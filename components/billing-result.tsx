import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react'

export function BillingResult({ status }: { status: 'success' | 'failure' | 'pending' }) {
  const content = status === 'success'
    ? { Icon: CheckCircle2, eyebrow: 'PayU Test Mode', title: 'Checkout demonstration complete', copy: 'Payment flow completed in Test Mode. Subscription activation is not implemented yet. This checkout demonstrates successful PayU integration only.', action: 'Return to Billing', href: '/' }
    : status === 'pending'
      ? { Icon: Clock3, eyebrow: 'PayU Test Mode', title: 'Checkout demonstration returned', copy: 'The test checkout returned without activating a subscription. Production payment verification is intentionally not implemented in this development phase.', action: 'Return to Billing', href: '/' }
      : { Icon: AlertTriangle, eyebrow: 'PayU Test Mode', title: 'Test checkout was not completed', copy: 'PayU returned from the test payment flow. No subscription or billing state was changed.', action: 'Return to Billing', href: '/' }
  return <main className="billing-result-page"><section className={`billing-result-card ${status}`}><span className="billing-result-icon"><content.Icon size={28}/></span><span className="eyebrow">{content.eyebrow}</span><h1>{content.title}</h1><p>{content.copy}</p><Link href={content.href}>{content.action}</Link><small>Development checkout powered by PayU Test Environment</small></section></main>
}
