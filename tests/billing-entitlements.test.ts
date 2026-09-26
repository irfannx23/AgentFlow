import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyUsage, entitlementsFor } from '../lib/billing/types'
import { createCheckoutHash, payuConfig } from '../lib/billing/payu'
import { createPayUTestCheckout } from '../lib/billing/checkout'

test('free plan stops project creation at three projects', () => {
  assert.equal(entitlementsFor('free', { projects: 2 }).canCreateProject, true)
  const atLimit = entitlementsFor('free', { projects: 3 })
  assert.equal(atLimit.canCreateProject, false)
  assert.equal(atLimit.projectLimit, 3)
})

test('pro plan has lifecycle entitlements and no project cap', () => {
  const entitlements = entitlementsFor('pro', { projects: 300 })
  assert.equal(entitlements.canCreateProject, true)
  assert.equal(entitlements.canImportWorkflow, true)
  assert.equal(entitlements.canUseVersionHistory, true)
  assert.equal(entitlements.projectLimit, null)
})

test('billing usage defaults are safe zero values', () => {
  assert.equal(Object.values(emptyUsage).every(value => value === 0), true)
})

test('PayU Test checkout uses the documented basic payment hash sequence', () => {
  const hash = createCheckoutHash({ key: 'testKey', txnid: 'txn123', amount: '999.00', productinfo: 'AgentFlow Pro Test Checkout', firstname: 'Ada', email: 'ada@example.com', udf1: '', udf2: '', udf3: '', udf4: '', udf5: '' }, 'testSalt')
  assert.equal(hash, '91bfba40af29cbaf42cc74a3ebff4247863e7e0e3cd79681cca9ece1751c4cb438161048bcbfe84515962861d1f916ae69ab17805b01336b639f2fdf91adee2f')
})

test('missing PayU Test credentials produce a developer-friendly configuration error', () => {
  const originalKey = process.env.PAYU_MERCHANT_KEY
  const originalSalt = process.env.PAYU_MERCHANT_SALT
  delete process.env.PAYU_MERCHANT_KEY
  delete process.env.PAYU_MERCHANT_SALT
  assert.throws(payuConfig, /PayU Test credentials are incomplete/)
  if (originalKey === undefined) delete process.env.PAYU_MERCHANT_KEY
  else process.env.PAYU_MERCHANT_KEY = originalKey
  if (originalSalt === undefined) delete process.env.PAYU_MERCHANT_SALT
  else process.env.PAYU_MERCHANT_SALT = originalSalt
})

test('PayU development checkout targets the test gateway without subscription fields', () => {
  const originalKey = process.env.PAYU_MERCHANT_KEY
  const originalSalt = process.env.PAYU_MERCHANT_SALT
  process.env.PAYU_MERCHANT_KEY = 'testKey'
  process.env.PAYU_MERCHANT_SALT = 'testSalt'
  try {
    const checkout = createPayUTestCheckout({ origin: 'http://localhost:3000', email: 'ada@example.com', displayName: 'Ada Lovelace' })
    assert.equal(checkout.action, 'https://test.payu.in/_payment')
    assert.equal(checkout.method, 'POST')
    assert.equal(checkout.fields.phone, '9999999999')
    assert.equal(checkout.fields.surl, 'http://localhost:3000/api/billing/callback?result=success')
    assert.equal('si' in checkout.fields, false)
    assert.equal('si_details' in checkout.fields, false)
  } finally {
    if (originalKey === undefined) delete process.env.PAYU_MERCHANT_KEY
    else process.env.PAYU_MERCHANT_KEY = originalKey
    if (originalSalt === undefined) delete process.env.PAYU_MERCHANT_SALT
    else process.env.PAYU_MERCHANT_SALT = originalSalt
  }
})
