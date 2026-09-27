import type { Json } from '@/lib/supabase/types'

export type IntegrationAuthentication = 'none'|'oauth2'|'apiKey'|'basicAuth'|'bearer'|'webhook'|'database'|'ssh'
export type HttpMethod = 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'

export type IntegrationOperation = {
  id: string
  aliases: string[]
  resource?: string
  n8nOperation: string
  method?: HttpMethod
  endpoint?: string
  requiredParameters: string[]
  optionalParameters: string[]
  parameters: Record<string, Json>
  headers?: Record<string, Json>
  query?: Record<string, Json>
  body?: Record<string, Json>
  outputMapping?: Record<string, Json>
}

export type IntegrationClarification = {
  parameter: string
  question: string
  options?: string[]
}

export type IntegrationDefinition = {
  id: string
  name: string
  aliases: string[]
  supportedNodes: string[]
  n8nNodeType: string
  typeVersion: number
  authentication: IntegrationAuthentication
  credentialType?: string
  credentialName?: string
  operations: IntegrationOperation[]
  defaultHeaders: Record<string, Json>
  endpointTemplates: string[]
  bodyTemplates: Array<Record<string, Json>>
  expressionTemplates: Record<string, string>
  environmentVariables: string[]
  validationRules: string[]
  bestPractices: string[]
  knownLimitations: string[]
  clarifications: IntegrationClarification[]
  retry: { attempts: number; backoffSeconds: number }
  timeoutSeconds: number
}

export type IntegrationClarificationQuestion = {
  integrationId: string
  integrationName: string
  parameter: string
  question: string
  options?: string[]
}
