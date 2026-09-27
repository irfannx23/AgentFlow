import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/**
 * Creates a request-scoped server client. Pass the Firebase ID token from the
 * incoming request so Supabase can verify it and apply the caller's RLS rules.
 */
export function createServerSupabaseClient(firebaseIdToken: string | null = null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing required public Supabase environment variables')
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => firebaseIdToken,
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}
