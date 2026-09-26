'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/account-state'
import {
  deleteProjectSuggestion,
  deletePromptTemplate,
  listProjectRoadmaps,
  listProjectSuggestions,
  listPromptTemplates,
  saveProjectRoadmap,
  saveProjectSuggestion,
  savePromptTemplate,
  getAutomationRequirements,
  getAutomationWorkflow,
  listAutomationExports,
  saveAutomationRequirements,
  saveAutomationWorkflow,
  createAutomationExport,
  createAutomationVersion,
  createProjectTimelineEvent,
  createWorkflowImport,
  listAutomationVersions,
  listProjectTimeline,
  listWorkflowImports,
} from '@/lib/supabase/intelligence'
import type { Tables, TablesInsert } from '@/lib/supabase/types'

export type ArtifactStage = 'requirements' | 'workflow' | 'deployment' | 'environment' | 'testing' | 'review' | 'export'
export type ArtifactJobStatus = 'queued' | 'generating' | 'validating' | 'persisting' | 'complete' | 'error'
export type ArtifactJob = { status: ArtifactJobStatus; updatedAt: string; error?: string }

type AIState = {
  projectId: string | null
  promptTemplates: Tables<'prompt_templates'>[]
  suggestions: Tables<'project_suggestions'>[]
  roadmaps: Tables<'project_roadmaps'>[]
  roadmap: Tables<'project_roadmaps'> | null
  loading: boolean
  requirements: Tables<'automation_requirements'> | null
  workflow: Tables<'automation_workflows'> | null
  exports: Tables<'automation_exports'>[]
  versions: Tables<'automation_versions'>[]
  timeline: Tables<'project_timeline'>[]
  imports: Tables<'workflow_imports'>[]
  artifactJobs: Record<string, Partial<Record<ArtifactStage, ArtifactJob>>>
  setArtifactJob: (projectId: string, stage: ArtifactStage, status: ArtifactJobStatus, error?: string) => void
  loadProjectIntelligence: (projectId: string) => Promise<void>
  savePrompt: (values: Omit<TablesInsert<'prompt_templates'>, 'owner_id'> & { id?: string }) => Promise<Tables<'prompt_templates'>>
  removePrompt: (id: string) => Promise<void>
  saveSuggestion: (values: Omit<TablesInsert<'project_suggestions'>, 'owner_id'> & { id?: string }) => Promise<Tables<'project_suggestions'>>
  removeSuggestion: (id: string) => Promise<void>
  saveRoadmap: (values: Omit<TablesInsert<'project_roadmaps'>, 'owner_id'> & { id?: string }) => Promise<Tables<'project_roadmaps'>>
  saveRequirements: (values: Omit<TablesInsert<'automation_requirements'>, 'owner_id'> & { id?: string }) => Promise<Tables<'automation_requirements'>>
  saveWorkflow: (values: Omit<TablesInsert<'automation_workflows'>, 'owner_id'> & { id?: string }) => Promise<Tables<'automation_workflows'>>
  saveExport: (values: Omit<TablesInsert<'automation_exports'>, 'owner_id'>) => Promise<Tables<'automation_exports'>>
  createVersion: (values: Omit<TablesInsert<'automation_versions'>, 'owner_id'|'sequence'>) => Promise<Tables<'automation_versions'>>
  addTimelineEvent: (values: Omit<TablesInsert<'project_timeline'>, 'owner_id'>) => Promise<Tables<'project_timeline'>>
  saveImport: (values: Omit<TablesInsert<'workflow_imports'>, 'owner_id'>) => Promise<Tables<'workflow_imports'>>
}

const AIContext = createContext<AIState | null>(null)

export function AIProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [promptTemplates, setPromptTemplates] = useState<Tables<'prompt_templates'>[]>([])
  const [suggestions, setSuggestions] = useState<Tables<'project_suggestions'>[]>([])
  const [roadmaps, setRoadmaps] = useState<Tables<'project_roadmaps'>[]>([])
  const [roadmap, setRoadmap] = useState<Tables<'project_roadmaps'> | null>(null)
  const [loading, setLoading] = useState(false)
  const [requirements, setRequirements] = useState<Tables<'automation_requirements'> | null>(null)
  const [workflow, setWorkflow] = useState<Tables<'automation_workflows'> | null>(null)
  const [exports, setExports] = useState<Tables<'automation_exports'>[]>([])
  const [versions, setVersions] = useState<Tables<'automation_versions'>[]>([])
  const [timeline, setTimeline] = useState<Tables<'project_timeline'>[]>([])
  const [imports, setImports] = useState<Tables<'workflow_imports'>[]>([])
  const [artifactJobs, setArtifactJobs] = useState<Record<string, Partial<Record<ArtifactStage, ArtifactJob>>>>({})
  const requestGeneration = useRef(0)
  const activeProjectId = useRef<string|null>(null)

  const clear = useCallback(() => {
    activeProjectId.current = null
    setProjectId(null)
    setPromptTemplates([])
    setSuggestions([])
    setRoadmaps([])
    setRoadmap(null)
    setRequirements(null)
    setWorkflow(null)
    setExports([])
    setVersions([])
    setTimeline([])
    setImports([])
  }, [])

  useEffect(() => {
    if (user) return
    requestGeneration.current += 1
    clear()
    setLoading(false)
  }, [clear, user])

  const loadProjectIntelligence = useCallback(async (nextProjectId: string) => {
    const generation = ++requestGeneration.current
    setLoading(true)
    clear()
    activeProjectId.current = nextProjectId
    setProjectId(nextProjectId)
    try {
      const [templates, nextSuggestions, nextRoadmap, nextRequirements, nextWorkflow, nextExports, nextVersions, nextTimeline, nextImports] = await Promise.all([
        listPromptTemplates(nextProjectId),
        listProjectSuggestions(nextProjectId),
        listProjectRoadmaps(nextProjectId),
        getAutomationRequirements(nextProjectId),
        getAutomationWorkflow(nextProjectId),
        listAutomationExports(nextProjectId),
        listAutomationVersions(nextProjectId),
        listProjectTimeline(nextProjectId),
        listWorkflowImports(nextProjectId),
      ])
      if (generation !== requestGeneration.current) return
      setPromptTemplates(templates)
      setSuggestions(nextSuggestions)
      setRoadmaps(nextRoadmap)
      setRoadmap(nextRoadmap.find(item => item.status === 'current') ?? nextRoadmap[0] ?? null)
      setRequirements(nextRequirements)
      setWorkflow(nextWorkflow)
      setExports(nextExports)
      setVersions(nextVersions)
      setTimeline(nextTimeline)
      setImports(nextImports)
    } finally {
      if (generation === requestGeneration.current) setLoading(false)
    }
  }, [clear])

  const savePrompt = useCallback(async (values: Omit<TablesInsert<'prompt_templates'>, 'owner_id'> & { id?: string }) => {
    if (!user) throw new Error('Sign in to save prompt templates.')
    const template = await savePromptTemplate({ ...values, owner_id: user.uid })
    setPromptTemplates(current => [template, ...current.filter(item => item.id !== template.id)])
    return template
  }, [user])

  const saveRequirements = useCallback(async (values: Omit<TablesInsert<'automation_requirements'>, 'owner_id'> & { id?: string }) => {
    if (!user) throw new Error('Sign in to save requirements.')
    const saved = await saveAutomationRequirements({ ...values, owner_id: user.uid })
    if (!activeProjectId.current || activeProjectId.current === saved.project_id) {
      requestGeneration.current += 1
      activeProjectId.current = saved.project_id
      setProjectId(saved.project_id)
      setRequirements(saved)
      setLoading(false)
    }
    return saved
  }, [user])

  const saveWorkflow = useCallback(async (values: Omit<TablesInsert<'automation_workflows'>, 'owner_id'> & { id?: string }) => {
    if (!user) throw new Error('Sign in to save workflows.')
    const saved = await saveAutomationWorkflow({ ...values, owner_id: user.uid })
    if (!activeProjectId.current || activeProjectId.current === saved.project_id) {
      requestGeneration.current += 1
      activeProjectId.current = saved.project_id
      setProjectId(saved.project_id)
      setWorkflow(saved)
      setLoading(false)
    }
    return saved
  }, [user])

  const saveExport = useCallback(async (values: Omit<TablesInsert<'automation_exports'>, 'owner_id'>) => {
    if (!user) throw new Error('Sign in to export workflows.')
    const saved = await createAutomationExport({ ...values, owner_id: user.uid })
    if (!activeProjectId.current || activeProjectId.current === saved.project_id) {
      requestGeneration.current += 1
      activeProjectId.current = saved.project_id
      setProjectId(saved.project_id)
      setExports(current => [saved, ...current])
      setLoading(false)
    }
    return saved
  }, [user])

  const createVersion = useCallback(async (values: Omit<TablesInsert<'automation_versions'>, 'owner_id'|'sequence'>) => {
    if (!user) throw new Error('Sign in to create project versions.')
    const current = await listAutomationVersions(values.project_id)
    const saved = await createAutomationVersion({ ...values, owner_id: user.uid, sequence: (current[0]?.sequence ?? 0) + 1 })
    if (activeProjectId.current === saved.project_id) setVersions(items => [saved, ...items])
    return saved
  }, [user])

  const addTimelineEvent = useCallback(async (values: Omit<TablesInsert<'project_timeline'>, 'owner_id'>) => {
    if (!user) throw new Error('Sign in to update the project timeline.')
    const saved = await createProjectTimelineEvent({ ...values, owner_id: user.uid })
    if (activeProjectId.current === saved.project_id) setTimeline(items => [saved, ...items])
    return saved
  }, [user])

  const saveImport = useCallback(async (values: Omit<TablesInsert<'workflow_imports'>, 'owner_id'>) => {
    if (!user) throw new Error('Sign in to import workflows.')
    const saved = await createWorkflowImport({ ...values, owner_id: user.uid })
    if (activeProjectId.current === saved.project_id) setImports(items => [saved, ...items])
    return saved
  }, [user])

  const setArtifactJob = useCallback((targetProjectId: string, stage: ArtifactStage, status: ArtifactJobStatus, error?: string) => {
    setArtifactJobs(current => ({
      ...current,
      [targetProjectId]: { ...current[targetProjectId], [stage]: { status, updatedAt: new Date().toISOString(), ...(error ? { error } : {}) } },
    }))
  }, [])

  const removePrompt = useCallback(async (id: string) => {
    await deletePromptTemplate(id)
    setPromptTemplates(current => current.filter(item => item.id !== id))
  }, [])

  const saveSuggestion = useCallback(async (values: Omit<TablesInsert<'project_suggestions'>, 'owner_id'> & { id?: string }) => {
    if (!user) throw new Error('Sign in to save automation suggestions.')
    const suggestion = await saveProjectSuggestion({ ...values, owner_id: user.uid })
    setSuggestions(current => [suggestion, ...current.filter(item => item.id !== suggestion.id)])
    return suggestion
  }, [user])

  const removeSuggestion = useCallback(async (id: string) => {
    await deleteProjectSuggestion(id)
    setSuggestions(current => current.filter(item => item.id !== id))
  }, [])

  const saveRoadmap = useCallback(async (values: Omit<TablesInsert<'project_roadmaps'>, 'owner_id'> & { id?: string }) => {
    if (!user) throw new Error('Sign in to save automation deployment plans.')
    const nextRoadmap = await saveProjectRoadmap({ ...values, owner_id: user.uid })
    setRoadmaps(current => [nextRoadmap, ...current.filter(item => item.id !== nextRoadmap.id)])
    if (nextRoadmap.status === 'current') setRoadmap(nextRoadmap)
    return nextRoadmap
  }, [user])

  const value = useMemo(() => ({ projectId, promptTemplates, suggestions, roadmaps, roadmap, requirements, workflow, exports, versions, timeline, imports, artifactJobs, setArtifactJob, loading, loadProjectIntelligence, savePrompt, removePrompt, saveSuggestion, removeSuggestion, saveRoadmap, saveRequirements, saveWorkflow, saveExport, createVersion, addTimelineEvent, saveImport }), [projectId, promptTemplates, suggestions, roadmaps, roadmap, requirements, workflow, exports, versions, timeline, imports, artifactJobs, setArtifactJob, loading, loadProjectIntelligence, savePrompt, removePrompt, saveSuggestion, removeSuggestion, saveRoadmap, saveRequirements, saveWorkflow, saveExport, createVersion, addTimelineEvent, saveImport])
  return <AIContext.Provider value={value}>{children}</AIContext.Provider>
}

export function useAI() {
  const state = useContext(AIContext)
  if (!state) throw new Error('useAI must be used within AIProvider')
  return state
}
