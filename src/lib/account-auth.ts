import type { SupabaseClient } from '@supabase/supabase-js'

// Keep an unavailable auth service distinct from an expired or missing session.
export async function getVerifiedAccount(create: () => Promise<SupabaseClient>) {
  const unavailable = () => ({ client: null, user: null, status: 503, error: 'Sign-in service is temporarily unavailable. Try again shortly.', retryAfter: 15 } as const)
  try {
    const client = await create()
    const { data: { user }, error } = await client.auth.getUser()
    if (error && (!error.status || error.status >= 500)) return unavailable()
    if (error || !user) return { client: null, user: null, status: 401, error: 'Unauthorized', retryAfter: undefined } as const
    return { client, user, status: 200, error: null, retryAfter: undefined } as const
  } catch { return unavailable() }
}
