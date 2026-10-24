import type { Metadata } from 'next'
import Profile from '@/components/vantra/Profile'
import { usageAccount } from '@/lib/usage-server'

export const metadata: Metadata = { title: 'Profile' }
export default async function ProfilePage() {
  const { allowed } = await usageAccount()
  return <Profile canViewUsage={allowed} />
}
