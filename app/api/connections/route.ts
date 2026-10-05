import { NextResponse } from 'next/server'
import { getAIProvider, listAIModels } from '@/lib/ai/provider-registry'
import { authenticatedUserId, deleteConnection, listConnections, loadCredential, saveConnection } from '@/lib/connections/repository'
import { isConnectionProvider } from '@/lib/connections/types'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { connectionFailure, type ProviderConnectionResult } from '@/lib/ai/provider-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function tokenFor(request: Request) {
  const authorization = request.headers.get('authorization')
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() || null : null
}

function workspaceFor(request: Request) {
  return new URL(request.url).searchParams.get('workspaceId')?.trim() || null
}

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function resultResponse(result: ProviderConnectionResult, connection?: Awaited<ReturnType<typeof saveConnection>>) {
  return NextResponse.json({ ...result, valid: result.success, ...(connection ? { connection } : {}) }, { status: result.success ? 200 : 422 })
}

function logException(error: unknown) {
  const type = error instanceof Error ? error.name : 'UnknownError'
  console.error('Connections request failed.', { type })
}

async function authorized(request: Request) {
  const token = tokenFor(request)
  if (!token) throw new Error('UNAUTHENTICATED')
  const client = createServerSupabaseClient(token)
  const ownerId = await authenticatedUserId(client)
  return { client, ownerId }
}

export async function GET(request: Request) {
  try {
    const { client } = await authorized(request)
    return NextResponse.json({ connections: await listConnections(client, workspaceFor(request)), models: listAIModels() })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return failure('Authentication is required.', 401)
    logException(error)
    return failure('Unable to load connections.', 403)
  }
}

export async function POST(request: Request) {
  try {
    const { client, ownerId } = await authorized(request)
    const body = await request.json() as { provider?: unknown; apiKey?: unknown; testOnly?: unknown }
    if (!isConnectionProvider(body.provider)) return failure('This provider is not supported.', 400)
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
    if (!apiKey || apiKey.length > 10_000) return failure('A valid API key is required.', 400)
    const provider = getAIProvider(body.provider)
    const result = await provider.testConnection(apiKey)
    if (body.testOnly === true) return resultResponse(result)
    const testedAt = result.success ? new Date().toISOString() : null
    const connection = await saveConnection(client, ownerId, body.provider, apiKey, workspaceFor(request), result.success ? 'connected' : 'invalid', testedAt)
    return resultResponse(result, connection)
  } catch (error) {
    if (error instanceof SyntaxError) return failure('A valid JSON request body is required.', 400)
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return failure('Authentication is required.', 401)
    const result = connectionFailure('unknown', error)
    logException(error)
    return NextResponse.json(result, { status: 502 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { client, ownerId } = await authorized(request)
    const body = await request.json() as { provider?: unknown }
    if (!isConnectionProvider(body.provider)) return failure('This provider is not supported.', 400)
    const workspaceId = workspaceFor(request)
    const credential = await loadCredential(client, ownerId, body.provider, workspaceId, false)
    const result = await getAIProvider(body.provider).testConnection(credential)
    const connection = await saveConnection(client, ownerId, body.provider, credential, workspaceId, result.success ? 'connected' : 'invalid', result.success ? new Date().toISOString() : null)
    return resultResponse(result, connection)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return failure('Authentication is required.', 401)
    const result = connectionFailure('unknown', error)
    logException(error)
    return NextResponse.json(result, { status: 502 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { client } = await authorized(request)
    const provider = new URL(request.url).searchParams.get('provider')
    if (!isConnectionProvider(provider)) return failure('This provider is not supported.', 400)
    await deleteConnection(client, provider, workspaceFor(request))
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return failure('Authentication is required.', 401)
    logException(error)
    return failure('Unable to disconnect this provider.', 502)
  }
}
