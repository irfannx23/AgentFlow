import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const VERSION = 'v1'

function encryptionKey() {
  const secret = process.env.CONNECTIONS_ENCRYPTION_KEY?.trim()
  if (!secret) throw new Error('Connection encryption is not configured.')

  // Accept a 32-byte base64 key when available. Hashing the configured secret
  // also supports secret managers that provide high-entropy text values.
  const decoded = Buffer.from(secret, 'base64')
  return decoded.length === 32 ? decoded : createHash('sha256').update(secret, 'utf8').digest()
}

export function encryptCredential(plaintext: string, context: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from(context, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptCredential(payload: string, context: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext] = payload.split('.')
  if (version !== VERSION || !encodedIv || !encodedTag || !encodedCiphertext) throw new Error('Stored connection credential is invalid.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(encodedIv, 'base64url'))
  decipher.setAAD(Buffer.from(context, 'utf8'))
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, 'base64url')), decipher.final()]).toString('utf8')
}
