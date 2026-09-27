import type { AutomationTool, ToolPlan } from '@/lib/automation/tool-plan'
import type { WorkflowCredential, WorkflowGraph, WorkflowNode, WorkflowVariable } from '@/lib/automation/types'
import type { Json } from '@/lib/supabase/types'
import { integrationIntelligenceRegistry, resolveIntegration } from '@/lib/integrations/intelligence/catalog'
import type { IntegrationClarificationQuestion, IntegrationDefinition, IntegrationOperation } from '@/lib/integrations/intelligence/types'

type ConfigurationContext = { toolPlan?: ToolPlan | null; answers?: Json }
const secretName = /(?:api[_-]?key|token|password|secret|private[_-]?key)/i

function record(value: unknown): Record<string, Json> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Json> : {}
}

function meaningful(value: Json | undefined) {
  return value !== undefined && value !== null && !(typeof value === 'string' && !value.trim())
}

function safeAnswer(value: Json | undefined, parameter: string) {
  if (!meaningful(value) || secretName.test(parameter)) return undefined
  return value
}

function integrationAnswers(answers: Json | undefined, integration: IntegrationDefinition) {
  const root = record(answers)
  const configuration = record(root.integrationConfiguration ?? root._integrationConfiguration)
  const direct = record(configuration[integration.id] ?? configuration[integration.name] ?? root[integration.id])
  return direct
}

function selectedDefinitions(toolPlan?: ToolPlan | null) {
  return (toolPlan?.tools ?? []).flatMap(tool => {
    if (!tool.selectedTool || tool.skipped) return []
    const definition = resolveIntegration(tool.selectedTool) ?? resolveIntegration(tool.name)
    return definition ? [{ tool, definition }] : []
  })
}

function definitionForNode(node: WorkflowNode, selected: Array<{ tool: AutomationTool; definition: IntegrationDefinition }>) {
  const explicit = resolveIntegration(node.service)
  if (explicit) return explicit
  const context = `${node.name} ${node.description} ${node.operation ?? ''}`.toLowerCase()
  const match = selected.find(({ tool, definition }) =>
    definition.aliases.some(alias => context.includes(alias.toLowerCase())) ||
    (tool.usedFor && context.includes(tool.usedFor.toLowerCase())),
  )
  return match?.definition
}

function operationScore(operation: IntegrationOperation, context: string) {
  const terms = [operation.id, operation.n8nOperation, ...operation.aliases]
  return terms.reduce((score, term) => {
    const normalized = term.toLowerCase().replace(/[-_]+/g, ' ')
    return score + (context === normalized ? 8 : context.includes(normalized) ? Math.max(2, normalized.split(/\s+/).length * 2) : 0)
  }, 0)
}

function operationForNode(node: WorkflowNode, integration: IntegrationDefinition) {
  const context = `${node.operation ?? ''} ${node.name} ${node.description}`.toLowerCase().replace(/[-_]+/g, ' ')
  const ranked = integration.operations.map(operation => ({ operation, score: operationScore(operation, context) })).sort((left, right) => right.score - left.score)
  if (ranked[0]?.score) return ranked[0].operation
  if (node.type === 'trigger') return integration.operations.find(operation => /receive|trigger|watch|list|read|get/.test(`${operation.id} ${operation.aliases.join(' ')}`)) ?? integration.operations[0]
  if (/delete|remove/.test(context)) return integration.operations.find(operation => /delete|remove/.test(operation.id)) ?? integration.operations[0]
  if (/update|sync|edit/.test(context)) return integration.operations.find(operation => /update|upsert|sync/.test(operation.id)) ?? integration.operations[0]
  if (/read|get|find|lookup|search|list/.test(context)) return integration.operations.find(operation => /read|get|find|lookup|search|list|query/.test(operation.id)) ?? integration.operations[0]
  return integration.operations.find(operation => /create|send|append|upload|insert|generate|post/.test(operation.id)) ?? integration.operations[0]
}

function configuredParameters(node: WorkflowNode, integration: IntegrationDefinition, operation: IntegrationOperation, answers?: Json) {
  const values = integrationAnswers(answers, integration)
  const parameters: Record<string, Json> = { ...operation.parameters }
  for (const parameter of operation.requiredParameters) {
    const answer = safeAnswer(values[parameter], parameter)
    const existing = safeAnswer(node.inputs[parameter], parameter)
    if (answer !== undefined) parameters[parameter] = answer
    else if (existing !== undefined) parameters[parameter] = existing
  }
  for (const [key, value] of Object.entries(node.inputs)) {
    if (!meaningful(value) || secretName.test(key)) continue
    if (!(key in parameters)) parameters[key] = value
  }
  if (operation.resource) parameters.resource = operation.resource
  parameters.operation = operation.n8nOperation
  return parameters
}

function configureNode(node: WorkflowNode, integration: IntegrationDefinition, answers?: Json): WorkflowNode {
  const operation = operationForNode(node, integration)
  const credentialRequired = integration.authentication !== 'none' && integration.authentication !== 'webhook'
  const parameters = configuredParameters(node, integration, operation, answers)
  const endpoint = safeAnswer(integrationAnswers(answers, integration).endpoint, 'endpoint') ?? operation.endpoint
  const trigger = node.type === 'trigger'
  const triggerConfiguration = trigger ? {
    integrationId: integration.id,
    n8nNodeType: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    operation: 'receive',
    authentication: 'webhook' as const,
    credentialRequired: false,
    method: 'POST' as const,
    parameters: { httpMethod: 'POST', path: `={{ $env.${integration.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_WEBHOOK_PATH }}`, responseMode: 'onReceived' },
    headers: {}, query: {}, body: {}, requiredParameters: ['path'],
    outputMapping: { payload: '={{ $json.body ?? $json }}' },
    notes: [`Receives ${integration.name} events.`, 'Configure and activate the production webhook URL in the source integration.'],
  } : null
  const configuration = triggerConfiguration ?? {
    integrationId: integration.id,
    n8nNodeType: integration.id === 'webhook' ? 'n8n-nodes-base.httpRequest' : integration.n8nNodeType,
    typeVersion: integration.id === 'webhook' ? 4.2 : integration.typeVersion,
    operation: operation.n8nOperation,
    ...(operation.resource ? { resource: operation.resource } : {}),
    authentication: integration.authentication,
    ...(integration.credentialType ? { credentialType: integration.credentialType } : {}),
    ...(integration.credentialName ? { credentialName: integration.credentialName } : {}),
    credentialRequired,
    ...(operation.method ? { method: operation.method } : {}),
    ...(typeof endpoint === 'string' ? { endpoint } : {}),
    parameters,
    headers: { ...integration.defaultHeaders, ...(operation.headers ?? {}) },
    query: { ...(operation.query ?? {}) },
    body: { ...(operation.body ?? {}) },
    requiredParameters: operation.requiredParameters,
    outputMapping: { ...(operation.outputMapping ?? {}) },
    notes: [
      `${integration.name}: ${operation.id.replace(/-/g, ' ')}.`,
      ...(credentialRequired ? ['Credential required; select it in n8n after import.'] : []),
      ...integration.bestPractices.slice(0, 2),
    ],
  }
  return {
    ...node,
    service: integration.name,
    operation: operation.id,
    inputs: { ...node.inputs, ...parameters },
    outputs: { ...node.outputs, ...configuration.outputMapping },
    configuration,
    retry: trigger ? { attempts: 0, backoffSeconds: 0 } : integration.retry,
    timeoutSeconds: integration.timeoutSeconds,
  }
}

function mergeVariables(graph: WorkflowGraph, definitions: IntegrationDefinition[]) {
  const variables = new Map(graph.variables.map(variable => [variable.name, variable]))
  for (const integration of definitions) for (const name of integration.environmentVariables) if (!variables.has(name)) variables.set(name, {
    name,
    description: `${integration.name} configuration value. Provide this during deployment; never store a secret in the workflow.`,
    type: 'string',
    required: true,
  } satisfies WorkflowVariable)
  return [...variables.values()]
}

function mergeCredentials(graph: WorkflowGraph, definitions: IntegrationDefinition[]) {
  const credentials = new Map(graph.credentials.map(credential => [`${credential.service.toLowerCase()}:${credential.name.toLowerCase()}`, credential]))
  for (const integration of definitions) {
    if (!integration.credentialType || !integration.credentialName || integration.authentication === 'none' || integration.authentication === 'webhook') continue
    const credential: WorkflowCredential = { name: integration.credentialName, service: integration.name, description: `${integration.authentication} credential managed by n8n. Configure after import; no secret is embedded.`, required: true }
    credentials.set(`${credential.service.toLowerCase()}:${credential.name.toLowerCase()}`, credential)
  }
  return [...credentials.values()]
}

export function configureWorkflowIntegrations(graph: WorkflowGraph, context: ConfigurationContext = {}) {
  const selected = selectedDefinitions(context.toolPlan)
  const used = new Map<string, IntegrationDefinition>()
  const nodes = graph.nodes.map(node => {
    if (['condition', 'transform', 'delay', 'error-handler'].includes(node.type) && !resolveIntegration(node.service)) return node
    const integration = definitionForNode(node, selected)
    if (!integration) return node
    used.set(integration.id, integration)
    return configureNode(node, integration, context.answers)
  })
  const definitions = [...used.values()]
  return {
    graph: {
      ...graph,
      nodes,
      variables: mergeVariables(graph, definitions),
      credentials: mergeCredentials(graph, definitions),
    },
    integrations: definitions.map(definition => definition.id),
    clarifications: integrationClarificationQuestions(context.toolPlan, context.answers),
  }
}

export function integrationClarificationQuestions(toolPlan?: ToolPlan | null, answers?: Json): IntegrationClarificationQuestion[] {
  const questions: IntegrationClarificationQuestion[] = []
  for (const { definition } of selectedDefinitions(toolPlan)) {
    const values = integrationAnswers(answers, definition)
    for (const clarification of definition.clarifications) if (!meaningful(values[clarification.parameter])) questions.push({
      integrationId: definition.id,
      integrationName: definition.name,
      parameter: clarification.parameter,
      question: clarification.question,
      ...(clarification.options ? { options: clarification.options } : {}),
    })
  }
  return questions
}

export function supportedIntegrationIds() {
  return integrationIntelligenceRegistry.map(integration => integration.id)
}
