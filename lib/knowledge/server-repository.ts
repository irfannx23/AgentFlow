import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json, Tables } from '@/lib/supabase/types'

type Client = SupabaseClient<Database>

export async function getKnowledgeDocument(client: Client, id: string) {
  const result = await client.from('knowledge_documents').select('*').eq('id', id).single()
  if (result.error) throw result.error
  return result.data
}

export async function downloadKnowledgeDocument(client: Client, path: string) {
  const result = await client.storage.from('project-documents').download(path)
  if (result.error) throw result.error
  return new Uint8Array(await result.data.arrayBuffer())
}

export async function setDocumentProcessing(client: Client, id: string) {
  const result = await client.from('knowledge_documents').update({ status: 'processing', processing_error: null }).eq('id', id)
  if (result.error) throw result.error
}

export async function finishDocumentProcessing(client: Client, document: Tables<'knowledge_documents'>, hash: string, chunks: Array<{ content: string; embedding: number[]; metadata: Json }>) {
  const removed = await client.from('knowledge_chunks').delete().eq('document_id', document.id)
  if (removed.error) throw removed.error
  const inserted = await client.from('knowledge_chunks').insert(chunks.map((chunk, index) => ({
    document_id: document.id,
    project_id: document.project_id,
    owner_id: document.owner_id,
    chunk_index: index,
    content: chunk.content,
    token_count: Math.ceil(chunk.content.length / 4),
    embedding: `[${chunk.embedding.join(',')}]`,
    metadata: chunk.metadata,
  })))
  if (inserted.error) throw inserted.error
  const updated = await client.from('knowledge_documents').update({ status: 'ready', content_hash: hash, processed_at: new Date().toISOString(), processing_error: null, version: document.version + (document.content_hash ? 1 : 0) }).eq('id', document.id)
  if (updated.error) throw updated.error
}

export async function failDocumentProcessing(client: Client, id: string, error: string) {
  await client.from('knowledge_documents').update({ status: 'failed', processing_error: error.slice(0, 2000) }).eq('id', id)
}
