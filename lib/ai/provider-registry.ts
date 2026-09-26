import 'server-only'

import type { AIProviderAdapter } from '@/lib/ai/provider'
import { AnthropicProvider } from '@/lib/ai/providers/anthropic'
import { DeepSeekProvider } from '@/lib/ai/providers/deepseek'
import { GeminiProvider } from '@/lib/ai/providers/gemini'
import { OpenAIProvider } from '@/lib/ai/providers/openai'
import type { ConnectionModel, ConnectionProvider } from '@/lib/connections/types'

const providers = new Map<string, AIProviderAdapter>([
  ['openai', new OpenAIProvider()],
  ['gemini', new GeminiProvider()],
  ['anthropic', new AnthropicProvider()],
  ['deepseek', new DeepSeekProvider()],
])

export function getAIProvider(providerId = 'gemini') {
  const provider = providers.get(providerId)
  if (!provider) throw new Error('The requested AI provider is not enabled.')
  return provider
}

export function getDefaultAIModel(providerId = 'gemini') {
  const provider = getAIProvider(providerId)
  const model = provider.models[0]
  if (!model) throw new Error('The requested AI provider has no configured models.')
  return model
}

export function listAIModels(): ConnectionModel[] {
  return [...providers.values()].flatMap(provider => provider.models.map(model => ({ id: model.id, provider: provider.id as ConnectionProvider, displayName: model.displayName })))
}
