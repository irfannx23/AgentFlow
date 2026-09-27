import { inflateRawSync } from 'node:zlib'

const TEXT_EXTENSIONS = new Set(['txt', 'log', 'md', 'markdown', 'json', 'yaml', 'yml', 'env', 'example'])
const MAX_ENTRIES = 100
const MAX_EXTRACTED_BYTES = 10 * 1024 * 1024

/** Reads safe text evidence from a ZIP without writing archive contents to disk. */
export function extractZipText(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes)
  const sections: string[] = []
  let extractedBytes = 0
  let cursor = 0
  let entries = 0
  while (cursor + 46 <= buffer.length && entries < MAX_ENTRIES) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      cursor += 1
      continue
    }
    const method = buffer.readUInt16LE(cursor + 10)
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const uncompressedSize = buffer.readUInt32LE(cursor + 24)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')
    cursor += 46 + nameLength + extraLength + commentLength
    entries += 1
    if (!name || name.endsWith('/') || name.includes('..') || name.startsWith('/')) continue
    const extension = name.toLowerCase().split('.').pop() ?? ''
    if (!TEXT_EXTENSIONS.has(extension) || uncompressedSize > MAX_EXTRACTED_BYTES) continue
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) continue
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataStart + compressedSize
    if (dataEnd > buffer.length) continue
    const compressed = buffer.subarray(dataStart, dataEnd)
    const content = method === 0
      ? compressed
      : method === 8
        ? inflateRawSync(compressed, { maxOutputLength: MAX_EXTRACTED_BYTES - extractedBytes })
        : null
    if (!content || extractedBytes + content.length > MAX_EXTRACTED_BYTES) continue
    extractedBytes += content.length
    sections.push(`--- ${name} ---\n${content.toString('utf8')}`)
  }
  if (!sections.length) throw new Error('No readable automation files were found in this ZIP archive.')
  return sections.join('\n\n')
}
