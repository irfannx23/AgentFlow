import { NextResponse } from 'next/server'
import { authenticatedUserId } from '@/lib/connections/repository'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { emptyUsage, entitlementsFor } from '@/lib/billing/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function tokenFor(request: Request) {
  const value = request.headers.get('authorization')
  return value?.startsWith('Bearer ') ? value.slice(7).trim() : null
}

export async function GET(request: Request) {
  const token = tokenFor(request)
  if (!token) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
  try {
    const client = createServerSupabaseClient(token)
    await authenticatedUserId(client)
    const [projects, runs, exports, requests, uploads, documents, conversations, versions, timeline] = await Promise.all([
      client.from('projects').select('id', { count: 'exact', head: true }),
      client.from('automation_workflows').select('id', { count: 'exact', head: true }),
      client.from('automation_exports').select('id', { count: 'exact', head: true }),
      client.from('ai_messages').select('id', { count: 'exact', head: true }).eq('role', 'assistant'),
      client.from('knowledge_documents').select('id', { count: 'exact', head: true }),
      client.from('knowledge_documents').select('size_bytes').limit(5000),
      client.from('ai_conversations').select('id', { count: 'exact', head: true }),
      client.from('automation_versions').select('id', { count: 'exact', head: true }),
      client.from('project_timeline').select('id', { count: 'exact', head: true }),
    ])
    const queryError = projects.error ?? runs.error ?? exports.error ?? requests.error ?? uploads.error ?? documents.error ?? conversations.error ?? versions.error ?? timeline.error
    if (queryError) throw queryError
    const usage = {
      ...emptyUsage,
      projects: projects.count ?? 0,
      automationRuns: runs.count ?? 0,
      workflowExports: exports.count ?? 0,
      aiRequests: requests.count ?? 0,
      knowledgeUploads: uploads.count ?? 0,
      storageBytes: (documents.data ?? []).reduce((sum, item) => sum + item.size_bytes, 0),
      conversations: conversations.count ?? 0,
      versions: versions.count ?? 0,
      timelineEvents: timeline.count ?? 0,
    }
    return NextResponse.json({ plan: 'free', status: 'active', renewalDate: null, cancelAtPeriodEnd: false, usage, entitlements: entitlementsFor('free', usage), history: [] })
  } catch (error) {
    console.error('Unable to load billing state.', { type: error instanceof Error ? error.name : 'UnknownError' })
    return NextResponse.json({ error: 'Unable to load billing information.' }, { status: 403 })
  }
}
