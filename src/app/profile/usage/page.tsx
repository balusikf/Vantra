import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { usageAccount } from '@/lib/usage-server'
import UsagePanel from '@/components/vantra/UsagePanel'
import { readLiveCapacity } from '@/lib/usage-capacity-server'

export const metadata: Metadata = { title: 'Supabase usage', robots: { index: false, follow: false } }
export default async function UsagePage() {
  const { supabase, user, allowed } = await usageAccount()
  if (!allowed || !user) notFound()
  let capacity = null
  try { capacity = await readLiveCapacity(supabase, user.id) } catch { /* The panel offers a retry without hiding the page. */ }
  return <UsagePanel initialCapacity={capacity} />
}
