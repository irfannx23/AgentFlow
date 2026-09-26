import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptCredential, encryptCredential } from '@/lib/connections/crypto'
import type { ConnectionProvider, ConnectionStatus, ConnectionSummary } from '@/lib/connections/types'
import type { Database, Tables } from '@/lib/supabase/types'

type Client = SupabaseClient<Database>
type Connection = Tables<'connections'>

function context(ownerId: string, provider: ConnectionProvider, organizationId: string | null) {
  return `${ownerId}:${organizationId ?? 'personal'}:${provider}`
}

function summary(row: Connection): ConnectionSummary {
  return {
    provider: row.provider as ConnectionProvider,
    status: row.status as ConnectionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSuccessfulTestAt: row.last_successful_test_at,
  }
}

export async function authenticatedUserId(client: Client) {
  const result = await client.from('profiles').select('id').maybeSingle()
  if (result.error || !result.data) throw new Error('Authentication is required.')
  return result.data.id
}

export async function listConnections(client: Client, organizationId: string | null) {
  let query = client.from('connections').select('*').order('provider')
  query = organizationId ? query.eq('organization_id', organizationId) : query.is('organization_id', null)
  const result = await query
  if (result.error) throw result.error
  return (result.data ?? []).map(summary)
}

export async function saveConnection(client: Client, ownerId: string, provider: ConnectionProvider, apiKey: string, organizationId: string | null, status: ConnectionStatus, testedAt: string | null) {
  const credential = encryptCredential(apiKey, context(ownerId, provider, organizationId))
  let existingQuery = client.from('connections').select('id').eq('provider', provider)
  existingQuery = organizationId ? existingQuery.eq('organization_id', organizationId) : existingQuery.is('organization_id', null)
  const existing = await existingQuery.maybeSingle()
  if (existing.error) throw existing.error
  const values = { owner_id: ownerId, organization_id: organizationId, provider, encrypted_credential: credential, status, last_successful_test_at: testedAt }
  const result = existing.data
    ? await client.from('connections').update(values).eq('id', existing.data.id).select('*').single()
    : await client.from('connections').insert(values).select('*').single()
  if (result.error) throw result.error
  return summary(result.data)
}

export async function deleteConnection(client: Client, provider: ConnectionProvider, organizationId: string | null) {
  let query = client.from('connections').delete().eq('provider', provider)
  query = organizationId ? query.eq('organization_id', organizationId) : query.is('organization_id', null)
  const result = await query
  if (result.error) throw result.error
}

export async function loadCredential(client: Client, ownerId: string, provider: ConnectionProvider, organizationId: string | null, requireConnected = true) {
  const scopes = organizationId ? [organizationId, null] : [null]
  for (const scope of scopes) {
    let query = client.from('connections').select('*').eq('provider', provider)
    if (requireConnected) query = query.eq('status', 'connected')
    query = scope ? query.eq('organization_id', scope) : query.is('organization_id', null)
    const result = await query.maybeSingle()
    if (result.error) throw result.error
    if (result.data) return decryptCredential(result.data.encrypted_credential, context(ownerId, provider, scope))
  }
  const label = provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : provider === 'deepseek' ? 'DeepSeek' : 'Google Gemini'
  throw new Error(`Connect ${label} in Settings before using this provider.`)
}
