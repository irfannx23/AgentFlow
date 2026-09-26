import { NextResponse } from 'next/server'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const origin = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '')
  const result = new URL(request.url).searchParams.get('result') === 'success' ? 'success' : 'failure'
  return NextResponse.redirect(`${origin}/billing/test-complete?result=${result}`, 303)
}
