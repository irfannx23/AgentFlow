'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthButton, AuthDivider, AuthField, AuthHeading, AuthShell } from '@/components/auth-shell'
import { useAuth } from '@/components/account-state'
import { GoogleIcon } from '@/components/google-icon'
import { getAuthErrorMessage } from '@/lib/auth'

export default function SignupPage() {
  const router = useRouter()
  const { user, loading, signupWithEmail, loginWithGoogle } = useAuth()
  const [name, setName] = useState('')
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
      await signupWithEmail(name, email, password)
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

  return <AuthShell eyebrow="Create your account" title="AI Automation Engineer" description="Create an AgentFlow account to design and generate production-ready automation workflows."><AuthHeading title="Create your account" description="Start building with AgentFlow"/><form className="auth-form" onSubmit={submitEmail}><AuthField label="Name" name="name" autoComplete="name" placeholder="Your name" required value={name} onChange={event=>setName(event.target.value)} disabled={loading}/><AuthField label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={event=>setEmail(event.target.value)} disabled={loading}/><AuthField label="Password" name="password" type="password" autoComplete="new-password" placeholder="Create a password" required minLength={6} value={password} onChange={event=>setPassword(event.target.value)} disabled={loading}/>{notice&&<p className="auth-notice" role="alert">{notice}</p>}<AuthButton disabled={loading}>{loading?'Creating account…':'Create Account'}</AuthButton></form><AuthDivider/><button className="auth-google" type="button" onClick={submitGoogle} disabled={loading}><GoogleIcon/>{loading?'Connecting…':'Continue with Google'}</button><p className="auth-footer">Already have an account? <Link href="/login">Sign in</Link></p></AuthShell>
}
