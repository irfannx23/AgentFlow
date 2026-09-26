import { NextResponse } from 'next/server'
import { authenticatedUserId } from '@/lib/connections/repository'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function tokenFor(request: Request) {
  const authorization = request.headers.get('authorization')
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() || null : null
}

export async function GET(request: Request) {
  const token = tokenFor(request)
  if (!token) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })

  try {
    const client = createServerSupabaseClient(token)
    await authenticatedUserId(client)

    const [messages, conversations, projects, requestCount, conversationCount, projectCount] = await Promise.all([
      client
        .from('ai_messages')
        .select('id,conversation_id,created_at,metadata,model,prompt_tokens,completion_tokens,role')
        .order('created_at', { ascending: false })
        .limit(1500),
      client
        .from('ai_conversations')
        .select('id,created_at,updated_at,model,project_id')
        .order('updated_at', { ascending: false })
        .limit(1000),
      client
        .from('projects')
        .select('id,created_at,updated_at,stage')
        .order('updated_at', { ascending: false })
        .limit(1000),
      client.from('ai_messages').select('id', { count: 'exact', head: true }).eq('role', 'assistant'),
      client.from('ai_conversations').select('id', { count: 'exact', head: true }),
      client.from('projects').select('id', { count: 'exact', head: true }),
    ])

    const error = messages.error ?? conversations.error ?? projects.error ?? requestCount.error ?? conversationCount.error ?? projectCount.error
    if (error) throw error

    return NextResponse.json({
      messages: messages.data ?? [],
      conversations: conversations.data ?? [],
      projects: projects.data ?? [],
      totals: {
        requests: requestCount.count ?? 0,
        conversations: conversationCount.count ?? 0,
        projects: projectCount.count ?? 0,
      },
    })
  } catch (error) {
    console.error('Unable to load usage analytics.', { type: error instanceof Error ? error.name : 'UnknownError' })
    return NextResponse.json({ error: 'Unable to load usage analytics.' }, { status: 403 })
  }
}
