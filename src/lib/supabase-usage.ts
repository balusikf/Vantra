export const monthlyMetrics = [
  { key: 'egressGb', label: 'Egress', limit: 5, unit: 'GB', note: 'Uncached outgoing traffic' },
  { key: 'cachedEgressGb', label: 'Cached egress', limit: 5, unit: 'GB', note: 'Separate allowance for cache hits' },
  { key: 'activeUsers', label: 'Active users', limit: 50_000, unit: 'users', note: 'Distinct users in this billing cycle' },
  { key: 'thirdPartyUsers', label: 'Third-party active users', limit: 50_000, unit: 'users', note: 'Users of external Auth systems, such as Clerk' },
  { key: 'edgeInvocations', label: 'Edge function invocations', limit: 500_000, unit: 'calls', note: 'All invocation responses count' },
  { key: 'realtimeMessages', label: 'Realtime messages', limit: 2_000_000, unit: 'messages', note: 'Broadcast, presence and database changes' },
  { key: 'realtimePeak', label: 'Realtime peak connections', limit: 200, unit: 'connections', note: 'Maximum concurrent connections in the cycle' },
] as const
export const logMetrics = [
  { key: 'logIngestGb', label: 'Log ingestion', limit: 1, unit: 'GB', note: 'Upcoming · grace period until the start of 2027' },
  { key: 'logQueryGb', label: 'Log query', limit: 100, unit: 'GB', note: 'Upcoming · enforcement starts at the start of 2027' },
] as const
export type MetricKey = (typeof monthlyMetrics)[number]['key'] | (typeof logMetrics)[number]['key']
export type UsageSnapshot = {
  periodStart: string | null
  periodEnd: string | null
  observedAt: string | null
  monthly: Partial<Record<MetricKey, number | null>>
  capacity: { databaseGb: number | null; storageBytes: number | null; observedAt: string | null }
}
export function isUsageOwner(userId: string | null | undefined, configuredOwner: string | undefined) {
  return !!configuredOwner && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(configuredOwner) && userId === configuredOwner
}
export function quotaState(value: number | null | undefined, limit: number) {
  if (value == null || !Number.isFinite(value) || value < 0 || !Number.isFinite(limit) || limit <= 0) return null
  const percent = value / limit * 100
  return { percent, barPercent: Math.min(percent, 100), remaining: Math.max(0, limit - value), status: percent >= 100 ? 'limit' : percent >= 80 ? 'warning' : 'healthy' } as const
}
export function parseUsageSnapshot(input: unknown, now = Date.now()): UsageSnapshot {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid usage snapshot.')
  const v = input as Record<string, unknown>
  const date = (value: unknown, dateOnly = false): string | null => {
    if (value == null || value === '') return null
    if (typeof value !== 'string' || (dateOnly && !/^\d{4}-\d{2}-\d{2}$/.test(value)) || !Number.isFinite(Date.parse(value))) throw new Error('Enter valid dates.')
    if (dateOnly && new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Enter valid dates.')
    return value
  }
  const amount = (value: unknown, integer = false): number | null => {
    if (value == null || value === '') return null
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || (integer && !Number.isSafeInteger(value))) throw new Error('Usage must be a non-negative number; counts must be whole numbers.')
    return value
  }
  const periodStart = date(v.periodStart, true), periodEnd = date(v.periodEnd, true), observedAt = date(v.observedAt)
  if (!!periodStart !== !!periodEnd || (periodStart && periodEnd && Date.parse(periodEnd) <= Date.parse(periodStart))) throw new Error('The cycle end must be after its start.')
  if (observedAt && Date.parse(observedAt) > now + 300_000) throw new Error('The observation time cannot be in the future.')
  if (!v.monthly || typeof v.monthly !== 'object' || Array.isArray(v.monthly)) throw new Error('Invalid monthly usage.')
  const monthly: UsageSnapshot['monthly'] = {}
  for (const metric of [...monthlyMetrics, ...logMetrics]) monthly[metric.key] = amount((v.monthly as Record<string, unknown>)[metric.key], metric.unit !== 'GB')
  if (Object.values(monthly).some(x => x != null) && (!periodStart || !periodEnd || !observedAt)) throw new Error('Monthly readings need a billing cycle and observation time.')
  if (observedAt && periodStart && periodEnd && (Date.parse(observedAt) < Date.parse(periodStart) || Date.parse(observedAt) >= Date.parse(periodEnd) + 86_400_000)) throw new Error('The reading must belong to the selected billing cycle.')
  if (!v.capacity || typeof v.capacity !== 'object' || Array.isArray(v.capacity)) throw new Error('Invalid capacity reading.')
  const c = v.capacity as Record<string, unknown>
  const capacity = { databaseGb: amount(c.databaseGb), storageBytes: amount(c.storageBytes, true), observedAt: date(c.observedAt) }
  if ((capacity.databaseGb != null || capacity.storageBytes != null) && !capacity.observedAt) throw new Error('Capacity readings need an observation time.')
  if (capacity.observedAt && Date.parse(capacity.observedAt) > now + 300_000) throw new Error('The observation time cannot be in the future.')
  return { periodStart, periodEnd, observedAt, monthly, capacity }
}
export function snapshotAge(observedAt: string | null, periodEnd: string | null, now = Date.now()) {
  if (!observedAt) return 'missing'
  if (periodEnd && now >= Date.parse(periodEnd)) return 'previous-cycle'
  return now - Date.parse(observedAt) > 86_400_000 ? 'stale' : 'recent'
}
