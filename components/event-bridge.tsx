'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/account-state'
import { useWorkspace } from '@/components/workspace-state'
import type { EventEmission } from '@/lib/events/contract'
import { reportAgentFlowEvent } from '@/lib/events/emitter'

export function dispatchAgentFlowEvent(emission: EventEmission): void {
  window.dispatchEvent(new CustomEvent<EventEmission>('agentflow:backend-event', { detail: emission }))
}

export function AgentFlowEventBridge() {
  const { user } = useAuth()
  const { workspace } = useWorkspace()
  useEffect(() => {
    const receive = (raw: Event) => {
      const emission = (raw as CustomEvent<EventEmission>).detail
      if (!emission?.event) return
      reportAgentFlowEvent(user, { ...emission, workspaceId: emission.workspaceId ?? workspace?.id ?? null })
    }
    window.addEventListener('agentflow:backend-event', receive)
    return () => window.removeEventListener('agentflow:backend-event', receive)
  }, [user, workspace?.id])
  return null
}
