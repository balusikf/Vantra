import test from 'node:test'
import assert from 'node:assert/strict'
import { lockBodyScroll } from '../src/lib/body-scroll-lock.ts'

test('switching between animated dialogs keeps scrolling locked and restores the original value', () => {
  const originalDocument = globalThis.document
  globalThis.document = { body: { style: { overflow: 'auto' } } }
  try {
    const nook = lockBodyScroll()
    const search = lockBodyScroll()
    nook()
    assert.equal(document.body.style.overflow, 'hidden')
    nook() // an already released lock must not decrement the active count
    assert.equal(document.body.style.overflow, 'hidden')
    search()
    assert.equal(document.body.style.overflow, 'auto')
    const first = lockBodyScroll(), second = lockBodyScroll()
    second()
    assert.equal(document.body.style.overflow, 'hidden')
    first()
    assert.equal(document.body.style.overflow, 'auto')
  } finally { globalThis.document = originalDocument }
})
