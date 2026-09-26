import 'server-only'

import { OpenAICompatibleProvider } from '@/lib/ai/providers/openai-compatible'

export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      id: 'deepseek',
      apiRoot: 'https://api.deepseek.com',
      maxTokensField: 'max_tokens',
      requestExtras: model => model === 'deepseek-v4-pro' ? { thinking: { type: 'enabled' }, reasoning_effort: 'high' } : { thinking: { type: 'disabled' } },
      models: [
        { id: 'deepseek-flash', provider: 'deepseek', displayName: 'DeepSeek Chat', contextWindow: 1_048_576, maxOutputTokens: 65_536, streaming: true },
        { id: 'deepseek-v4-pro', provider: 'deepseek', displayName: 'DeepSeek Reasoner', contextWindow: 1_048_576, maxOutputTokens: 131_072, streaming: true },
      ],
    })
  }
}
