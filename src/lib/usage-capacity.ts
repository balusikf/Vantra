export type LiveCapacity = { databaseBytes: number | null; storageBytes: number | null; observedAt: string }

export function parseLiveCapacity(input: unknown, now = Date.now()): LiveCapacity {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid capacity reading.')
  const value = input as Record<string, unknown>
  const bytes = (v: unknown) => {
    if (v === null) return null
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new Error('Invalid capacity size.')
    return v
  }
  if (typeof value.observedAt !== 'string' || !Number.isFinite(Date.parse(value.observedAt)) || Date.parse(value.observedAt) > now + 300_000) throw new Error('Invalid capacity timestamp.')
  return { databaseBytes: bytes(value.databaseBytes), storageBytes: bytes(value.storageBytes), observedAt: value.observedAt }
}

// Each server process coalesces concurrent refreshes; failures are never cached.
export function createCapacityReader<T>(ttl = 60_000, clock = Date.now) {
  let cached: { value: T; expires: number } | undefined
  let pending: Promise<T> | undefined
  return async (load: () => Promise<T>): Promise<T> => {
    if (cached && clock() < cached.expires) return cached.value
    if (pending) return pending
    pending = load().then(value => { cached = { value, expires: clock() + ttl }; return value }).finally(() => { pending = undefined })
    return pending
  }
}
