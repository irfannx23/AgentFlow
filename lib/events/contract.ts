export const AGENTFLOW_EVENT_NAMES = [
  'user.registered', 'user.logged_in', 'user.logged_out',
  'project.created', 'project.deleted', 'project.archived', 'project.shared',
  'workflow.generated', 'workflow.regenerated', 'workflow.repaired',
  'generation.failed', 'generation.completed',
  'workflow.downloaded', 'workflow.imported', 'workflow.exported', 'workflow.import.failed',
  'provider.connected', 'provider.disconnected', 'model.changed', 'integration.connected',
  'repair.started', 'repair.completed', 'repair.failed',
  'conversation.created', 'conversation.continued', 'template.used', 'tool.selected',
] as const

export type AgentFlowEventName = (typeof AGENTFLOW_EVENT_NAMES)[number]

export type AgentFlowEvent = {
  eventId: string
  event: AgentFlowEventName
  timestamp: string
  userId: string
  projectId: string | null
  workspaceId: string | null
  metadata: Readonly<Record<string, unknown>>
  source: 'agentflow'
  version: '1.0'
}

export type EventEmission = Omit<AgentFlowEvent, 'eventId' | 'timestamp' | 'userId' | 'source' | 'version'>

export function isAgentFlowEventName(value: unknown): value is AgentFlowEventName {
  return typeof value === 'string' && (AGENTFLOW_EVENT_NAMES as readonly string[]).includes(value)
}
