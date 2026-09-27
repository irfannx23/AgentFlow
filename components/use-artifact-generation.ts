'use client'

import { useCallback, useRef } from 'react'
import { useAuth } from '@/components/account-state'
import { useAI, type ArtifactStage } from '@/components/ai-provider'
import { useConnections } from '@/components/connections-provider'
import type { Project } from '@/components/workspace-state'
import { exportN8n, productionExportIssues } from '@/lib/automation/exporters/n8n'
import { isWorkflowGraph, type WorkflowGraph } from '@/lib/automation/types'
import type { ConnectionModel } from '@/lib/connections/types'
import type { Json, Tables } from '@/lib/supabase/types'
import { getAutomationRequirements, getAutomationWorkflow, listAutomationExports } from '@/lib/supabase/intelligence'
import { newLifecycleRequestId, reportClientLifecycle } from '@/lib/observability/client'

type UpdateProject = (projectId: string, values: { description?: string; phase?: string }) => Promise<void>
type WorkflowRow = Tables<'automation_workflows'>
export type GenerationChange = {
  summary?: string
  reasoning?: string
  added?: string[]
  modified?: string[]
  removed?: string[]
  versionBump?: 'patch'|'major'
  author?: 'ai'|'user'|'system'
}

const stageLabels: Record<ArtifactStage, string> = {
  requirements: 'Requirements Saved', workflow: 'Workflow Generated', deployment: 'Deployment Guide Ready',
  environment: 'Environment Ready', testing: 'Testing Checklist Ready', review: 'Architecture Review Ready', export: 'Export Ready',
}

function notify(project: Project, stage: ArtifactStage) {
  window.dispatchEvent(new CustomEvent('agentflow:artifact-complete', { detail: {
    id: `${project.id}:${stage}:${Date.now()}`,
    projectId: project.id,
    stage,
    icon: '✓',
    title: stageLabels[stage],
    body: `${project.name} is ready to review.`,
    action: `View ${stage === 'export' ? 'Export' : stageLabels[stage].replace(/ (Saved|Generated|Ready)$/, '')}`,
  } }))
}

async function workflowHash(graph: WorkflowGraph) {
  const bytes = new TextEncoder().encode(JSON.stringify(graph))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
}

function nextVersionLabel(current: Tables<'automation_versions'> | undefined, bump: 'patch'|'major' = 'patch') {
  if (!current) return 'v1.0'
  const match = current.label.match(/^v(\d+)\.(\d+)$/)
  const major = Number(match?.[1] ?? 1)
  const minor = Number(match?.[2] ?? 0)
  return bump === 'major' ? `v${major + 1}.0` : `v${major}.${minor + 1}`
}

export function useArtifactGeneration() {
  const { user } = useAuth()
  const ai = useAI()
  const connections = useConnections()
  const queue = useRef(Promise.resolve())

  const preferredModel = useCallback((override?: ConnectionModel | null) => {
    if (override) return override
    const connected = new Set(connections.connections.filter(item => item.status === 'connected').map(item => item.provider))
    return connections.defaultModel ?? connections.models.find(item => connected.has(item.provider)) ?? null
  }, [connections.connections, connections.defaultModel, connections.models])

  const request = useCallback(async (project: Project, model: ConnectionModel, body: Record<string, unknown>, requestId?: string, tokenOverride?: string) => {
    if (!user) throw new Error('Sign in to generate project artifacts.')
    const response = await fetch('/api/intelligence/generate', {
      method: 'POST',
      headers: { authorization: `Bearer ${tokenOverride ?? await user.getIdToken()}`, 'content-type': 'application/json', ...(requestId ? { 'x-request-id': requestId } : {}) },
      body: JSON.stringify({ projectId: project.id, provider: model.provider, model: model.id, ...body }),
    })
    const payload = await response.json()
    if (!response.ok) {
      if (payload.error && typeof payload.error === 'object') {
        const issues = Array.isArray(payload.error.issues) ? ` ${payload.error.issues.join(' ')}` : ''
        throw new Error(`${String(payload.error.message ?? 'Artifact generation failed.')}${issues}`)
      }
      throw new Error(typeof payload.error === 'string' ? payload.error : 'Artifact generation failed.')
    }
    return payload
  }, [user])

  const retry = useCallback(async <T,>(projectId: string, stage: ArtifactStage, operation: () => Promise<T>) => {
    let failure: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      ai.setArtifactJob(projectId, stage, 'generating')
      try { return await operation() } catch (error) {
        failure = error
        const message = error instanceof Error ? error.message : ''
        const transient = /temporar|timeout|timed out|unavailable|network|fetch|rate limit|503|429/i.test(message)
        // Validation failures get one isolated repair/regeneration attempt; transient
        // provider failures get one additional attempt with exponential backoff.
        const finalAttempt = transient ? 2 : 1
        if (attempt >= finalAttempt) break
        await new Promise(resolve => window.setTimeout(resolve, 400 * (2 ** attempt)))
      }
    }
    const message = failure instanceof Error ? failure.message : `${stageLabels[stage]} failed.`
    ai.setArtifactJob(projectId, stage, 'error', message)
    throw failure
  }, [ai])

  const start = useCallback((project: Project, updateProject: UpdateProject, only?: ArtifactStage|ArtifactStage[], modelOverride?: ConnectionModel | null, change: GenerationChange = {}) => {
    const lifecycleRequestId = newLifecycleRequestId()
    queue.current = queue.current.catch(() => undefined).then(async () => {
      const lifecycleToken = user ? await user.getIdToken() : ''
      const model = preferredModel(modelOverride)
      if (!model) throw new Error('Connect an AI provider before generating artifacts.')
      const stages: ArtifactStage[] = only ? (Array.isArray(only) ? [...new Set(only)] : [only]) : ['workflow','deployment','environment','testing','review','export']
      if (lifecycleToken) void reportClientLifecycle(lifecycleToken, { requestId: lifecycleRequestId, stage: 'artifact-scheduling', event: 'artifacts.execution_started', projectId: project.id, status: 'started', context: { stages } })
      if (!only) stages.forEach((stage, index) => ai.setArtifactJob(project.id, stage, index === 0 ? 'generating' : 'queued'))
      let workflow: WorkflowRow | null = ai.projectId === project.id ? ai.workflow : null
      if (!workflow) workflow = await getAutomationWorkflow(project.id)
      let graph: WorkflowGraph | null = workflow && isWorkflowGraph(workflow.graph) ? workflow.graph : null
      let latestExport: Tables<'automation_exports'> | null = ai.projectId === project.id ? ai.exports[0] ?? null : (await listAutomationExports(project.id))[0] ?? null
      const failedStages = new Set<ArtifactStage>()

      if (stages.includes('requirements')) {
        await ai.loadProjectIntelligence(project.id)
        ai.setArtifactJob(project.id, 'requirements', 'complete')
        notify(project, 'requirements')
      }

      if (stages.includes('workflow')) {
        try {
          const generatedWorkflow = await retry(project.id, 'workflow', async () => {
            const generated = await request(project, model, { agentId: 'designer', task: 'workflow', prompt: 'Generate the complete provider-neutral internal workflow graph from the saved requirements and indexed project knowledge.' }, lifecycleRequestId, lifecycleToken)
            ai.setArtifactJob(project.id, 'workflow', 'validating')
            if (!isWorkflowGraph(generated.workflow)) throw new Error('The generated internal workflow failed schema validation.')
            const validatedGraph:WorkflowGraph = generated.workflow
            ai.setArtifactJob(project.id, 'workflow', 'persisting')
            const saved = await ai.saveWorkflow({ id: workflow?.id, project_id: project.id, name: validatedGraph.name, status: 'generated', graph: validatedGraph as unknown as Json, version: (workflow?.version ?? 0) + 1 })
            return { graph: validatedGraph, workflow: saved }
          })
          graph = generatedWorkflow.graph
          workflow = generatedWorkflow.workflow
          await updateProject(project.id, { phase: 'Workflow Generation' })
          ai.setArtifactJob(project.id, 'workflow', 'complete')
          notify(project, 'workflow')
          await ai.addTimelineEvent({ project_id: project.id, event_type: 'artifact_generated', title: stageLabels.workflow, description: `Validated workflow version ${workflow.version} was persisted.`, metadata: { stage: 'workflow' } })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Workflow generation failed.'
          ai.setArtifactJob(project.id, 'workflow', 'error', message)
          if (lifecycleToken) void reportClientLifecycle(lifecycleToken, { requestId: lifecycleRequestId, stage: 'artifact-generation', event: 'artifact.failed', projectId: project.id, status: 'failed', error, context: { artifact: 'workflow' } })
          if (!only) return
          throw error
        }
      }

      if (!workflow || !graph) {
        const message = 'A validated workflow is required before generating this artifact.'
        stages.filter(stage => stage !== 'requirements' && stage !== 'workflow').forEach(stage => ai.setArtifactJob(project.id, stage, 'error', message))
        return
      }

      const savePatch = async (patch: Partial<Pick<WorkflowRow, 'deployment_guide'|'environment_variables'|'testing_checklist'|'explanation'|'status'>>) => {
        workflow = await ai.saveWorkflow({ id: workflow!.id, project_id: project.id, name: workflow!.name, graph: workflow!.graph, version: workflow!.version, ...patch })
      }
      const jobs: Array<{ stage: ArtifactStage; run: () => Promise<void> }> = [
        { stage: 'deployment', run: async () => { const value = await request(project, model, { agentId: 'generator', task: 'deployment', prompt: 'Create only the deployment guide for the persisted workflow.' }, lifecycleRequestId, lifecycleToken); await savePatch({ deployment_guide: String(value.deploymentGuide ?? '') }) } },
        { stage: 'environment', run: async () => { const value = await request(project, model, { agentId: 'generator', task: 'environment', prompt: 'Generate only the environment variable manifest required by the persisted workflow.' }, lifecycleRequestId, lifecycleToken); await savePatch({ environment_variables: (value.environmentVariables ?? []) as Json }) } },
        { stage: 'testing', run: async () => { const value = await request(project, model, { agentId: 'generator', task: 'testing', prompt: 'Generate only the testing checklist for the persisted workflow.' }, lifecycleRequestId, lifecycleToken); await savePatch({ testing_checklist: (value.testingChecklist ?? []) as Json }) } },
        { stage: 'review', run: async () => { const value = await request(project, model, { agentId: 'reviewer', task: 'review', prompt: 'Review only the persisted internal workflow architecture. Report risks, failure modes, and concrete corrections.' }, lifecycleRequestId, lifecycleToken); await savePatch({ explanation: String(value.review ?? ''), status: 'reviewed' }); await updateProject(project.id, { phase: 'Review' }) } },
        { stage: 'export', run: async () => { ai.setArtifactJob(project.id, 'export', 'validating'); const payload = exportN8n(graph!); const issues = productionExportIssues(graph!, payload); if (issues.length) throw new Error(`Production export validation failed: ${issues.join(' ')}`); latestExport = await ai.saveExport({ workflow_id: workflow!.id, project_id: project.id, platform: 'n8n', workflow_version: workflow!.version, payload }); await updateProject(project.id, { phase: 'Export' }) } },
      ]
      for (const job of jobs.filter(item => stages.includes(item.stage))) {
        try {
          await retry(project.id, job.stage, job.run)
          ai.setArtifactJob(project.id, job.stage, 'complete')
          notify(project, job.stage)
          await ai.addTimelineEvent({ project_id: project.id, event_type: 'artifact_generated', title: stageLabels[job.stage], description: `${job.stage} completed and passed validation.`, metadata: { stage: job.stage } })
        } catch (error) {
          failedStages.add(job.stage)
          if (lifecycleToken) void reportClientLifecycle(lifecycleToken, { requestId: lifecycleRequestId, stage: 'artifact-generation', event: 'artifact.failed', projectId: project.id, status: 'failed', error, context: { artifact: job.stage } })
        }
      }
      if (workflow && graph && failedStages.size === 0) {
        const label = nextVersionLabel(ai.versions[0], change.versionBump)
        const currentRequirements = await getAutomationRequirements(project.id)
        await ai.createVersion({
          project_id: project.id,
          label,
          change_summary: change.summary ?? (ai.versions.length ? 'Updated automation artifacts' : 'Initial generation'),
          modified_artifacts: stages as unknown as Json,
          change_details: { added: change.added ?? [], modified: change.modified ?? [], removed: change.removed ?? [] },
          ai_reasoning: change.reasoning ?? null,
          workflow_hash: await workflowHash(graph),
          author: change.author ?? 'ai',
          snapshot: { requirements: currentRequirements, workflow, export: latestExport },
        })
        await ai.addTimelineEvent({ project_id: project.id, event_type: 'version', title: `${label} published`, description: change.summary ?? 'Validated automation artifacts were updated.', metadata: { label, modifiedArtifacts: stages } })
      }
    }).catch(error => {
      const stage = Array.isArray(only) ? only[0] ?? 'workflow' : only ?? 'workflow'
      ai.setArtifactJob(project.id, stage, 'error', error instanceof Error ? error.message : 'Artifact generation failed.')
      if (user) void user.getIdToken().then(token => reportClientLifecycle(token, { requestId: lifecycleRequestId, stage: 'artifact-scheduling', event: 'artifacts.execution_failed', projectId: project.id, status: 'failed', error, context: { artifact: stage } })).catch(() => undefined)
    })
    return queue.current
  }, [ai, preferredModel, request, retry, user])

  return { start }
}
