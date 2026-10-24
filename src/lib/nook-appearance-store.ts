import { bareNook, encodeNookAccessories, parseNookAccessories, type NookAccessories } from './nook-cosmetics.ts'

const cache = new Map<string, NookAccessories>()
const listeners = new Set<() => void>()
const prefix = 'vantra:nook-style:v1:'

export function nookAppearanceKey(userId: string | null) { return `${prefix}${userId || 'guest'}` }

export function getNookAppearance(key: string): NookAccessories {
  if (typeof window === 'undefined') return bareNook
  const cached = cache.get(key)
  if (cached) return cached
  let value = bareNook
  try { value = parseNookAccessories(window.localStorage.getItem(key)) } catch { /* Storage can be disabled. Keep a working in-memory wardrobe. */ }
  cache.set(key, value)
  return value
}

function storageChanged(event: StorageEvent) {
  if (event.key !== null && !event.key.startsWith(prefix)) return
  if (event.key === null) cache.clear()
  else cache.delete(event.key)
  listeners.forEach(listener => listener())
}

export function subscribeNookAppearance(listener: () => void) {
  if (!listeners.size) window.addEventListener('storage', storageChanged)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) window.removeEventListener('storage', storageChanged)
  }
}

export function setNookAppearance(key: string, update: (previous: NookAccessories) => NookAccessories) {
  const next = parseNookAccessories(encodeNookAccessories(update(getNookAppearance(key))))
  cache.set(key, next)
  try { window.localStorage.setItem(key, encodeNookAccessories(next)) } catch { /* The current visit still keeps its selection. */ }
  listeners.forEach(listener => listener())
}
