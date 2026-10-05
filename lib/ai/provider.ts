import type { AIGenerationRequest, AIGenerationResult, AIModelConfiguration, AIStreamEvent } from '@/lib/ai/types'
import type { ProviderConnectionResult } from '@/lib/ai/provider-errors'

export interface AIProviderAdapter {
  readonly id: string
  readonly models: readonly AIModelConfiguration[]
  generate(request: AIGenerationRequest, credential: string): Promise<AIGenerationResult>
  stream(request: AIGenerationRequest, credential: string): AsyncIterable<AIStreamEvent>
  testConnection(credential: string): Promise<ProviderConnectionResult>
  embed(texts: string[], credential: string): Promise<number[][]>
  extractText(data: string, mimeType: string, credential: string): Promise<string>
}
