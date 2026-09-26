'use client'

import { Check, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useBilling } from '@/components/billing-provider'
import { useDialogFocus } from '@/components/use-dialog-focus'

export function UpgradeModal({ close }: { close: () => void }) {
  const dialogRef = useDialogFocus<HTMLElement>(close)
  const { checkout } = useBilling()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const upgrade = async () => {
    setBusy(true); setError('')
    try { await checkout('pro') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to start checkout.'); setBusy(false) }
  }
  return <div className="modal-backdrop glass-backdrop billing-upgrade-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section ref={dialogRef} tabIndex={-1} className="upgrade-modal glass-modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
      <button className="modal-close" onClick={close} aria-label="Close upgrade dialog"><X size={18}/></button>
      <span className="upgrade-icon"><Sparkles size={24}/></span>
      <span className="eyebrow">AgentFlow Pro</span><h2 id="upgrade-title">Unlock Unlimited Automation</h2>
      <ul>{['Unlimited Projects','Unlimited Workflow Exports','Unlimited AI Conversations','Future GTM & RevOps Modules','Priority Features'].map(item => <li key={item}><Check size={15}/>{item}</li>)}</ul>
      {error && <p className="modal-note" role="alert">{error}</p>}
      <div className="modal-actions"><button className="secondary-action" onClick={close} disabled={busy}>Maybe Later</button><button className="lime-button" onClick={() => void upgrade()} disabled={busy}>{busy ? 'Opening PayU…' : 'Upgrade Now'}</button></div>
    </section>
  </div>
}
