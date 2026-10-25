import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createTokenBucket } from '@/lib/api-policy'
import { CatalogUnavailableError } from '@/lib/upstream-policy'
import { getVerifiedAccount } from '@/lib/account-auth'

const consume = createTokenBucket()
export function apiJson(data: unknown, status = 200, retryAfter?: number) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) } })
}
export async function authorizeMediaApi() {
  const account = await mediaApiAccount()
  if (account.status !== 200) return apiJson({ error: account.error }, account.status, account.retryAfter)
  const retry = consume(account.user.id)
  return retry ? apiJson({ error: 'Too many requests. Please wait a moment before trying again.' }, 429, retry) : null
}
export function mediaApiAccount() { return getVerifiedAccount(createServerSupabaseClient) }
export function catalogError(error: unknown) {
  if (error instanceof CatalogUnavailableError) return apiJson({ error: error.message }, 503, error.retryAfter)
  return apiJson({ error: 'The catalog could not be loaded. Please try again shortly.' }, 502)
}
