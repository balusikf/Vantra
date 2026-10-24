import { usageAccount } from '@/lib/usage-server'
import { readLiveCapacity } from '@/lib/usage-capacity-server'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
export async function GET() {
  const { supabase, user, allowed } = await usageAccount()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
  if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403, headers })
  try { return Response.json(await readLiveCapacity(supabase, user.id), { headers }) }
  catch { return Response.json({ error: 'Live capacity could not be refreshed. Your last successful reading has been kept.' }, { status: 503, headers }) }
}
