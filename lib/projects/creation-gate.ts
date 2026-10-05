/**
 * Project creation has to tell three different situations apart:
 *
 * 1. the visitor is genuinely signed out -> sign-in is required,
 * 2. Firebase is still restoring the persisted session -> wait, do not blame auth,
 * 3. a Firebase user exists but the personal workspace is still initializing
 *    (or its bootstrap failed) -> wait / surface the real workspace error.
 *
 * Collapsing (2) and (3) into (1) produced the false
 * "Sign in to create a project." error reported on the live site.
 */

export type ProjectCreationReadiness =
  | { status: 'ready' }
  | { status: 'authenticating' }
  | { status: 'signed-out' }
  | { status: 'workspace-pending' }
  | { status: 'workspace-failed'; message: string }

export type ProjectCreationSignals = {
  /** A Firebase user is available right now (React state or `auth.currentUser`). */
  authenticated: boolean
  /** Firebase has finished restoring the persisted session (`auth.authStateReady()`). */
  authSettled: boolean
  /** The personal workspace is available for project writes. */
  workspaceReady: boolean
  /** Real workspace bootstrap error, when the bootstrap already failed. */
  workspaceError?: string | null
}

export const PROJECT_CREATION_MESSAGES = {
  signedOut: 'Sign in to create an automation project.',
  authenticating: 'Still restoring your AgentFlow session. Please try again in a moment.',
  workspacePending: 'Preparing your workspace. Please try again in a moment.',
  workspaceFailed: 'Unable to prepare your workspace. Reload AgentFlow and try again.',
} as const

export function projectCreationReadiness({ authenticated, authSettled, workspaceReady, workspaceError }: ProjectCreationSignals): ProjectCreationReadiness {
  if (!authenticated) return authSettled ? { status: 'signed-out' } : { status: 'authenticating' }
  if (workspaceReady) return { status: 'ready' }
  return workspaceError
    ? { status: 'workspace-failed', message: workspaceError }
    : { status: 'workspace-pending' }
}

export function projectCreationMessage(readiness: ProjectCreationReadiness): string | null {
  switch (readiness.status) {
    case 'ready':
      return null
    case 'signed-out':
      return PROJECT_CREATION_MESSAGES.signedOut
    case 'authenticating':
      return PROJECT_CREATION_MESSAGES.authenticating
    case 'workspace-pending':
      return PROJECT_CREATION_MESSAGES.workspacePending
    case 'workspace-failed':
      return readiness.message || PROJECT_CREATION_MESSAGES.workspaceFailed
  }
}
