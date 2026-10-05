import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  PROJECT_CREATION_MESSAGES,
  projectCreationMessage,
  projectCreationReadiness,
} from '@/lib/projects/creation-gate'

test('a signed-in user with a ready workspace can create a project', () => {
  const readiness = projectCreationReadiness({ authenticated: true, authSettled: true, workspaceReady: true })
  assert.equal(readiness.status, 'ready')
  assert.equal(projectCreationMessage(readiness), null)
})

test('a signed-in user whose workspace is still provisioning is never told to sign in', () => {
  const readiness = projectCreationReadiness({ authenticated: true, authSettled: true, workspaceReady: false })
  assert.equal(readiness.status, 'workspace-pending')
  assert.equal(projectCreationMessage(readiness), PROJECT_CREATION_MESSAGES.workspacePending)
  assert.notEqual(projectCreationMessage(readiness), PROJECT_CREATION_MESSAGES.signedOut)
})

test('an unsettled Firebase session is treated as initializing, not as signed out', () => {
  const readiness = projectCreationReadiness({ authenticated: false, authSettled: false, workspaceReady: false })
  assert.equal(readiness.status, 'authenticating')
  assert.equal(projectCreationMessage(readiness), PROJECT_CREATION_MESSAGES.authenticating)
  assert.notEqual(projectCreationMessage(readiness), PROJECT_CREATION_MESSAGES.signedOut)
})

test('only a settled session without a Firebase user requires sign-in', () => {
  const readiness = projectCreationReadiness({ authenticated: false, authSettled: true, workspaceReady: false })
  assert.equal(readiness.status, 'signed-out')
  assert.equal(projectCreationMessage(readiness), PROJECT_CREATION_MESSAGES.signedOut)
})

test('a failed workspace bootstrap surfaces its real error instead of an auth error', () => {
  const readiness = projectCreationReadiness({
    authenticated: true,
    authSettled: true,
    workspaceReady: false,
    workspaceError: 'Unable to create your workspace.',
  })
  assert.equal(readiness.status, 'workspace-failed')
  assert.equal(projectCreationMessage(readiness), 'Unable to create your workspace.')
})

test('project creation waits for Firebase auth readiness and keeps one workspace bootstrap path', async () => {
  const [workspaceState, conversationWorkspace] = await Promise.all(
    ['components/workspace-state.tsx', 'components/conversation-workspace.tsx']
      .map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')),
  )

  for (const source of [workspaceState, conversationWorkspace]) {
    assert.match(source, /await auth\.authStateReady\(\)/, 'auth readiness must be awaited before judging the session')
    assert.match(source, /PROJECT_CREATION_MESSAGES\.signedOut/, 'the sign-in requirement must stay enforced')
  }

  // The false "signed in but told to sign in" guard must not come back.
  assert.doesNotMatch(workspaceState, /if \(!user \|\| !workspace\)/)
  // Project creation must reuse the single provider bootstrap instead of a second code path.
  assert.match(workspaceState, /const bootstrapWorkspace = useCallback/)
  assert.equal((workspaceState.match(/from\('organizations'\)/g) ?? []).length, 3)
  // The chat composer keeps the AI provider guard and still requires a Firebase user.
  assert.match(conversationWorkspace, /const activeUser = user \?\? auth\.currentUser/)
})
