import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from '@/lib/automation/types'

/** A validated workflow whose nodes have resolved canvas coordinates. */
export type PositionedWorkflowGraph = WorkflowGraph

/** Layout providers may change coordinates and display order, never workflow semantics. */
export interface WorkflowLayoutProvider {
  readonly id: string
  position(graph: WorkflowGraph): PositionedWorkflowGraph
}

const GRID_X = 280
const GRID_Y = 160
const ORIGIN_X = 120
const ORIGIN_Y = 120

function operationGroup(node: WorkflowNode) {
  const value = `${node.name} ${node.description} ${node.service ?? ''} ${node.operation ?? ''}`.toLowerCase()
  if (node.type === 'error-handler' || /error|failure|fallback|dead.?letter|catch/.test(value)) return 5
  if (/log|audit|metric|trace|monitor/.test(value)) return 4
  if (/notify|notification|slack|teams|email|sms|message/.test(value)) return 3
  if (node.type === 'condition' || node.type === 'approval' || /validat|verify|approve|filter/.test(value)) return 1
  if (node.type === 'trigger') return 0
  return 2
}

function stronglyConnectedComponents(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const adjacency = new Map(nodes.map(node => [node.id, [] as string[]]))
  edges.forEach(edge => adjacency.get(edge.source)?.push(edge.target))
  const indexById = new Map<string, number>()
  const lowById = new Map<string, number>()
  const stack: string[] = []
  const inStack = new Set<string>()
  const components: string[][] = []
  let index = 0

  const visit = (id: string) => {
    indexById.set(id, index)
    lowById.set(id, index)
    index += 1
    stack.push(id)
    inStack.add(id)
    for (const target of adjacency.get(id) ?? []) {
      if (!indexById.has(target)) {
        visit(target)
        lowById.set(id, Math.min(lowById.get(id)!, lowById.get(target)!))
      } else if (inStack.has(target)) lowById.set(id, Math.min(lowById.get(id)!, indexById.get(target)!))
    }
    if (lowById.get(id) !== indexById.get(id)) return
    const component: string[] = []
    let current = ''
    do {
      current = stack.pop()!
      inStack.delete(current)
      component.push(current)
    } while (current !== id)
    components.push(component)
  }
  nodes.forEach(node => { if (!indexById.has(node.id)) visit(node.id) })
  return components
}

function componentDepths(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const components = stronglyConnectedComponents(nodes, edges)
  const componentByNode = new Map<string, number>()
  components.forEach((component, componentIndex) => component.forEach(id => componentByNode.set(id, componentIndex)))
  const outgoing = components.map(() => new Set<number>())
  const incoming = components.map(() => new Set<number>())
  edges.forEach(edge => {
    const source = componentByNode.get(edge.source)
    const target = componentByNode.get(edge.target)
    if (source === undefined || target === undefined || source === target) return
    outgoing[source].add(target)
    incoming[target].add(source)
  })
  const indegree = incoming.map(items => items.size)
  const queue = indegree.map((value, component) => ({ value, component })).filter(item => item.value === 0).map(item => item.component)
  const depth = components.map(() => 0)
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const source = queue[cursor]
    outgoing[source].forEach(target => {
      depth[target] = Math.max(depth[target], depth[source] + 1)
      indegree[target] -= 1
      if (indegree[target] === 0) queue.push(target)
    })
  }
  return new Map(nodes.map(node => [node.id, depth[componentByNode.get(node.id)!]]))
}

function orderedLayers(graph: WorkflowGraph, depthById: Map<string, number>) {
  const layers = new Map<number, WorkflowNode[]>()
  graph.nodes.filter(node => operationGroup(node) !== 5).forEach(node => {
    const depth = depthById.get(node.id) ?? 0
    layers.set(depth, [...(layers.get(depth) ?? []), node])
  })
  const predecessorRows = new Map<string, number>()
  const incoming = new Map(graph.nodes.map(node => [node.id, [] as string[]]))
  graph.edges.forEach(edge => incoming.get(edge.target)?.push(edge.source))
  for (const depth of [...layers.keys()].sort((left, right) => left - right)) {
    const layer = layers.get(depth)!
    layer.sort((left, right) => {
      const average = (node: WorkflowNode) => {
        const rows = (incoming.get(node.id) ?? []).map(id => predecessorRows.get(id)).filter((row): row is number => row !== undefined)
        return rows.length ? rows.reduce((sum, row) => sum + row, 0) / rows.length : Number.MAX_SAFE_INTEGER
      }
      return average(left) - average(right) || operationGroup(left) - operationGroup(right) || graph.nodes.indexOf(left) - graph.nodes.indexOf(right)
    })
    layer.forEach((node, row) => predecessorRows.set(node.id, row))
  }
  return layers
}

/**
 * Deterministic Sugiyama-style layout for automation graphs. It condenses cycles,
 * assigns left-to-right ranks, orders branches by predecessor barycentres, snaps
 * everything to a grid, and reserves a dedicated lane for errors and logging.
 */
export const productionAutoLayout: WorkflowLayoutProvider = {
  id: 'agentflow-layered-v1',
  position(graph) {
    const depthById = componentDepths(graph.nodes, graph.edges)
    const layers = orderedLayers(graph, depthById)
    const positions = new Map<string, { x: number; y: number }>()
    let largestLayer = 1
    layers.forEach(layer => { largestLayer = Math.max(largestLayer, layer.length) })
    layers.forEach((layer, depth) => {
      const offset = (largestLayer - layer.length) * GRID_Y / 2
      layer.forEach((node, row) => positions.set(node.id, { x: ORIGIN_X + depth * GRID_X, y: ORIGIN_Y + offset + row * GRID_Y }))
    })
    const errorNodes = graph.nodes.filter(node => operationGroup(node) === 5)
    const errorLaneY = ORIGIN_Y + largestLayer * GRID_Y + GRID_Y
    errorNodes.sort((left, right) => (depthById.get(left.id) ?? 0) - (depthById.get(right.id) ?? 0) || graph.nodes.indexOf(left) - graph.nodes.indexOf(right))
    const errorRows = new Map<number, number>()
    errorNodes.forEach((node, index) => {
      const depth = depthById.get(node.id) ?? index
      const row = errorRows.get(depth) ?? 0
      errorRows.set(depth, row + 1)
      positions.set(node.id, { x: ORIGIN_X + depth * GRID_X, y: errorLaneY + row * GRID_Y })
    })
    const nodes = graph.nodes.map(node => ({ ...node, position: positions.get(node.id) ?? node.position })).sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y)
    return { ...graph, nodes }
  },
}

/** Compatibility provider for imported graphs that explicitly request source coordinates. */
export const preserveExistingLayout: WorkflowLayoutProvider = { id: 'existing-positions', position: graph => graph }

export function layoutWorkflowGraph(graph: WorkflowGraph, provider: WorkflowLayoutProvider = productionAutoLayout): PositionedWorkflowGraph {
  return provider.position(graph)
}
