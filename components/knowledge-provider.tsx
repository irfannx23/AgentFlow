'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/account-state'
import {
  createDocumentDownloadUrl,
  deleteKnowledgeDocument,
  listKnowledgeChunks,
  listKnowledgeDocuments,
  updateKnowledgeDocument,
  uploadKnowledgeDocument,
} from '@/lib/supabase/intelligence'
import type { Json, Tables, TablesUpdate } from '@/lib/supabase/types'

type KnowledgeState = {
  projectId: string | null
  documents: Tables<'knowledge_documents'>[]
  chunks: Tables<'knowledge_chunks'>[]
  loading: boolean
  error: string | null
  loadProjectKnowledge: (projectId: string) => Promise<void>
  uploadDocument: (projectId: string, file: File, metadata?: Json) => Promise<Tables<'knowledge_documents'>>
  updateDocument: (id: string, values: TablesUpdate<'knowledge_documents'>) => Promise<Tables<'knowledge_documents'>>
  removeDocument: (document: Tables<'knowledge_documents'>) => Promise<void>
  getDownloadUrl: (storagePath: string, expiresIn?: number) => Promise<string>
  processDocument: (documentId: string) => Promise<void>
}

const KnowledgeContext = createContext<KnowledgeState | null>(null)

export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Tables<'knowledge_documents'>[]>([])
  const [chunks, setChunks] = useState<Tables<'knowledge_chunks'>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestGeneration = useRef(0)

  useEffect(() => {
    if (user) return
    requestGeneration.current += 1
    setProjectId(null)
    setDocuments([])
    setChunks([])
    setLoading(false)
    setError(null)
  }, [user])

  const loadProjectKnowledge = useCallback(async (nextProjectId: string) => {
    const generation = ++requestGeneration.current
    setLoading(true)
    setError(null)
    setProjectId(nextProjectId)
    setDocuments([])
    setChunks([])
    try {
      const [nextDocuments, nextChunks] = await Promise.all([listKnowledgeDocuments(nextProjectId), listKnowledgeChunks(nextProjectId)])
      if (generation !== requestGeneration.current) return
      setDocuments(nextDocuments)
      setChunks(nextChunks)
    } catch (loadError) {
      if (generation === requestGeneration.current) setError(loadError instanceof Error ? loadError.message : 'Unable to load automation knowledge.')
      throw loadError
    } finally {
      if (generation === requestGeneration.current) setLoading(false)
    }
  }, [])

  const uploadDocument = useCallback(async (nextProjectId: string, file: File, metadata: Json = {}) => {
    if (!user) throw new Error('Sign in to upload automation requirements.')
    const document = await uploadKnowledgeDocument(nextProjectId, user.uid, file, metadata)
    if (projectId === nextProjectId) setDocuments(current => [document, ...current])
    void processDocumentRequest(user, document.id).then(() => loadProjectKnowledge(nextProjectId)).catch(() => loadProjectKnowledge(nextProjectId))
    return document
  }, [loadProjectKnowledge, projectId, user])

  const processDocument = useCallback(async (documentId: string) => {
    if (!user) throw new Error('Sign in to process automation requirements.')
    setDocuments(current => current.map(item => item.id === documentId ? { ...item, status: 'processing', processing_error: null } : item))
    await processDocumentRequest(user, documentId)
    if (projectId) await loadProjectKnowledge(projectId)
  }, [loadProjectKnowledge, projectId, user])

  const updateDocument = useCallback(async (id: string, values: TablesUpdate<'knowledge_documents'>) => {
    const document = await updateKnowledgeDocument(id, values)
    setDocuments(current => current.map(item => item.id === id ? document : item))
    return document
  }, [])

  const removeDocument = useCallback(async (document: Tables<'knowledge_documents'>) => {
    await deleteKnowledgeDocument(document)
    setDocuments(current => current.filter(item => item.id !== document.id))
    setChunks(current => current.filter(chunk => chunk.document_id !== document.id))
  }, [])

  const value = useMemo(() => ({ projectId, documents, chunks, loading, error, loadProjectKnowledge, uploadDocument, updateDocument, removeDocument, getDownloadUrl: createDocumentDownloadUrl, processDocument }), [projectId, documents, chunks, loading, error, loadProjectKnowledge, uploadDocument, updateDocument, removeDocument, processDocument])
  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>
}

async function processDocumentRequest(user: NonNullable<ReturnType<typeof useAuth>['user']>, documentId: string) {
  const response = await fetch('/api/knowledge/process', { method: 'POST', headers: { authorization: `Bearer ${await user.getIdToken()}`, 'content-type': 'application/json' }, body: JSON.stringify({ documentId }) })
  const payload = await response.json() as { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Document processing failed.')
}

export function useKnowledge() {
  const state = useContext(KnowledgeContext)
  if (!state) throw new Error('useKnowledge must be used within KnowledgeProvider')
  return state
}
