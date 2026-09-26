import { createHash } from 'node:crypto'

export const PAYU_TEST_CHECKOUT_URL = 'https://test.payu.in/_payment'

export type PayUResponse = Record<string, string>

function sha512(value: string) {
  return createHash('sha512').update(value).digest('hex')
}

export function payuConfig() {
  const key = process.env.PAYU_MERCHANT_KEY?.trim()
  const salt = process.env.PAYU_MERCHANT_SALT?.trim()
  if (!key || !salt) throw new Error('PayU Test credentials are incomplete. Please configure your environment variables before testing checkout.')
  return { key, salt }
}

export function createCheckoutHash(fields: PayUResponse, salt: string) {
  const udf = [1, 2, 3, 4, 5].map(index => fields[`udf${index}`] ?? '')
  return sha512([
    fields.key,
    fields.txnid,
    fields.amount,
    fields.productinfo,
    fields.firstname,
    fields.email,
    ...udf,
    '', '', '', '', '',
    salt,
  ].join('|'))
}
