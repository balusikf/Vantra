'use client'

import { createContext, useCallback, useContext, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { useAccount } from '@/components/vantra/AccountProvider'
import { nookAllowed } from '@/lib/nook-selection'
import { bareNook, type NookAccessories } from '@/lib/nook-cosmetics'
import { getNookAppearance, nookAppearanceKey, setNookAppearance, subscribeNookAppearance } from '@/lib/nook-appearance-store'

const NookPanel = dynamic(() => import('./NookPanel'), { ssr: false })
type NookContext = { open: boolean; show: (trigger?: HTMLElement) => void; close: () => void; accessories: NookAccessories; dress: (update: (previous: NookAccessories) => NookAccessories) => void }
const Context = createContext<NookContext | null>(null)

export default function NookProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { user } = useAccount()
  const appearanceKey = nookAppearanceKey(user?.id || null)
  const readAppearance = useCallback(() => getNookAppearance(appearanceKey), [appearanceKey])
  const accessories = useSyncExternalStore(subscribeNookAppearance, readAppearance, () => bareNook)
  const dress = useCallback((update: (previous: NookAccessories) => NookAccessories) => setNookAppearance(appearanceKey, update), [appearanceKey])
  const [opened, setOpened] = useState<string | null>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const location = `${user?.id || 'guest'}:${pathname}`
  const allowed = nookAllowed(pathname)
  const open = allowed && opened === location
  const show = useCallback((element?: HTMLElement) => { trigger.current = element || null; setOpened(location) }, [location])
  const close = useCallback(() => setOpened(null), [])
  const returnFocus = useCallback(() => { if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }) }, [])
  return <Context.Provider value={{ open, show, close, accessories, dress }}>{children}
    {/* Unmount immediately on /watch, including any outgoing exit animation. */}
    {allowed && <AnimatePresence key={location}>{open && <NookPanel key={location} userId={user?.id || null} onClose={close} returnFocus={returnFocus} />}</AnimatePresence>}
  </Context.Provider>
}

export function useNook() {
  const context = useContext(Context)
  if (!context) throw new Error('NookProvider is missing')
  return context
}
