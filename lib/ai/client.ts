export type AICitation = {
  id: number
  documentId: string
  fileName: string
  version: number
  chunkIndex: number
  score?: number
}

export type AIStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'citations'; citations: AICitation[] }
  | { type: 'usage'; usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }
  | { type: 'error'; error: string; errorId?: string; requestId?: string }
  | { type: string; [key: string]: unknown }

type StreamRequest = {
  token: string
  requestId?: string
  body: Record<string, unknown>
  onEvent: (event: AIStreamEvent) => void
}

function errorMessage(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return errorMessage(record.error ?? record.message ?? record.details)
  }
  return 'Unable to start conversation.'
}

export async function streamAIResponse({ token, requestId, body, onEvent }: StreamRequest) {
  const response = await fetch('/api/intelligence/generate', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(requestId ? { 'x-request-id': requestId } : {}) },
    body: JSON.stringify({ ...body, stream: true }),
  })
  if (!response.ok) {
    const raw = await response.text()
    let payload: unknown = raw
    try { payload = JSON.parse(raw) as unknown } catch { /* keep the raw response */ }
    throw new Error(errorMessage(payload))
  }
  if (!response.body) throw new Error('The AI response stream is unavailable.')

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      const line = block.split(/\r?\n/).find(value => value.startsWith('data:'))
      if (!line) continue
      const event = JSON.parse(line.slice(5)) as AIStreamEvent
      if (event.type === 'error') throw new Error(typeof event.error === 'string' ? event.error : 'Generation failed.')
      onEvent(event)
    }
  }
}
