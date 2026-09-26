import type { Json } from '@/lib/supabase/types'

export type WorkflowNodeType = 'trigger' | 'action' | 'condition' | 'approval' | 'transform' | 'delay' | 'error-handler'
export type WorkflowNode = { id: string; type: WorkflowNodeType; name: string; description: string; service?: string; operation?: string; inputs: Record<string, Json>; outputs: Record<string, Json>; retry: { attempts: number; backoffSeconds: number }; timeoutSeconds: number; position: { x: number; y: number } }
export type WorkflowEdge = { id: string; source: string; target: string; condition?: string; label?: string; errorPath?: boolean }
export type WorkflowVariable = { name: string; description: string; type: 'string'|'number'|'boolean'|'object'|'array'; required: boolean; default?: Json }
export type WorkflowCredential = { name: string; service: string; description: string; required: boolean }
export type WorkflowGraph = { schemaVersion: 1; name: string; description: string; nodes: WorkflowNode[]; edges: WorkflowEdge[]; variables: WorkflowVariable[]; credentials: WorkflowCredential[]; assumptions: string[]; risks: string[] }

export function workflowValidationIssues(value: unknown): string[] {
  const issues: string[] = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Workflow must be a JSON object.']
  const graph = value as Partial<WorkflowGraph>
  if (graph.schemaVersion !== 1) issues.push('schemaVersion must equal 1.')
  if (typeof graph.name !== 'string' || !graph.name.trim()) issues.push('name must be a non-empty string.')
  if (typeof graph.description !== 'string') issues.push('description must be a string.')
  if (!Array.isArray(graph.nodes) || graph.nodes.length < 2 || graph.nodes.length > 200) issues.push('nodes must contain between 2 and 200 nodes.')
  if (!Array.isArray(graph.edges) || graph.edges.length > 400) issues.push('edges must be an array with at most 400 entries.')
  if (!Array.isArray(graph.variables)) issues.push('variables must be an array.')
  if (!Array.isArray(graph.credentials)) issues.push('credentials must be an array.')
  if (!Array.isArray(graph.assumptions)) issues.push('assumptions must be an array.')
  if (!Array.isArray(graph.risks)) issues.push('risks must be an array.')
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return issues
  const types: WorkflowNodeType[] = ['trigger','action','condition','approval','transform','delay','error-handler']
  const variableTypes = ['string','number','boolean','object','array']
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const [index, node] of graph.nodes.entries()) {
    if (!node || typeof node !== 'object') { issues.push(`nodes[${index}] must be an object.`); continue }
    if (typeof node.id !== 'string' || !node.id) issues.push(`nodes[${index}].id must be a non-empty string.`)
    else if (ids.has(node.id)) issues.push(`Duplicate node id: ${node.id}.`)
    ids.add(node.id)
    if (!types.includes(node.type)) issues.push(`nodes[${index}].type is invalid.`)
    if (typeof node.name !== 'string' || !node.name.trim()) issues.push(`nodes[${index}].name must be non-empty.`)
    else if (names.has(node.name)) issues.push(`Duplicate node name: ${node.name}.`)
    names.add(node.name)
    if (typeof node.description !== 'string') issues.push(`nodes[${index}].description must be a string.`)
    if (node.service !== undefined && typeof node.service !== 'string') issues.push(`nodes[${index}].service must be a string.`)
    if (node.operation !== undefined && typeof node.operation !== 'string') issues.push(`nodes[${index}].operation must be a string.`)
    if (!node.inputs || typeof node.inputs !== 'object' || Array.isArray(node.inputs)) issues.push(`nodes[${index}].inputs must be an object.`)
    if (!node.outputs || typeof node.outputs !== 'object' || Array.isArray(node.outputs)) issues.push(`nodes[${index}].outputs must be an object.`)
    if (!node.retry || !Number.isInteger(node.retry.attempts) || node.retry.attempts < 0 || node.retry.attempts > 10 || typeof node.retry.backoffSeconds !== 'number') issues.push(`nodes[${index}].retry is invalid.`)
    if (typeof node.timeoutSeconds !== 'number' || node.timeoutSeconds <= 0) issues.push(`nodes[${index}].timeoutSeconds must be positive.`)
    if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') issues.push(`nodes[${index}].position is invalid.`)
  }
  const triggers = graph.nodes.filter(node => node?.type === 'trigger').length
  if (triggers !== 1) issues.push(`Workflow must contain exactly one trigger; found ${triggers}.`)
  const edgeIds = new Set<string>()
  for (const [index, edge] of graph.edges.entries()) {
    if (!edge || typeof edge !== 'object') { issues.push(`edges[${index}] must be an object.`); continue }
    if (!edge?.id) issues.push(`edges[${index}].id must be non-empty.`)
    else if (edgeIds.has(edge.id)) issues.push(`Duplicate edge id: ${edge.id}.`)
    edgeIds.add(edge?.id)
    if (!ids.has(edge?.source)) issues.push(`edges[${index}] references missing source node ${edge?.source}.`)
    if (!ids.has(edge?.target)) issues.push(`edges[${index}] references missing target node ${edge?.target}.`)
    if (edge.source === edge.target) issues.push(`edges[${index}] cannot connect a node to itself.`)
    if (edge.condition !== undefined && typeof edge.condition !== 'string') issues.push(`edges[${index}].condition must be a string.`)
    if (edge.label !== undefined && typeof edge.label !== 'string') issues.push(`edges[${index}].label must be a string.`)
    if (edge.errorPath !== undefined && typeof edge.errorPath !== 'boolean') issues.push(`edges[${index}].errorPath must be a boolean.`)
  }
  const trigger = graph.nodes.find(node => node?.type === 'trigger')
  if (trigger) {
    const reachable = new Set([trigger.id])
    let changed = true
    while (changed) {
      changed = false
      for (const edge of graph.edges) if (reachable.has(edge.source) && !reachable.has(edge.target)) { reachable.add(edge.target); changed = true }
    }
    for (const node of graph.nodes) if (node?.id && !reachable.has(node.id)) issues.push(`Node ${node.id} is not reachable from the trigger.`)
  }
  const variableNames = new Set<string>()
  const variables = Array.isArray(graph.variables) ? graph.variables : []
  for (const [index, variable] of variables.entries()) {
    if (!variable || typeof variable !== 'object') { issues.push(`variables[${index}] must be an object.`); continue }
    if (typeof variable.name !== 'string' || !variable.name.trim()) issues.push(`variables[${index}].name must be non-empty.`)
    else if (variableNames.has(variable.name)) issues.push(`Duplicate variable name: ${variable.name}.`)
    else variableNames.add(variable.name)
    if (typeof variable.description !== 'string') issues.push(`variables[${index}].description must be a string.`)
    if (!variableTypes.includes(variable.type)) issues.push(`variables[${index}].type is invalid.`)
    if (typeof variable.required !== 'boolean') issues.push(`variables[${index}].required must be a boolean.`)
  }
  const credentialNames = new Set<string>()
  const credentials = Array.isArray(graph.credentials) ? graph.credentials : []
  for (const [index, credential] of credentials.entries()) {
    if (!credential || typeof credential !== 'object') { issues.push(`credentials[${index}] must be an object.`); continue }
    if (typeof credential.name !== 'string' || !credential.name.trim()) issues.push(`credentials[${index}].name must be non-empty.`)
    else if (credentialNames.has(credential.name)) issues.push(`Duplicate credential name: ${credential.name}.`)
    else credentialNames.add(credential.name)
    if (typeof credential.service !== 'string' || !credential.service.trim()) issues.push(`credentials[${index}].service must be non-empty.`)
    if (typeof credential.description !== 'string') issues.push(`credentials[${index}].description must be a string.`)
    if (typeof credential.required !== 'boolean') issues.push(`credentials[${index}].required must be a boolean.`)
  }
  if (Array.isArray(graph.assumptions) && !graph.assumptions.every(item => typeof item === 'string')) issues.push('assumptions must contain only strings.')
  if (Array.isArray(graph.risks) && !graph.risks.every(item => typeof item === 'string')) issues.push('risks must contain only strings.')
  return issues
}

export function isWorkflowGraph(value: unknown): value is WorkflowGraph {
  return workflowValidationIssues(value).length === 0
}
