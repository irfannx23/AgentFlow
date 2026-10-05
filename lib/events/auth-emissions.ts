'use client'

import type { User } from 'firebase/auth'
import type { EventEmission } from '@/lib/events/contract'

export type FirebaseAuthProvider = 'password' | 'google.com'

function methodFor(provider: FirebaseAuthProvider): 'email' | 'google' {
  return provider === 'password' ? 'email' : 'google'
}

export function loginEvent(provider: FirebaseAuthProvider): EventEmission {
  return {
    event: 'user.logged_in',
    projectId: null,
    workspaceId: null,
    metadata: { method: methodFor(provider), provider },
  }
}

export function registrationEvent(user: Pick<User, 'email' | 'displayName'>, provider: FirebaseAuthProvider): EventEmission {
  const displayName = user.displayName?.trim()
  return {
    event: 'user.registered',
    projectId: null,
    workspaceId: null,
    metadata: {
      method: methodFor(provider),
      provider,
      email: user.email,
      ...(displayName ? { displayName } : {}),
    },
  }
}
