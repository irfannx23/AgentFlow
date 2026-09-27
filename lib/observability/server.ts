import 'server-only'

import { randomUUID } from 'node:crypto'

type LogLevel = 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown>

const REDACTED_KEY = /authorization|cookie|credential|password|secret|token|api[-_]?key|encrypted/i

function safeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[MAX_DEPTH]'
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value
  if (Array.isArray(value)) return value.slice(0, 20).map(item => safeValue(item, depth + 1))
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.entries(record).slice(0, 30).map(([key, item]) => [key, REDACTED_KEY.test(key) ? '[REDACTED]' : safeValue(item, depth + 1)]))
  }
  return String(value)
}

function sourceLocation(stack: string | undefined) {
  if (!stack) return null
  for (const line of stack.split('\n').slice(1)) {
    const match = line.match(/(?:file:\/\/)?([^()\s]+):(\d+):(\d+)/)
    if (match && !match[1].includes('lib/observability/server')) {
      return { file: match[1], line: Number(match[2]), column: Number(match[3]) }
    }
  }
  return null
}

export function errorMetadata(value: unknown) {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : null
  const message = value instanceof Error ? value.message : typeof record?.message === 'string' ? record.message : String(value)
  const stack = value instanceof Error ? value.stack : typeof record?.stack === 'string' ? record.stack : undefined
  return {
    name: value instanceof Error ? value.name : typeof record?.name === 'string' ? record.name : 'NonErrorException',
    message,
    stack: stack ?? null,
    source: sourceLocation(stack),
    originalException: value instanceof Error
      ? { name: value.name, message: value.message, stack: value.stack ?? null, cause: safeValue(value.cause) }
      : safeValue(value),
  }
}

export function requestId(request: Request) {
  const candidate = request.headers.get('x-request-id')?.trim()
  return candidate && /^[a-zA-Z0-9_-]{8,100}$/.test(candidate) ? candidate : randomUUID()
}

export function newErrorId() {
  return `err_${randomUUID()}`
}

export function missingEnvironmentVariables(names: readonly string[]) {
  return names.filter(name => !process.env[name]?.trim())
}

export function logLifecycle(level: LogLevel, event: string, values: {
  requestId: string
  stage: string
  elapsedMs?: number
  errorId?: string
  error?: unknown
  missingEnvironmentVariables?: string[]
  context?: LogContext
}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'agentflow',
    event,
    stage: values.stage,
    elapsedMs: values.elapsedMs ?? null,
    requestId: values.requestId,
    errorId: values.errorId ?? null,
    missingEnvironmentVariables: values.missingEnvironmentVariables ?? [],
    context: safeValue(values.context ?? {}),
    ...(values.error === undefined ? {} : { exception: errorMetadata(values.error) }),
  }
  const serialized = JSON.stringify(entry)
  if (level === 'error') console.error(serialized)
  else if (level === 'warn') console.warn(serialized)
  else console.info(serialized)
}
