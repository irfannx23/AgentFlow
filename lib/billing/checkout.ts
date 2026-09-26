import { randomBytes } from 'node:crypto'
import { createCheckoutHash, PAYU_TEST_CHECKOUT_URL, payuConfig } from '@/lib/billing/payu'

export type CheckoutRequest = {
  action: string
  method: 'POST'
  fields: Record<string, string>
}

export function createPayUTestCheckout(input: { origin: string; email: string; displayName: string | null }): CheckoutRequest {
  const { key, salt } = payuConfig()
  const amount = Number(process.env.PAYU_PRO_MONTHLY_AMOUNT || '999').toFixed(2)
  const fields: Record<string, string> = {
    key,
    txnid: `af${Date.now().toString(36)}${randomBytes(4).toString('hex')}`,
    amount,
    productinfo: 'AgentFlow Pro Test Checkout',
    firstname: input.displayName?.trim().split(/\s+/)[0] || 'AgentFlow User',
    email: input.email,
    phone: process.env.PAYU_TEST_CUSTOMER_PHONE?.trim() || '9999999999',
    surl: `${input.origin}/api/billing/callback?result=success`,
    furl: `${input.origin}/api/billing/callback?result=failure`,
    udf1: '', udf2: '', udf3: '', udf4: '', udf5: '',
  }
  fields.hash = createCheckoutHash(fields, salt)
  return { action: PAYU_TEST_CHECKOUT_URL, method: 'POST', fields }
}
