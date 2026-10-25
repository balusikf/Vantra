import { apiJson, mediaApiAccount } from '@/lib/media-api'
import { createTokenBucket } from '@/lib/api-policy'
import { parsePersonalStats, statsTimezone } from '@/lib/personal-stats'

const quota = createTokenBucket(12, 60_000)
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  let timezone: string
  try {
    if ([...params.keys()].some(key => key !== 'timezone') || params.getAll('timezone').length > 1) throw new Error('Invalid parameters.')
    timezone = statsTimezone(params.get('timezone'))
  } catch { return Response.json({ error: 'Invalid statistics request.' }, { status: 400, headers }) }
  const account = await mediaApiAccount()
  if (account.status !== 200) return apiJson({ error: account.error }, account.status, account.retryAfter)
  const { client: supabase, user } = account
  const retry = quota(user.id)
  if (retry) return Response.json({ error: 'Please wait a moment before refreshing again.' }, { status: 429, headers: { ...headers, 'Retry-After': String(retry) } })
  try {
    const { data, error } = await supabase.rpc('personal_library_stats', { report_timezone: timezone }).abortSignal(request.signal)
    if (error) throw error
    return Response.json(parsePersonalStats(data), { headers })
  } catch { return Response.json({ error: 'Your statistics could not be loaded. Please try again.' }, { status: 503, headers }) }
}
