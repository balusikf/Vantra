import test from 'node:test'
import assert from 'node:assert/strict'
import { isUsageOwner, quotaState, parseUsageSnapshot, snapshotAge } from '../src/lib/supabase-usage.ts'

const owner = '11111111-1111-4111-8111-111111111111'
const now = Date.parse('2026-10-22T15:00:00Z')
const sample = () => ({ periodStart: '2026-09-25', periodEnd: '2026-10-25', observedAt: '2026-10-22T14:00:00Z', monthly: { activeUsers: 1, egressGb: .006 }, capacity: { databaseGb: .027, storageBytes: 107321, observedAt: '2026-10-22T14:00:00Z' } })

test('usage access fails closed and only matches the configured immutable user ID', () => {
  assert.equal(isUsageOwner(owner, undefined), false)
  assert.equal(isUsageOwner(null, owner), false)
  assert.equal(isUsageOwner('another-user', owner), false)
  assert.equal(isUsageOwner('admin', 'admin'), false)
  assert.equal(isUsageOwner(owner, owner), true)
})
test('unknown usage stays unknown while actual zero is a valid reading', () => {
  assert.equal(quotaState(undefined, 5), null)
  assert.equal(quotaState(null, 5), null)
  assert.equal(quotaState(NaN, 5), null)
  assert.equal(quotaState(-1, 5), null)
  assert.equal(quotaState(0, 5).remaining, 5)
  const data = parseUsageSnapshot(sample(), now)
  assert.equal(data.monthly.cachedEgressGb, null)
  assert.equal(data.monthly.activeUsers, 1)
})
test('thresholds and exceeded quotas retain the true percentage without overflowing the progress bar', () => {
  assert.equal(quotaState(4, 5).status, 'warning')
  assert.deepEqual(quotaState(6, 5), { percent: 120, barPercent: 100, remaining: 0, status: 'limit' })
})
test('monthly readings require real cycle dates and timestamps; unknown cycles cannot imply a reset', () => {
  for (const change of [{ periodStart: null }, { periodEnd: '2026-09-25' }, { observedAt: null }, { observedAt: '2026-11-01' }, { periodStart: '2026-02-30' }]) assert.throws(() => parseUsageSnapshot({ ...sample(), ...change }, now))
  assert.equal(snapshotAge(null, null, now), 'missing')
  assert.equal(snapshotAge('2026-10-22T14:00:00Z', '2026-10-25', now), 'recent')
  assert.equal(snapshotAge('2026-10-20T14:00:00Z', '2026-10-25', now), 'stale')
  assert.equal(snapshotAge('2026-10-22T14:00:00Z', '2026-10-25', Date.parse('2026-10-26')), 'previous-cycle')
})
test('negative, non-finite and fractional counts are rejected, but fractional GB is accepted', () => {
  for (const n of [-1, Infinity, NaN, 1.5, '10']) assert.throws(() => parseUsageSnapshot({ ...sample(), monthly: { activeUsers: n } }, now))
  assert.equal(parseUsageSnapshot(sample(), now).monthly.egressGb, .006)
  assert.throws(() => parseUsageSnapshot({ ...sample(), capacity: { databaseGb: .02, storageBytes: .5, observedAt: '2026-10-22T14:00:00Z' } }, now))
})
test('capacity retains its own measurement time and is not reset or relabelled by the monthly cycle', () => {
  const data = sample(); data.capacity.observedAt = '2026-10-20T12:00:00Z'
  assert.equal(parseUsageSnapshot(data, now).capacity.observedAt, '2026-10-20T12:00:00Z')
  assert.throws(() => parseUsageSnapshot({ ...data, capacity: { ...data.capacity, observedAt: null } }, now))
})
