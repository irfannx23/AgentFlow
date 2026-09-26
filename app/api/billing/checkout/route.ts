import { NextResponse } from 'next/server'
import { authenticatedUserId } from '@/lib/connections/repository'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createPayUTestCheckout } from '@/lib/billing/checkout'

export const runtime = 'nodejs'

function tokenFor(request: Request) {
  const value = request.headers.get('authorization')
  return value?.startsWith('Bearer ') ? value.slice(7).trim() : null
}

export async function POST(request: Request) {
  const token = tokenFor(request)
  if (!token) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
  try {
    const client = createServerSupabaseClient(token)
    const ownerId = await authenticatedUserId(client)
    const profile = await client.from('profiles').select('email,display_name').eq('id', ownerId).single()
    if (profile.error || !profile.data.email) throw new Error('A verified billing email is required.')
    const body = await request.json() as { plan?: string }
    if (body.plan !== 'pro') return NextResponse.json({ error: 'This plan is not available for checkout.' }, { status: 400 })

    const origin = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '')
    return NextResponse.json(createPayUTestCheckout({ origin, email: profile.data.email, displayName: profile.data.display_name }))
  } catch (error) {
    console.error('Unable to start PayU checkout.', { type: error instanceof Error ? error.name : 'UnknownError' })
    const message = error instanceof Error && error.message.startsWith('PayU Test credentials are incomplete') ? error.message : 'Unable to start PayU Test checkout.'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
