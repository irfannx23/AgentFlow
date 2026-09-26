import type { AIGenerationRequest, AIGenerationResult, AIModelConfiguration, AIStreamEvent } from '@/lib/ai/types'

export interface AIProviderAdapter {
  readonly id: string
  readonly models: readonly AIModelConfiguration[]
  generate(request: AIGenerationRequest, credential: string): Promise<AIGenerationResult>
  stream(request: AIGenerationRequest, credential: string): AsyncIterable<AIStreamEvent>
  testConnection(credential: string): Promise<boolean>
  embed(texts: string[], credential: string): Promise<number[][]>
  extractText(data: string, mimeType: string, credential: string): Promise<string>
}
