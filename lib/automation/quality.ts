import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from '@/lib/automation/types'

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${key}:${stable(item)}`).join(',')}}`
  return JSON.stringify(value)
}

function conditionSignature(node: WorkflowNode) {
  return stable({ type: node.type, description: node.description, service: node.service, operation: node.operation, inputs: node.inputs, outputs: node.outputs, retry: node.retry, timeoutSeconds: node.timeoutSeconds })
}

function edgeSignature(edge: WorkflowEdge) {
  return `${edge.source}\u0000${edge.target}\u0000${edge.condition ?? ''}\u0000${edge.errorPath === true}`
}

function conciseLabel(label: string | undefined) {
  if (!label || label.length <= 48) return label
  const words = label.split(/\s+/)
  let output = ''
  for (const word of words) {
    if (`${output} ${word}`.trim().length > 47) break
    output = `${output} ${word}`.trim()
  }
  return `${output || label.slice(0, 47)}…`
}

/** Applies only semantics-preserving graph cleanup before layout/export. */
export function optimizeWorkflowGraph(graph: WorkflowGraph): WorkflowGraph {
  const uniqueEdges = new Map<string, WorkflowEdge>()
  graph.edges.forEach(edge => {
    const key = edgeSignature(edge)
    if (!uniqueEdges.has(key)) uniqueEdges.set(key, { ...edge, label: conciseLabel(edge.label) })
  })
  let nodes = graph.nodes.map(node => ({ ...node }))
  let edges = [...uniqueEdges.values()]

  // Merge only structurally and semantically identical condition copies.
  const conditions = nodes.filter(node => node.type === 'condition')
  for (let index = 0; index < conditions.length; index += 1) for (let candidateIndex = index + 1; candidateIndex < conditions.length; candidateIndex += 1) {
    const keep = conditions[index]
    const duplicate = conditions[candidateIndex]
    if (!nodes.some(node => node.id === duplicate.id) || conditionSignature(keep) !== conditionSignature(duplicate)) continue
    const inbound = (id: string) => edges.filter(edge => edge.target === id).map(edge => `${edge.source}:${edge.condition ?? ''}:${edge.errorPath === true}`).sort()
    const outbound = (id: string) => edges.filter(edge => edge.source === id).map(edge => `${edge.target}:${edge.condition ?? ''}:${edge.errorPath === true}`).sort()
    if (stable(inbound(keep.id)) !== stable(inbound(duplicate.id)) || stable(outbound(keep.id)) !== stable(outbound(duplicate.id))) continue
    nodes = nodes.filter(node => node.id !== duplicate.id)
    edges = edges.filter(edge => edge.source !== duplicate.id && edge.target !== duplicate.id)
  }
  return { ...graph, nodes, edges }
}
