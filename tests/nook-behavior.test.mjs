import test from 'node:test'
import assert from 'node:assert/strict'
import { nookGaze, NookIdleClock, nookBreathing } from '../src/lib/nook-behavior.ts'

test('eyes follow pointers outside the avatar, with correct up/down direction and bounded angles', () => {
  const box = { left: 800, top: 300, width: 200, height: 200 }
  const leftTop = nookGaze({ x: 0, y: 0 }, box)
  const rightBottom = nookGaze({ x: 2000, y: 2000 }, box)
  assert.equal(leftTop.yaw, -36)
  assert.equal(leftTop.pitch, 25)
  assert.equal(rightBottom.yaw, 36)
  assert.equal(rightBottom.pitch, -25)
  const center = nookGaze({ x: 900, y: 400 }, box)
  assert.equal(center.yaw, 0)
  assert.equal(center.pitch, 0)
  assert.equal(center.mix, 1)
  assert.equal(nookGaze({ x: 1, y: 2 }, { ...box, width: 0 }), null)
  assert.equal(nookGaze({ x: Infinity, y: 2 }, box), null)
})

test('idle beats wait for visible idle time and cannot interrupt a user reaction or a pending selection', () => {
  const clock = new NookIdleClock(() => 0)
  assert.equal(clock.sample(8.99, 'idle', true), null)
  assert.equal(clock.sample(9, 'thinking', true), null)
  assert.equal(clock.sample(9, 'idle', false), null)
  assert.equal(clock.sample(9, 'idle', true), 'wink')
  clock.postpone(10) // a user interaction resets the quiet interval
  assert.equal(clock.sample(19.99, 'idle', true), null)
  assert.equal(clock.sample(20, 'burst', true), null)
  assert.equal(clock.sample(20, 'idle', true), 'wide')
  // A frozen visible-time clock does not catch up to background wall time.
  assert.equal(clock.sample(20, 'idle', true), null)
  assert.equal(clock.sample(29.99, 'idle', true), null)
  assert.equal(clock.sample(30, 'idle', true), 'wink')
})

test('breathing settles to identity when movement is reduced and stays finite through long sessions', () => {
  assert.equal(nookBreathing(0, 0), 'translate(0 0.000) rotate(0.000) scale(1.0000 1.0000)')
  for (const time of [0, .5, 5, 600, 36000]) assert.doesNotMatch(nookBreathing(time, 1), /NaN|Infinity/)
})
