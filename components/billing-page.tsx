'use client'

import { useState } from 'react'
import { Activity, Boxes, Check, Clock3, Cloud, CodeXml, CreditCard, Database, Download, FileClock, FolderKanban, Gauge, History, MessageSquareText, PackageOpen, Rocket, ShieldCheck, Sparkles, Workflow } from 'lucide-react'
import { useBilling } from '@/components/billing-provider'
import { UpgradeModal } from '@/components/upgrade-modal'
import { planLabels } from '@/lib/billing/types'

type PlanCard = { id: 'free'|'pro'|'team'; name: string; tagline: string; price: string; features: readonly string[]; featured?: boolean; comingSoon?: boolean }

const plans: readonly PlanCard[] = [
  { id: 'free', name: 'Free', tagline: 'Perfect for learning.', price: '₹0', features: ['3 Projects','1 Workspace','2 AI Providers','Basic Workflow Export','Community Support'] },
  { id: 'pro', name: 'Pro', tagline: 'Unlimited automation development.', price: '₹999', featured: true, features: ['Unlimited Projects','Unlimited Conversations','Unlimited AI Providers','Version History & Imports','Advanced Exports','Priority Support'] },
  { id: 'team', name: 'Team', tagline: 'Everything in Pro, built for teams.', price: 'Coming Soon', comingSoon: true, features: ['Shared Workspaces','Collaboration','Role Management','Audit Logs','Team Billing'] },
] as const

const modules = [
  ['Revenue Operations Engine','Lifecycle automation, lead routing, CRM automation, pipeline intelligence, PQL, customer health and forecasting.', Gauge],
  ['GTM Engine','ICP builder, journey mapping, messaging, campaigns, demand generation, sales playbooks and partner programs.', Rocket],
  ['AI Agent Marketplace','Install specialized automation agents for your workflow lifecycle.', Boxes],
  ['Template Marketplace','Start from reviewed, production-ready automation blueprints.', PackageOpen],
  ['Advanced Exporters','Export to more workflow platforms from one validated graph.', CodeXml],
  ['Deployment Assistant','Guided production rollout, credentials and environment validation.', Cloud],
  ['Workflow Analytics','Performance, reliability and execution intelligence.', Activity],
  ['API Access','Programmatic project and artifact lifecycle access.', Database],
  ['Enterprise Connectors','Governed integrations for enterprise systems.', Workflow],
  ['White Label','Branded automation workspaces for partners and agencies.', Sparkles],
] as const

function formatBytes(value: number) {
  if (!value) return '0 MB'
  const units = ['B','KB','MB','GB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`
}

export function BillingPage() {
  const billing = useBilling()
  const [upgrade, setUpgrade] = useState(false)
  const usage = [
    ['Projects', billing.usage.projects, FolderKanban],
    ['Automation Runs', billing.usage.automationRuns, Activity],
    ['Workflow Exports', billing.usage.workflowExports, Download],
    ['AI Requests', billing.usage.aiRequests, Sparkles],
    ['Knowledge Uploads', billing.usage.knowledgeUploads, Cloud],
    ['Storage', formatBytes(billing.usage.storageBytes), Database],
    ['Conversation History', billing.usage.conversations, MessageSquareText],
    ['Versions', billing.usage.versions, History],
    ['Timeline Events', billing.usage.timelineEvents, FileClock],
  ] as const
  return <section className="page-view billing-page">
    <div className="page-heading billing-heading"><div><span className="eyebrow">Account & subscription</span><h1>Billing &amp; Plans</h1><p>Manage your plan, usage, and AgentFlow capabilities.</p></div><span className="payu-test-badge"><ShieldCheck size={14}/>PayU Test Mode</span></div>
    {billing.error && <p className="billing-alert" role="alert">{billing.error}</p>}
    <article className="current-plan-panel billing-glass">
      <div className="current-plan-copy"><span className="billing-icon"><CreditCard size={21}/></span><div><span className="eyebrow">Current plan</span><h2>{planLabels[billing.plan]}</h2><p>{billing.plan === 'free' ? 'Explore AgentFlow and create up to three automation projects.' : 'Unlimited automation development with advanced lifecycle tools.'}</p></div></div>
      <div className="plan-status-grid"><div><span>Status</span><strong><i/>{billing.status}</strong></div><div><span>Renewal</span><strong>{billing.cancelAtPeriodEnd ? 'Cancels at period end' : billing.renewalDate ? new Date(billing.renewalDate).toLocaleDateString() : 'No renewal'}</strong></div><div><span>Projects used</span><strong>{billing.usage.projects}{billing.entitlements.projectLimit ? ` / ${billing.entitlements.projectLimit}` : ' / Unlimited'}</strong></div></div>
      <div className="current-plan-actions"><button className="lime-button" onClick={() => setUpgrade(true)}>Test Pro Checkout</button></div>
    </article>

    <div className="billing-section-heading"><div><span className="eyebrow">Current cycle</span><h2>Usage</h2></div><p>Live totals across your personal workspace.</p></div>
    <div className="billing-usage-grid">{usage.map(([label, value, Icon]) => <article className="billing-usage-card billing-glass" key={label}><span><Icon size={17}/></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</div>

    <div className="billing-section-heading"><div><span className="eyebrow">Choose your level</span><h2>Plans</h2></div><p>Change plans without losing access to existing projects.</p></div>
    <div className="plan-card-grid">{plans.map(plan => <article className={`plan-card billing-glass${plan.featured ? ' featured' : ''}`} key={plan.id}>{plan.featured && <span className="popular-badge">Most popular</span>}<header><h3>{plan.name}</h3><p>{plan.tagline}</p><strong>{plan.price}{plan.id === 'pro' && <small>/month</small>}</strong></header><ul>{plan.features.map(feature => <li key={feature}><Check size={14}/>{feature}</li>)}</ul>{plan.comingSoon ? <button className="secondary-action" disabled>Coming Soon</button> : plan.id === 'free' ? <button className="secondary-action" disabled>Current Plan</button> : <button className="lime-button" onClick={() => setUpgrade(true)}>Test Checkout</button>}</article>)}</div>

    <div className="billing-section-heading"><div><span className="eyebrow">Expansion ready</span><h2>Future modules</h2></div><p>Your entitlement layer is ready for add-on capabilities.</p></div>
    <div className="module-grid">{modules.map(([name, description, Icon]) => <article className="module-card billing-glass" key={name}><span><Icon size={17}/></span><div><h3>{name}</h3><p>{description}</p></div><small>Coming Soon</small></article>)}</div>

    <div className="billing-section-heading"><div><span className="eyebrow">Payments</span><h2>Billing history</h2></div></div>
    <div className="billing-history billing-glass">{billing.history.length ? billing.history.map(item => <div key={item.transaction_id}><span><Clock3 size={14}/>{new Date(item.created_at).toLocaleDateString()}</span><strong>{item.plan.toUpperCase()}</strong><span>{new Intl.NumberFormat('en-IN',{style:'currency',currency:item.currency}).format(item.amount)}</span><small className={`transaction-${item.status}`}>{item.status}</small></div>) : <div className="billing-empty"><CreditCard size={22}/><span>No billing transactions yet.</span></div>}</div>
    {billing.loading && <div className="billing-loading" aria-label="Refreshing billing information"/>}
    {upgrade && <UpgradeModal close={() => setUpgrade(false)}/>}
  </section>
}
