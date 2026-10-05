'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Copy, CreditCard, Eye, EyeOff, FileText, Folder, Home as HomeIcon, KeyRound, Link2, LogOut, MoreHorizontal, Pencil, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Trash2, UploadCloud, X } from 'lucide-react'
import { useAuth as useAccount, type AccountIdentity } from '@/components/account-state'
import { ConversationWorkspace } from '@/components/conversation-workspace'
import { ProjectWorkspace } from '@/components/project-workspace'
import { useWorkspace, type Project } from '@/components/workspace-state'
import { useConnections } from '@/components/connections-provider'
import { useKnowledge } from '@/components/knowledge-provider'
import { TopbarTools } from '@/components/topbar-tools'
import { useDialogFocus } from '@/components/use-dialog-focus'
import { UsageDashboard } from '@/components/usage-dashboard'
import { useAI } from '@/components/ai-provider'
import { useConversations } from '@/components/conversations-provider'
import type { ConnectionModel, ConnectionProvider, ConnectionSummary } from '@/lib/connections/types'
import { BillingPage } from '@/components/billing-page'
import { useBilling } from '@/components/billing-provider'
import { UpgradeModal } from '@/components/upgrade-modal'
import { planLabels } from '@/lib/billing/types'
import { normalizeProjectStage, PROJECT_STAGE, PROJECT_STAGES } from '@/lib/projects/lifecycle'
import { dispatchAgentFlowEvent } from '@/components/event-bridge'

const logo='/agentflow-logo.svg?v=badge-2'
const chatLogo='/agentflow-logo.svg?v=badge-2'
const providerAssets:Record<string,string>={OpenAI:'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/63c52af590250dd34bd6a9ab-By9nbolpsKmxnUHdXLvh7h7CJOsLfU.png','Anthropic Claude':'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/66af99839e55f1ee29f117ac-YMPnlsgu0gDyDae0U5FuprCtkAQTUV.png','Google Gemini':'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/66afd96f19a3a73a2c337823-6WJxqtcx5NM4Rnn2q4dFon61yM7jEt.png','DeepSeek':'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/679b6046bf7d84d380b826bb-fDx0BOfNSf9wUebFC1F08dzccQknb4.png'}
const providerCatalog=[
  {id:'openai',name:'OpenAI'},
  {id:'gemini',name:'Google Gemini'},
  {id:'anthropic',name:'Anthropic Claude'},
  {id:'deepseek',name:'DeepSeek'},
] as const
const repairStyles=`.project-picker,.model-wrap{position:relative}.composer,.composer-footer,.composer-tools,.composer-actions{overflow:visible!important}.compact-menu{position:absolute;z-index:100;display:block!important;height:auto!important;min-height:88px!important;min-width:360px;max-height:320px!important;overflow-y:auto;padding:10px;background:#151a20;border:1px solid rgba(230,240,246,.16);border-radius:12px;box-shadow:0 18px 42px rgba(0,0,0,.42)}.project-menu{left:0;right:auto!important;top:calc(100% + 10px)!important;bottom:auto!important;width:400px;height:auto!important;min-height:0!important;max-height:none!important;overflow:hidden;display:block!important}.project-menu:has(.project-list-area:empty){height:auto!important;min-height:0!important;max-height:none!important}.project-menu:has(.project-list-area:empty) .menu-divider{display:none}.project-menu:has(.project-list-area:empty) .project-list-area{display:none}.project-list-area{max-height:168px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#39434d transparent}.project-list-area button{min-height:52px}.project-list-area::-webkit-scrollbar{width:5px}.project-list-area::-webkit-scrollbar-thumb{background:#39434d;border-radius:999px}.model-menu{right:0;bottom:calc(100% + 10px);min-width:340px}.search-indicator{display:inline-block;width:8px;height:8px;border-radius:50%;background:#353c43;margin-left:3px}.search-indicator.active{background:#c0ff3e;box-shadow:0 0 7px rgba(192,255,62,.65)}.tool-chip:has(.search-indicator.active){border-color:rgba(192,255,62,.3)}.model-select{display:flex;align-items:center;gap:9px;min-width:150px;max-width:220px;white-space:nowrap}.model-select .model-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.model-select .model-empty-dot{flex:none}.connect-provider-title{display:flex;align-items:center;gap:12px}.connect-provider-title .provider-logo{width:30px;max-width:30px;height:30px;max-height:30px}.connect-modal .modal-heading h2{margin:7px 0 0}.project-menu .menu-divider{flex:none}.rich-project-row{width:100%;display:grid;grid-template-columns:45% 25% 30%;align-items:center;gap:0;padding:22px 0;border:0;border-top:1px solid rgba(230,240,246,.11);background:transparent;text-align:left}.rich-project-row:hover{background:rgba(255,255,255,.025)}.project-stage,.project-progress{display:flex;flex-direction:column;gap:8px}.project-stage>span,.project-progress>span{display:flex;align-items:center;gap:8px;font-size:13px}.project-stage small{color:#8e98a5;font-size:11px}.stage-dot{width:8px;height:8px;border-radius:50%;background:#8e98a5}.stage-0{background:#c0ff3e}.stage-1{background:#4361ee}.project-progress>span{justify-content:space-between;padding-right:20px;color:#8e98a5;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.project-progress b{color:#edf4ee;font-size:13px;letter-spacing:0}.progress-track{height:6px;background:#242b31;border-radius:999px;overflow:hidden;margin-right:20px}.progress-track i{display:block;height:100%;background:#c0ff3e;border-radius:inherit}.rich-project-row time{color:#8e98a5;font-size:12px;text-align:right;padding-right:4px}@media(max-width:850px){.rich-project-row{grid-template-columns:1fr 1fr;gap:14px}.rich-project-row time{text-align:left}.project-info{min-width:0}}.compact-menu button{width:100%;display:flex;align-items:center;gap:10px;padding:10px 11px;border:0;border-radius:8px;background:transparent;color:#edf4ee;text-align:left}.compact-menu button:hover{background:rgba(255,255,255,.07)}.menu-heading{padding:5px 11px 8px;color:#8e98a5;font-size:11px;letter-spacing:.12em}.menu-divider{height:1px;background:rgba(230,240,246,.11);margin:8px 0}.menu-new{color:#c0ff3e!important}.provider-logo{display:block;width:auto;height:auto;max-width:28px;max-height:28px;object-fit:contain}.provider-mark{width:44px;height:44px;display:grid;place-items:center;flex:none;border:1px solid rgba(230,240,246,.1);border-radius:10px;background:#11151a}.provider-card{display:flex;align-items:center;justify-content:space-between;gap:28px;padding:16px 18px;background:#11151a;border:1px solid rgba(230,240,246,.11);border-radius:12px}.provider-copy,.provider-actions{display:flex;align-items:center;gap:14px}.provider-copy{min-width:0}.provider-copy h2{margin:0 0 4px;font-size:15px}.provider-copy p{margin:0;color:#8e98a5;font-size:12px}.provider-actions{justify-content:flex-end;flex-wrap:wrap;gap:10px}.connection-status,.enabled-count{color:#8e98a5;font-size:12px;white-space:nowrap}.connection-tabs{display:flex;gap:8px;margin:28px 0 18px}.connection-tabs button{padding:10px 14px;border:1px solid transparent;border-radius:8px;background:transparent;color:#8e98a5}.connection-tabs button.selected{background:#151a20;border-color:rgba(230,240,246,.12);color:#fff}.provider-list{display:flex;flex-direction:column;gap:10px;max-width:960px}.connections-page .page-heading{margin-bottom:0}.connections-divider{height:1px;background:rgba(230,240,246,.13);max-width:960px;margin:28px 0 18px}.connections-section-label{color:#8e98a5;font:11px/1 'Space Mono',monospace;letter-spacing:.14em;margin-bottom:14px}.hero-orbit{position:absolute;width:min(720px,72vw);aspect-ratio:1;border-radius:50%;top:49px;left:50%;transform:translateX(-50%);border:1px solid transparent;background:linear-gradient(120deg,rgba(192,255,62,.75),transparent 29%,transparent 66%,rgba(67,97,238,.8)) border-box;-webkit-mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.8}.home-view{position:relative;overflow:hidden;background:radial-gradient(circle at 50% 48%,rgba(42,50,64,.16),transparent 45%),#080a0d}.home-content{position:relative;z-index:1}.lime-button{color:#0b0f14!important}.lime-button svg{color:#0b0f14!important}.tree-label{gap:18px}.tree-label small{font-size:9px;letter-spacing:.1em}.empty-models{padding:8px 11px 2px;display:flex;flex-direction:column;gap:8px}.empty-models button{padding:0;color:#c0ff3e}.model-check .provider-logo{width:20px;max-width:20px;height:20px;max-height:20px}.connect-modal .provider-logo{width:24px;max-width:24px;height:24px;max-height:24px}@media(max-width:760px){.compact-menu{min-width:300px}.provider-card{align-items:flex-start;flex-direction:column}.provider-actions{width:100%;justify-content:flex-start}}@media(max-width:560px){.project-menu{width:min(400px,calc(100vw - 48px))!important}.model-menu{right:0;min-width:0;width:min(340px,calc(100vw - 48px))}.compact-menu{min-width:0;width:min(360px,calc(100vw - 48px))}}`
type View='home'|'projects'|'connections'|'usage'|'billing'|'workspace'
function Logo({hero=false}:{hero?:boolean}){return hero?<img className="hero-mark" src={chatLogo} alt="AgentFlow"/>:<div className="brand-lockup"><img className="brand-mark" src={logo} alt=""/><span>AgentFlow</span></div>}
function ProviderIcon({name}:{name:string}){return providerAssets[name]?<img className="provider-logo" src={providerAssets[name]} alt=""/>:<span className="provider-fallback">◎</span>}
function ProjectModal({project,close,onSave,onDelete,onDuplicate}:{project:Project|null;close:()=>void;onSave:(name:string,description:string,files:File[],workflowFile?:File)=>Promise<void>;onDelete?:()=>Promise<void>;onDuplicate?:()=>Promise<void>}) {
  useDialogFocus<HTMLElement>(close)
  const {entitlements}=useBilling()
  const [name,setName]=useState(project?.name??'')
  const [description,setDescription]=useState(project?.description??'')
  const [files,setFiles]=useState<File[]>([])
  const [busy,setBusy]=useState('')
  const [error,setError]=useState('')
  const fileRef=useRef<HTMLInputElement>(null)
  const workflowRef=useRef<HTMLInputElement>(null)
  const [workflowFile,setWorkflowFile]=useState<File|null>(null)
  const run=async(action:string,operation:()=>Promise<void>)=>{setBusy(action);setError('');try{await operation()}catch(value){setError(value instanceof Error?value.message:'Unable to update this project.');setBusy('')}}
  return <div className="modal-backdrop glass-backdrop" onMouseDown={event=>event.target===event.currentTarget&&close()} onKeyDown={event=>event.key==='Escape'&&close()}>
    <section className="project-modal glass-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
      <div className="modal-heading"><div><span className="eyebrow">{project?'Project settings':'New automation'}</span><h2 id="project-modal-title">{project?'Manage project':'Create an automation project'}</h2><p>{project?'Rename, duplicate, or remove this project.':'Add a little context and let AgentFlow guide the rest through conversation.'}</p></div><button className="modal-close" onClick={close} aria-label="Close"><X size={18}/></button></div>
      <label>Project name<input autoFocus value={name} onChange={event=>setName(event.target.value)} placeholder="Employee onboarding automation" disabled={Boolean(busy)}/></label>
      <label>Optional context<textarea value={description} onChange={event=>setDescription(event.target.value)} placeholder="What should the AI know before the interview?" disabled={Boolean(busy)}/></label>
      {!project&&<div className="modal-upload"><input ref={fileRef} hidden multiple type="file" accept=".md,.markdown,.pdf,.docx,image/png,image/jpeg,.txt,.log,.json,.yaml,.yml,.zip,application/zip" onChange={event=>setFiles([...(event.target.files??[])])}/><button type="button" className="modal-upload-button" disabled={Boolean(busy)} onClick={()=>fileRef.current?.click()}><UploadCloud size={18}/><span><strong>Attach documents</strong><small>Workflow JSON, Project.zip, logs, documents, PNG or JPG</small></span></button>{files.length>0&&<div className="modal-file-list">{files.map((file,index)=><span key={`${file.name}-${index}`}><FileText size={13}/>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={()=>setFiles(current=>current.filter((_,itemIndex)=>itemIndex!==index))}><X size={12}/></button></span>)}</div>}<input ref={workflowRef} hidden type="file" accept=".json,application/json" onChange={event=>setWorkflowFile(event.target.files?.[0]??null)}/><button type="button" className="modal-upload-button" disabled={Boolean(busy)||!entitlements.canImportWorkflow} onClick={()=>workflowRef.current?.click()}><FileText size={18}/><span><strong>Import workflow</strong><small>{entitlements.canImportWorkflow?'n8n JSON or Make.com Blueprint':'Available on AgentFlow Pro'}</small></span></button>{workflowFile&&<div className="modal-file-list"><span><FileText size={13}/>{workflowFile.name}<button type="button" aria-label={`Remove ${workflowFile.name}`} onClick={()=>setWorkflowFile(null)}><X size={12}/></button></span></div>}</div>}
      {error&&<p className="modal-note" role="alert">{error}</p>}
      {project&&<div className="project-settings-actions"><button className="secondary-action" disabled={Boolean(busy)} onClick={()=>void run('duplicate',async()=>{await onDuplicate?.();close()})}><Copy size={15}/><span>{busy==='duplicate'?'Duplicating…':'Duplicate'}</span></button><button className="danger-action" disabled={Boolean(busy)} onClick={()=>{if(window.confirm(`Delete “${project.name}”? This cannot be undone.`))void run('delete',async()=>{await onDelete?.();close()})}}><Trash2 size={15}/><span>{busy==='delete'?'Deleting…':'Delete'}</span></button></div>}
      <div className="modal-actions"><button className="secondary-action" disabled={Boolean(busy)} onClick={close}>Cancel</button><button className="lime-button" disabled={Boolean(busy)||!name.trim()} onClick={()=>void run('save',async()=>{await onSave(name.trim(),description.trim(),files,workflowFile??undefined);close()})}>{busy==='save'?'Saving…':project?'Save changes':workflowFile?'Import workflow':'Start AI interview'}</button></div>
    </section>
  </div>
}
function Avatar({account,small}:{account:AccountIdentity;small?:boolean}){return <div className={`avatar${small?' small':''}`}>{account.photoURL?<img src={account.photoURL} alt="" referrerPolicy="no-referrer"/>:account.initials}</div>}
function AccountMenu({account,signOut,setView,align,children}:{account:AccountIdentity;signOut:()=>void;setView:(v:View)=>void;align:'top'|'bottom';children:(toggle:()=>void)=>React.ReactNode}){
  const[open,setOpen]=useState(false)
  const[position,setPosition]=useState({left:0,top:0})
  const triggerRef=useRef<HTMLDivElement>(null)
  const menuRef=useRef<HTMLDivElement>(null)
  const go=(view:View)=>{setOpen(false);setView(view)}
  const leave=()=>{setOpen(false);signOut()}
  const updatePosition=useCallback(()=>{
    const trigger=triggerRef.current
    if(!trigger)return
    const rect=trigger.getBoundingClientRect()
    const width=Math.min(280,window.innerWidth-24)
    const height=menuRef.current?.offsetHeight??224
    const preferredLeft=align==='bottom'?rect.right+12:rect.right-width
    const left=Math.max(12,Math.min(preferredLeft,window.innerWidth-width-12))
    const preferredTop=align==='bottom'?rect.bottom-height:rect.bottom+10
    const top=Math.max(12,Math.min(preferredTop,window.innerHeight-height-12))
    setPosition({left,top})
  },[align])
  useEffect(()=>{
    if(!open)return
    updatePosition()
    const frame=window.requestAnimationFrame(updatePosition)
    const outside=(event:MouseEvent)=>{const target=event.target as Node;if(!triggerRef.current?.contains(target)&&!menuRef.current?.contains(target))setOpen(false)}
    const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);triggerRef.current?.querySelector('button')?.focus()}}
    window.addEventListener('resize',updatePosition)
    window.addEventListener('scroll',updatePosition,true)
    document.addEventListener('mousedown',outside)
    document.addEventListener('keydown',keyboard)
    return()=>{window.cancelAnimationFrame(frame);window.removeEventListener('resize',updatePosition);window.removeEventListener('scroll',updatePosition,true);document.removeEventListener('mousedown',outside);document.removeEventListener('keydown',keyboard)}
  },[open,updatePosition])
  const menu=open&&typeof document!=='undefined'?createPortal(<div ref={menuRef} className="account-menu account-menu-floating" style={position} role="menu"><div className="account-menu-head"><Avatar account={account} small/><div className="account-menu-id"><strong>{account.name}</strong><span>{account.status==='signed-in'?account.plan:'Sign in to AgentFlow'}</span></div></div><div className="menu-divider"/>{account.status==='signed-in'?<><button role="menuitem" className="account-menu-item" onClick={()=>go('connections')}><Link2 size={16}/>Connections</button><button role="menuitem" className="account-menu-item" onClick={()=>go('usage')}><SlidersHorizontal size={16}/>Usage & Costs</button><button role="menuitem" className="account-menu-item" onClick={()=>go('billing')}><CreditCard size={16}/>Billing &amp; Plans</button><div className="menu-divider"/><button role="menuitem" className="account-menu-item account-sign-out" onClick={leave}><LogOut size={16}/>Sign Out</button></>:<><Link role="menuitem" className="account-menu-item" href="/login" onClick={()=>setOpen(false)}>Log In</Link><Link role="menuitem" className="account-menu-item" href="/signup" onClick={()=>setOpen(false)}>Create Account</Link></>}</div>,document.body):null
  return <div ref={triggerRef} className="account-wrap">{children(()=>setOpen(value=>!value))}{menu}</div>
}
function Sidebar({account,signOut,view,setView,recentProjects,newProject,project,openProject}:{account:AccountIdentity;signOut:()=>void;view:View;setView:(v:View)=>void;recentProjects:Project[];newProject:()=>void;project:Project|null;openProject:(project:Project)=>void}){const nav=[['Home',HomeIcon,'home'],['Automation Projects',Folder,'projects']] as const;return <aside className="sidebar"><Logo/><button className="new-project" onClick={newProject}><Plus size={19}/><span>New Automation</span></button><div className="sidebar-scroll"><nav className="main-nav">{nav.map(([t,I,v])=><button className={`nav-item ${view===v?'active':''}`} key={t} onClick={()=>setView(v)}><I size={19}/><span>{t}</span></button>)}</nav><div className="recent-heading"><span>RECENT AUTOMATIONS</span></div><div className="recent-project-list">{recentProjects.map(recent=><button className={`recent-project-card ${project?.id===recent.id?'selected':''}`} key={recent.id} onClick={()=>openProject(recent)}><span>{recent.name}</span><small>{recent.phase}</small></button>)}</div></div><AccountMenu account={account} signOut={signOut} setView={setView} align="bottom">{toggle=><button className="profile" onClick={toggle}><Avatar account={account}/><div className="profile-copy"><strong>{account.name}</strong><span>{account.status==='signed-in'?account.plan:'Login'}</span></div><MoreHorizontal size={18}/></button>}</AccountMenu></aside>}
function Top({account,signOut,setView}:{account:AccountIdentity;signOut:()=>void;setView:(v:View)=>void}){return <header className="topbar"><div className="top-actions"><TopbarTools/><span className="top-divider"/><AccountMenu account={account} signOut={signOut} setView={setView} align="top">{toggle=><button className="top-user" onClick={toggle}><Avatar account={account} small/><span>{account.name}</span><ChevronDown size={16}/></button>}</AccountMenu></div></header>}
function Home({project,projects,recentProjects,createProject,onProjectReady,onSelectProject,onNewProject,onUpdate}:{project:Project|null;projects:Project[];recentProjects:Project[];createProject:(input:{name:string;description:string;phase?:string})=>Promise<Project>;onProjectReady:(project:Project)=>void;onSelectProject:(project:Project)=>void;onNewProject:()=>void;onUpdate:(projectId:string,values:{description?:string;phase?:string})=>Promise<void>}){return <ConversationWorkspace project={project} projects={projects} recentProjects={recentProjects} createProject={createProject} onProjectReady={onProjectReady} onSelectProject={onSelectProject} onNewProject={onNewProject} onUpdate={onUpdate}/>}
function ProjectActions({project,onManage}:{project:Project;onManage:(project:Project)=>void}) {
  const [open,setOpen]=useState(false)
  const [position,setPosition]=useState({left:0,top:0})
  const triggerRef=useRef<HTMLButtonElement>(null)
  const menuRef=useRef<HTMLDivElement>(null)
  const manage=()=>{setOpen(false);onManage(project)}
  const updatePosition=useCallback(()=>{
    const trigger=triggerRef.current
    if(!trigger)return
    const rect=trigger.getBoundingClientRect()
    const width=184
    const height=menuRef.current?.offsetHeight??174
    const left=Math.max(12,Math.min(rect.right-width,window.innerWidth-width-12))
    const top=rect.bottom+8+height<=window.innerHeight-12?rect.bottom+8:Math.max(12,rect.top-height-8)
    setPosition({left,top})
  },[])
  useEffect(()=>{
    if(!open)return
    updatePosition()
    const frame=requestAnimationFrame(updatePosition)
    const closeOutside=(event:MouseEvent)=>{const target=event.target as Node;if(!triggerRef.current?.contains(target)&&!menuRef.current?.contains(target))setOpen(false)}
    const closeWithKeyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);triggerRef.current?.focus()}}
    window.addEventListener('resize',updatePosition)
    window.addEventListener('scroll',updatePosition,true)
    document.addEventListener('mousedown',closeOutside)
    document.addEventListener('keydown',closeWithKeyboard)
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',updatePosition);window.removeEventListener('scroll',updatePosition,true);document.removeEventListener('mousedown',closeOutside);document.removeEventListener('keydown',closeWithKeyboard)}
  },[open,updatePosition])
  const menu=open&&typeof document!=='undefined'?createPortal(<div ref={menuRef} className="project-action-menu project-action-menu-floating" role="menu" style={position}><button role="menuitem" onClick={manage}><Pencil size={15}/>Rename</button><button role="menuitem" onClick={manage}><Copy size={15}/><span>Duplicate</span></button><button role="menuitem" onClick={manage}><Settings size={15}/>Project settings</button><span className="project-menu-divider"/><button className="danger" role="menuitem" onClick={manage}><Trash2 size={15}/>Delete</button></div>,document.body):null
  return <div className="project-action-wrap"><button ref={triggerRef} className="project-more" onClick={()=>{if(!open)updatePosition();setOpen(value=>!value)}} aria-label={`Manage ${project.name}`} aria-haspopup="menu" aria-expanded={open}><MoreHorizontal size={17}/></button>{menu}</div>
}

function Projects({projects,newProject,onOpen,onManage,loading,error}:{projects:Project[];newProject:()=>void;onOpen:(project:Project)=>void;onManage:(project:Project)=>void;loading:boolean;error:string|null}) {
  const [q,setQ]=useState('')
  const stages=[...PROJECT_STAGES]
  const query=q.trim().toLowerCase()
  const visible=projects.filter(p=>`${p.name} ${p.description}`.toLowerCase().includes(query))
  return <section className="page-view projects-page"><div className="page-heading"><div><span className="eyebrow">Automation library</span><h1>Automation projects</h1><p>Every project is a generated snapshot of its AI conversation.</p></div><button className="lime-button" onClick={newProject}><Plus size={18}/>New automation</button></div><div className="project-toolbar"><div className="search-field"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search projects…"/></div></div><div className="project-list glass-list">{visible.map(p=>{const stage=normalizeProjectStage(p.phase);const index=stages.indexOf(stage);const progress=Math.round((index+1)/stages.length*100);return <article className="project-row rich-project-row" key={p.id}><button className="project-row-main" onClick={()=>onOpen(p)}><div className="project-info"><strong>{p.name}</strong><span>{p.description||'No starting context.'}</span></div><div className="project-stage"><span><i className={`stage-dot stage-${index}`}/>{stage}</span><small>Updated {new Date(p.updatedAt).toLocaleDateString()}</small></div><div className="project-progress"><span>Progress <b>{progress}%</b></span><div className="progress-track"><i style={{width:`${progress}%`}}/></div></div></button><ProjectActions project={p} onManage={onManage}/></article>})}{loading&&<div className="results-empty shimmer-line"><img src={logo} alt=""/>Loading projects…</div>}{!loading&&error&&<div className="results-empty">Unable to load automation projects.</div>}{!loading&&!error&&!projects.length&&<div className="results-empty branded-empty"><img src={logo} alt=""/><span>No automation projects yet</span></div>}{!loading&&!error&&projects.length>0&&!visible.length&&<div className="results-empty">No projects match your search.</div>}</div></section>
}

function ConversationTransition({leaving}:{leaving:boolean}) {
  const messages=['Loading conversation history','Restoring previous conversation','Loading automation context','Almost ready']
  const[index,setIndex]=useState(0)
  useEffect(()=>{const timer=window.setInterval(()=>setIndex(current=>(current+1)%messages.length),1400);return()=>window.clearInterval(timer)},[messages.length])
  return <div className={`workspace-transition${leaving?' is-leaving':''}`} role="status" aria-live="polite" aria-label="Preparing your conversation workspace"><div className="workspace-transition-card"><span className="workspace-transition-logo"><img src={logo} alt=""/></span><h2>Preparing your workspace…</h2><p key={index}>{messages[index]}</p><span className="workspace-transition-progress" aria-hidden="true"><i/></span><div className="workspace-transition-skeleton" aria-hidden="true"><span/><span/><span/></div></div></div>
}
function ConnectModal({provider,close,onTest,onSave,updating}:{provider:string;close:()=>void;onTest:(key:string)=>Promise<boolean>;onSave:(key:string)=>Promise<boolean>;updating:boolean}){const[key,setKey]=useState('');const[visible,setVisible]=useState(false);const[busy,setBusy]=useState('');const[result,setResult]=useState<string|null>(null);const submit=async(action:'test'|'save')=>{setBusy(action);setResult(null);try{const valid=await(action==='test'?onTest(key):onSave(key));setResult(valid?'Connection verified.':'Invalid API Key');if(valid&&action==='save')close()}catch(error){setResult(error instanceof Error?error.message:'Unable to connect.')}finally{setBusy('')}};return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()} onKeyDown={e=>e.key==='Escape'&&close()}><section className="connect-modal" role="dialog" aria-modal="true" aria-labelledby="connect-provider-title"><div className="modal-heading"><div><span className="eyebrow">{updating?'Update connection':'Connect provider'}</span><h2 id="connect-provider-title"><span className="connect-provider-title"><ProviderIcon name={provider}/><span>{provider}</span></span></h2></div><button className="modal-close" onClick={close} aria-label="Close"><X/></button></div><label>API key<span className="secret-input"><input type={visible?'text':'password'} autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="••••••••••••••••••••" disabled={Boolean(busy)}/><button type="button" onClick={()=>setVisible(value=>!value)} aria-label={visible?'Hide API key':'Show API key'}>{visible?<EyeOff size={16}/>:<Eye size={16}/>}</button></span></label><p className="modal-note">Your key is encrypted on the server and is never returned to the browser.</p>{result&&<p className="modal-note" role="status">{result}</p>}<div className="modal-actions"><button className="secondary-action" onClick={close} disabled={Boolean(busy)}>Cancel</button><button className="secondary-action" onClick={()=>void submit('test')} disabled={Boolean(busy)||!key.trim()}>{busy==='test'?'Testing…':'Test Connection'}</button><button className="lime-button" onClick={()=>void submit('save')} disabled={Boolean(busy)||!key.trim()}>{busy==='save'?'Saving…':'Save'}</button></div></section></div>}
function ManageConnectionModal({provider,connection,models,isDefault,close,onUpdate,onTest,onDisconnect,onDefault}:{provider:{id:ConnectionProvider;name:string};connection:ConnectionSummary;models:ConnectionModel[];isDefault:boolean;close:()=>void;onUpdate:(key:string)=>Promise<boolean>;onTest:()=>Promise<boolean>;onDisconnect:()=>Promise<void>;onDefault:()=>void}){
  useDialogFocus<HTMLElement>(close)
  const[key,setKey]=useState('')
  const[visible,setVisible]=useState(false)
  const[editing,setEditing]=useState(false)
  const[busy,setBusy]=useState('')
  const[notice,setNotice]=useState('')
  const run=async(action:string,operation:()=>Promise<void>)=>{setBusy(action);setNotice('');try{await operation()}catch(value){setNotice(value instanceof Error?value.message:'Connection request failed.')}finally{setBusy('')}}
  const update=()=>run('update',async()=>{const valid=await onUpdate(key);setNotice(valid?'API key updated and verified.':'The API key is invalid.');if(valid){setEditing(false);setKey('')}})
  const testConnection=()=>run('test',async()=>setNotice(await onTest()?'Connection verified.':'The saved API key is invalid.'))
  return <div className="modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&close()}><section className="connect-modal manage-connection-modal" role="dialog" aria-modal="true" aria-labelledby="manage-connection-title"><div className="modal-heading"><div><span className="eyebrow">Connection management</span><h2 id="manage-connection-title"><span className="connect-provider-title"><ProviderIcon name={provider.name}/><span>{provider.name}</span></span></h2></div><button className="modal-close" onClick={close} aria-label="Close"><X size={18}/></button></div><div className="connection-detail-grid"><div><span>Connection status</span><strong className={connection.status==='connected'?'is-connected':'is-invalid'}><ShieldCheck size={15}/>{connection.status==='connected'?'Connected':'Invalid API Key'}</strong></div><div><span>Connected model</span><strong>{models[0]?.displayName??'No model available'}</strong></div><div className="connection-key-row"><span>API key</span><strong><KeyRound size={14}/>••••••••••••••••</strong><button className="text-action" onClick={()=>setEditing(value=>!value)}>{editing?'Cancel update':'Update API Key'}</button></div></div>{editing&&<div className="connection-key-editor"><label>New API key<span className="secret-input"><input autoFocus type={visible?'text':'password'} autoComplete="off" value={key} onChange={event=>setKey(event.target.value)} placeholder="Enter a new API key" disabled={Boolean(busy)}/><button type="button" onClick={()=>setVisible(value=>!value)} aria-label={visible?'Hide API key':'Show API key'}>{visible?<EyeOff size={16}/>:<Eye size={16}/>}</button></span></label><button className="lime-button" disabled={Boolean(busy)||!key.trim()} onClick={()=>void update()}>{busy==='update'?'Updating…':'Save API Key'}</button></div>}{notice&&<p className="modal-note" role="status">{notice}</p>}<div className="manage-connection-actions"><button className="secondary-action" disabled={Boolean(busy)} onClick={()=>void testConnection()}>{busy==='test'?'Testing…':'Test Connection'}</button>{!isDefault?<button className="secondary-action" disabled={connection.status!=='connected'||Boolean(busy)} onClick={()=>{onDefault();setNotice(`${provider.name} is now the default provider.`)}}><Check size={15}/>Set as Default</button>:<span className="default-badge"><Check size={13}/>Default</span>}<button className="danger-action" disabled={Boolean(busy)} onClick={()=>{if(window.confirm(`Disconnect ${provider.name}?`))void run('disconnect',async()=>{await onDisconnect();close()})}}>{busy==='disconnect'?'Disconnecting…':'Disconnect'}</button></div></section></div>
}
function Connections(){
  const{connections,models,defaultProvider,loading,error,connect,testCredential,disconnect,test,setDefaultProvider}=useConnections()
  const[connecting,setConnecting]=useState<ConnectionProvider|null>(null)
  const[managing,setManaging]=useState<ConnectionProvider|null>(null)
  return <section className="page-view connections-page"><div className="page-heading"><div><span className="eyebrow">Settings</span><h1>Connections</h1><p>Manage the AI providers available to this workspace.</p></div></div><div className="connections-divider"/><div className="connections-section-label">AI providers</div>{error&&<p className="modal-note" role="alert">{error}</p>}<div className="provider-list">{providerCatalog.map(provider=>{const current=connections.find(item=>item.provider===provider.id);const connected=current?.status==='connected';const isDefault=defaultProvider===provider.id;return <article className="provider-card" key={provider.id}><div className="provider-copy"><div className="provider-mark"><ProviderIcon name={provider.name}/></div><div><div className="provider-title-row"><h2>{provider.name}</h2>{isDefault&&<span className="default-badge"><Check size={12}/>Default</span>}</div><p>{connected?'Connected':current?.status==='invalid'?'Invalid API Key':'Not connected'}{current&&` · Updated ${new Date(current.updatedAt).toLocaleString()}`}</p></div></div><div className="provider-actions">{loading?<span className="connection-status">Loading…</span>:current?<button className="secondary-action" onClick={()=>setManaging(provider.id)}>Manage</button>:<button className="secondary-action" onClick={()=>setConnecting(provider.id)}>Connect</button>}</div></article>})}</div>{connecting&&(()=>{const provider=providerCatalog.find(item=>item.id===connecting)!;return <ConnectModal provider={provider.name} updating={false} close={()=>setConnecting(null)} onTest={key=>testCredential(connecting,key)} onSave={key=>connect(connecting,key)}/>})()}{managing&&(()=>{const provider=providerCatalog.find(item=>item.id===managing)!;const connection=connections.find(item=>item.provider===managing);if(!connection)return null;return <ManageConnectionModal provider={provider} connection={connection} models={models.filter(model=>model.provider===managing)} isDefault={defaultProvider===managing} close={()=>setManaging(null)} onUpdate={key=>connect(managing,key)} onTest={()=>test(managing)} onDisconnect={()=>disconnect(managing)} onDefault={()=>setDefaultProvider(managing)}/>})()}</section>
}
export default function Page(){
  const router=useRouter()
  const{user,account,signOut}=useAccount()
  const{workspace,projects,recentProjects,loading,error,visitProject,createProject,updateProject,deleteProject}=useWorkspace()
  const knowledge=useKnowledge()
  const ai=useAI()
  const conversations=useConversations()
  const billing=useBilling()
  const[view,setView]=useState<View>('home')
  const[projectModal,setProjectModal]=useState<Project|'new'|null>(null)
  const[selectedProjectId,setSelectedProjectId]=useState<string|null>(null)
  const[conversationTransition,setConversationTransition]=useState<{projectId:string;leaving:boolean}|null>(null)
  const[upgradeModal,setUpgradeModal]=useState(false)
  const[downloadNotice,setDownloadNotice]=useState<string|null>(null)
  const transitionGeneration=useRef(0)
  const selectedProject=projects.find(project=>project.id===selectedProjectId)??null
  const openNewProject=useCallback(()=>{if(!user){router.push('/login');return}if((billing.plan==='free'&&projects.length>=3)||!billing.entitlements.canCreateProject){setUpgradeModal(true);return}setProjectModal('new')},[billing.entitlements.canCreateProject,billing.plan,projects.length,router,user])
  useEffect(()=>{const show=()=>{setProjectModal(null);setUpgradeModal(true)};window.addEventListener('agentflow:upgrade-required',show);return()=>window.removeEventListener('agentflow:upgrade-required',show)},[])
  useEffect(()=>{const show=(event:Event)=>{const name=(event as CustomEvent<{name?:string}>).detail?.name??'download';setDownloadNotice(name);dispatchAgentFlowEvent({event:'workflow.downloaded',projectId:selectedProjectId,workspaceId:workspace?.id??null,metadata:{name}})};window.addEventListener('agentflow:download-complete',show);return()=>window.removeEventListener('agentflow:download-complete',show)},[selectedProjectId,workspace?.id])
  const openProject=useCallback((project:Project)=>{visitProject(project.id);setSelectedProjectId(project.id);setView('workspace');window.history.pushState(null,'',`/?project=${project.id}`)},[visitProject])
  useEffect(()=>{const open=(event:Event)=>{const detail=(event as CustomEvent<{projectId?:string;stage?:string}>).detail;const target=projects.find(item=>item.id===detail?.projectId);if(target){if(detail.stage)window.sessionStorage.setItem('agentflow:open-stage',JSON.stringify({projectId:target.id,stage:detail.stage}));openProject(target)}};window.addEventListener('agentflow:open-project',open);return()=>window.removeEventListener('agentflow:open-project',open)},[openProject,projects])
  const continueConversation=useCallback((project:Project)=>{
    const generation=++transitionGeneration.current
    window.sessionStorage.setItem(`agentflow:continued:${project.id}`,'1')
    setConversationTransition({projectId:project.id,leaving:false})
    visitProject(project.id)
    setSelectedProjectId(project.id)
    setView('home')
    window.history.pushState(null,'',`/?chat=${project.id}`)
    dispatchAgentFlowEvent({event:'conversation.continued',projectId:project.id,workspaceId:workspace?.id??null,metadata:{source:'project-home'}})
    void Promise.all([
      Promise.allSettled([ai.loadProjectIntelligence(project.id),knowledge.loadProjectKnowledge(project.id),conversations.loadProjectConversations(project.id)]),
      new Promise(resolve=>window.setTimeout(resolve,650)),
    ]).then(()=>{
      if(transitionGeneration.current!==generation)return
      setConversationTransition({projectId:project.id,leaving:true})
      window.setTimeout(()=>{if(transitionGeneration.current===generation)setConversationTransition(null)},260)
    })
  },[ai,conversations,knowledge,visitProject,workspace?.id])
  const navigate=useCallback((next:View)=>{setView(next);if(next!=='workspace'){setSelectedProjectId(null);window.history.replaceState(null,'','/')}},[])
  useEffect(()=>{if(!projects.length||selectedProjectId)return;const params=new URLSearchParams(window.location.search);const snapshot=projects.find(item=>item.id===params.get('project'));const chat=projects.find(item=>item.id===params.get('chat'));const target=snapshot??chat;if(target){visitProject(target.id);setSelectedProjectId(target.id);setView(snapshot?'workspace':'home')}},[projects,selectedProjectId,visitProject])
  useEffect(()=>{const pop=()=>{const params=new URLSearchParams(window.location.search);const snapshot=projects.find(item=>item.id===params.get('project'));const chat=projects.find(item=>item.id===params.get('chat'));const target=snapshot??chat;if(target){visitProject(target.id);setSelectedProjectId(target.id);setView(snapshot?'workspace':'home')}else{setSelectedProjectId(null);setView('home')}};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[projects,visitProject])
  useEffect(()=>{const keydown=(event:KeyboardEvent)=>{if(event.repeat||projectModal||event.key.toLowerCase()!=='p'||(!event.metaKey&&!event.ctrlKey))return;const target=event.target;if(target instanceof HTMLElement&&(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable))return;event.preventDefault();openNewProject()};document.addEventListener('keydown',keydown);return()=>document.removeEventListener('keydown',keydown)},[openNewProject,projectModal])
  const selectForConversation=(project:Project)=>{visitProject(project.id);setSelectedProjectId(project.id);setView('home');window.history.replaceState(null,'',`/?chat=${project.id}`)}
  const saveProject=async(name:string,description:string,files:File[],workflowFile?:File)=>{
    if(projectModal!=='new'){if(projectModal)await updateProject(projectModal.id,{name,description});return}
    const created=await createProject({name,description,phase:workflowFile?PROJECT_STAGE.workflowGeneration:PROJECT_STAGE.businessProblem})
    try{
      if(workflowFile){
        if(!user)throw new Error('Sign in to import a workflow.')
        let payload:unknown
        try{payload=JSON.parse(await workflowFile.text())}catch{throw new Error('The imported workflow is not valid JSON.')}
        const response=await fetch('/api/workflows/import',{method:'POST',headers:{authorization:`Bearer ${await user.getIdToken()}`,'content-type':'application/json'},body:JSON.stringify({projectId:created.id,fileName:workflowFile.name,payload})})
        const result=await response.json()
        if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'Workflow import failed.')
        for(const file of files)await knowledge.uploadDocument(created.id,file)
        await ai.loadProjectIntelligence(created.id)
        await updateProject(created.id,{description:String(result.analysis?.businessPurpose??description),phase:PROJECT_STAGE.workflowPlanning})
        dispatchAgentFlowEvent({event:'workflow.imported',projectId:created.id,workspaceId:workspace?.id??null,metadata:{fileName:workflowFile.name,platform:result.platform}})
        selectForConversation(created)
        return
      }
      for(const file of files)await knowledge.uploadDocument(created.id,file)
      selectForConversation(created)
    }catch(value){
      if(workflowFile)dispatchAgentFlowEvent({event:'workflow.import.failed',projectId:created.id,workspaceId:workspace?.id??null,metadata:{fileName:workflowFile.name,message:value instanceof Error?value.message:'Workflow import failed.'}})
      await deleteProject(created.id)
      throw value
    }
  }
  const duplicateProject=async(project:Project)=>{const created=await createProject({name:`${project.name} copy`,description:project.description,phase:project.phase});selectForConversation(created)}
  const removeProject=async(project:Project)=>{await deleteProject(project.id);if(selectedProjectId===project.id){setSelectedProjectId(null);setView('projects');window.history.replaceState(null,'','/')}}
  const displayedAccount={...account,plan:account.status==='signed-in'?`${planLabels[billing.plan]} Plan`:null}
  return <main className="product-app-shell design-v2"><style dangerouslySetInnerHTML={{__html:repairStyles}}/><Sidebar account={displayedAccount} signOut={signOut} view={view} setView={navigate} recentProjects={recentProjects} newProject={openNewProject} project={selectedProject} openProject={openProject}/><div className="main-shell"><Top account={displayedAccount} signOut={signOut} setView={navigate}/>{view==='home'&&<Home project={selectedProject} projects={projects} recentProjects={recentProjects} createProject={createProject} onProjectReady={selectForConversation} onSelectProject={selectForConversation} onNewProject={openNewProject} onUpdate={async(projectId,values)=>{await updateProject(projectId,values)}}/>}{view==='projects'&&<Projects projects={projects} newProject={openNewProject} onOpen={openProject} onManage={setProjectModal} loading={loading} error={error}/>} {view==='connections'&&<Connections/>} {view==='usage'&&<UsageDashboard/>}{view==='billing'&&<BillingPage/>}{view==='workspace'&&selectedProject&&<ProjectWorkspace project={selectedProject} workspaceName={workspace?.name||'Personal Workspace'} onContinue={()=>continueConversation(selectedProject)} onManage={()=>setProjectModal(selectedProject)} onUpdate={async(projectId,values)=>{await updateProject(projectId,values)}}/>}</div>{conversationTransition&&<ConversationTransition leaving={conversationTransition.leaving}/>} {projectModal&&<ProjectModal project={projectModal==='new'?null:projectModal} close={()=>setProjectModal(null)} onSave={saveProject} onDuplicate={projectModal==='new'?undefined:()=>duplicateProject(projectModal)} onDelete={projectModal==='new'?undefined:()=>removeProject(projectModal)}/>} {upgradeModal&&<UpgradeModal close={()=>setUpgradeModal(false)}/>} {downloadNotice&&<aside className="download-success global-download-success" role="status" aria-live="polite"><span><Check size={18}/></span><div><h3>Production Package Downloaded</h3><p><b>{downloadNotice}</b> is ready. Import workflow.json into n8n, configure credentials, complete .env.example, follow the README, test every branch, then deploy.</p><small>Need help? Continue chatting and upload workflow.json, screenshots, logs, or node exports. AgentFlow will diagnose the issue and generate a repaired version.</small></div><button onClick={()=>setDownloadNotice(null)} aria-label="Dismiss download confirmation"><X size={14}/></button></aside>}</main>
}
