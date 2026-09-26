import 'server-only'

import type { AIProviderAdapter } from '@/lib/ai/provider'
import type { AIGenerationRequest, AIGenerationResult, AIModelConfiguration, AIStreamEvent, AIUsage } from '@/lib/ai/types'

type ChatResponse = {
  choices?: Array<{ message?: { content?: string }; delta?: { content?: string }; finish_reason?: string }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

type CompatibleOptions = {
  id: string
  apiRoot: string
  models: readonly AIModelConfiguration[]
  maxTokensField: 'max_tokens' | 'max_completion_tokens'
  embeddingModel?: string
  imageModel?: string
  requestExtras?: (model: string) => Record<string, unknown>
}

function usage(value?: ChatResponse['usage']): AIUsage | undefined {
  if (!value) return undefined
  return { inputTokens: value.prompt_tokens, outputTokens: value.completion_tokens, totalTokens: value.total_tokens }
}

function errorMessage(provider: string, status: number, body: string) {
  void body
  if (status === 401 || status === 403) return 'Invalid API Key'
  if (status === 404) return 'Model unavailable'
  if (status === 429) return 'Rate limit exceeded'
  if (status === 408) return `${provider} request timed out. Please try again.`
  if (status >= 500) return `${provider} is temporarily unavailable. Please try again.`
  return `${provider} request failed with status ${status}.`
}

function signal(value?: AbortSignal, timeout = 60_000) {
  const deadline = AbortSignal.timeout(timeout)
  return value ? AbortSignal.any([value, deadline]) : deadline
}

function messages(request: AIGenerationRequest) {
  return [
    ...(request.systemInstruction ? [{ role: 'system', content: request.systemInstruction }] : []),
    ...request.messages.map(message => ({ role: message.role === 'model' ? 'assistant' : 'user', content: message.content })),
  ]
}

function eventPayload(block: string) {
  const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('')
  if (!data || data === '[DONE]') return null
  return JSON.parse(data) as ChatResponse
}

export class OpenAICompatibleProvider implements AIProviderAdapter {
  readonly id: string
  readonly models: readonly AIModelConfiguration[]
  private readonly options: CompatibleOptions

  constructor(options: CompatibleOptions) {
    this.id = options.id
    this.models = options.models
    this.options = options
  }

  private ensureModel(model: string) {
    if (!this.models.some(candidate => candidate.id === model)) throw new Error('The requested AI model is not enabled.')
  }

  private body(request: AIGenerationRequest, stream: boolean) {
    return {
      model: request.model,
      messages: messages(request),
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.maxOutputTokens !== undefined ? { [this.options.maxTokensField]: request.maxOutputTokens } : {}),
      ...(this.options.requestExtras?.(request.model) ?? {}),
    }
  }

  private async request(path: string, credential: string, init: RequestInit = {}) {
    const response = await fetch(`${this.options.apiRoot}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}`, ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(60_000),
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(errorMessage(this.id, response.status, body))
    }
    return response
  }

  async generate(request: AIGenerationRequest, credential: string): Promise<AIGenerationResult> {
    this.ensureModel(request.model)
    const response = await this.request('/chat/completions', credential, { method: 'POST', body: JSON.stringify(this.body(request, false)), signal: signal(request.signal) })
    const payload = await response.json() as ChatResponse
    return { text: payload.choices?.[0]?.message?.content ?? '', model: request.model, finishReason: payload.choices?.[0]?.finish_reason, usage: usage(payload.usage) }
  }

  async *stream(request: AIGenerationRequest, credential: string): AsyncIterable<AIStreamEvent> {
    this.ensureModel(request.model)
    const response = await this.request('/chat/completions', credential, { method: 'POST', body: JSON.stringify(this.body(request, true)), signal: signal(request.signal) })
    if (!response.body) throw new Error(`${this.id} returned no response stream.`)
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
          const payload = eventPayload(block)
          if (!payload) continue
          const text = payload.choices?.[0]?.delta?.content
          if (text) yield { type: 'text', text }
          const nextUsage = usage(payload.usage)
          if (nextUsage) yield { type: 'usage', usage: nextUsage }
          finishReason = payload.choices?.[0]?.finish_reason ?? finishReason
        }
      }
      yield { type: 'done', finishReason }
    } finally {
      reader.releaseLock()
    }
  }

  async testConnection(credential: string) {
    try {
      await this.request('/models', credential, { method: 'GET', signal: AbortSignal.timeout(15_000) })
      return true
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid API Key') return false
      throw error
    }
  }

  async embed(texts: string[], credential: string) {
    if (!texts.length) return []
    if (!this.options.embeddingModel) throw new Error(`${this.id} does not provide the embedding model used by this knowledge index.`)
    const response = await this.request('/embeddings', credential, { method: 'POST', body: JSON.stringify({ model: this.options.embeddingModel, input: texts, dimensions: 768 }) })
    const payload = await response.json() as { data?: Array<{ embedding?: number[]; index?: number }> }
    const embeddings = [...(payload.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(item => item.embedding ?? [])
    if (embeddings.length !== texts.length || embeddings.some(item => item.length !== 768)) throw new Error(`${this.id} returned invalid embeddings.`)
    return embeddings
  }

  async extractText(data: string, mimeType: string, credential: string) {
    const model = this.options.imageModel
    if (!model) throw new Error(`${this.id} image text extraction is not enabled.`)
    const response = await this.request('/chat/completions', credential, { method: 'POST', body: JSON.stringify({ model, messages: [{ role: 'user', content: [{ type: 'text', text: 'Extract all readable text from this image. Preserve headings and structure. Return only the extracted text.' }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } }] }], [this.options.maxTokensField]: 4096 }) })
    return ((await response.json() as ChatResponse).choices?.[0]?.message?.content ?? '')
  }
}
