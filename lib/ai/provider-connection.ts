import { connectionFailure, providerHttpError, ProviderError, type ProviderConnectionResult } from '@/lib/ai/provider-errors'

export async function testProviderConnection(options: {
  provider: string
  endpoint: string
  headers: Record<string, string>
  method?: 'GET' | 'POST'
  body?: string
  validate?: (response: Response) => Promise<boolean>
}): Promise<ProviderConnectionResult> {
  try {
    const response = await fetch(options.endpoint, {
      method: options.method ?? 'GET', headers: options.headers,
      body: options.body, signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw providerHttpError(options.provider, response.status, await response.text())
    if (options.validate && !(await options.validate(response)))
      throw new ProviderError(options.provider, 'upstream', 'PROVIDER_EMPTY_TEST_RESPONSE', `${options.provider} returned an empty connection-test response.`)
    return { success: true, provider: options.provider }
  } catch (error) {
    return connectionFailure(options.provider, error)
  }
}
