import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import { testProviderConnection } from '../lib/ai/provider-connection'
import { providerHttpError } from '../lib/ai/provider-errors'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('provider connection contracts', { concurrency: false }, () => {
  test('DeepSeek connection remains successful for a valid model-list response', async () => {
    globalThis.fetch = async () => response(200, { data: [{ id: 'deepseek-flash' }] })
    assert.deepEqual(await testProviderConnection({ provider: 'deepseek', endpoint: 'https://api.deepseek.com/models', headers: { authorization: 'Bearer safe-test-key' } }), { success: true, provider: 'deepseek' })
  })

  test('Gemini valid connection uses the direct generateContent endpoint', async () => {
    let requested = ''
    globalThis.fetch = async input => {
      requested = String(input)
      return response(200, { candidates: [{ content: { parts: [{ text: 'OK' }] } }] })
    }
    const result = await testProviderConnection({ provider: 'gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', method: 'POST', headers: { 'x-goog-api-key': 'safe-test-key' } })
    assert.equal(result.success, true)
    assert.match(requested, /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.6-flash:generateContent$/)
  })

  test('Gemini invalid key is authentication-classified without leaking it', async () => {
    const secret = 'AIza-secret-must-not-leak'
    globalThis.fetch = async () => response(400, { error: { message: `API key not valid: ${secret}` } })
    const result = await testProviderConnection({ provider: 'gemini', endpoint: 'https://example.test', headers: { 'x-goog-api-key': secret } })
    assert.equal(result.category, 'authentication')
    assert.equal(result.diagnosticCode, 'PROVIDER_AUTHENTICATION_FAILED')
    assert.doesNotMatch(JSON.stringify(result), new RegExp(secret))
  })

  test('Gemini invalid model and upstream outage are classified', async t => {
    await t.test('model', async () => {
      globalThis.fetch = async () => response(404, { error: { message: 'model not found' } })
      assert.equal((await testProviderConnection({ provider: 'gemini', endpoint: 'https://example.test', headers: {} })).category, 'model')
    })
    await t.test('upstream', async () => {
      globalThis.fetch = async () => response(503, { error: { message: 'unavailable' } })
      assert.equal((await testProviderConnection({ provider: 'gemini', endpoint: 'https://example.test', headers: {} })).category, 'upstream')
    })
  })

  test('Gemini timeout, network, and malformed endpoint are distinguished', async t => {
    await t.test('timeout', async () => {
      globalThis.fetch = async () => { throw new DOMException('timed out', 'TimeoutError') }
      assert.equal((await testProviderConnection({ provider: 'gemini', endpoint: 'https://example.test', headers: {} })).category, 'timeout')
    })
    await t.test('network', async () => {
      globalThis.fetch = async () => { throw new TypeError('fetch failed') }
      assert.equal((await testProviderConnection({ provider: 'gemini', endpoint: 'https://example.test', headers: {} })).category, 'network')
    })
    await t.test('endpoint', async () => {
      assert.equal(providerHttpError('gemini', 400, 'invalid endpoint url').category, 'endpoint')
    })
  })
})
