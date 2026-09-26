'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CircleDollarSign,
  FolderKanban,
  MessageSquareText,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/components/account-state'
import { useConnections } from '@/components/connections-provider'

type MessageRecord = {
  id: string
  conversation_id: string
  created_at: string
  metadata: unknown
  model: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  role: string
}

type UsagePayload = {
  messages: MessageRecord[]
  conversations: Array<{ id: string; created_at: string; updated_at: string; model: string | null; project_id: string }>
  projects: Array<{ id: string; created_at: string; updated_at: string; stage: string }>
  totals?: { requests: number; conversations: number; projects: number }
}

type ActivityRow = {
  id: string
  date: Date
  provider: string
  model: string
  feature: string
  tokens: number
  duration: number | null
}

const providerNames: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
}

const chartColors = ['#83b735', '#6f86cc', '#d49a4b', '#9a78c5', '#55a9a2']

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function providerFor(message: MessageRecord) {
  const metadata = objectMetadata(message.metadata)
  const raw = typeof metadata.provider === 'string' ? metadata.provider.toLowerCase() : ''
  if (raw.includes('gemini') || raw.includes('google')) return 'Gemini'
  if (raw.includes('anthropic') || raw.includes('claude')) return 'Anthropic'
  if (raw.includes('deepseek')) return 'DeepSeek'
  if (raw.includes('openai')) return 'OpenAI'
  const model = (message.model ?? '').toLowerCase()
  if (model.includes('gemini')) return 'Gemini'
  if (model.includes('claude')) return 'Anthropic'
  if (model.includes('deepseek')) return 'DeepSeek'
  if (model.includes('gpt')) return 'OpenAI'
  return 'AgentFlow'
}

function featureFor(message: MessageRecord) {
  const metadata = objectMetadata(message.metadata)
  const agent = typeof metadata.agentId === 'string' ? metadata.agentId.toLowerCase() : ''
  if (agent.includes('designer')) return 'Workflow Design'
  if (agent.includes('generator')) return 'Workflow Generation'
  if (agent.includes('review')) return 'Review'
  if (agent.includes('consult')) return 'Requirements'
  return 'Conversation'
}

function modelLabel(model: string | null) {
  if (!model) return 'Default model'
  return model
    .replace(/^models\//, '')
    .split('-')
    .map(word => word ? word[0].toUpperCase() + word.slice(1) : word)
    .join(' ')
}

function shortNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      return
    }
    const start = performance.now()
    let frame = 0
    const animate = (time: number) => {
      const progress = Math.min(1, (time - start) / 700)
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <>{shortNumber(shown)}{suffix}</>
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function trendFor(rows: ActivityRow[]) {
  const now = Date.now()
  const week = 7 * 86400000
  const current = rows.filter(row => now - row.date.getTime() <= week).length
  const previous = rows.filter(row => now - row.date.getTime() > week && now - row.date.getTime() <= week * 2).length
  if (!previous) return current ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function seriesFor(rows: ActivityRow[], days = 14, value: (row: ActivityRow) => number = () => 1) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (days - 1 - index))
    const key = dayKey(date)
    return { label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: rows.filter(row => dayKey(row.date) === key).reduce((total, row) => total + value(row), 0) }
  })
}

function pointsFor(values: number[], width = 620, height = 156) {
  const max = Math.max(...values, 1)
  return values.map((value, index) => ({ x: values.length === 1 ? width / 2 : index * (width / (values.length - 1)), y: height - (value / max) * (height - 18) - 9 }))
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return ''
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const middle = (previous.x + point.x) / 2
    return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`
  }, `M ${points[0].x} ${points[0].y}`)
}

function LineGraph({ data, area = false, id }: { data: Array<{ label: string; value: number }>; area?: boolean; id: string }) {
  const points = pointsFor(data.map(item => item.value))
  const line = smoothPath(points)
  const areaPath = points.length ? `${line} L ${points.at(-1)?.x ?? 620} 164 L 0 164 Z` : ''
  return <div className="usage-line-chart" aria-label={data.map(item => `${item.label}: ${item.value}`).join(', ')}>
    <svg viewBox="0 0 620 170" role="img" preserveAspectRatio="none">
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#91d72c" stopOpacity=".28"/><stop offset="1" stopColor="#91d72c" stopOpacity="0"/></linearGradient></defs>
      {[34, 68, 102, 136].map(y => <line key={y} x1="0" y1={y} x2="620" y2={y} className="chart-grid-line"/>)}
      {area && <path d={areaPath} fill={`url(#${id}-fill)`}/>}<path d={line} className="chart-line"/>
      {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3" className="chart-point"><title>{data[index].label}: {data[index].value}</title></circle>)}
    </svg>
    <div className="chart-axis"><span>{data[0]?.label}</span><span>{data[Math.floor(data.length / 2)]?.label}</span><span>{data.at(-1)?.label}</span></div>
  </div>
}

function Donut({ entries }: { entries: Array<[string, number]> }) {
  const total = entries.reduce((sum, [, value]) => sum + value, 0)
  let offset = 0
  const stops = entries.map(([, value], index) => {
    const start = offset
    offset += total ? (value / total) * 100 : 0
    return `${chartColors[index % chartColors.length]} ${start}% ${offset}%`
  })
  const background = total ? `conic-gradient(${stops.join(',')})` : 'conic-gradient(#e5e9e2 0 100%)'
  return <div className="donut-layout"><div className="usage-donut" style={{ background }}><div><strong>{total}</strong><span>requests</span></div></div><div className="chart-legend">{entries.length ? entries.map(([label, value], index) => <div key={label}><i style={{ background: chartColors[index % chartColors.length] }}/><span>{label}</span><b>{value}</b></div>) : <p>No model activity yet.</p>}</div></div>
}

function ChartCard({ title, subtitle, children, wide = false }: { title: string; subtitle: string; children: React.ReactNode; wide?: boolean }) {
  return <article className={`analytics-card chart-card${wide ? ' chart-wide' : ''}`}><header><div><h2>{title}</h2><p>{subtitle}</p></div><span className="live-chip"><i/>Live</span></header>{children}</article>
}

export function UsageDashboard() {
  const { user } = useAuth()
  const { connections } = useConnections()
  const [payload, setPayload] = useState<UsagePayload>({ messages: [], conversations: [], projects: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState('All providers')

  useEffect(() => {
    let active = true
    async function load() {
      if (!user) { setLoading(false); return }
      try {
        setLoading(true)
        const token = await user.getIdToken()
        const response = await fetch('/api/usage', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const body = await response.json() as UsagePayload & { error?: string }
        if (!response.ok) throw new Error(body.error || 'Unable to load usage analytics.')
        if (active) setPayload(body)
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load usage analytics.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [user])

  const rows = useMemo<ActivityRow[]>(() => {
    const messages = [...payload.messages].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    const lastUserMessage = new Map<string, MessageRecord>()
    const activity: ActivityRow[] = []
    for (const message of messages) {
      if (message.role === 'user') {
        lastUserMessage.set(message.conversation_id, message)
        continue
      }
      if (message.role !== 'assistant') continue
      const previous = lastUserMessage.get(message.conversation_id)
      const duration = previous ? Math.max(0, Math.round((+new Date(message.created_at) - +new Date(previous.created_at)) / 1000)) : null
      activity.push({ id: message.id, date: new Date(message.created_at), provider: providerFor(message), model: modelLabel(message.model), feature: featureFor(message), tokens: (message.prompt_tokens ?? 0) + (message.completion_tokens ?? 0), duration })
    }
    return activity.sort((a, b) => +b.date - +a.date)
  }, [payload.messages])

  const timeline = useMemo(() => seriesFor(rows), [rows])
  const tokens = useMemo(() => seriesFor(rows, 14, row => row.tokens), [rows])
  const modelEntries = useMemo(() => Object.entries(rows.reduce<Record<string, number>>((result, row) => ({ ...result, [row.model]: (result[row.model] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 5), [rows])
  const providerEntries = useMemo(() => Object.entries(rows.reduce<Record<string, number>>((result, row) => ({ ...result, [row.provider]: (result[row.provider] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]), [rows])
  const maxProvider = Math.max(...providerEntries.map(([, value]) => value), 1)
  const monthly = useMemo(() => Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - (5 - index)); return { label: date.toLocaleDateString(undefined, { month: 'short' }), value: rows.filter(row => row.date.getFullYear() === date.getFullYear() && row.date.getMonth() === date.getMonth()).length } }), [rows])
  const maxMonth = Math.max(...monthly.map(item => item.value), 1)
  const totalTokens = rows.reduce((sum, row) => sum + row.tokens, 0)
  const activeProvider = providerEntries[0]?.[0] ?? providerNames[connections.find(connection => connection.status === 'connected')?.provider ?? ''] ?? 'Not connected'
  const trend = trendFor(rows)
  const featureEntries = Object.entries(rows.reduce<Record<string, number>>((result, row) => ({ ...result, [row.feature]: (result[row.feature] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])
  const dominantProvider = providerEntries[0]
  const dominantShare = dominantProvider && rows.length ? Math.round(dominantProvider[1] / rows.length * 100) : 0
  const providers = ['All providers', ...new Set(rows.map(row => row.provider))]
  const filteredRows = rows.filter(row => (providerFilter === 'All providers' || row.provider === providerFilter) && `${row.provider} ${row.model} ${row.feature}`.toLowerCase().includes(search.toLowerCase()))
  const metrics = [
    { label: 'AI Requests', value: payload.totals?.requests ?? rows.length, icon: Zap, trend },
    { label: 'Tokens Used', value: totalTokens, icon: Activity, trend: null },
    { label: 'Total Conversations', value: payload.totals?.conversations ?? payload.conversations.length, icon: MessageSquareText, trend: null },
    { label: 'Projects Created', value: payload.totals?.projects ?? payload.projects.length, icon: FolderKanban, trend: null },
  ]

  return <section className="page-view usage-page">
    <div className="page-heading usage-heading"><div><span className="eyebrow">Workspace intelligence</span><h1>Usage overview</h1><p>Understand how AgentFlow is working across your automation projects.</p></div><span className="usage-period">Last 6 months</span></div>
    {error && <div className="usage-error" role="alert">{error}</div>}
    {loading ? <div className="usage-loading" aria-label="Loading usage analytics">{Array.from({ length: 6 }, (_, index) => <i key={index}/>)}</div> : <>
      <div className="metric-grid">
        {metrics.map(metric => <article className="metric-card" key={metric.label}><div className="metric-icon"><metric.icon size={17}/></div><span>{metric.label}</span><strong><AnimatedNumber value={metric.value}/></strong>{metric.trend !== null && <small className={metric.trend >= 0 ? 'trend-up' : 'trend-down'}>{metric.trend >= 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>} {Math.abs(metric.trend)}% vs last week</small>}</article>)}
        <article className="metric-card"><div className="metric-icon"><Bot size={17}/></div><span>Active AI Provider</span><strong className="metric-text">{activeProvider}</strong><small>{connections.filter(connection => connection.status === 'connected').length} connected</small></article>
        <article className="metric-card"><div className="metric-icon"><CircleDollarSign size={17}/></div><span>Current Month Cost</span><strong className="metric-text">$—</strong><small>Provider billing is not stored</small></article>
      </div>

      <div className="analytics-grid">
        <ChartCard title="AI usage timeline" subtitle="Requests over the last 14 days" wide><LineGraph data={timeline} id="request-line"/></ChartCard>
        <ChartCard title="Requests by model" subtitle="Distribution across selected models"><Donut entries={modelEntries}/></ChartCard>
        <ChartCard title="Token consumption" subtitle="Recorded prompt and completion tokens" wide><LineGraph data={tokens} area id="token-area"/></ChartCard>
        <ChartCard title="Provider usage" subtitle="Requests routed by provider"><div className="provider-bars">{providerEntries.length ? providerEntries.map(([name, value], index) => <div key={name}><span>{name}</span><div><i style={{ width: `${value / maxProvider * 100}%`, background: chartColors[index % chartColors.length] }}/></div><b>{value}</b></div>) : <p className="chart-empty">No provider activity yet.</p>}</div></ChartCard>
        <ChartCard title="Monthly usage" subtitle="AI requests across six months"><div className="month-bars">{monthly.map(item => <div key={item.label}><span><i style={{ height: `${Math.max(4, item.value / maxMonth * 100)}%` }}><b>{item.value}</b></i></span><small>{item.label}</small></div>)}</div></ChartCard>
        <ChartCard title="Recent activity" subtitle="Latest completed AI operations"><div className="activity-timeline">{rows.slice(0, 5).map(row => <div key={row.id}><i/><span><strong>{row.feature}</strong><small>{row.provider} · {row.date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span></div>)}{!rows.length && <p className="chart-empty">Your activity will appear here.</p>}</div></ChartCard>
      </div>

      <section className="insights-section"><header><span><Sparkles size={16}/></span><div><h2>AI insights</h2><p>Highlights derived from your recorded workspace activity.</p></div></header><div className="insight-grid"><article><strong>{dominantProvider ? `${dominantProvider[0]} handled ${dominantShare}% of your conversations.` : 'Connect a provider to start building usage insights.'}</strong><p>Your provider mix is calculated from completed assistant responses.</p></article><article><strong>{trend >= 0 ? `AI request volume increased ${trend}% this week.` : `AI request volume decreased ${Math.abs(trend)}% this week.`}</strong><p>Compared with the previous seven-day period.</p></article><article><strong>{featureEntries[0] ? `${featureEntries[0][0]} is your most used AI capability.` : 'Your most used capability will appear here.'}</strong><p>Based on the stages recorded with your conversations.</p></article></div></section>

      <section className="analytics-card history-card"><header><div><h2>Usage history</h2><p>Search and filter recorded AI requests.</p></div><div className="history-tools"><label><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search usage…"/></label><select value={providerFilter} onChange={event => setProviderFilter(event.target.value)} aria-label="Filter by provider">{providers.map(provider => <option key={provider}>{provider}</option>)}</select></div></header><div className="history-table-wrap"><table><thead><tr><th>Date</th><th>Provider</th><th>Model</th><th>Feature</th><th>Tokens</th><th>Duration</th><th>Status</th></tr></thead><tbody>{filteredRows.slice(0, 50).map(row => <tr key={row.id}><td>{row.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><span className="provider-cell"><i/>{row.provider}</span></td><td>{row.model}</td><td>{row.feature}</td><td>{shortNumber(row.tokens)}</td><td>{row.duration === null ? '—' : `${row.duration}s`}</td><td><span className="status-complete">Completed</span></td></tr>)}</tbody></table>{!filteredRows.length && <div className="history-empty">No usage records match these filters.</div>}</div></section>
    </>}
  </section>
}
