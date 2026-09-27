import type { Json } from '@/lib/supabase/types'
import type { WorkflowGraph, WorkflowNode } from '@/lib/automation/types'
import { integrationById } from '@/lib/integrations/intelligence/catalog'

function hasValue(value: Json | undefined) {
  return value !== undefined && value !== null && !(typeof value === 'string' && !value.trim())
}

function expressionIssues(value: Json | undefined, path: string): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => expressionIssues(item, `${path}[${index}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => expressionIssues(item, `${path}.${key}`))
  if (typeof value !== 'string' || !value.includes('{{')) return []
  const opens = (value.match(/\{\{/g) ?? []).length
  const closes = (value.match(/\}\}/g) ?? []).length
  if (opens !== closes || !value.trim().endsWith('}}')) return [`${path} contains an invalid expression.`]
  return []
}

function endpointIssues(node: WorkflowNode) {
  const endpoint = node.configuration?.endpoint
  if (!endpoint) return []
  if (/^https:\/\//i.test(endpoint) || /^=\{\{.+\}\}$/.test(endpoint)) return []
  return [`Node ${node.id} has an invalid or insecure endpoint.`]
}

export function integrationConfigurationIssues(graph: WorkflowGraph) {
  const issues: string[] = []
  for (const node of graph.nodes) {
    const configuration = node.configuration
    if (!configuration) continue
    const definition = integrationById(configuration.integrationId)
    if (!definition) {
      issues.push(`Node ${node.id} references unsupported integration ${configuration.integrationId}.`)
      continue
    }
    if (!definition.supportedNodes.includes(configuration.n8nNodeType) && configuration.n8nNodeType !== 'n8n-nodes-base.webhook') issues.push(`Node ${node.id} uses unsupported n8n node ${configuration.n8nNodeType} for ${definition.name}.`)
    const operation = definition.operations.find(candidate => candidate.n8nOperation === configuration.operation || candidate.id === node.operation)
    if (!operation && node.type !== 'trigger') issues.push(`Node ${node.id} uses unsupported ${definition.name} operation ${configuration.operation}.`)
    for (const parameter of configuration.requiredParameters) {
      const present = hasValue(configuration.parameters[parameter]) || hasValue(configuration.body[parameter]) || hasValue(configuration.query[parameter]) || (parameter === 'url' && hasValue(configuration.endpoint))
      if (!present) issues.push(`Node ${node.id} is missing required ${definition.name} parameter ${parameter}.`)
    }
    if (configuration.credentialRequired && (!configuration.credentialType || !configuration.credentialName)) issues.push(`Node ${node.id} is missing its ${definition.name} credential reference.`)
    if (configuration.authentication !== (node.type === 'trigger' ? 'webhook' : definition.authentication)) issues.push(`Node ${node.id} has incompatible authentication for ${definition.name}.`)
    issues.push(...endpointIssues(node))
    issues.push(...expressionIssues(configuration.parameters, `nodes.${node.id}.configuration.parameters`))
    issues.push(...expressionIssues(configuration.headers, `nodes.${node.id}.configuration.headers`))
    issues.push(...expressionIssues(configuration.query, `nodes.${node.id}.configuration.query`))
    issues.push(...expressionIssues(configuration.body, `nodes.${node.id}.configuration.body`))
  }
  return [...new Set(issues)]
}
