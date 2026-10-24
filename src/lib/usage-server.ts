import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isUsageOwner } from '@/lib/supabase-usage'

export async function usageAccount() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user, allowed: !error && isUsageOwner(user?.id, process.env.VANTRA_OWNER_USER_ID) }
}
