'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/account-state'
import { createConversation, createMessage, deleteConversation, listConversations, listMessages, updateConversation } from '@/lib/supabase/intelligence'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'
import { dispatchAgentFlowEvent } from '@/components/event-bridge'

type ConversationsState = {
  projectId: string | null
  conversations: Tables<'ai_conversations'>[]
  activeConversation: Tables<'ai_conversations'> | null
  messages: Tables<'ai_messages'>[]
  loading: boolean
  loadProjectConversations: (projectId: string) => Promise<void>
  startConversation: (projectId: string, values?: Pick<TablesInsert<'ai_conversations'>, 'title' | 'model' | 'metadata'>) => Promise<Tables<'ai_conversations'>>
  selectConversation: (conversation: Tables<'ai_conversations'>) => Promise<void>
  editConversation: (id: string, values: TablesUpdate<'ai_conversations'>) => Promise<Tables<'ai_conversations'>>
  removeConversation: (id: string) => Promise<void>
  addMessage: (values: Omit<TablesInsert<'ai_messages'>, 'owner_id'>) => Promise<Tables<'ai_messages'>>
}

const ConversationsContext = createContext<ConversationsState | null>(null)

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Tables<'ai_conversations'>[]>([])
  const [activeConversation, setActiveConversation] = useState<Tables<'ai_conversations'> | null>(null)
  const [messages, setMessages] = useState<Tables<'ai_messages'>[]>([])
  const [loading, setLoading] = useState(false)
  const requestGeneration = useRef(0)

  useEffect(() => {
    if (user) return
    requestGeneration.current += 1
    setProjectId(null)
    setConversations([])
    setActiveConversation(null)
    setMessages([])
    setLoading(false)
  }, [user])

  const loadProjectConversations = useCallback(async (nextProjectId: string) => {
    const generation = ++requestGeneration.current
    setLoading(true)
    setProjectId(nextProjectId)
    setConversations([])
    setActiveConversation(null)
    setMessages([])
    try {
      const nextConversations = await listConversations(nextProjectId)
      const nextActiveConversation = nextConversations[0] ?? null
      const nextMessages = nextActiveConversation ? await listMessages(nextActiveConversation.id) : []
      if (generation === requestGeneration.current) {
        setConversations(nextConversations)
        setActiveConversation(nextActiveConversation)
        setMessages(nextMessages)
      }
    } finally {
      if (generation === requestGeneration.current) setLoading(false)
    }
  }, [])

  const startConversation = useCallback(async (nextProjectId: string, values: Pick<TablesInsert<'ai_conversations'>, 'title' | 'model' | 'metadata'> = {}) => {
    if (!user) throw new Error('Sign in to start an AI conversation.')
    const conversation = await createConversation({ project_id: nextProjectId, owner_id: user.uid, ...values })
    setProjectId(nextProjectId)
    setConversations(current => [conversation, ...current])
    setActiveConversation(conversation)
    setMessages([])
    dispatchAgentFlowEvent({ event: 'conversation.created', projectId: nextProjectId, workspaceId: null, metadata: { conversationId: conversation.id } })
    return conversation
  }, [user])

  const selectConversation = useCallback(async (conversation: Tables<'ai_conversations'>) => {
    const generation = ++requestGeneration.current
    setLoading(true)
    setActiveConversation(conversation)
    setMessages([])
    try {
      const nextMessages = await listMessages(conversation.id)
      if (generation === requestGeneration.current) setMessages(nextMessages)
      dispatchAgentFlowEvent({ event: 'conversation.continued', projectId: conversation.project_id, workspaceId: null, metadata: { conversationId: conversation.id } })
    } finally {
      if (generation === requestGeneration.current) setLoading(false)
    }
  }, [])

  const editConversation = useCallback(async (id: string, values: TablesUpdate<'ai_conversations'>) => {
    const conversation = await updateConversation(id, values)
    setConversations(current => current.map(item => item.id === id ? conversation : item))
    setActiveConversation(current => current?.id === id ? conversation : current)
    return conversation
  }, [])

  const removeConversation = useCallback(async (id: string) => {
    await deleteConversation(id)
    setConversations(current => current.filter(item => item.id !== id))
    setActiveConversation(current => current?.id === id ? null : current)
    setMessages(current => activeConversation?.id === id ? [] : current)
  }, [activeConversation?.id])

  const addMessage = useCallback(async (values: Omit<TablesInsert<'ai_messages'>, 'owner_id'>) => {
    if (!user) throw new Error('Sign in to send an AI message.')
    const message = await createMessage({ ...values, owner_id: user.uid })
    if (activeConversation?.id === message.conversation_id) setMessages(current => [...current, message])
    return message
  }, [activeConversation?.id, user])

  const value = useMemo(() => ({ projectId, conversations, activeConversation, messages, loading, loadProjectConversations, startConversation, selectConversation, editConversation, removeConversation, addMessage }), [projectId, conversations, activeConversation, messages, loading, loadProjectConversations, startConversation, selectConversation, editConversation, removeConversation, addMessage])
  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>
}

export function useConversations() {
  const state = useContext(ConversationsContext)
  if (!state) throw new Error('useConversations must be used within ConversationsProvider')
  return state
}
