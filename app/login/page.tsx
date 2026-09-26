'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthButton, AuthDivider, AuthField, AuthHeading, AuthShell } from '@/components/auth-shell'
import { useAuth } from '@/components/account-state'
import { GoogleIcon } from '@/components/google-icon'
import { getAuthErrorMessage } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading, loginWithEmail, loginWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace('/')
  }, [loading, router, user])

  const submitEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')
    try {
      await loginWithEmail(email, password)
      router.replace('/')
    } catch (error) {
      setNotice(getAuthErrorMessage(error))
    }
  }

  const submitGoogle = async () => {
    setNotice('')
    try {
      await loginWithGoogle()
      router.replace('/')
    } catch (error) {
      setNotice(getAuthErrorMessage(error))
    }
  }

  return <AuthShell eyebrow="Welcome back" title="AI Automation Engineer" description="Return to AgentFlow and continue building production-ready automation workflows."><AuthHeading title="Welcome back" description="Sign in to continue to AgentFlow"/><form className="auth-form" onSubmit={submitEmail}><AuthField label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={event=>setEmail(event.target.value)} disabled={loading}/><AuthField label="Password" name="password" type="password" autoComplete="current-password" placeholder="Your password" required value={password} onChange={event=>setPassword(event.target.value)} disabled={loading}/>{notice&&<p className="auth-notice" role="alert">{notice}</p>}<AuthButton disabled={loading}>{loading?'Signing in…':'Sign In'}</AuthButton></form><AuthDivider/><button className="auth-google" type="button" onClick={submitGoogle} disabled={loading}><GoogleIcon/>{loading?'Connecting…':'Continue with Google'}</button><p className="auth-footer">Don&apos;t have an account? <Link href="/signup">Create account</Link></p></AuthShell>
}
