import type { Json } from '@/lib/supabase/types'
import type { WorkflowGraph, WorkflowNode } from '@/lib/automation/types'
import { layoutWorkflowGraph, productionAutoLayout, type WorkflowLayoutProvider } from '@/lib/automation/layout'
import { optimizeWorkflowGraph } from '@/lib/automation/quality'
import { productionGraphValidationIssues } from '@/lib/automation/validation'

function n8nType(node: WorkflowNode) {
  if (node.type === 'trigger') return 'n8n-nodes-base.webhook'
  if (node.type === 'condition') return 'n8n-nodes-base.if'
  if (node.type === 'delay') return 'n8n-nodes-base.wait'
  if (node.type === 'transform' || /^(?:internal|agentflow)$/i.test(node.service ?? '')) return 'n8n-nodes-base.set'
  if (node.type === 'error-handler') return 'n8n-nodes-base.stopAndError'
  if (node.configuration) return node.configuration.n8nNodeType
  return 'n8n-nodes-base.httpRequest'
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'agentflow-webhook'
}

function pairs(value: Record<string, Json>) {
  return Object.entries(value).map(([name, entry]) => ({ name, value: typeof entry === 'string' ? entry : JSON.stringify(entry) }))
}

function fallbackParameters(node: WorkflowNode): Record<string, Json> {
  if (node.type === 'trigger') return { httpMethod: 'POST', path: slug(node.name), responseMode: 'onReceived', options: {} }
  if (node.type === 'condition') return { conditions: { options: { caseSensitive: true, typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.valid }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }
  if (node.type === 'delay') return { amount: Math.max(1, Number(node.inputs.amount) || 1), unit: typeof node.inputs.unit === 'string' ? node.inputs.unit : 'seconds' }
  if (node.type === 'transform' || /^(?:internal|agentflow)$/i.test(node.service ?? '')) return { mode: 'manual', duplicateItem: false, assignments: { assignments: Object.entries(node.inputs).map(([name, value], index) => ({ id: `${node.id}-${index}`, name, value, type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string' })) }, options: {} }
  if (node.type === 'error-handler') return { errorType: 'errorMessage', errorMessage: `=${node.description || 'Workflow execution failed.'}` }
  return {
    method: /(?:read|get|fetch|lookup|search|list)/i.test(`${node.operation} ${node.name}`) ? 'GET' : 'POST',
    url: '={{ $env.INTEGRATION_ENDPOINT_URL }}',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Accept', value: 'application/json' }] },
    sendBody: true,
    contentType: 'raw',
    rawContentType: 'application/json',
    body: '={{ JSON.stringify($json) }}',
    options: { timeout: node.timeoutSeconds * 1000, response: { response: { responseFormat: 'json' } } },
  }
}

function configuredParameters(node: WorkflowNode): Record<string, Json> {
  const configuration = node.configuration
  if (!configuration) return fallbackParameters(node)
  if (configuration.n8nNodeType !== 'n8n-nodes-base.httpRequest') return { ...configuration.parameters, ...(configuration.resource ? { resource: configuration.resource } : {}), operation: configuration.operation }
  const headers = pairs(configuration.headers)
  const query = pairs(configuration.query)
  const body = Object.keys(configuration.body).length ? configuration.body : configuration.parameters.body
  return {
    method: configuration.method ?? 'POST',
    url: configuration.endpoint ?? '={{ $env.INTEGRATION_ENDPOINT_URL }}',
    authentication: configuration.credentialRequired ? 'genericCredentialType' : 'none',
    ...(configuration.credentialRequired ? { genericAuthType: configuration.credentialType ?? 'httpHeaderAuth' } : {}),
    sendHeaders: headers.length > 0,
    ...(headers.length ? { headerParameters: { parameters: headers } } : {}),
    sendQuery: query.length > 0,
    ...(query.length ? { queryParameters: { parameters: query } } : {}),
    sendBody: body !== undefined && (typeof body !== 'object' || body === null || Object.keys(body as Record<string, Json>).length > 0),
    contentType: 'raw',
    rawContentType: 'application/json',
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    options: { timeout: node.timeoutSeconds * 1000, response: { response: { responseFormat: 'json' } } },
  }
}

function n8nCredentials(node: WorkflowNode): Json | undefined {
  const configuration = node.configuration
  if (!configuration?.credentialRequired || !configuration.credentialType || !configuration.credentialName) {
    if (n8nType(node) === 'n8n-nodes-base.httpRequest' && !configuration && !['trigger','condition','delay','transform','error-handler'].includes(node.type) && !/^(?:internal|agentflow)$/i.test(node.service ?? '')) return { httpHeaderAuth: { id: 'CONFIGURE_IN_N8N', name: 'API credential (configure in n8n)' } }
    return undefined
  }
  return { [configuration.credentialType]: { id: 'CONFIGURE_IN_N8N', name: configuration.credentialName } }
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
    nodes: positionedGraph.nodes.map(node => {
      const credentials = n8nCredentials(node)
      return { id: node.id, name: node.name, type: n8nType(node), typeVersion: node.configuration?.typeVersion ?? (n8nType(node) === 'n8n-nodes-base.httpRequest' ? 4.2 : 1), position: [node.position.x, node.position.y], parameters: configuredParameters(node), ...(credentials ? { credentials } : {}), notes: [node.description, ...(node.configuration?.notes ?? [])].filter(Boolean).join('\n'), retryOnFail: node.retry.attempts > 0, maxTries: Math.max(1, node.retry.attempts), waitBetweenTries: node.retry.backoffSeconds * 1000, alwaysOutputData: node.type === 'error-handler' } }),
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
    if (/webhook|trigger$/i.test(String(node.type))) triggers += 1
    if (!Array.isArray(node.position) || node.position.length !== 2 || node.position.some(position => typeof position !== 'number')) issues.push(`n8n node ${index} has an invalid position.`)
    const parameters = node.parameters && typeof node.parameters === 'object' && !Array.isArray(node.parameters) ? node.parameters as Record<string, Json | undefined> : {}
    if (node.type === 'n8n-nodes-base.httpRequest') {
      if (!['GET','POST','PUT','PATCH','DELETE'].includes(String(parameters.method))) issues.push(`HTTP Request node ${String(node.name)} has an invalid method.`)
      if (typeof parameters.url !== 'string' || !parameters.url.trim()) issues.push(`HTTP Request node ${String(node.name)} has no endpoint.`)
      if (parameters.authentication !== 'none' && (!node.credentials || typeof node.credentials !== 'object' || Array.isArray(node.credentials))) issues.push(`HTTP Request node ${String(node.name)} has no credential placeholder.`)
    }
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
