import test from 'node:test'
import assert from 'node:assert/strict'
import { ownedAvatarPath, persistAvatar, safeAvatarUrl, validateAvatar } from '../src/lib/avatar.ts'

test('avatar display only requests this account raster images from the configured project', () => {
  const project = 'https://example.supabase.co'
  const avatar = `${project}/storage/v1/object/public/avatars/user-id/avatar.webp`
  assert.equal(safeAvatarUrl(avatar, 'user-id', project), avatar)
  assert.equal(safeAvatarUrl(`${project}/storage/v1/object/public/avatars/user-id.png?t=1`, 'user-id', project), `${project}/storage/v1/object/public/avatars/user-id.png?t=1`)
  for (const url of [avatar.replace('example.supabase.co', 'tracker.example'), avatar.replace('user-id/', 'other-user/'), avatar.replace('.webp', '.svg'), avatar.replace('https:', 'http:'), avatar.replace('https://', 'https://user:password@'), avatar.replace('avatar.webp', '%2e%2e/private.webp'), 'data:image/png;base64,AAAA', 'javascript:alert(1)']) {
    assert.equal(safeAvatarUrl(url, 'user-id', project), null)
  }
  assert.equal(safeAvatarUrl(avatar, undefined, project), null)
  assert.equal(safeAvatarUrl(avatar, 'user-id', undefined), null)
})

test('avatar cleanup only targets this project and user, including legacy paths', () => {
  const project = 'https://example.supabase.co'
  const prefix = `${project}/storage/v1/object/public/avatars/`
  assert.equal(ownedAvatarPath(`${prefix}user-id/avatar.webp`, 'user-id', project), 'user-id/avatar.webp')
  assert.equal(ownedAvatarPath(`${prefix}user-id.png?t=1`, 'user-id', project), 'user-id.png')
  for (const url of [`${prefix}other-user/avatar.webp`, `${prefix}user-id2.png`, `${prefix}user-id/%2e%2e/other.png`, 'https://evil.example/storage/v1/object/public/avatars/user-id.png']) {
    assert.equal(ownedAvatarPath(url, 'user-id', project), null)
  }
})

test('avatar validation rejects oversized and non-raster files', () => {
  assert.throws(() => validateAvatar({ type: 'image/svg+xml', size: 200 }))
  assert.throws(() => validateAvatar({ type: 'image/png', size: 6 * 1024 * 1024 }))
  assert.doesNotThrow(() => validateAvatar({ type: 'image/png', size: 1000 }))
})

test('failed upload never deletes the current avatar', async () => {
  const calls = []
  await assert.rejects(persistAvatar({ previous: 'old', upload: async () => { throw new Error('upload failed') }, saveProfile: async () => calls.push('save'), remove: async path => calls.push(path) }))
  assert.deepEqual(calls, [])
})

test('uncertain profile save preserves both files instead of risking a broken saved URL', async () => {
  const calls = []
  await assert.rejects(persistAvatar({ previous: 'old', upload: async () => 'new', saveProfile: async () => { throw new Error('save failed') }, remove: async path => calls.push(path) }))
  assert.deepEqual(calls, [])
})

test('successful replacement saves before cleanup and tolerates cleanup failure', async () => {
  const calls = []
  const result = await persistAvatar({ previous: 'old', upload: async () => { calls.push('upload'); return 'new' }, saveProfile: async () => { calls.push('save') }, remove: async path => { calls.push(path); throw new Error('cleanup failed') } })
  assert.deepEqual(calls, ['upload', 'save', 'old'])
  assert.deepEqual(result, { uploaded: 'new', cleanupFailed: true })
})
