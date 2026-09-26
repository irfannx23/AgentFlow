import 'server-only'

import type { AIProviderAdapter } from '@/lib/ai/provider'
import type { AIGenerationRequest, AIGenerationResult, AIStreamEvent, AIUsage } from '@/lib/ai/types'

const API_ROOT = 'https://api.anthropic.com/v1'
const MODEL = { id: 'claude-sonnet-5', provider: 'anthropic', displayName: 'Claude Sonnet', contextWindow: 1_000_000, maxOutputTokens: 64_000, streaming: true } as const

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>
  stop_reason?: string
  usage?: { input_tokens?: number; output_tokens?: number }
}

function usage(value?: AnthropicResponse['usage']): AIUsage | undefined {
  if (!value) return undefined
  return { inputTokens: value.input_tokens, outputTokens: value.output_tokens, totalTokens: (value.input_tokens ?? 0) + (value.output_tokens ?? 0) }
}

function safeMessage(status: number, body: string) {
  void body
  if (status === 401 || status === 403) return 'Invalid API Key'
  if (status === 404) return 'Model unavailable'
  if (status === 429) return 'Rate limit exceeded'
  if (status === 408) return 'Anthropic request timed out. Please try again.'
  if (status >= 500) return 'Anthropic is temporarily unavailable. Please try again.'
  return `Anthropic request failed with status ${status}.`
}

export class AnthropicProvider implements AIProviderAdapter {
  readonly id = 'anthropic'
  readonly models = [MODEL] as const

  private async request(path: string, credential: string, init: RequestInit = {}) {
    const response=await fetch(`${API_ROOT}${path}`,{...init,headers:{'content-type':'application/json','x-api-key':credential,'anthropic-version':'2023-06-01',...init.headers},signal:init.signal??AbortSignal.timeout(60_000)})
    if(!response.ok)throw new Error(safeMessage(response.status,await response.text()))
    return response
  }

  private body(request:AIGenerationRequest,stream:boolean){
    if(request.model!==MODEL.id)throw new Error('The requested AI model is not enabled.')
    return {model:request.model,system:request.systemInstruction,messages:request.messages.map(message=>({role:message.role==='model'?'assistant':'user',content:message.content})),max_tokens:request.maxOutputTokens??8192,stream,...(request.temperature!==undefined?{temperature:request.temperature}:{})}
  }

  async generate(request:AIGenerationRequest,credential:string):Promise<AIGenerationResult>{
    const payload=await (await this.request('/messages',credential,{method:'POST',body:JSON.stringify(this.body(request,false)),signal:request.signal})).json() as AnthropicResponse
    return {text:payload.content?.filter(block=>block.type==='text').map(block=>block.text??'').join('')??'',model:request.model,finishReason:payload.stop_reason,usage:usage(payload.usage)}
  }

  async *stream(request:AIGenerationRequest,credential:string):AsyncIterable<AIStreamEvent>{
    const response=await this.request('/messages',credential,{method:'POST',body:JSON.stringify(this.body(request,true)),signal:request.signal})
    if(!response.body)throw new Error('Anthropic returned no response stream.')
    const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();let buffer='';let inputTokens=0;let outputTokens=0;let finishReason:string|undefined
    try{while(true){const{value,done}=await reader.read();if(done)break;buffer+=value;const blocks=buffer.split(/\r?\n\r?\n/);buffer=blocks.pop()??'';for(const block of blocks){const data=block.split(/\r?\n/).find(line=>line.startsWith('data:'))?.slice(5).trim();if(!data)continue;const event=JSON.parse(data) as {type?:string;delta?:{type?:string;text?:string;stop_reason?:string};message?:AnthropicResponse;usage?:{output_tokens?:number}};if(event.type==='content_block_delta'&&event.delta?.type==='text_delta'&&event.delta.text)yield{type:'text',text:event.delta.text};if(event.type==='message_start')inputTokens=event.message?.usage?.input_tokens??0;if(event.type==='message_delta'){outputTokens=event.usage?.output_tokens??outputTokens;finishReason=event.delta?.stop_reason??finishReason}}}yield{type:'usage',usage:{inputTokens,outputTokens,totalTokens:inputTokens+outputTokens}};yield{type:'done',finishReason}}finally{reader.releaseLock()}
  }

  async testConnection(credential:string){try{await this.request('/models?limit=1',credential,{method:'GET',signal:AbortSignal.timeout(15_000)});return true}catch(error){if(error instanceof Error&&error.message==='Invalid API Key')return false;throw error}}
  async embed(texts:string[],credential:string):Promise<number[][]>{void texts;void credential;throw new Error('Anthropic does not provide the embedding model used by this knowledge index.')}
  async extractText(data:string,mimeType:string,credential:string):Promise<string>{void data;void mimeType;void credential;throw new Error('Anthropic image text extraction is not enabled.')}
}
