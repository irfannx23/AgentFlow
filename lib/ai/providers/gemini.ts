import 'server-only'

import type { AIProviderAdapter } from '@/lib/ai/provider'
import { connectionFailure, normalizeProviderError, providerHttpError, ProviderError, type ProviderConnectionResult } from '@/lib/ai/provider-errors'
import { testProviderConnection } from '@/lib/ai/provider-connection'
import type { AIGenerationRequest, AIGenerationResult, AIStreamEvent, AIUsage } from '@/lib/ai/types'

const DEFAULT_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-3.6-flash'
const REQUEST_TIMEOUT_MS = 60_000
const EMBEDDING_MODEL = 'gemini-embedding-001'

type GeminiUsage = {
  promptTokenCount?: number
  candidatesTokenCount?: number
  totalTokenCount?: number
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  usageMetadata?: GeminiUsage
}

function configuredModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL
}

export function configuredGeminiApiRoot() {
  const configured = process.env.GEMINI_ENDPOINT?.trim() || DEFAULT_API_ROOT
  let url: URL
  try { url = new URL(configured) } catch (error) {
    throw new ProviderError('gemini', 'endpoint', 'GEMINI_ENDPOINT_INVALID', 'The Gemini endpoint is not a valid HTTPS URL.', undefined, { cause: error })
  }
  if (url.protocol !== 'https:') throw new ProviderError('gemini', 'endpoint', 'GEMINI_ENDPOINT_INVALID', 'The Gemini endpoint must use HTTPS.')
  const path = url.pathname.replace(/\/+$/, '')
  url.pathname = path.endsWith('/models') ? path : `${path}/models`
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

function usage(metadata?: GeminiUsage): AIUsage | undefined {
  if (!metadata) return undefined
  return {
    inputTokens: metadata.promptTokenCount,
    outputTokens: metadata.candidatesTokenCount,
    totalTokens: metadata.totalTokenCount,
  }
}

function responseText(response: GeminiResponse) {
  return response.candidates?.flatMap(candidate => candidate.content?.parts ?? []).map(part => part.text ?? '').join('') ?? ''
}

function requestBody(request: AIGenerationRequest) {
  return {
    ...(request.systemInstruction ? { systemInstruction: { parts: [{ text: request.systemInstruction }] } } : {}),
    contents: request.messages.map(message => ({ role: message.role, parts: [{ text: message.content }] })),
    generationConfig: {
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.maxOutputTokens !== undefined ? { maxOutputTokens: request.maxOutputTokens } : {}),
    },
  }
}

function requestSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

async function responseErrorBody(response: Response) {
  return response.ok ? null : response.clone().text()
}

async function geminiFetch(request: AIGenerationRequest, streaming: boolean, credential: string) {
  if (request.model !== configuredModel()) throw new ProviderError('gemini', 'model', 'PROVIDER_MODEL_NOT_CONFIGURED', 'The requested AI model is not enabled.')
  const operation = streaming ? 'streamGenerateContent?alt=sse' : 'generateContent'
  const endpoint = `${configuredGeminiApiRoot()}/${encodeURIComponent(request.model)}:${operation}`
  let response: Response
  try {
    response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': credential }, body: JSON.stringify(requestBody(request)), signal: requestSignal(request.signal) })
  } catch (error) { throw normalizeProviderError('gemini', error) }
  const errorBody = await responseErrorBody(response)
  if (!response.ok) throw providerHttpError('gemini', response.status, errorBody ?? '')
  return response
}

function parseEvent(block: string): GeminiResponse | null {
  const payload = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('')
  if (!payload || payload === '[DONE]') return null
  return JSON.parse(payload) as GeminiResponse
}

export class GeminiProvider implements AIProviderAdapter {
  readonly id = 'gemini'

  get models() {
    const model = configuredModel()
    return [{
      id: model,
      provider: this.id,
      displayName: model === DEFAULT_MODEL ? 'Gemini 3.6 Flash' : model,
      contextWindow: 1_048_576,
      maxOutputTokens: 65_536,
      streaming: true,
    }] as const
  }

  async generate(request: AIGenerationRequest, credential: string): Promise<AIGenerationResult> {
    const response = await geminiFetch(request, false, credential)
    const payload = await response.json() as GeminiResponse
    return {
      text: responseText(payload),
      model: request.model,
      finishReason: payload.candidates?.[0]?.finishReason,
      usage: usage(payload.usageMetadata),
    }
  }

  async *stream(request: AIGenerationRequest, credential: string): AsyncIterable<AIStreamEvent> {
    const response = await geminiFetch(request, true, credential)
    if (!response.body) throw new Error('Gemini returned no response stream.')
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    let finishReason: string | undefined
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        const blocks = buffer.split(/\r?\n\r?\n/)
        buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          const payload = parseEvent(block)
          if (!payload) continue
          const text = responseText(payload)
          if (text) yield { type: 'text', text }
          const nextUsage = usage(payload.usageMetadata)
          if (nextUsage) yield { type: 'usage', usage: nextUsage }
          finishReason = payload.candidates?.[0]?.finishReason ?? finishReason
        }
      }
      if (buffer.trim()) {
        const payload = parseEvent(buffer)
        if (payload) {
          const text = responseText(payload)
          if (text) yield { type: 'text', text }
          const nextUsage = usage(payload.usageMetadata)
          if (nextUsage) yield { type: 'usage', usage: nextUsage }
          finishReason = payload.candidates?.[0]?.finishReason ?? finishReason
        }
      }
      yield { type: 'done', finishReason }
    } finally {
      reader.releaseLock()
    }
  }

  async testConnection(credential: string): Promise<ProviderConnectionResult> {
    let endpoint: string
    try { endpoint = `${configuredGeminiApiRoot()}/${encodeURIComponent(configuredModel())}:generateContent` }
    catch (error) { return connectionFailure('gemini', error) }
    return testProviderConnection({
      provider: 'gemini', endpoint, method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': credential },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply OK.' }] }], generationConfig: { maxOutputTokens: 8 } }),
    })
  }

  async embed(texts: string[], credential: string) {
    if (!texts.length) return []
    const endpoint = `${configuredGeminiApiRoot()}/${EMBEDDING_MODEL}:batchEmbedContents`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': credential },
      body: JSON.stringify({ requests: texts.map(text => ({ model: `models/${EMBEDDING_MODEL}`, content: { parts: [{ text }] }, outputDimensionality: 768 })) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const errorBody = await responseErrorBody(response)
    if (!response.ok) throw providerHttpError('gemini', response.status, errorBody ?? '')
    const payload = await response.json() as { embeddings?: Array<{ values?: number[] }> }
    const embeddings = payload.embeddings?.map(item => item.values ?? []) ?? []
    if (embeddings.length !== texts.length || embeddings.some(item => item.length !== 768)) throw new Error('Gemini returned invalid embeddings.')
    return embeddings
  }

  async extractText(data: string, mimeType: string, credential: string) {
    const model = configuredModel()
    const endpoint = `${configuredGeminiApiRoot()}/${encodeURIComponent(model)}:generateContent`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': credential },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Extract all readable text from this image. Preserve headings and structure. Return only the extracted text.' }, { inlineData: { mimeType, data } }] }] }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const errorBody = await responseErrorBody(response)
    if (!response.ok) throw providerHttpError('gemini', response.status, errorBody ?? '')
    return responseText(await response.json() as GeminiResponse)
  }
}
