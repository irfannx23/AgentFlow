import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { entitlementsFor } from '@/lib/billing/types'

export async function serverEntitlements(client: SupabaseClient<Database>) {
  const projects = await client.from('projects').select('id', { count: 'exact', head: true })
  if (projects.error) throw projects.error
  return entitlementsFor('free', { projects: projects.count ?? 0 })
}
