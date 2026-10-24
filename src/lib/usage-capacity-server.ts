import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isUsageOwner } from '@/lib/supabase-usage'
import { createCapacityReader, parseLiveCapacity, type LiveCapacity } from '@/lib/usage-capacity'

const cachedRead = createCapacityReader<LiveCapacity>()
export async function readLiveCapacity(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  // Authenticate on every request, before consulting the process-local cache.
  if (!isUsageOwner(userId, process.env.VANTRA_OWNER_USER_ID)) throw new Error('Forbidden')
  return cachedRead(async () => {
    const { data, error } = await supabase.rpc('owner_project_capacity').abortSignal(AbortSignal.timeout(8_000))
    if (error) throw new Error('Live capacity is temporarily unavailable.')
    return parseLiveCapacity(data)
  })
}
