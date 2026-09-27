'use client'

import type { User } from 'firebase/auth'
import type { AgentFlowEvent, EventEmission } from '@/lib/events/contract'

export async function emitAgentFlowEvent(user: User, emission: EventEmission): Promise<AgentFlowEvent> {
  const token = await user.getIdToken()
  const payload = {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...emission,
  }
  let failure = 'Backend event delivery failed.'
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: emission.event === 'user.logged_out',
    })
    const result = await response.json() as { event?: AgentFlowEvent; error?: string }
    if (response.ok && result.event) return result.event
    failure = result.error ?? failure
    if (response.status >= 400 && response.status < 500 && response.status !== 401) break
    if (attempt < 2) await new Promise(resolve => window.setTimeout(resolve, 250 * (2 ** attempt)))
  }
  throw new Error(failure)
}

export function reportAgentFlowEvent(user: User | null, emission: EventEmission): void {
  if (!user) return
  void emitAgentFlowEvent(user, emission).catch(error => {
    if (process.env.NODE_ENV !== 'production') console.warn('agentflow.event.failed', { event: emission.event, error: error instanceof Error ? error.message : String(error) })
  })
}
