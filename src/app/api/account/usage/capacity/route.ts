import { apiJson, mediaApiAccount } from '@/lib/media-api'
import { isUsageOwner } from '@/lib/supabase-usage'
import { readLiveCapacity } from '@/lib/usage-capacity-server'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
export async function GET() {
  const account = await mediaApiAccount()
  if (account.status !== 200) return apiJson({ error: account.error }, account.status, account.retryAfter)
  const { client: supabase, user } = account
  const allowed = isUsageOwner(user.id, process.env.VANTRA_OWNER_USER_ID)
  if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403, headers })
  try { return Response.json(await readLiveCapacity(supabase, user.id), { headers }) }
  catch { return Response.json({ error: 'Live capacity could not be refreshed. Your last successful reading has been kept.' }, { status: 503, headers }) }
}
