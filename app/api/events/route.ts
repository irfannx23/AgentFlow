import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import { authenticatedUserId } from '@/lib/connections/repository'
import { isAgentFlowEventName, type AgentFlowEvent } from '@/lib/events/contract'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
}

function optionalId(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: Request) {
  const token = bearerToken(request)
  if (!token) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
  const backendUrl = process.env.AGENTFLOW_BACKEND_URL?.trim()
  const integrationSecret = process.env.AGENTFLOW_INTEGRATION_SECRET?.trim()
  if (!backendUrl || !integrationSecret) return NextResponse.json({ error: 'Backend event integration is not configured.' }, { status: 503 })

  try {
    const ownerId = await authenticatedUserId(createServerSupabaseClient(token))
    const body = await request.json() as Record<string, unknown>
    const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : ''
    const timestamp = typeof body.timestamp === 'string' ? body.timestamp : ''
    const projectId = optionalId(body.projectId)
    const workspaceId = optionalId(body.workspaceId)
    if (!eventId || !isAgentFlowEventName(body.event) || !Number.isFinite(Date.parse(timestamp)) || projectId === undefined || workspaceId === undefined || !record(body.metadata)) {
      return NextResponse.json({ error: 'Invalid event payload.' }, { status: 422 })
    }
    const event: AgentFlowEvent = {
      eventId,
      event: body.event,
      timestamp,
      userId: ownerId,
      projectId,
      workspaceId,
      metadata: body.metadata,
      source: 'agentflow',
      version: '1.0',
    }
    const serialized = JSON.stringify(event)
    const signatureTimestamp = String(Math.floor(Date.now() / 1_000))
    const signature = createHmac('sha256', integrationSecret).update(`${signatureTimestamp}.${serialized}`).digest('hex')
    const response = await fetch(`${backendUrl.replace(/\/$/, '')}/v1/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-agentflow-timestamp': signatureTimestamp,
        'x-agentflow-signature': signature,
      },
      body: serialized,
      signal: AbortSignal.timeout(20_000),
    })
    const result = await response.json() as Record<string, unknown>
    if (!response.ok) return NextResponse.json({ error: 'Backend event processing failed.', details: result.error }, { status: 502 })
    return NextResponse.json({ event, result }, { status: 202 })
  } catch (error) {
    console.error('agentflow.event.proxy_failed', { message: error instanceof Error ? error.message : 'unknown_error' })
    return NextResponse.json({ error: 'Backend event delivery failed.' }, { status: 502 })
  }
}
