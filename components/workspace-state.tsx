'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/account-state'
import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'
import { useBilling } from '@/components/billing-provider'
import { PROJECT_STAGE } from '@/lib/projects/lifecycle'
import { supabaseError } from '@/lib/supabase/errors'
import { reportAgentFlowEvent } from '@/lib/events/emitter'

export type Project = {
  id: string
  name: string
  description: string
  phase: string
  organizationId: string | null
  createdAt: string
  updatedAt: string
}

export class ProjectLimitError extends Error {
  constructor() { super('You have reached the Free plan limit of 3 projects.'); this.name = 'ProjectLimitError' }
}

type Workspace = Pick<Tables<'organizations'>, 'id' | 'name'>
type ProjectInput = { name: string; description: string; phase?: string }

type WorkspaceState = {
  workspace: Workspace | null
  projects: Project[]
  recentProjects: Project[]
  loading: boolean
  error: string | null
  visitProject: (id: string) => void
  createProject: (input: ProjectInput) => Promise<Project>
  updateProject: (id: string, input: Partial<ProjectInput>) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  reloadProjects: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceState | null>(null)

function toProject(row: Tables<'projects'>): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    phase: row.stage,
    organizationId: row.organization_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function workspaceName(displayName: string) {
  return `${displayName}'s Workspace`
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, account } = useAuth()
  const { plan, entitlements, refresh: refreshBilling } = useBilling()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [recentProjectIds, setRecentProjectIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setRecentProjectIds([])
      return
    }
    try {
      const saved = JSON.parse(window.localStorage.getItem(`orbisweave:recent-projects:${user.uid}`) ?? '[]')
      setRecentProjectIds(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string').slice(0, 5) : [])
    } catch {
      setRecentProjectIds([])
    }
  }, [user])

  const visitProject = useCallback((id: string) => {
    setRecentProjectIds(current => {
      const next = [id, ...current.filter(projectId => projectId !== id)].slice(0, 5)
      if (user) window.localStorage.setItem(`orbisweave:recent-projects:${user.uid}`, JSON.stringify(next))
      return next
    })
  }, [user])

  const loadProjectsFor = useCallback(async (workspaceId: string) => {
    const { data, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', workspaceId)
      .order('updated_at', { ascending: false })
    if (projectsError) throw supabaseError(projectsError, 'Unable to load automation projects.')
    return (data ?? []).map(toProject)
  }, [])

  useEffect(() => {
    if (!user) {
      setWorkspace(null)
      setProjects([])
      setError(null)
      setLoading(false)
      return
    }

    let active = true
    const initialize = async () => {
      setLoading(true)
      setError(null)
      try {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.uid,
          email: user.email,
          display_name: user.displayName?.trim() || account.name,
          avatar_url: user.photoURL,
        })
        if (profileError) throw supabaseError(profileError, 'Unable to initialize your profile.')

        const workspaceResult = await supabase
          .from('organizations')
          .select('id,name')
          .eq('owner_id', user.uid)
          .eq('is_personal', true)
          .maybeSingle()
        let personalWorkspace = workspaceResult.data
        const workspaceError = workspaceResult.error
        if (workspaceError) throw supabaseError(workspaceError, 'Unable to load your workspace.')

        if (!personalWorkspace) {
          const created = await supabase
            .from('organizations')
            .insert({ owner_id: user.uid, name: workspaceName(account.name), is_personal: true })
            .select('id,name')
            .single()
          if (created.error?.code === '23505') {
            const existing = await supabase
              .from('organizations')
              .select('id,name')
              .eq('owner_id', user.uid)
              .eq('is_personal', true)
              .single()
            if (existing.error) throw supabaseError(existing.error, 'Unable to load your workspace.')
            personalWorkspace = existing.data
          } else if (created.error) {
            throw supabaseError(created.error, 'Unable to create your workspace.')
          } else {
            personalWorkspace = created.data
          }
        }

        if (!active) return
        setWorkspace(personalWorkspace)
        const nextProjects = await loadProjectsFor(personalWorkspace.id)
        if (active) {
          setProjects(nextProjects)
          void refreshBilling()
        }
      } catch (initializationError) {
        if (!active) return
        setError(initializationError instanceof Error ? initializationError.message : 'Unable to load your workspace.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void initialize()
    return () => { active = false }
  }, [account.email, account.name, account.photoURL, loadProjectsFor, refreshBilling, user])

  const reloadProjects = useCallback(async () => {
    if (!workspace) return
    setProjects(await loadProjectsFor(workspace.id))
  }, [loadProjectsFor, workspace])

  const createProject = useCallback(async (input: ProjectInput) => {
    if (!user || !workspace) throw new Error('Sign in to create an automation project.')
    if ((plan === 'free' && projects.length >= 3) || !entitlements.canCreateProject) {
      window.dispatchEvent(new CustomEvent('agentflow:upgrade-required', { detail: { reason: 'project-limit' } }))
      throw new ProjectLimitError()
    }
    const { data, error: createError } = await supabase.from('projects').insert({
      owner_id: user.uid,
      organization_id: workspace.id,
      name: input.name,
      description: input.description || null,
      stage: input.phase ?? PROJECT_STAGE.businessProblem,
    }).select('*').single()
    if (createError) {
      if (createError.message.includes('FREE_PROJECT_LIMIT_REACHED')) {
        window.dispatchEvent(new CustomEvent('agentflow:upgrade-required', { detail: { reason: 'project-limit' } }))
        throw new ProjectLimitError()
      }
      throw supabaseError(createError, 'Unable to create the automation project.')
    }
    const project = toProject(data)
    setProjects(current => [project, ...current])
    void refreshBilling()
    reportAgentFlowEvent(user, { event: 'project.created', projectId: project.id, workspaceId: workspace.id, metadata: { phase: project.phase } })
    return project
  }, [entitlements.canCreateProject, plan, projects.length, refreshBilling, user, workspace])

  const updateProject = useCallback(async (id: string, input: Partial<ProjectInput>) => {
    const values: { name?: string; description?: string | null; stage?: string } = {}
    if (input.name !== undefined) values.name = input.name
    if (input.description !== undefined) values.description = input.description || null
    if (input.phase !== undefined) values.stage = input.phase
    const { data, error: updateError } = await supabase.from('projects').update(values).eq('id', id).select('*').single()
    if (updateError) throw supabaseError(updateError, 'Unable to update the automation project.')
    const project = toProject(data)
    setProjects(current => current.map(item => item.id === id ? project : item))
    if (input.phase?.toLowerCase() === 'archived') reportAgentFlowEvent(user, { event: 'project.archived', projectId: id, workspaceId: workspace?.id ?? null, metadata: {} })
    return project
  }, [user, workspace?.id])

  const deleteProject = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', id)
    if (deleteError) throw supabaseError(deleteError, 'Unable to delete the automation project.')
    setProjects(current => current.filter(project => project.id !== id))
    void refreshBilling()
    setRecentProjectIds(current => {
      const next = current.filter(projectId => projectId !== id)
      if (user) window.localStorage.setItem(`orbisweave:recent-projects:${user.uid}`, JSON.stringify(next))
      return next
    })
    reportAgentFlowEvent(user, { event: 'project.deleted', projectId: id, workspaceId: workspace?.id ?? null, metadata: {} })
  }, [refreshBilling, user, workspace?.id])

  const recentProjects = useMemo(() => {
    const ordered = recentProjectIds.map(id => projects.find(project => project.id === id)).filter((project): project is Project => Boolean(project))
    return ordered.length ? ordered : projects.slice(0, 5)
  }, [projects, recentProjectIds])
  const value = useMemo(() => ({ workspace, projects, recentProjects, loading, error, visitProject, createProject, updateProject, deleteProject, reloadProjects }), [workspace, projects, recentProjects, loading, error, visitProject, createProject, updateProject, deleteProject, reloadProjects])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const state = useContext(WorkspaceContext)
  if (!state) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return state
}
