import { createBrowserClient } from '@supabase/ssr'

// Browser client is shared by the SDK; account authorization remains on the server/RLS.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
