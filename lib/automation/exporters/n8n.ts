import type { Json } from '@/lib/supabase/types'
import type { WorkflowGraph, WorkflowNode } from '@/lib/automation/types'
import { layoutWorkflowGraph, productionAutoLayout, type WorkflowLayoutProvider } from '@/lib/automation/layout'
import { optimizeWorkflowGraph } from '@/lib/automation/quality'
import { productionGraphValidationIssues } from '@/lib/automation/validation'

function n8nType(node: WorkflowNode) {
  if (node.type === 'trigger') return 'n8n-nodes-base.webhook'
  if (node.type === 'condition') return 'n8n-nodes-base.if'
  if (node.type === 'delay') return 'n8n-nodes-base.wait'
  return 'n8n-nodes-base.httpRequest'
}

export function exportN8n(graph: WorkflowGraph, layoutProvider: WorkflowLayoutProvider = productionAutoLayout): Json {
  const positionedGraph = layoutWorkflowGraph(optimizeWorkflowGraph(graph), layoutProvider)
  const connections: Record<string, { main: Array<Array<{ node: string; type: string; index: number }>> }> = {}
  for (const edge of positionedGraph.edges) {
    const source = positionedGraph.nodes.find(node => node.id === edge.source)?.name
    const target = positionedGraph.nodes.find(node => node.id === edge.target)?.name
    if (!source || !target) continue
    const branch = edge.condition === 'false' ? 1 : 0
    const current = connections[source] ?? { main: [] }
    while (current.main.length <= branch) current.main.push([])
    current.main[branch].push({ node: target, type: 'main', index: 0 })
    connections[source] = current
  }
  return {
    name: positionedGraph.name,
    nodes: positionedGraph.nodes.map(node => ({ id: node.id, name: node.name, type: n8nType(node), typeVersion: 1, position: [node.position.x, node.position.y], parameters: { ...node.inputs, operation: node.operation, notes: node.description }, retryOnFail: node.retry.attempts > 0, maxTries: Math.max(1, node.retry.attempts), waitBetweenTries: node.retry.backoffSeconds * 1000 })),
    connections,
    settings: { executionOrder: 'v1' },
    active: false,
    meta: { orbisweaveSchemaVersion: positionedGraph.schemaVersion, generatedBy: 'AgentFlow' },
  }
}

export function productionExportIssues(graph: WorkflowGraph, payload: Json) {
  const positionedGraph = layoutWorkflowGraph(optimizeWorkflowGraph(graph))
  return [...productionGraphValidationIssues(positionedGraph), ...n8nValidationIssues(payload)]
}

export function n8nValidationIssues(value: Json): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['n8n export must be a JSON object.']
  const workflow = value as Record<string, Json | undefined>
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
  const connections = workflow.connections && typeof workflow.connections === 'object' && !Array.isArray(workflow.connections) ? workflow.connections as Record<string, Json | undefined> : null
  const issues: string[] = []
  if (typeof workflow.name !== 'string' || !workflow.name.trim()) issues.push('n8n workflow name is required.')
  if (!nodes.length) issues.push('n8n workflow must contain nodes.')
  if (!connections) issues.push('n8n workflow connections must be an object.')
  if (!workflow.settings || typeof workflow.settings !== 'object' || Array.isArray(workflow.settings)) issues.push('n8n workflow settings must be an object.')
  if (typeof workflow.active !== 'boolean') issues.push('n8n workflow active flag must be a boolean.')
  const ids = new Set<string>()
  const names = new Set<string>()
  let triggers = 0
  nodes.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { issues.push(`n8n node ${index} is invalid.`); return }
    const node = raw as Record<string, Json | undefined>
    if (typeof node.id !== 'string' || !node.id) issues.push(`n8n node ${index} has no id.`)
    else if (ids.has(node.id)) issues.push(`Duplicate n8n node id: ${node.id}.`)
    else ids.add(node.id)
    if (typeof node.name !== 'string' || !node.name) issues.push(`n8n node ${index} has no name.`)
    else if (names.has(node.name)) issues.push(`Duplicate n8n node name: ${node.name}.`)
    else names.add(node.name)
    if (typeof node.type !== 'string' || !node.type) issues.push(`n8n node ${index} has no type.`)
    if (typeof node.typeVersion !== 'number') issues.push(`n8n node ${index} has no typeVersion.`)
    if (!node.parameters || typeof node.parameters !== 'object' || Array.isArray(node.parameters)) issues.push(`n8n node ${index} has invalid parameters.`)
    if (node.type === 'n8n-nodes-base.webhook') triggers += 1
    if (!Array.isArray(node.position) || node.position.length !== 2 || node.position.some(position => typeof position !== 'number')) issues.push(`n8n node ${index} has an invalid position.`)
  })
  if (triggers !== 1) issues.push(`n8n workflow must contain exactly one trigger; found ${triggers}.`)
  if (connections) for (const [source, rawOutputs] of Object.entries(connections)) {
    if (!names.has(source)) issues.push(`n8n connection source does not exist: ${source}.`)
    if (!rawOutputs || typeof rawOutputs !== 'object' || Array.isArray(rawOutputs)) { issues.push(`n8n connections for ${source} are invalid.`); continue }
    const main = (rawOutputs as Record<string, Json | undefined>).main
    if (!Array.isArray(main)) { issues.push(`n8n connections for ${source} have no main outputs.`); continue }
    for (const [branchIndex, branch] of main.entries()) {
      if (!Array.isArray(branch)) { issues.push(`n8n connection branch ${branchIndex} from ${source} is invalid.`); continue }
      for (const rawTarget of branch) {
      if (!rawTarget || typeof rawTarget !== 'object' || Array.isArray(rawTarget)) { issues.push(`n8n connection from ${source} is invalid.`); continue }
      const target = (rawTarget as Record<string, Json | undefined>).node
      if (typeof target !== 'string' || !names.has(target)) issues.push(`n8n connection from ${source} references missing node ${String(target)}.`)
      }
    }
  }
  return issues
}
