'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDialogFocus } from '@/components/use-dialog-focus'
import {
  BarChart3,
  ArrowRight,
  Bell,
  Bot,
  CheckCheck,
  CircleHelp,
  ClipboardCheck,
  Download,
  FileQuestion,
  FolderCog,
  FolderPlus,
  GitBranch,
  Keyboard,
  KeyRound,
  Lightbulb,
  MessageSquareText,
  PackageCheck,
  Sparkles,
  WandSparkles,
  Workflow,
  X,
} from 'lucide-react'

type ModalName = 'help' | 'notifications' | null
type NotificationItem = { id:string; icon:string; title:string; body:string; time:string; unread:boolean; projectId?:string; stage?:string; action?:string }

const helpSections = [
  { icon: FolderPlus, title: 'Create a Project', copy: 'Select New Automation and give your project a clear name. Add optional context or documents so AgentFlow starts with the right information.' },
  { icon: MessageSquareText, title: 'Describe your automation', copy: 'Explain the business process in everyday language. Include the trigger, the people involved, and the result you want.' },
  { icon: FileQuestion, title: 'Answer AI questions', copy: 'AgentFlow asks one focused question at a time. Your answers become the source of truth for the automation.' },
  { icon: ClipboardCheck, title: 'Review Requirements', copy: 'Open the project snapshot to inspect the generated requirements. Continue the conversation if anything needs clarification.' },
  { icon: GitBranch, title: 'Review Workflow', copy: 'Check the workflow stages, decision points, and connected systems. Confirm the process matches how your team actually works.' },
  { icon: WandSparkles, title: 'Generate Workflow', copy: 'Ask AgentFlow to generate the workflow once the requirements are complete. It will build from the approved conversation context.' },
  { icon: Lightbulb, title: 'Review AI Suggestions', copy: 'Read the review for risks, missing details, and recommendations. Reply in the conversation to resolve any important issues.' },
  { icon: Download, title: 'Export', copy: 'Open the Export stage when the workflow is ready. Download the generated n8n JSON and keep its deployment notes nearby.' },
  { icon: KeyRound, title: 'Connect AI Providers', copy: 'Open Connections from your account menu and securely add an API key. Test the connection before choosing one of its models.' },
  { icon: FolderCog, title: 'Manage Projects', copy: 'Use the three-dot menu to rename, duplicate, or delete a project. All project editing continues through its original conversation.' },
  { icon: BarChart3, title: 'Usage Analytics', copy: 'The Usage page summarizes requests, tokens, providers, and recent activity. Use its search and filters to inspect individual records.' },
  { icon: Keyboard, title: 'Keyboard Shortcuts', copy: 'Press Command K on macOS or Control K on Windows to create a new automation. Press Escape to close menus and dialogs.' },
]

const initialNotifications:NotificationItem[] = [
  { id: 'welcome', icon: '👋', title: 'Welcome to AgentFlow', body: 'Your workspace is ready.', time: 'Just now', unread: true },
  { id: 'create', icon: '✨', title: 'Create your first automation project', body: 'Start with a business process you want to improve.', time: 'Just now', unread: true },
  { id: 'provider', icon: '🤖', title: 'Connect an AI provider', body: 'Add your API key to unlock AI conversations.', time: 'Just now', unread: true },
  { id: 'usage', icon: '📊', title: 'Monitor AI usage', body: 'Visit Usage to see requests, tokens, and provider activity.', time: 'Just now', unread: false },
  { id: 'saved', icon: '📁', title: 'Your work is saved', body: 'Every automation project is automatically persisted.', time: 'Just now', unread: false },
]

function ModalFrame({ labelledBy, close, children, className = '' }: { labelledBy: string; close: () => void; children: React.ReactNode; className?: string }) {
  const dialogRef = useDialogFocus<HTMLElement>(close)
  return <div className="utility-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section ref={dialogRef} tabIndex={-1} className={`utility-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      {children}
      <button className="utility-close" onClick={close} aria-label="Close dialog"><X size={18}/></button>
    </section>
  </div>
}

export function TopbarTools() {
  const [modal, setModal] = useState<ModalName>(null)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(()=>{
    const receive=(event:Event)=>{const detail=(event as CustomEvent<Omit<NotificationItem,'time'|'unread'>>).detail;if(!detail?.id)return;setNotifications(current=>[{...detail,time:'Just now',unread:true},...current.filter(item=>item.id!==detail.id)])}
    window.addEventListener('agentflow:artifact-complete',receive)
    return()=>window.removeEventListener('agentflow:artifact-complete',receive)
  },[])
  const unread = notifications.filter(item => item.unread).length
  const close = useCallback(() => setModal(null), [])
  const modalContent = modal === 'help' ? <ModalFrame labelledBy="help-title" close={close} className="help-modal">
    <header className="utility-modal-header"><span className="utility-heading-icon"><CircleHelpIcon/></span><div><span className="eyebrow">AgentFlow guide</span><h2 id="help-title">How to use AgentFlow</h2><p>From your first idea to a tested, exportable automation.</p></div></header>
    <div className="help-modal-content">{helpSections.map(({ icon: Icon, title, copy }, index) => <article key={title}><span><Icon size={17}/></span><div><small>{String(index + 1).padStart(2, '0')}</small><h3>{title}</h3><p>{copy}</p></div></article>)}</div>
  </ModalFrame> : modal === 'notifications' ? <ModalFrame labelledBy="notifications-title" close={close} className="notifications-modal">
    <header className="utility-modal-header"><span className="utility-heading-icon"><Bell size={19}/></span><div><span className="eyebrow">Workspace updates</span><h2 id="notifications-title">Notifications</h2><p>{unread ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'You are all caught up.'}</p></div>{notifications.length > 0 && <button className="mark-read" disabled={!unread} onClick={() => setNotifications(items => items.map(item => ({ ...item, unread: false })))}><CheckCheck size={15}/>Mark all as read</button>}</header>
    <div className="notification-list">{notifications.length ? notifications.map(item => <article className={item.unread ? 'unread' : ''} key={item.id}><span className="notification-emoji" aria-hidden="true">{item.icon}</span><div><h3>{item.title}</h3><p>{item.body}</p><time>{item.time}</time>{item.projectId&&<button className="notification-action" onClick={()=>{setNotifications(current=>current.map(value=>value.id===item.id?{...value,unread:false}:value));setModal(null);window.dispatchEvent(new CustomEvent('agentflow:open-project',{detail:{projectId:item.projectId,stage:item.stage}}))}}>{item.action??'View project'}<ArrowRight size={12}/></button>}</div><div className="notification-controls">{item.unread&&<i aria-label="Unread"/>}<button aria-label={`Dismiss ${item.title}`} onClick={()=>setNotifications(current=>current.filter(value=>value.id!==item.id))}><X size={13}/></button></div></article>) : <div className="notification-empty"><PackageCheck size={28}/><h3>No new notifications</h3><p>Workspace updates will appear here.</p></div>}</div>
  </ModalFrame> : null

  return <>
    <button className="circle-button utility-trigger" onClick={() => setModal('help')} aria-label="Open help center" aria-haspopup="dialog"><CircleHelp size={18}/></button>
    <button className="circle-button utility-trigger" onClick={() => setModal('notifications')} aria-label={`Open notifications${unread ? `, ${unread} unread` : ''}`} aria-haspopup="dialog"><Bell size={18}/>{unread > 0 && <span className="notification-badge">{unread}</span>}</button>
    {mounted && modalContent ? createPortal(modalContent, document.body) : null}
  </>
}

function CircleHelpIcon() {
  return <span className="help-spark" aria-hidden="true"><Sparkles size={18}/><Bot size={12}/><Workflow size={11}/></span>
}
