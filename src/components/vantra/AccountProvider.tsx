'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/types/media'

type Account = { user: User | null; profile: Profile | null; loading: boolean; error: string | null; refresh: () => Promise<void>; updateProfile: (profile: Pick<Profile, 'id'> & Partial<Profile>) => void }
const Context = createContext<Account | null>(null)

export default function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const identity = useRef<string | null>(null)
  const generation = useRef(0)
  const activeRead = useRef<{ generation: number; promise: Promise<void> } | null>(null)
  const invalidate = useCallback(() => { generation.current++ }, [])
  const refresh = useCallback(async () => {
    if (activeRead.current?.generation === generation.current) return activeRead.current.promise
    const current = ++generation.current
    const request = (async () => {
    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.getUser()
      if (current !== generation.current) return
      if (authError) {
        if (authError.status === 401 || authError.status === 403) { identity.current = null; setUser(null); setProfile(null) }
        throw authError
      }
      const nextUser = data.user
      if (identity.current !== nextUser?.id) setProfile(null)
      identity.current = nextUser?.id || null
      setUser(nextUser)
      if (!nextUser) { setProfile(null); setError(null); return }
      const result = await supabase.from('profiles').select('id, display_name, avatar_url').eq('id', nextUser.id).single()
      if (current !== generation.current) return
      if (result.error) throw result.error
      setProfile(result.data); setError(null)
    } catch { if (current === generation.current) setError('Your profile could not be loaded. Please try again.') }
    finally { if (current === generation.current) setLoading(false) }
    })()
    activeRead.current = { generation:current, promise:request }
    try { await request } finally { if (activeRead.current?.promise === request) activeRead.current = null }
  }, [])

  useEffect(() => {
    let mounted = true
    void Promise.resolve().then(() => { if (mounted) void refresh() })
    let timer: ReturnType<typeof setTimeout> | undefined
    const { data } = createClient().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        generation.current++; identity.current = null; setUser(null); setProfile(null); setError(null); setLoading(false)
      } else if ((event === 'SIGNED_IN' && session?.user.id !== identity.current) || event === 'USER_UPDATED') {
        if (identity.current && session?.user.id !== identity.current) {
          generation.current++; identity.current = null; setUser(null); setProfile(null); setLoading(true)
        }
        clearTimeout(timer); timer = setTimeout(() => { void refresh() }, 0)
      }
    })
    return () => { mounted = false; invalidate(); clearTimeout(timer); data.subscription.unsubscribe() }
  }, [refresh, invalidate])
  return <Context.Provider value={{ user, profile, loading, error, refresh, updateProfile: next => { if (next.id === identity.current) setProfile(previous => previous ? { ...previous, ...next } : previous) } }}>{children}</Context.Provider>
}

export function useAccount() {
  const account = useContext(Context)
  if (!account) throw new Error('AccountProvider is missing')
  return account
}
