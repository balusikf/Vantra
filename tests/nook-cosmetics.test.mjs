import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { bareNook, encodeNookAccessories, parseNookAccessories, nookAccessoryOpacity, nookBodyAccessories, transformNookPoint } from '../src/lib/nook-cosmetics.ts'
import { getNookAppearance, nookAppearanceKey, setNookAppearance, subscribeNookAppearance } from '../src/lib/nook-appearance-store.ts'

// Vendored runtime uses bundler-style relative imports. Resolve those to their
// real TS files so tests exercise the production engine, without a copied model.
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.includes('/vendor/bloub/') && specifier.startsWith('./') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context)
  return next(specifier, context)
} })
const { BotEngine } = await import('../src/vendor/bloub/engine.ts')
const { SHAPES } = await import('../src/vendor/bloub/skins.ts')
const { EXPRESSIONS } = await import('../src/vendor/bloub/expressions.ts')
const { STATES } = await import('../src/vendor/bloub/states.ts')
hooks.deregister()

test('wardrobe accepts only versioned boolean choices and discards corrupt or unknown data', () => {
  for (const raw of [null, '', '{', 'null', '[]', '{"version":2,"items":{"beanie":true}}']) assert.deepEqual(parseNookAccessories(raw), bareNook)
  assert.deepEqual(parseNookAccessories('{"version":1,"items":{"beanie":"true","glasses":true,"bow":1,"image":"https://invalid"}}'), { beanie: false, glasses: true, bow: false })
  const all = { beanie: true, glasses: true, bow: true }
  assert.deepEqual(parseNookAccessories(encodeNookAccessories(all)), all)
  assert.ok(Object.isFrozen(parseNookAccessories(encodeNookAccessories(all))))
})

test('style storage isolates owners, survives reread and notifies mounted copies and other tabs', () => {
  const data = new Map(), events = new Map()
  const original = globalThis.window
  globalThis.window = { localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }, addEventListener: (name, listener) => events.set(name, listener), removeEventListener: name => events.delete(name) }
  const a = nookAppearanceKey('test-owner-a'), b = nookAppearanceKey('test-owner-b')
  let notices = 0
  const unsubscribe = subscribeNookAppearance(() => notices++)
  try {
    assert.equal(getNookAppearance(a), getNookAppearance(a), 'snapshot is referentially stable')
    setNookAppearance(a, previous => ({ ...previous, beanie: true }))
    assert.equal(getNookAppearance(a).beanie, true)
    assert.deepEqual(getNookAppearance(b), bareNook)
    assert.equal(parseNookAccessories(data.get(a)).beanie, true)
    data.set(a, encodeNookAccessories({ ...bareNook, glasses: true }))
    events.get('storage')({ key: a })
    assert.equal(getNookAppearance(a).glasses, true)
    assert.equal(getNookAppearance(a).beanie, false)
    assert.equal(notices, 2)
    globalThis.window.localStorage.setItem = () => { throw new Error('disabled storage') }
    setNookAppearance(a, () => ({ ...bareNook, bow: true }))
    assert.equal(getNookAppearance(a).bow, true, 'disabled storage still works for this visit')
  } finally { unsubscribe(); globalThis.window = original }
  assert.equal(events.size, 0)
})

test('all engine states and eight silhouettes produce finite, attached and bounded accessory anchors', () => {
  for (const shape of SHAPES) for (const state of STATES) {
    const engine = new BotEngine(100, state.id, shape.radii, EXPRESSIONS[0])
    for (const t of [0, .1, .25, .55, 1, 1.8, 2.3, state.duration]) {
      const frame = engine.sample(t), fit = nookBodyAccessories(frame)
      for (const value of [...fit.matrix, fit.left.x, fit.left.y, fit.right.x, fit.right.y, fit.crown, fit.band, fit.bowY]) assert.ok(Number.isFinite(value) && Math.abs(value) < 500, `${shape.id}/${state.id}/${t}`)
      const alpha = nookAccessoryOpacity(frame, state.id)
      assert.ok(alpha >= 0 && alpha <= 1)
      if (['thinking', 'alert', 'exclaim', 'sleep', 'burst', 'comet'].includes(state.id)) assert.equal(alpha, 0, `${state.id} must never leave floating accessories`)
      for (const anchor of frame.attachments.eyes) {
        const eye = frame.eyes[frame.attachments.eyes.indexOf(anchor)]
        const values = eye.matrix.match(/-?\d+(?:\.\d+)?/g).map(Number)
        assert.ok(Math.abs(anchor.matrix[4] - values[4]) <= .006)
        assert.ok(Math.abs(anchor.matrix[5] - values[5]) <= .006)
      }
    }
  }
})

test('glasses track the real gaze for every expression and never inherit blink compression', () => {
  for (const expression of EXPRESSIONS) {
    const engine = new BotEngine(100, 'idle', SHAPES[0].radii, expression)
    engine.setLook({ yaw: -36, pitch: 25, mix: 1, spin: 0, wander: 0 }, 0)
    const left = engine.sample(1).attachments.eyes[0].matrix
    engine.setLook({ yaw: 36, pitch: -25, mix: 1, spin: 0, wander: 0 }, 1)
    const right = engine.sample(2).attachments.eyes[0].matrix
    assert.ok(right[4] - left[4] > 70, expression.id)
    assert.ok(right[5] - left[5] > 60, expression.id)
  }
  const engine = new BotEngine(100, 'idle', SHAPES[0].radii, EXPRESSIONS[0])
  engine.setState('wink', 0)
  const frame = engine.sample(.1)
  const anchor = frame.attachments.eyes[0].matrix
  const eye = frame.eyes[0].matrix.match(/-?\d+(?:\.\d+)?/g).map(Number)
  const determinant = m => Math.abs(m[0] * m[3] - m[1] * m[2])
  assert.ok(determinant(anchor) > determinant(eye) * 5)
  assert.ok(nookAccessoryOpacity(frame, 'wink') > .99, 'blinking is not disappearing')
})

test('body accessories follow interrupted morphs continuously and vanish when the face turns away', () => {
  const engine = new BotEngine(100, 'idle', SHAPES[0].radii, EXPRESSIONS[0])
  engine.setShape(SHAPES.find(shape => shape.id === 'triangle').radii, 0)
  engine.setShape(SHAPES.find(shape => shape.id === 'nuage').radii, .13)
  let previous = null
  for (let t = .13; t < 1; t += .02) {
    const frame = engine.sample(t), fit = nookBodyAccessories(frame)
    const position = transformNookPoint(fit.matrix, fit.middle, fit.crown)
    if (previous) assert.ok(Math.hypot(position.x - previous.x, position.y - previous.y) < 26)
    previous = position
  }
  engine.setLook({ yaw: 180, pitch: 0, mix: 1, spin: 0, wander: 0 }, 1)
  assert.equal(nookAccessoryOpacity(engine.sample(2), 'idle'), 0)
  const noBody = engine.sample(3)
  noBody.bodyAlpha = 0
  assert.equal(nookAccessoryOpacity(noBody, 'idle'), 0)
})
