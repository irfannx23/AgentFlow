'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/account-state'
import { initialBillingState, type BillingPlan, type BillingState } from '@/lib/billing/types'

export type BillingHistoryItem = { transaction_id: string; plan: string; amount: number; currency: string; status: string; created_at: string }

type BillingContextValue = BillingState & {
  history: BillingHistoryItem[]
  loading: boolean
  error: string
  refresh: () => Promise<void>
  checkout: (plan: BillingPlan) => Promise<void>
}

const BillingContext = createContext<BillingContextValue | null>(null)

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState(initialBillingState)
  const [history, setHistory] = useState<BillingHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!user) { setState(initialBillingState); setHistory([]); return }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/billing/status', { headers: { authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' })
      const payload = await response.json() as BillingState & { history?: BillingHistoryItem[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Unable to load billing information.')
      setState(payload)
      setHistory(payload.history ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load billing information.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void refresh() }, [refresh])
  const checkout = useCallback(async (plan: BillingPlan) => {
    if (!user) throw new Error('Sign in to upgrade your plan.')
    const response = await fetch('/api/billing/checkout', { method: 'POST', headers: { authorization: `Bearer ${await user.getIdToken()}`, 'content-type': 'application/json' }, body: JSON.stringify({ plan }) })
    const payload = await response.json() as { action?: string; fields?: Record<string, string>; error?: string }
    if (!response.ok || !payload.action || !payload.fields) throw new Error(payload.error || 'Unable to start checkout.')
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = payload.action
    for (const [name, value] of Object.entries(payload.fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }, [user])

  const value = useMemo(() => ({ ...state, history, loading, error, refresh, checkout }), [state, history, loading, error, refresh, checkout])
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
}

export function useBilling() {
  const value = useContext(BillingContext)
  if (!value) throw new Error('useBilling must be used within BillingProvider')
  return value
}
