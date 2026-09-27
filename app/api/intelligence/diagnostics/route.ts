import { NextResponse } from 'next/server'
import { authenticatedUserId } from '@/lib/connections/repository'
import { logLifecycle, missingEnvironmentVariables, newErrorId, requestId } from '@/lib/observability/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REQUIRED_ENVIRONMENT = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'CONNECTIONS_ENCRYPTION_KEY'] as const

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
}

export async function POST(request: Request) {
  const id = requestId(request)
  const missing = missingEnvironmentVariables(REQUIRED_ENVIRONMENT)
  const token = bearerToken(request)
  if (!token) {
    const errorId = newErrorId()
    logLifecycle('error', 'client.lifecycle.authentication_failed', { requestId: id, errorId, stage: 'authentication', error: new Error('Authentication is required.'), missingEnvironmentVariables: missing })
    return NextResponse.json({ error: 'Authentication is required.', errorId, requestId: id }, { status: 401, headers: { 'x-request-id': id } })
  }
  try {
    const client = createServerSupabaseClient(token)
    const ownerId = await authenticatedUserId(client)
    const body = await request.json() as Record<string, unknown>
    const level = body.status === 'failed' || body.error ? 'error' : 'info'
    const eventErrorId = level === 'error' ? newErrorId() : undefined
    logLifecycle(level, typeof body.event === 'string' ? body.event : 'client.lifecycle', {
      requestId: id,
      stage: typeof body.stage === 'string' ? body.stage : 'client',
      errorId: eventErrorId,
      error: body.error,
      missingEnvironmentVariables: missing,
      context: {
        ownerId,
        projectId: typeof body.projectId === 'string' ? body.projectId : null,
        status: body.status,
        ...(body.context && typeof body.context === 'object' ? body.context as Record<string, unknown> : {}),
      },
    })
    return NextResponse.json({ requestId: id, errorId: eventErrorId ?? null }, { headers: { 'x-request-id': id } })
  } catch (error) {
    const errorId = newErrorId()
    logLifecycle('error', 'client.lifecycle.logging_failed', { requestId: id, errorId, stage: 'diagnostics', error, missingEnvironmentVariables: missing })
    return NextResponse.json({ error: 'Unable to record diagnostics.', errorId, requestId: id }, { status: 500, headers: { 'x-request-id': id } })
  }
}
