'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { getAdditionalUserInfo, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import {
  loginWithEmail as firebaseLoginWithEmail,
  loginWithGoogle as firebaseLoginWithGoogle,
  signOut as firebaseSignOut,
  signupWithEmail as firebaseSignupWithEmail,
} from '@/lib/auth'
import { reportAgentFlowEvent } from '@/lib/events/emitter'
import { loginEvent, registrationEvent } from '@/lib/events/auth-emissions'

export type AccountIdentity = {
  status: 'signed-in' | 'guest'
  name: string
  plan: string | null
  initials: string
  email: string | null
  photoURL: string | null
}

const guestAccount: AccountIdentity = {
  status: 'guest',
  name: 'Guest',
  plan: null,
  initials: 'G',
  email: null,
  photoURL: null,
}

function readableEmailName(email: string | null) {
  const localPart = email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim()
  if (!localPart) return 'Account'
  return localPart.replace(/\b\w/g, character => character.toUpperCase())
}

function initialsFor(name: string) {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')
  return initials.toUpperCase() || 'A'
}

/**
 * Exported so every consumer maps Firebase users to identity with one source of
 * truth (workspace provisioning reads the same name as the account UI).
 */
export function accountFor(user: User | null): AccountIdentity {
  if (!user) return guestAccount
  const name = user.displayName?.trim() || readableEmailName(user.email)
  return {
    status: 'signed-in',
    name,
    plan: 'Starter Plan',
    initials: initialsFor(name),
    email: user.email,
    photoURL: user.photoURL,
  }
}

type AuthState = {
  user: User | null
  account: AccountIdentity
  loading: boolean
  loginWithEmail: (email: string, password: string) => Promise<void>
  signupWithEmail: (name: string, email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileRevision, setProfileRevision] = useState(0)

  useEffect(() => onAuthStateChanged(auth, nextUser => {
    setUser(nextUser)
    setLoading(false)
  }), [])

  const run = useCallback(async (operation: () => Promise<unknown>) => {
    setLoading(true)
    try {
      await operation()
    } finally {
      setLoading(false)
    }
  }, [])

  const loginWithEmail = useCallback((email: string, password: string) =>
    run(async () => {
      const credential = await firebaseLoginWithEmail(email, password)
      reportAgentFlowEvent(credential.user, loginEvent('password'))
    }), [run])
  const signupWithEmail = useCallback((name: string, email: string, password: string) =>
    run(async () => {
      const credential = await firebaseSignupWithEmail(name, email, password)
      setUser(credential.user)
      setProfileRevision(revision => revision + 1)
      reportAgentFlowEvent(credential.user, registrationEvent(credential.user, 'password'))
    }), [run])
  const loginWithGoogle = useCallback(() => run(async () => {
    const credential = await firebaseLoginWithGoogle()
    const emission = getAdditionalUserInfo(credential)?.isNewUser
      ? registrationEvent(credential.user, 'google.com')
      : loginEvent('google.com')
    reportAgentFlowEvent(credential.user, emission)
  }), [run])
  const signOut = useCallback(() => run(async () => {
    reportAgentFlowEvent(user, { event: 'user.logged_out', projectId: null, workspaceId: null, metadata: {} })
    await firebaseSignOut()
  }), [run, user])
  const account = useMemo(() => { void profileRevision; return accountFor(user) }, [user, profileRevision])
  const value = useMemo(() => ({ user, account, loading, loginWithEmail, signupWithEmail, loginWithGoogle, signOut }), [user, account, loading, loginWithEmail, signupWithEmail, loginWithGoogle, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const state = useContext(AuthContext)
  if (!state) throw new Error('useAuth must be used within AuthProvider')
  return state
}
