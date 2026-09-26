import type { Json } from '@/lib/supabase/types'
import { workflowValidationIssues, type WorkflowEdge, type WorkflowGraph } from '@/lib/automation/types'

const SECRET_KEY = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|client[_-]?secret|private[_-]?key|authorization)/i
const SAFE_SECRET_VALUE = /^(?:\$\{|\{\{|<|\[|env:|secret:|credential:|redacted|masked|replace[_ -]?me|your[_ -]?)/i

function findSecretIssues(value: Json | undefined, path = 'inputs'): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => findSecretIssues(item, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, item]) => {
    const location = `${path}.${key}`
    if (SECRET_KEY.test(key) && typeof item === 'string' && item.trim() && !SAFE_SECRET_VALUE.test(item.trim())) return [`${location} appears to contain a literal secret. Use a credential or environment reference.`]
    return findSecretIssues(item, location)
  })
}

function cycleIssues(graph: WorkflowGraph) {
  const outgoing = new Map(graph.nodes.map(node => [node.id, [] as WorkflowEdge[]]))
  graph.edges.forEach(edge => outgoing.get(edge.source)?.push(edge))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const path: string[] = []
  const issues = new Set<string>()
  const intentional = (ids: string[], edges: WorkflowEdge[]) => ids.some(id => graph.nodes.find(node => node.id === id)?.type === 'delay') || edges.some(edge => /loop|repeat|retry/i.test(`${edge.label ?? ''} ${edge.condition ?? ''}`))
  const visit = (id: string) => {
    if (visiting.has(id)) {
      const start = path.indexOf(id)
      const ids = path.slice(start)
      const cycleEdges = ids.map((source, index) => (outgoing.get(source) ?? []).find(edge => edge.target === ids[(index + 1) % ids.length])).filter((edge): edge is WorkflowEdge => Boolean(edge))
      if (!intentional(ids, cycleEdges)) issues.add(`Unintentional execution cycle detected: ${[...ids, id].join(' → ')}.`)
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    path.push(id)
    ;(outgoing.get(id) ?? []).forEach(edge => visit(edge.target))
    path.pop()
    visiting.delete(id)
    visited.add(id)
  }
  graph.nodes.forEach(node => visit(node.id))
  return [...issues]
}

export function productionGraphValidationIssues(graph: WorkflowGraph) {
  const issues = [...workflowValidationIssues(graph), ...cycleIssues(graph)]
  const positions = new Set<string>()
  graph.nodes.forEach(node => {
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) issues.push(`Node ${node.id} has non-finite coordinates.`)
    if (node.position.x % 40 !== 0 || node.position.y % 40 !== 0) issues.push(`Node ${node.id} is not aligned to the layout grid.`)
    const position = `${node.position.x}:${node.position.y}`
    if (positions.has(position)) issues.push(`Node ${node.id} overlaps another node at ${position}.`)
    positions.add(position)
    issues.push(...findSecretIssues(node.inputs as Json, `nodes.${node.id}.inputs`))
  })
  return [...new Set(issues)]
}
