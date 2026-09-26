import { workflowValidationIssues, type WorkflowEdge, type WorkflowGraph, type WorkflowNode, type WorkflowNodeType } from '@/lib/automation/types'
import type { Json } from '@/lib/supabase/types'

type RecordValue = Record<string, unknown>
export type ImportPlatform = 'n8n'|'make'

function object(value: unknown): RecordValue { return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {} }
function text(value: unknown, fallback = '') { return typeof value === 'string' && value.trim() ? value.trim() : fallback }
function jsonObject(value: unknown): Record<string, Json> { return object(value) as Record<string, Json> }
function nodeType(type: string, index: number): WorkflowNodeType {
  if (index === 0 || /trigger|webhook|schedule|cron/i.test(type)) return 'trigger'
  if (/\bif\b|filter|router|condition/i.test(type)) return 'condition'
  if (/wait|delay|sleep/i.test(type)) return 'delay'
  if (/error|catch|fallback/i.test(type)) return 'error-handler'
  if (/approval/i.test(type)) return 'approval'
  if (/transform|set|code|function/i.test(type)) return 'transform'
  return 'action'
}

function unique(value: string, used: Set<string>, fallback: string) {
  let candidate = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || fallback
  let suffix = 2
  while (used.has(candidate)) candidate = `${value}-${suffix++}`
  used.add(candidate)
  return candidate
}

function n8nGraph(payload: RecordValue): WorkflowGraph {
  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes.map(object) : []
  if (rawNodes.length < 2) throw new Error('The n8n workflow must contain at least two nodes.')
  const ids = new Set<string>(); const names = new Set<string>()
  let triggerAssigned = false
  const nodes:WorkflowNode[]=rawNodes.map((raw,index)=>{
    const rawType=text(raw.type,'unknown')
    let type=nodeType(rawType,index)
    if(type==='trigger'){if(triggerAssigned)type='action';else triggerAssigned=true}
    const name=unique(text(raw.name,`Step ${index+1}`),names,`Step-${index+1}`)
    const position=Array.isArray(raw.position)?raw.position:[]
    return {id:unique(text(raw.id,`node-${index+1}`),ids,`node-${index+1}`),type,name,description:text(object(raw.parameters).notes,`${name} imported from n8n.`),service:rawType.replace(/^n8n-nodes-(?:base|langchain)\./,''),operation:text(object(raw.parameters).operation,'execute'),inputs:jsonObject(raw.parameters),outputs:{},retry:{attempts:raw.retryOnFail===true?Math.max(1,Number(raw.maxTries)||3):0,backoffSeconds:Math.max(0,Number(raw.waitBetweenTries)||0)/1000},timeoutSeconds:Math.max(1,Number(raw.timeout)||30),position:{x:Number(position[0])||index*240,y:Number(position[1])||0}}
  })
  const byRawName=new Map(rawNodes.map((node,index)=>[text(node.name),nodes[index]]))
  const edges:WorkflowEdge[]=[]; const edgeIds=new Set<string>()
  for(const [sourceName,rawConnection] of Object.entries(object(payload.connections))){
    const source=byRawName.get(sourceName);if(!source)throw new Error(`n8n connection source does not exist: ${sourceName}.`)
    const branches=object(rawConnection).main
    if(!Array.isArray(branches))continue
    branches.forEach((branch,branchIndex)=>{if(!Array.isArray(branch))throw new Error(`n8n connection branch ${branchIndex} from ${sourceName} is invalid.`);branch.forEach(rawTarget=>{const targetName=text(object(rawTarget).node);const target=byRawName.get(targetName);if(!target)throw new Error(`n8n connection from ${sourceName} references missing node ${targetName||'(unnamed)'}.`);edges.push({id:unique(`edge-${source.id}-${target.id}`,edgeIds,'edge'),source:source.id,target:target.id,...(source.type==='condition'?{condition:branchIndex===0?'true':'false',label:branchIndex===0?'Yes':'No'}:{})})})})
  }
  const reachable=new Set([nodes[0].id]);let changed=true
  while(changed){changed=false;for(const edge of edges)if(reachable.has(edge.source)&&!reachable.has(edge.target)){reachable.add(edge.target);changed=true}}
  for(let index=1;index<nodes.length;index++)if(!reachable.has(nodes[index].id)){edges.push({id:unique(`edge-import-${index}`,edgeIds,'edge'),source:nodes[index-1].id,target:nodes[index].id,label:'Imported sequence'});reachable.add(nodes[index].id)}
  const credentialServices=new Set<string>()
  rawNodes.forEach(node=>Object.values(object(node.credentials)).forEach(value=>credentialServices.add(text(object(value).name,text(value,'Credential')))))
  const serialized=JSON.stringify(payload)
  const variables=[...new Set([...serialized.matchAll(/\$env(?:\.([A-Z][A-Z0-9_]+)|\[['"]([A-Z][A-Z0-9_]+)['"]\])/g)].map(match=>match[1]||match[2]))]
  return {schemaVersion:1,name:text(payload.name,'Imported n8n Workflow'),description:'Imported from an existing n8n workflow.',nodes,edges,variables:variables.map(name=>({name,description:`Environment variable referenced by the imported workflow.`,type:'string',required:true})),credentials:[...credentialServices].filter(Boolean).map((name,index)=>({name:`credential_${index+1}`,service:name,description:`Credential used by ${name}.`,required:true})),assumptions:['Imported node parameters were preserved as internal inputs.'],risks:[]}
}

function makeGraph(payload: RecordValue): WorkflowGraph {
  const subflows=Array.isArray(payload.subflows)?payload.subflows.map(object):[]
  const rawModules=(Array.isArray(payload.flow)?payload.flow:Array.isArray(payload.modules)?payload.modules:subflows.flatMap(subflow=>Array.isArray(subflow.flow)?subflow.flow:[])).map(object)
  if(rawModules.length<2)throw new Error('The Make.com blueprint must contain at least two modules.')
  const ids=new Set<string>();const names=new Set<string>()
  const nodes=rawModules.map((raw,index):WorkflowNode=>{const service=text(raw.module,text(raw.type,'Make'));const name=unique(text(object(raw.metadata).designer ? object(object(raw.metadata).designer).name : raw.name,`${service} ${index+1}`),names,`Step-${index+1}`);const position=object(object(raw.metadata).designer);return{id:unique(text(raw.id,`module-${index+1}`),ids,`module-${index+1}`),type:nodeType(service,index),name,description:`${name} imported from Make.com.`,service,operation:text(raw.operation,'execute'),inputs:jsonObject(raw.mapper),outputs:{},retry:{attempts:3,backoffSeconds:5},timeoutSeconds:30,position:{x:Number(position.x)||index*240,y:Number(position.y)||0}}})
  const edges=nodes.slice(1).map((node,index)=>({id:`edge-${index+1}`,source:nodes[index].id,target:node.id}))
  return{schemaVersion:1,name:text(payload.name,text(object(payload.metadata).name,'Imported Make Workflow')),description:'Imported from a Make.com blueprint.',nodes,edges,variables:[],credentials:[...new Set(nodes.map(node=>node.service).filter(Boolean) as string[])].map((service,index)=>({name:`credential_${index+1}`,service,description:`Credential used by ${service}.`,required:true})),assumptions:['Make.com module order was preserved.'],risks:[]}
}

export function detectWorkflowPlatform(payload: unknown): ImportPlatform {
  const value=object(payload)
  if(Array.isArray(value.nodes)&&value.connections&&typeof value.connections==='object')return'n8n'
  if(Array.isArray(value.flow)||Array.isArray(value.modules)||Array.isArray(value.subflows))return'make'
  throw new Error('Unsupported workflow file. Upload an n8n JSON workflow or Make.com blueprint.')
}

export function importWorkflow(payload: unknown, platform=detectWorkflowPlatform(payload)) {
  const graph=platform==='n8n'?n8nGraph(object(payload)):makeGraph(object(payload))
  const issues=workflowValidationIssues(graph)
  if(issues.length)throw new Error(`Imported workflow validation failed: ${issues.join(' ')}`)
  const integrations=[...new Set(graph.nodes.map(node=>node.service).filter((value):value is string=>Boolean(value)))]
  const errorNodes=graph.nodes.filter(node=>node.type==='error-handler')
  const analysis={workflowSummary:`${graph.name} contains ${graph.nodes.length} nodes and ${graph.edges.length} connections.`,businessPurpose:graph.description,triggerAnalysis:graph.nodes.find(node=>node.type==='trigger')?.description??'Trigger detected from the first module.',actionAnalysis:`${graph.nodes.filter(node=>node.type!=='trigger').length} downstream actions and decisions detected.`,integrationMap:integrations,environmentVariables:graph.variables.map(variable=>variable.name),credentialsUsed:graph.credentials.map(credential=>credential.service),errorHandlingReview:errorNodes.length?`${errorNodes.length} explicit error-handling node(s) detected.`:'No explicit error-handler node was detected.',performanceReview:graph.nodes.length>30?'Large workflow; review sequential operations and API rate limits.':'Workflow size is within a typical operating range.',securityReview:graph.credentials.length?'Credentials were detected and must remain in the target platform credential store.':'No explicit credential metadata was detected; verify authentication manually.',complexityScore:Math.min(100,Math.round(graph.nodes.length*2+graph.edges.length+graph.credentials.length*3)),missingDocumentation:graph.nodes.filter(node=>/imported from/i.test(node.description)).map(node=>node.name),improvementSuggestions:[...(errorNodes.length?[]:['Add explicit error handling and failure notifications.']),'Validate credentials and test every branch before production activation.']}
  return{graph,analysis}
}
