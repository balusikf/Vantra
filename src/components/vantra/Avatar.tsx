'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useAccount } from './AccountProvider'
import { safeAvatarUrl } from '@/lib/avatar'
import s from './vantra.module.css'

export default function Avatar({ large = false }: { large?: boolean }) {
  const { user, profile, loading } = useAccount()
  const [failed, setFailed] = useState<string | null>(null)
  const source = safeAvatarUrl(profile?.avatar_url, user?.id, process.env.NEXT_PUBLIC_SUPABASE_URL)
  const name = profile?.display_name || user?.email?.split('@')[0] || 'Vantra'
  return <span className={`${s.avatarPicture} ${large ? s.avatarLarge : ''}`} aria-busy={loading}>
    {source && failed !== source ? <Image src={source} alt="Your profile photo" fill sizes={large ? '112px' : '34px'} className={s.avatarImage} unoptimized referrerPolicy="no-referrer" onError={() => setFailed(source)} /> : <span aria-label={name}>{loading ? '' : name.slice(0, 2).toUpperCase()}</span>}
  </span>
}
