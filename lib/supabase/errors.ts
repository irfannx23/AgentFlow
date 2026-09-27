type SupabaseErrorShape = {
  message?: unknown
  code?: unknown
}

export function supabaseError(value: unknown, fallback = 'The database request failed.'): Error {
  if (value instanceof Error) return value

  const record = value && typeof value === 'object' ? value as SupabaseErrorShape : null
  const message = typeof record?.message === 'string' && record.message.trim()
    ? record.message
    : fallback
  const error = new Error(message, { cause: value })
  error.name = 'SupabaseError'
  if (record && typeof record.code === 'string') {
    Object.defineProperty(error, 'code', { value: record.code, enumerable: true })
  }
  return error
}
