import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createTokenBucket } from '@/lib/api-policy'
import { apiJson } from '@/lib/media-api'
import { parseContinueCandidates } from '@/lib/continue-watching'
import { boundedContinue } from '@/lib/continue-server'

const quota = createTokenBucket(12, 60_000)
export async function GET(request: Request) {
  if (new URL(request.url).search) return apiJson({ error: 'Invalid continuation request.' }, 400)
  const client = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) return apiJson({ error: 'Sign in to see your recent stories.' }, 401)
  const retry = quota(user.id)
  if (retry) return apiJson({ error: 'Please wait before refreshing your stories again.' }, 429, retry)
  try {
    const { data, error } = await client.rpc('continue_watching_candidates').abortSignal(request.signal)
    if (error) throw error
    const cards = await boundedContinue(parseContinueCandidates(data), request.signal)
    return apiJson({ cards, checked_at: new Date().toISOString() })
  } catch { return apiJson({ error: 'Your recent stories could not be loaded. Please try again.' }, 503) }
}
