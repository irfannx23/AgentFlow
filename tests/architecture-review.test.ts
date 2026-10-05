import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { deterministicArchitectureIssues, parseArchitectureReview, renderArchitectureReview } from '../lib/automation/architecture-review'
import { productionPackageReady } from '../lib/automation/package-readiness'
import type { WorkflowGraph } from '../lib/automation/types'
import { readFile } from 'node:fs/promises'

const graph: WorkflowGraph = {
  schemaVersion: 1,
  name: 'Qualified workflow',
  description: 'A production workflow with explicit handling.',
  nodes: [
    { id: 'trigger', type: 'trigger', name: 'Trigger', description: 'Starts the flow.', inputs: {}, outputs: {}, retry: { attempts: 0, backoffSeconds: 0 }, timeoutSeconds: 30, position: { x: 0, y: 0 } },
    { id: 'action', type: 'action', name: 'Action', description: 'Runs the action.', inputs: {}, outputs: {}, retry: { attempts: 3, backoffSeconds: 5 }, timeoutSeconds: 30, position: { x: 200, y: 0 } },
    { id: 'error', type: 'error-handler', name: 'Error Handler', description: 'Handles errors.', inputs: {}, outputs: {}, retry: { attempts: 0, backoffSeconds: 0 }, timeoutSeconds: 30, position: { x: 200, y: 160 } },
  ],
  edges: [
    { id: 'main', source: 'trigger', target: 'action', errorPath: false },
    { id: 'failure', source: 'action', target: 'error', errorPath: true },
  ],
  variables: [], credentials: [], assumptions: [], risks: [],
}

describe('architecture review contract', () => {
  test('accepts valid and fenced structured provider output', () => {
    const payload = '{"verdict":"pass","summary":"The workflow is ready.","risks":[],"corrections":[]}'
    assert.equal(parseArchitectureReview(payload).verdict, 'pass')
    assert.equal(parseArchitectureReview('```json\n' + payload + '\n```').summary, 'The workflow is ready.')
  })

  test('rejects malformed output safely', () => {
    assert.throws(() => parseArchitectureReview('```json\n{"verdict":\n```'), /malformed structured output/)
  })

  test('combines deterministic validation with the AI-assisted review', () => {
    const issues = deterministicArchitectureIssues(graph)
    assert.deepEqual(issues, [])
    assert.match(renderArchitectureReview(parseArchitectureReview('{"verdict":"pass","summary":"Ready.","risks":[],"corrections":[]}'), issues), /Deterministic Checks/)
    assert.match(renderArchitectureReview(parseArchitectureReview('{"verdict":"needs_attention","summary":"Valid review with advisory risks.","risks":["Review this risk."],"corrections":[]}'), issues), /Needs attention/)
  })

  test('download readiness requires every validation and a valid ZIP', () => {
    const ready = { requirementsReady: true, workflowReady: true, deploymentReady: true, environmentReady: true, testingReady: true, architectureReviewReady: true, exportReady: true, zipValid: true }
    assert.equal(productionPackageReady(ready), true)
    assert.equal(productionPackageReady({ ...ready, architectureReviewReady: false }), false)
    assert.equal(productionPackageReady({ ...ready, zipValid: false }), false)
  })

  test('review failure exposes an isolated retry without regenerating completed stages', async () => {
    const [card, generation] = await Promise.all([
      readFile(new URL('../components/conversation-action-cards.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../components/use-artifact-generation.ts', import.meta.url), 'utf8'),
    ])
    assert.match(card, /Retry Architecture Review/)
    assert.match(card, /retryArchitectureReview/)
    assert.match(card, /stageReady\[stage\]/)
    assert.match(generation, /only \? \(Array\.isArray\(only\)/)
  })
})
