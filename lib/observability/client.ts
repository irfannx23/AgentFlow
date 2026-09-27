type ClientLifecycleEvent = {
  requestId: string
  stage: string
  event: string
  projectId?: string
  status?: 'started' | 'completed' | 'failed' | 'scheduled'
  error?: unknown
  context?: Record<string, unknown>
}

function clientError(value: unknown) {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return {
      name: typeof record.name === 'string' ? record.name : 'NonErrorException',
      message: typeof record.message === 'string' ? record.message : String(value),
      code: record.code,
      details: record.details,
      hint: record.hint,
      stack: typeof record.stack === 'string' ? record.stack : new Error('Client lifecycle failure').stack,
    }
  }
  return { name: 'NonErrorException', message: String(value), stack: new Error('Client lifecycle failure').stack }
}

export function newLifecycleRequestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export async function reportClientLifecycle(token: string, value: ClientLifecycleEvent) {
  try {
    await fetch('/api/intelligence/diagnostics', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-request-id': value.requestId },
      body: JSON.stringify({ ...value, error: value.error === undefined ? undefined : clientError(value.error) }),
      keepalive: true,
    })
  } catch {
    // Diagnostics must never alter the product flow.
  }
}
