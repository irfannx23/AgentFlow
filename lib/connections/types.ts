export const connectionProviders = ['openai', 'gemini', 'anthropic', 'deepseek'] as const

export type ConnectionProvider = (typeof connectionProviders)[number]
export type ConnectionStatus = 'connected' | 'invalid'

export type ConnectionSummary = {
  provider: ConnectionProvider
  status: ConnectionStatus
  createdAt: string
  updatedAt: string
  lastSuccessfulTestAt: string | null
}

export type ConnectionModel = {
  id: string
  provider: ConnectionProvider
  displayName: string
}

export function isConnectionProvider(value: unknown): value is ConnectionProvider {
  return typeof value === 'string' && connectionProviders.includes(value as ConnectionProvider)
}
