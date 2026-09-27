import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { AGENTFLOW_EVENT_NAMES } from '@/lib/events/contract'
import { emitAgentFlowEvent } from '@/lib/events/emitter'

test('event contract exposes every integration event exactly once', () => {
  assert.equal(new Set(AGENTFLOW_EVENT_NAMES).size, AGENTFLOW_EVENT_NAMES.length)
  for (const name of [
    'user.registered', 'user.logged_in', 'user.logged_out',
    'project.created', 'project.deleted', 'project.archived', 'project.shared',
    'workflow.generated', 'workflow.regenerated', 'workflow.repaired',
    'generation.failed', 'generation.completed', 'workflow.downloaded', 'workflow.imported',
    'workflow.exported', 'workflow.import.failed', 'provider.connected', 'provider.disconnected',
    'model.changed', 'integration.connected', 'repair.started', 'repair.completed', 'repair.failed',
    'conversation.created', 'conversation.continued', 'template.used', 'tool.selected',
  ]) assert.ok((AGENTFLOW_EVENT_NAMES as readonly string[]).includes(name), name)
})

test('client emitter sends a Firebase-authenticated canonical event envelope', async () => {
  const originalFetch = globalThis.fetch
  let captured: { url: string; init?: RequestInit } | undefined
  globalThis.fetch = async (input, init) => {
    captured = { url: String(input), init }
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    return Response.json({ event: { ...body, userId: 'firebase-user-1', source: 'agentflow', version: '1.0' } }, { status: 202 })
  }
  try {
    const result = await emitAgentFlowEvent(
      { getIdToken: async () => 'firebase-id-token' } as never,
      { event: 'project.created', projectId: 'project-1', workspaceId: 'workspace-1', metadata: { phase: 'Business Problem' } },
    )
    assert.equal(captured?.url, '/api/events')
    assert.equal((captured?.init?.headers as Record<string, string>).authorization, 'Bearer firebase-id-token')
    assert.equal(result.event, 'project.created')
    assert.equal(result.userId, 'firebase-user-1')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('existing action boundaries emit backend events without UI replacement', async () => {
  const files = await Promise.all([
    'components/account-state.tsx',
    'components/workspace-state.tsx',
    'components/connections-provider.tsx',
    'components/conversations-provider.tsx',
    'components/ai-provider.tsx',
    'components/use-artifact-generation.ts',
    'components/product-home.tsx',
    'components/tool-plan-card.tsx',
  ].map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')))
  const source = files.join('\n')
  for (const name of [
    'user.registered', 'user.logged_in', 'user.logged_out', 'project.created', 'project.deleted',
    'workflow.generated', 'workflow.regenerated', 'workflow.repaired', 'generation.failed',
    'generation.completed', 'workflow.downloaded', 'workflow.imported', 'workflow.exported',
    'workflow.import.failed', 'provider.connected', 'provider.disconnected', 'model.changed',
    'repair.started', 'repair.completed', 'repair.failed', 'conversation.created',
    'conversation.continued', 'tool.selected',
  ]) assert.match(source, new RegExp(name.replace('.', '\\.')), name)
})
