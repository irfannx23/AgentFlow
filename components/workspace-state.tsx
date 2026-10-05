'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { accountFor, useAuth } from '@/components/account-state'
import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'
import { useBilling } from '@/components/billing-provider'
import { PROJECT_STAGE } from '@/lib/projects/lifecycle'
import { PROJECT_CREATION_MESSAGES, projectCreationMessage, projectCreationReadiness } from '@/lib/projects/creation-gate'
import { supabaseError } from '@/lib/supabase/errors'
import { reportAgentFlowEvent } from '@/lib/events/emitter'
import { auth } from '@/lib/firebase'

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
  const { user } = useAuth()
  const { plan, entitlements, refresh: refreshBilling } = useBilling()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [recentProjectIds, setRecentProjectIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const workspaceRef = useRef<Workspace | null>(null)
  const bootstrapRef = useRef<{ userId: string; promise: Promise<void> } | null>(null)

  const applyWorkspace = useCallback((next: Workspace | null) => {
    workspaceRef.current = next
    setWorkspace(next)
  }, [])

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

  /**
   * Single workspace bootstrap path. The provider effect runs it on sign-in and
   * project creation can await/retry it, so an authenticated user is never told
   * to sign in simply because this is still running.
   */
  const bootstrapWorkspace = useCallback(async (firebaseUser: User, isActive: () => boolean) => {
    const firebaseAccount = accountFor(firebaseUser)
    setLoading(true)
    setError(null)
    try {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: firebaseUser.uid,
        email: firebaseUser.email,
        display_name: firebaseUser.displayName?.trim() || firebaseAccount.name,
        avatar_url: firebaseUser.photoURL,
      })
      if (profileError) throw supabaseError(profileError, 'Unable to initialize your profile.')

      const workspaceResult = await supabase
        .from('organizations')
        .select('id,name')
        .eq('owner_id', firebaseUser.uid)
        .eq('is_personal', true)
        .maybeSingle()
      let personalWorkspace = workspaceResult.data
      const workspaceError = workspaceResult.error
      if (workspaceError) throw supabaseError(workspaceError, 'Unable to load your workspace.')

      if (!personalWorkspace) {
        const created = await supabase
          .from('organizations')
          .insert({ owner_id: firebaseUser.uid, name: workspaceName(firebaseAccount.name), is_personal: true })
          .select('id,name')
          .single()
        if (created.error?.code === '23505') {
          const existing = await supabase
            .from('organizations')
            .select('id,name')
            .eq('owner_id', firebaseUser.uid)
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

      if (!isActive()) return
      applyWorkspace(personalWorkspace)
      const nextProjects = await loadProjectsFor(personalWorkspace.id)
      if (isActive()) {
        setProjects(nextProjects)
        void refreshBilling()
      }
    } catch (initializationError) {
      if (!isActive()) return
      setError(initializationError instanceof Error ? initializationError.message : 'Unable to load your workspace.')
    } finally {
      if (isActive()) setLoading(false)
    }
  }, [applyWorkspace, loadProjectsFor, refreshBilling])

  useEffect(() => {
    if (!user) {
      bootstrapRef.current = null
      applyWorkspace(null)
      setProjects([])
      setError(null)
      setLoading(false)
      return
    }

    let active = true
    const pending = bootstrapWorkspace(user, () => active)
    bootstrapRef.current = { userId: user.uid, promise: pending }
    void pending.then(() => {
      if (bootstrapRef.current?.promise === pending) bootstrapRef.current = null
    })
    return () => { active = false }
  }, [applyWorkspace, bootstrapWorkspace, user])

  const reloadProjects = useCallback(async () => {
    if (!workspace) return
    setProjects(await loadProjectsFor(workspace.id))
  }, [loadProjectsFor, workspace])

  const ensureWorkspace = useCallback(async (): Promise<Workspace | null> => {
    if (workspaceRef.current) return workspaceRef.current
    const firebaseUser = auth.currentUser
    if (!firebaseUser) return null
    const inFlight = bootstrapRef.current
    const pending = inFlight?.userId === firebaseUser.uid ? inFlight.promise : bootstrapWorkspace(firebaseUser, () => true)
    bootstrapRef.current = { userId: firebaseUser.uid, promise: pending }
    await pending
    return workspaceRef.current
  }, [bootstrapWorkspace])

  const createProject = useCallback(async (input: ProjectInput) => {
    // Firebase may still be restoring the persisted session on the first paint, and
    // the personal workspace is provisioned asynchronously after that. Neither state
    // may be reported as "signed out".
    await auth.authStateReady().catch(() => undefined)
    const activeUser = auth.currentUser
    const readiness = projectCreationReadiness({
      authenticated: Boolean(activeUser),
      authSettled: true,
      workspaceReady: Boolean(workspaceRef.current ?? workspace),
      workspaceError: error,
    })
    if (readiness.status === 'signed-out') throw new Error(PROJECT_CREATION_MESSAGES.signedOut)
    if (readiness.status !== 'ready') {
      const ensured = activeUser ? await ensureWorkspace() : null
      if (!ensured) throw new Error(projectCreationMessage(readiness) ?? PROJECT_CREATION_MESSAGES.workspaceFailed)
    }
    const targetWorkspace = workspaceRef.current ?? workspace
    if (!targetWorkspace) throw new Error(PROJECT_CREATION_MESSAGES.workspacePending)
    const ownerId = activeUser?.uid ?? user?.uid
    if (!ownerId) throw new Error(PROJECT_CREATION_MESSAGES.signedOut)
    if ((plan === 'free' && projects.length >= 3) || !entitlements.canCreateProject) {
      window.dispatchEvent(new CustomEvent('agentflow:upgrade-required', { detail: { reason: 'project-limit' } }))
      throw new ProjectLimitError()
    }
    const { data, error: createError } = await supabase.from('projects').insert({
      owner_id: ownerId,
      organization_id: targetWorkspace.id,
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
    reportAgentFlowEvent(activeUser ?? user, { event: 'project.created', projectId: project.id, workspaceId: targetWorkspace.id, metadata: { phase: project.phase } })
    return project
  }, [ensureWorkspace, entitlements.canCreateProject, error, plan, projects.length, refreshBilling, user, workspace])

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
