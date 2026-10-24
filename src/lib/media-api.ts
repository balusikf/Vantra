import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createTokenBucket } from '@/lib/api-policy'
import { CatalogUnavailableError } from '@/lib/upstream-policy'

const consume = createTokenBucket()
export function apiJson(data: unknown, status = 200, retryAfter?: number) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) } })
}
export async function authorizeMediaApi() {
  try {
    const client = await createServerSupabaseClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error && (!error.status || error.status >= 500)) return apiJson({ error: 'Sign-in service is temporarily unavailable. Try again shortly.' }, 503, 15)
    if (error || !user) return apiJson({ error: 'Unauthorized' }, 401)
    const retry = consume(user.id)
    return retry ? apiJson({ error: 'Too many requests. Please wait a moment before trying again.' }, 429, retry) : null
  } catch { return apiJson({ error: 'Sign-in service is temporarily unavailable. Try again shortly.' }, 503, 15) }
}
export function catalogError(error: unknown) {
  if (error instanceof CatalogUnavailableError) return apiJson({ error: error.message }, 503, error.retryAfter)
  return apiJson({ error: 'The catalog could not be loaded. Please try again shortly.' }, 502)
}
