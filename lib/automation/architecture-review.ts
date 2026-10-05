import { workflowValidationIssues, type WorkflowGraph } from '@/lib/automation/types'

export type ArchitectureReview = {
  verdict: 'pass' | 'needs_attention'
  summary: string
  risks: string[]
  corrections: string[]
}

function jsonSource(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return (fenced?.[1] ?? trimmed).trim()
}

export function parseArchitectureReview(text: string): ArchitectureReview {
  const source = jsonSource(text)
  let value: unknown
  try { value = JSON.parse(source) } catch {
    throw new Error('Architecture review returned malformed structured output.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Architecture review returned an invalid structured object.')
  const record = value as Record<string, unknown>
  const risks = Array.isArray(record.risks) ? record.risks.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim()) : []
  const corrections = Array.isArray(record.corrections) ? record.corrections.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim()) : []
  if ((record.verdict !== 'pass' && record.verdict !== 'needs_attention') || typeof record.summary !== 'string' || !record.summary.trim())
    throw new Error('Architecture review does not match the required schema.')
  return { verdict: record.verdict, summary: record.summary.trim(), risks, corrections }
}

export function deterministicArchitectureIssues(graph: WorkflowGraph) {
  const issues = workflowValidationIssues(graph)
  if (!graph.nodes.some(node => node.type === 'error-handler')) issues.push('The workflow has no explicit error-handler node.')
  if (graph.nodes.filter(node => node.type !== 'trigger').some(node => node.timeoutSeconds <= 0)) issues.push('Every executable node must declare a positive timeout.')
  return [...new Set(issues)]
}

export function renderArchitectureReview(review: ArchitectureReview, deterministicIssues: string[]) {
  const deterministic = deterministicIssues.length ? deterministicIssues.map(item => `- ${item}`).join('\n') : '- Passed schema, graph, timeout, and explicit error-path checks.'
  const risks = review.risks.length ? review.risks.map(item => `- ${item}`).join('\n') : '- No additional AI-assisted risks were identified.'
  const corrections = review.corrections.length ? review.corrections.map(item => `- ${item}`).join('\n') : '- No corrective changes are required.'
  return `# Architecture Review\n\n## Verdict\n\n${review.verdict === 'pass' ? 'Pass' : 'Needs attention'}\n\n## Summary\n\n${review.summary}\n\n## Deterministic Checks\n\n${deterministic}\n\n## Risks\n\n${risks}\n\n## Recommended Corrections\n\n${corrections}\n`
}
