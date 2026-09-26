'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/account-state'
import { useWorkspace } from '@/components/workspace-state'
import type { ConnectionModel, ConnectionProvider, ConnectionSummary } from '@/lib/connections/types'

type ConnectionsState = {
  connections: ConnectionSummary[]
  models: ConnectionModel[]
  defaultModel: ConnectionModel | null
  defaultProvider: ConnectionProvider | null
  preferenceReady: boolean
  loading: boolean
  error: string | null
  connect: (provider: ConnectionProvider, apiKey: string) => Promise<boolean>
  testCredential: (provider: ConnectionProvider, apiKey: string) => Promise<boolean>
  disconnect: (provider: ConnectionProvider) => Promise<void>
  test: (provider: ConnectionProvider) => Promise<boolean>
  setDefaultProvider: (provider: ConnectionProvider) => void
  reload: () => Promise<void>
}

const ConnectionsContext = createContext<ConnectionsState | null>(null)

function errorMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return errorMessage(parsed) ?? value
    } catch {
      return value
    }
  }
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  for (const key of ['message', 'error', 'details', 'hint']) {
    const message = errorMessage(record[key])
    if (message) return message
  }
  return null
}

export function ConnectionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { workspace } = useWorkspace()
  const [connections, setConnections] = useState<ConnectionSummary[]>([])
  const [models, setModels] = useState<ConnectionModel[]>([])
  const [defaultModelKey, setDefaultModelKey] = useState('')
  const [preferenceReady, setPreferenceReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preferenceKey = user ? `agentflow:default-model:${user.uid}:${workspace?.id ?? 'personal'}` : ''

  useEffect(() => {
    setPreferenceReady(false)
    setDefaultModelKey(preferenceKey ? window.localStorage.getItem(preferenceKey) ?? '' : '')
    setPreferenceReady(true)
  }, [preferenceKey])

  const request = useCallback(async (method: string, provider?: ConnectionProvider, apiKey?: string, testOnly?: boolean) => {
    if (!user) throw new Error('Sign in to manage connections.')
    const token = await user.getIdToken()
    const params = new URLSearchParams()
    if (workspace?.id) params.set('workspaceId', workspace.id)
    if (method === 'DELETE' && provider) params.set('provider', provider)
    const response = await fetch(`/api/connections?${params}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(method === 'GET' || method === 'DELETE' ? {} : { 'content-type': 'application/json' }) },
      body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify({ provider, apiKey, testOnly }),
    })
    const payload = response.status === 204 ? null : await response.json() as { connections?: ConnectionSummary[]; models?: ConnectionModel[]; connection?: ConnectionSummary; valid?: boolean; error?: unknown }
    if (!response.ok && response.status !== 422) throw new Error(errorMessage(payload?.error) ?? 'Connection request failed.')
    return payload
  }, [user, workspace?.id])

  const reload = useCallback(async () => {
    if (!user || !workspace) { setConnections([]); return }
    setLoading(true)
    setError(null)
    try {
      const payload = await request('GET')
      setConnections(payload?.connections ?? [])
      setModels(payload?.models ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load connections.')
    } finally {
      setLoading(false)
    }
  }, [request, user, workspace])

  useEffect(() => { void reload() }, [reload])

  const replace = useCallback((connection: ConnectionSummary) => setConnections(current => [connection, ...current.filter(item => item.provider !== connection.provider)]), [])
  const clearDefaultProvider = useCallback((provider: ConnectionProvider) => setDefaultModelKey(current => {
    if (!current.startsWith(`${provider}:`)) return current
    if (preferenceKey) window.localStorage.removeItem(preferenceKey)
    return ''
  }), [preferenceKey])
  const connect = useCallback(async (provider: ConnectionProvider, apiKey: string) => {
    const payload = await request('POST', provider, apiKey)
    if (payload?.connection) replace(payload.connection)
    if (payload?.connection?.status !== 'connected') clearDefaultProvider(provider)
    return payload?.valid === true
  }, [clearDefaultProvider, replace, request])
  const testCredential = useCallback(async (provider: ConnectionProvider, apiKey: string) => (await request('POST', provider, apiKey, true))?.valid === true, [request])
  const disconnect = useCallback(async (provider: ConnectionProvider) => {
    await request('DELETE', provider)
    setConnections(current => current.filter(item => item.provider !== provider))
    clearDefaultProvider(provider)
  }, [clearDefaultProvider, request])
  const test = useCallback(async (provider: ConnectionProvider) => {
    const payload = await request('PATCH', provider)
    if (payload?.connection) replace(payload.connection)
    if (payload?.connection?.status !== 'connected') clearDefaultProvider(provider)
    return payload?.valid === true
  }, [clearDefaultProvider, replace, request])

  const defaultModel = models.find(model => `${model.provider}:${model.id}` === defaultModelKey && connections.some(connection => connection.provider === model.provider && connection.status === 'connected')) ?? null
  const defaultProvider = defaultModel?.provider ?? null
  const setDefaultProvider = useCallback((provider: ConnectionProvider) => {
    if (!connections.some(connection => connection.provider === provider && connection.status === 'connected')) throw new Error('Connect this provider before making it the default.')
    const model = models.find(candidate => candidate.provider === provider)
    if (!model) throw new Error('This provider has no available models.')
    const key = `${model.provider}:${model.id}`
    setDefaultModelKey(key)
    if (preferenceKey) window.localStorage.setItem(preferenceKey, key)
  }, [connections, models, preferenceKey])

  const value = useMemo(() => ({ connections, models, defaultModel, defaultProvider, preferenceReady, loading, error, connect, testCredential, disconnect, test, setDefaultProvider, reload }), [connections, models, defaultModel, defaultProvider, preferenceReady, loading, error, connect, testCredential, disconnect, test, setDefaultProvider, reload])
  return <ConnectionsContext.Provider value={value}>{children}</ConnectionsContext.Provider>
}

export function useConnections() {
  const state = useContext(ConnectionsContext)
  if (!state) throw new Error('useConnections must be used within ConnectionsProvider')
  return state
}
