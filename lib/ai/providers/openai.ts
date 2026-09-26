import 'server-only'

import { OpenAICompatibleProvider } from '@/lib/ai/providers/openai-compatible'

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      id: 'openai',
      apiRoot: 'https://api.openai.com/v1',
      maxTokensField: 'max_completion_tokens',
      embeddingModel: 'text-embedding-3-small',
      imageModel: 'gpt-5-mini',
      models: [
        { id: 'gpt-5', provider: 'openai', displayName: 'GPT-5', contextWindow: 400_000, maxOutputTokens: 128_000, streaming: true },
        { id: 'gpt-5-mini', provider: 'openai', displayName: 'GPT-5 Mini', contextWindow: 400_000, maxOutputTokens: 128_000, streaming: true },
      ],
    })
  }
}
