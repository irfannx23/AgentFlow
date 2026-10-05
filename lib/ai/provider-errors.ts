export type ProviderErrorCategory =
  | 'authentication'
  | 'model'
  | 'endpoint'
  | 'rate_limit'
  | 'upstream'
  | 'timeout'
  | 'configuration'
  | 'network'
  | 'unknown'

export type ProviderConnectionResult = {
  success: boolean
  provider: string
  category?: ProviderErrorCategory
  userMessage?: string
  diagnosticCode?: string
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly category: ProviderErrorCategory,
    readonly diagnosticCode: string,
    userMessage: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(userMessage, options)
    this.name = 'ProviderError'
  }
}

function abortCategory(error: unknown): ProviderErrorCategory | null {
  if (!(error instanceof Error)) return null
  if (error.name === 'TimeoutError' || /timed? ?out|timeout/i.test(error.message)) return 'timeout'
  if (error.name === 'AbortError') return 'timeout'
  if (error instanceof TypeError || /fetch|network|dns|socket|connect/i.test(error.message)) return 'network'
  return null
}

export function normalizeProviderError(provider: string, error: unknown): ProviderError {
  if (error instanceof ProviderError) return error
  const category = abortCategory(error) ?? 'unknown'
  const code = category === 'timeout' ? 'PROVIDER_TIMEOUT' : category === 'network' ? 'PROVIDER_NETWORK_FAILURE' : 'PROVIDER_UNKNOWN_FAILURE'
  const message = category === 'timeout'
    ? `${provider} connection timed out. Please try again.`
    : category === 'network'
      ? `AgentFlow could not reach ${provider}. Check the endpoint and network connection.`
      : `${provider} returned an unexpected error.`
  return new ProviderError(provider, category, code, message, undefined, error instanceof Error ? { cause: error } : undefined)
}

export function providerHttpError(provider: string, status: number, body = ''): ProviderError {
  const normalized = body.slice(0, 4_000).toLowerCase()
  if (status === 401 || status === 403 || /api[_ ]?key.*(?:invalid|not valid|expired)|unauthenticated/.test(normalized))
    return new ProviderError(provider, 'authentication', 'PROVIDER_AUTHENTICATION_FAILED', 'The API key was rejected by the provider.', status)
  if (status === 404 || /model.*(?:not found|unsupported|unavailable)|unsupported.*model/.test(normalized))
    return new ProviderError(provider, 'model', 'PROVIDER_MODEL_UNAVAILABLE', 'The configured model is unavailable for this API key.', status)
  if (status === 429) return new ProviderError(provider, 'rate_limit', 'PROVIDER_RATE_LIMITED', 'The provider rate limit was reached. Please try again later.', status)
  if (status === 408 || status === 504) return new ProviderError(provider, 'timeout', 'PROVIDER_TIMEOUT', `${provider} connection timed out. Please try again.`, status)
  if (status === 400 && /(?:url|endpoint|host|path|version)/.test(normalized))
    return new ProviderError(provider, 'endpoint', 'PROVIDER_ENDPOINT_INVALID', 'The provider endpoint configuration is invalid.', status)
  if (status === 400)
    return new ProviderError(provider, 'configuration', 'PROVIDER_REQUEST_INVALID', 'The provider rejected the connection-test configuration.', status)
  if (status === 402)
    return new ProviderError(provider, 'upstream', 'PROVIDER_ACCOUNT_RESTRICTED', 'The provider account cannot run generation requests. Check its billing or quota.', status)
  if (status >= 500)
    return new ProviderError(provider, 'upstream', 'PROVIDER_UPSTREAM_UNAVAILABLE', `${provider} is temporarily unavailable. Please try again.`, status)
  return new ProviderError(provider, 'unknown', 'PROVIDER_REQUEST_FAILED', `${provider} rejected the request.`, status)
}

export function connectionFailure(provider: string, error: unknown): ProviderConnectionResult {
  const normalized = normalizeProviderError(provider, error)
  return {
    success: false,
    provider,
    category: normalized.category,
    userMessage: normalized.message,
    diagnosticCode: normalized.diagnosticCode,
  }
}
