import 'server-only'

import { createHash } from 'node:crypto'
import mammoth from 'mammoth'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import type { AIProviderAdapter } from '@/lib/ai/provider'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const CHUNK_SIZE = 1_600
const CHUNK_OVERLAP = 240

export function validateDocument(name: string, mimeType: string | null, size: number) {
  if (size <= 0 || size > MAX_FILE_BYTES) throw new Error('Document must be between 1 byte and 50 MB.')
  const extension = name.toLowerCase().split('.').pop() ?? ''
  const supported = ['txt', 'md', 'markdown', 'json', 'yaml', 'yml', 'pdf', 'docx'].includes(extension) || mimeType?.startsWith('image/')
  if (!supported) throw new Error('Unsupported document type. Upload text, Markdown, JSON, YAML, PDF, Word, or an image.')
}

export async function extractDocumentText(name: string, mimeType: string | null, bytes: Uint8Array, provider: AIProviderAdapter, credential: string) {
  const extension = name.toLowerCase().split('.').pop() ?? ''
  const buffer = Buffer.from(bytes)
  if (mimeType?.startsWith('image/')) return provider.extractText(buffer.toString('base64'), mimeType, credential)
  if (extension === 'pdf' || mimeType === 'application/pdf') return (await pdf(buffer)).text
  if (extension === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return (await mammoth.extractRawText({ buffer })).value
  return buffer.toString('utf8')
}

export function documentHash(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function chunkDocument(text: string) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!normalized) throw new Error('No readable text was found in this document.')
  const chunks: string[] = []
  let start = 0
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + CHUNK_SIZE)
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf('\n\n', end), normalized.lastIndexOf('. ', end))
      if (boundary > start + CHUNK_SIZE / 2) end = boundary + 1
    }
    const chunk = normalized.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    if (end >= normalized.length) break
    start = Math.max(start + 1, end - CHUNK_OVERLAP)
  }
  return chunks
}
