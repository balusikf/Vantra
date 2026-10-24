import assert from 'node:assert/strict'
import test from 'node:test'
import nextConfig from '../next.config.ts'
import { PLAYER_IFRAME_ALLOW } from '../src/lib/player-permissions.ts'

async function siteHeaders() {
  const rules = await nextConfig.headers()
  const allPages = rules.find(rule => rule.source === '/:path*')
  assert.ok(allPages, 'security restrictions must cover nested watch routes and API paths')
  return new Map(allPages.headers.map(header => [header.key.toLowerCase(), header.value]))
}

test('sensitive browser APIs stay denied without disabling video capabilities', async () => {
  const headers = await siteHeaders()
  const permissions = new Map(headers.get('permissions-policy').split(',').map(entry => entry.trim().split('=')))
  for (const feature of ['camera', 'microphone', 'geolocation', 'clipboard-read', 'clipboard-write', 'display-capture', 'payment', 'usb', 'serial', 'hid', 'bluetooth', 'midi', 'web-share']) {
    assert.equal(permissions.get(feature), '()', `${feature} must not be available to players`)
  }
  for (const feature of ['autoplay', 'encrypted-media', 'fullscreen', 'picture-in-picture']) {
    assert.notEqual(permissions.get(feature), '()', `${feature} must remain available for playback`)
  }
})

test('site framing, injected base URLs and off-site forms are restricted', async () => {
  const headers = await siteHeaders()
  const policy = headers.get('content-security-policy').split(';').map(directive => directive.trim())
  assert.ok(policy.includes("frame-ancestors 'self'"))
  assert.ok(policy.includes("base-uri 'self'"))
  assert.ok(policy.includes("object-src 'none'"))
  assert.ok(policy.includes("form-action 'self'"))
  assert.equal(headers.get('x-frame-options'), 'SAMEORIGIN')
})

test('responses prevent MIME sniffing and restrict cross-origin referrers', async () => {
  const headers = await siteHeaders()
  assert.equal(headers.get('x-content-type-options'), 'nosniff')
  assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin')
})


test('iframe permissions deny the same sensitive features even without HTTP header support', async () => {
  const headers = await siteHeaders()
  const blockedFeatures = headers.get('permissions-policy').split(',').map(entry => entry.trim().split('=')[0])
  const framePolicy = PLAYER_IFRAME_ALLOW.split(';').map(entry => entry.trim())
  for (const feature of blockedFeatures) {
    assert.ok(framePolicy.includes(`${feature} 'none'`), `${feature} must also be denied on the iframe`)
  }
  for (const feature of ['autoplay', 'encrypted-media', 'fullscreen', 'picture-in-picture']) {
    assert.ok(framePolicy.includes(feature), `${feature} must remain available on the iframe`)
  }
})
