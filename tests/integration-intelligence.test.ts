import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { exportN8n, n8nValidationIssues, productionExportIssues } from '@/lib/automation/exporters/n8n'
import { importWorkflow } from '@/lib/automation/importers'
import { layoutWorkflowGraph } from '@/lib/automation/layout'
import { productionGraphValidationIssues } from '@/lib/automation/validation'
import type { WorkflowGraph, WorkflowNode } from '@/lib/automation/types'
import { parseToolPlan } from '@/lib/automation/tool-plan'
import { integrationIntelligenceRegistry } from '@/lib/integrations/intelligence/catalog'
import { configureWorkflowIntegrations, integrationClarificationQuestions, supportedIntegrationIds } from '@/lib/integrations/intelligence/configure'

function node(id: string, type: WorkflowNode['type'], name: string, service: string, operation: string): WorkflowNode {
  return { id, type, name, description: `${name} for this automation.`, service, operation, inputs: {}, outputs: {}, retry: { attempts: type === 'trigger' ? 0 : 3, backoffSeconds: 5 }, timeoutSeconds: 30, position: { x: 0, y: 0 } }
}

function graph(name: string, service: string, operation: string): WorkflowGraph {
  return {
    schemaVersion: 1,
    name,
    description: `Production ${name.toLowerCase()} automation.`,
    nodes: [
      node('trigger', 'trigger', 'Receive Request', 'webhook', 'receive'),
      node('action', 'action', operation.replace(/-/g, ' '), service, operation),
      node('error', 'error-handler', 'Stop With Error', 'logging', 'stop'),
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'action' },
      { id: 'e2', source: 'action', target: 'error', errorPath: true, label: 'Failure' },
    ],
    variables: [], credentials: [], assumptions: [], risks: [],
  }
}

const scenarios = [
  ['Employee Onboarding', 'google-sheets', 'append-row'],
  ['Lead Routing', 'hubspot', 'create-contact'],
  ['CRM Synchronization', 'salesforce', 'update-record'],
  ['Support Automation', 'slack', 'send-message'],
  ['Marketing Automation', 'airtable', 'create-record'],
  ['Invoice Approval', 'stripe', 'create-payment-link'],
  ['Customer Onboarding', 'google-workspace-admin', 'create-user'],
  ['Webhook Processing', 'http-request', 'create'],
] as const

describe('integration intelligence production configuration', () => {
  test('registry exposes complete production metadata for every supported integration', () => {
    const expected = ['google-sheets','gmail','google-drive','google-calendar','google-workspace-admin','slack','microsoft-teams','notion','hubspot','salesforce','airtable','shopify','stripe','discord','webhook','http-request','openai','anthropic','gemini','deepseek','supabase','postgresql','mysql','mongodb','redis','s3','ftp','email','twilio','clickup','asana','jira','github','gitlab','linear','trello']
    assert.deepEqual(supportedIntegrationIds().sort(), expected.sort())
    for (const integration of integrationIntelligenceRegistry) {
      assert.ok(integration.supportedNodes.length > 0, `${integration.name} must declare supported nodes`)
      assert.ok(integration.operations.length > 0, `${integration.name} must declare operations`)
      assert.ok(integration.credentialType || ['none','webhook'].includes(integration.authentication), `${integration.name} must declare a credential type`)
      assert.ok(integration.validationRules.length > 0)
      assert.ok(integration.bestPractices.length > 0)
      for (const operation of integration.operations) {
        assert.ok(operation.n8nOperation)
        assert.ok(Array.isArray(operation.requiredParameters))
        assert.equal(typeof operation.parameters, 'object')
      }
    }
  })

  test('every registered integration configures and exports a valid workflow node', () => {
    for (const integration of integrationIntelligenceRegistry) {
      const configured = configureWorkflowIntegrations(graph(`${integration.name} Automation`, integration.id, integration.operations[0].id)).graph
      const action = configured.nodes.find(candidate => candidate.id === 'action')!
      assert.equal(action.configuration?.integrationId, integration.id)
      assert.deepEqual(productionGraphValidationIssues(layoutWorkflowGraph(configured)), [], integration.name)
      assert.deepEqual(n8nValidationIssues(exportN8n(configured)), [], integration.name)
    }
  })

  for (const [name, service, operation] of scenarios) test(`${name} receives configured nodes and exports cleanly`, () => {
    const configured = configureWorkflowIntegrations(graph(name, service, operation))
    const action = configured.graph.nodes.find(candidate => candidate.id === 'action')!
    assert.equal(action.configuration?.integrationId, service)
    assert.ok(action.configuration?.operation)
    assert.ok(action.configuration?.n8nNodeType)
    assert.ok(Object.keys(action.configuration?.parameters ?? {}).length > 0)
    assert.ok(action.retry.attempts > 0)
    assert.ok(action.timeoutSeconds >= 30)
    if (action.configuration?.credentialRequired) {
      assert.ok(action.configuration.credentialType)
      assert.match(action.configuration.credentialName ?? '', /configure in n8n/i)
    }
    const positioned = layoutWorkflowGraph(configured.graph)
    assert.deepEqual(productionGraphValidationIssues(positioned), [])
    const exported = exportN8n(configured.graph)
    assert.deepEqual(n8nValidationIssues(exported), [])
    assert.deepEqual(productionExportIssues(configured.graph, exported), [])
    assert.equal(JSON.stringify(exported).includes('access_token'), false)
    assert.equal(JSON.stringify(exported).includes('live-secret'), false)
    const imported = importWorkflow(exported, 'n8n').graph
    assert.equal(imported.nodes.length, configured.graph.nodes.length)
  })

  test('HTTP Request receives a non-empty method, endpoint, headers, body, retry and credential placeholder', () => {
    const configured = configureWorkflowIntegrations(graph('Webhook Processing', 'http', 'send payload')).graph
    const action = configured.nodes.find(candidate => candidate.id === 'action')!
    assert.equal(action.configuration?.method, 'POST')
    assert.match(action.configuration?.endpoint ?? '', /API_ENDPOINT_URL/)
    assert.equal(action.configuration?.headers['Content-Type'], 'application/json')
    assert.ok(Object.keys(action.configuration?.body ?? {}).length > 0)
    const exported = exportN8n(configured) as Record<string, unknown>
    const exportedAction = (exported.nodes as Array<Record<string, unknown>>).find(candidate => candidate.id === 'action')!
    const parameters = exportedAction.parameters as Record<string, unknown>
    assert.equal(parameters.method, 'POST')
    assert.ok(parameters.url)
    assert.ok(exportedAction.credentials)
  })

  test('business-specific answers override placeholders while secret fields are never copied', () => {
    const configured = configureWorkflowIntegrations(graph('Slack Alerts', 'slack', 'send-message'), {
      answers: { integrationConfiguration: { slack: { channelId: 'C012345', accessToken: 'do-not-copy' } } },
    }).graph
    const action = configured.nodes.find(candidate => candidate.id === 'action')!
    assert.equal(action.configuration?.parameters.channelId, 'C012345')
    assert.equal(JSON.stringify(configured).includes('do-not-copy'), false)
  })

  test('missing business configuration produces focused non-secret clarification questions', () => {
    const plan = parseToolPlan({
      version: 2,
      summary: 'Slack notification automation.',
      blueprint: { objective: 'Notify HR', trigger: 'New employee', actions: ['Send Slack message'], complexity: 'Low', confidence: 96, estimatedNodes: 4, expectedArtifacts: [] },
      tools: [{ id: 'communication', name: 'Slack', selectedTool: 'Slack', alternatives: ['Microsoft Teams'], category: 'Communication', purpose: 'Internal messaging', usedFor: 'Send HR notifications', recommendationReason: 'Slack is already used by HR.', confidence: 98, credential: 'OAuth', environmentVariables: [{ name: 'SLACK_CHANNEL_ID', purpose: 'Destination channel', required: true }], permissions: ['chat:write'], optionalConfiguration: [], required: true, configured: true, skipped: false, exporterSupported: true, credentialMappable: true, conflictsWith: [] }],
    })
    const questions = integrationClarificationQuestions(plan, {})
    assert.deepEqual(questions.map(question => question.question), ['Which Slack channel should receive notifications?'])
    assert.ok(questions.every(question => !/key|token|password|secret/i.test(question.question)))
    assert.deepEqual(integrationClarificationQuestions(plan, { integrationConfiguration: { slack: { channelId: 'C012345' } } }), [])
  })
})
