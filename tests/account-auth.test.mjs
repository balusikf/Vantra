import test from 'node:test'
import assert from 'node:assert/strict'
import { getVerifiedAccount } from '../src/lib/account-auth.ts'

const client = (user, error = null) => ({ auth: { getUser: async () => ({ data: { user }, error }) } })

test('account API distinguishes a verified user from missing or rejected sessions', async () => {
  const verified = client({ id: 'verified-owner' })
  const result = await getVerifiedAccount(async () => verified)
  assert.equal(result.status, 200); assert.equal(result.client, verified); assert.equal(result.user.id, 'verified-owner')
  for (const failed of [client(null), client(null, { status: 400 }), client({ id: 'stale-owner' }, { status: 401 }), client(null, { status: 403 })]) {
    const result = await getVerifiedAccount(async () => failed)
    assert.equal(result.status, 401); assert.equal(result.user, null); assert.equal(result.client, null)
  }
})

test('auth outages and thrown failures return a retryable 503 without leaking diagnostics or stale identity', async () => {
  const cases = [
    async () => client({ id: 'stale-owner' }, { status: 503, message: 'private upstream diagnostic' }),
    async () => client(null, { status: 0 }),
    async () => client(null, Error('private upstream diagnostic')),
    async () => { throw Error('private environment diagnostic') },
    async () => ({ auth: { getUser: async () => { throw Error('private transport diagnostic') } } }),
  ]
  for (const create of cases) {
    const result = await getVerifiedAccount(create)
    assert.equal(result.status, 503); assert.equal(result.retryAfter, 15)
    assert.equal(result.user, null); assert.equal(result.client, null)
    assert.ok(!JSON.stringify(result).includes('private'))
  }
})
