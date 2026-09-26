import { NextResponse } from 'next/server'
import { getAIProvider } from '@/lib/ai/provider-registry'
import { authenticatedUserId, loadCredential } from '@/lib/connections/repository'
import { chunkDocument, documentHash, extractDocumentText, validateDocument } from '@/lib/knowledge/processing'
import { downloadKnowledgeDocument, failDocumentProcessing, finishDocumentProcessing, getKnowledgeDocument, setDocumentProcessing } from '@/lib/knowledge/server-repository'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function bearerToken(request: Request) {
  const header = request.headers.get('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7).trim() || null : null
}

function publicDocumentError(value: unknown) {
  const message = value instanceof Error ? value.message : ''
  return /^(Document must be|Unsupported document type|No readable text was found|Invalid API Key|Model unavailable|Rate limit exceeded|Connect Google Gemini)/.test(message) ? message : 'Document processing failed. Please try again.'
}

export async function POST(request: Request) {
  const token = bearerToken(request)
  if (!token) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
  const client = createServerSupabaseClient(token)
  let documentId = ''
  try {
    const body = await request.json() as { documentId?: unknown }
    documentId = typeof body.documentId === 'string' ? body.documentId : ''
    if (!documentId) return NextResponse.json({ error: 'documentId is required.' }, { status: 400 })
    const ownerId = await authenticatedUserId(client)
    const document = await getKnowledgeDocument(client, documentId)
    validateDocument(document.file_name, document.mime_type, document.size_bytes)
    await setDocumentProcessing(client, document.id)
    const project = await client.from('projects').select('organization_id').eq('id', document.project_id).single()
    if (project.error) throw project.error
    const credential = await loadCredential(client, ownerId, 'gemini', project.data.organization_id)
    const provider = getAIProvider('gemini')
    const bytes = await downloadKnowledgeDocument(client, document.storage_path)
    const hash = documentHash(bytes)
    const texts = chunkDocument(await extractDocumentText(document.file_name, document.mime_type, bytes, provider, credential))
    const embeddings: number[][] = []
    for (let index = 0; index < texts.length; index += 20) embeddings.push(...await provider.embed(texts.slice(index, index + 20), credential))
    const nextVersion = document.version + (document.content_hash ? 1 : 0)
    await finishDocumentProcessing(client, document, hash, texts.map((content, index) => ({ content, embedding: embeddings[index], metadata: { fileName: document.file_name, documentVersion: nextVersion, chunkIndex: index } })))
    return NextResponse.json({ documentId, status: 'ready', chunks: texts.length })
  } catch (error) {
    const message = publicDocumentError(error)
    if (documentId) await failDocumentProcessing(client, documentId, message)
    console.error('Knowledge processing failed.', { type: error instanceof Error ? error.name : 'UnknownError' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
