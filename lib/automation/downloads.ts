import type { WorkflowGraph } from '@/lib/automation/types'
import { layoutWorkflowGraph } from '@/lib/automation/layout'
import { optimizeWorkflowGraph } from '@/lib/automation/quality'

export type DownloadArtifact = {
  name: string
  data: string | Uint8Array | (() => Promise<string | Uint8Array>)
  mimeType: string
}

export function artifactValidationIssues(artifacts: DownloadArtifact[]) {
  const issues: string[] = []
  const names = new Set<string>()
  for (const artifact of artifacts) {
    if (!artifact.name || artifact.name.includes('/') || artifact.name.includes('\\') || artifact.name === '.' || artifact.name === '..') issues.push(`Artifact filename is unsafe: ${artifact.name || '(empty)'}.`)
    if (names.has(artifact.name)) issues.push(`Duplicate artifact filename: ${artifact.name}.`)
    names.add(artifact.name)
    if (!/^[\w.+-]+\/[\w.+-]+(?:;.*)?$/.test(artifact.mimeType)) issues.push(`Artifact ${artifact.name} has an invalid MIME type.`)
    if (typeof artifact.data !== 'function' && bytes(artifact.data).length === 0) issues.push(`Artifact ${artifact.name} is empty.`)
  }
  return issues
}

const encoder = new TextEncoder()

function bytes(value: string | Uint8Array) {
  return typeof value === 'string' ? encoder.encode(value) : value
}

export function safeFileName(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'automation'
}

async function resolvedData(artifact: DownloadArtifact) {
  return typeof artifact.data === 'function' ? artifact.data() : artifact.data
}

export async function downloadArtifact(artifact: DownloadArtifact) {
  const blob = new Blob([bytes(await resolvedData(artifact)) as BlobPart], { type: artifact.mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = artifact.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7e]/g, '?')
}

function wrapText(text: string, width = 88) {
  const result: string[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) { result.push(''); continue }
    const words = paragraph.trim().split(/\s+/)
    let line = ''
    for (const word of words) {
      if (!line) line = word
      else if (`${line} ${word}`.length <= width) line += ` ${word}`
      else { result.push(line); line = word }
    }
    if (line) result.push(line)
  }
  return result
}

export function textPdf(title: string, text: string) {
  const pages = wrapText(text).reduce<string[][]>((all, line) => {
    const page = all.at(-1)
    if (!page || page.length >= 46) all.push([line])
    else page.push(line)
    return all
  }, [])
  if (!pages.length) pages.push(['No content available.'])
  const pageObjectStart = 4
  const contentObjectStart = pageObjectStart + pages.length
  const objects: string[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, index) => `${pageObjectStart + index} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  for (const [index] of pages.entries()) objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectStart + index} 0 R >>`)
  for (const page of pages) {
    const lines = [`BT /F1 18 Tf 54 742 Td (${pdfEscape(title)}) Tj`, '/F1 10 Tf 0 -28 Td']
    page.forEach((line, index) => lines.push(`${index ? '0 -15 Td ' : ''}(${pdfEscape(line)}) Tj`))
    lines.push('ET')
    const stream = lines.join('\n')
    objects.push(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`)
  }
  let output = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(encoder.encode(output).length); output += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = encoder.encode(output).length
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return encoder.encode(output)
}

export async function workflowPng(graph: WorkflowGraph) {
  const positioned = layoutWorkflowGraph(optimizeWorkflowGraph(graph))
  const minX = Math.min(...positioned.nodes.map(node => node.position.x))
  const minY = Math.min(...positioned.nodes.map(node => node.position.y))
  const maxX = Math.max(...positioned.nodes.map(node => node.position.x))
  const maxY = Math.max(...positioned.nodes.map(node => node.position.y))
  const nodeWidth = 230
  const nodeHeight = 82
  const offsetX = 90 - minX
  const offsetY = 150 - minY
  const width = Math.max(1200, maxX - minX + nodeWidth + 180)
  const height = Math.max(640, maxY - minY + nodeHeight + 240)
  const density = 2
  const canvas = document.createElement('canvas')
  canvas.width = width * density
  canvas.height = height * density
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Workflow image rendering is not supported in this browser.')
  context.scale(density, density)
  context.fillStyle = '#f5f7f2'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#182019'
  context.font = '600 36px system-ui'
  context.fillText(graph.name, 76, 72)
  context.font = '18px system-ui'
  context.fillStyle = '#69736b'
  context.fillText('AgentFlow internal workflow', 76, 105)
  const nodeById = new Map(positioned.nodes.map(node => [node.id, node]))
  context.lineWidth = 2
  for (const edge of positioned.edges) {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target) continue
    const sourceX = source.position.x + offsetX + nodeWidth
    const sourceY = source.position.y + offsetY + nodeHeight / 2
    const targetX = target.position.x + offsetX
    const targetY = target.position.y + offsetY + nodeHeight / 2
    context.strokeStyle = edge.errorPath ? '#c76a5d' : '#a7b19f'
    context.beginPath()
    context.moveTo(sourceX, sourceY)
    const control = Math.max(45, (targetX - sourceX) / 2)
    context.bezierCurveTo(sourceX + control, sourceY, targetX - control, targetY, targetX, targetY)
    context.stroke()
  }
  positioned.nodes.forEach(node => {
    const x = node.position.x + offsetX
    const y = node.position.y + offsetY
    context.fillStyle = 'rgba(255,255,255,.96)'
    context.strokeStyle = node.type === 'trigger' ? '#78a938' : node.type === 'error-handler' ? '#c76a5d' : '#dce2d8'
    context.lineWidth = node.type === 'trigger' || node.type === 'error-handler' ? 3 : 2
    context.beginPath()
    context.roundRect(x, y, nodeWidth, nodeHeight, 16)
    context.fill()
    context.stroke()
    context.fillStyle = '#253028'
    context.font = '600 15px system-ui'
    const name = node.name.length > 27 ? `${node.name.slice(0, 26)}…` : node.name
    context.fillText(name, x + 18, y + 33)
    context.fillStyle = '#778179'
    context.font = '11px system-ui'
    const detail = `${node.type} · ${node.service || 'Internal'}`
    context.fillText(detail.length > 34 ? `${detail.slice(0, 33)}…` : detail, x + 18, y + 57)
  })
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Unable to render workflow PNG.')), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const value of data) crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function push16(output: number[], value: number) { output.push(value & 0xff, (value >>> 8) & 0xff) }
function push32(output: number[], value: number) { push16(output, value & 0xffff); push16(output, value >>> 16) }

export function zipArtifacts(artifacts: DownloadArtifact[]) {
  const issues = artifactValidationIssues(artifacts)
  if (issues.length) throw new Error(`Project ZIP validation failed: ${issues.join(' ')}`)
  const local: number[] = []
  const central: number[] = []
  for (const artifact of artifacts) {
    const name = encoder.encode(artifact.name)
    if (typeof artifact.data === 'function') throw new Error(`Artifact ${artifact.name} must be resolved before creating a ZIP.`)
    const data = bytes(artifact.data)
    const crc = crc32(data)
    const offset = local.length
    push32(local, 0x04034b50); push16(local, 20); push16(local, 0x0800); push16(local, 0); push16(local, 0); push16(local, 0); push32(local, crc); push32(local, data.length); push32(local, data.length); push16(local, name.length); push16(local, 0)
    local.push(...name, ...data)
    push32(central, 0x02014b50); push16(central, 20); push16(central, 20); push16(central, 0x0800); push16(central, 0); push16(central, 0); push16(central, 0); push32(central, crc); push32(central, data.length); push32(central, data.length); push16(central, name.length); push16(central, 0); push16(central, 0); push16(central, 0); push16(central, 0); push32(central, 0); push32(central, offset)
    central.push(...name)
  }
  const output = [...local, ...central]
  push32(output, 0x06054b50); push16(output, 0); push16(output, 0); push16(output, artifacts.length); push16(output, artifacts.length); push32(output, central.length); push32(output, local.length); push16(output, 0)
  return new Uint8Array(output)
}

export async function downloadProjectZip(name: string, artifacts: DownloadArtifact[]) {
  const resolved = await Promise.all(artifacts.map(async artifact => ({ ...artifact, data: await resolvedData(artifact) })))
  await downloadArtifact({ name: `${safeFileName(name)}.zip`, data: zipArtifacts(resolved), mimeType: 'application/zip' })
}
