export type AIMessageRole = 'user' | 'model'

export type AIMessage = {
  role: AIMessageRole
  content: string
}

export type AIModelConfiguration = {
  id: string
  provider: string
  displayName: string
  contextWindow: number
  maxOutputTokens: number
  streaming: boolean
}

export type AIGenerationRequest = {
  model: string
  messages: AIMessage[]
  systemInstruction?: string
  temperature?: number
  maxOutputTokens?: number
  signal?: AbortSignal
}

export type AIUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type AIGenerationResult = {
  text: string
  model: string
  finishReason?: string
  usage?: AIUsage
}

export type AIStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'usage'; usage: AIUsage }
  | { type: 'done'; finishReason?: string }
