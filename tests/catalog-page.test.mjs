import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogPage } from '../src/lib/catalog-page.ts'

function source(length) {
  const items = Array.from({ length }, (_, index) => index + 1)
  return async page => ({ results: items.slice((page - 1) * 20, page * 20), total_results: length, total_pages: Math.ceil(length / 20) })
}
test('18-title pages cross provider boundaries without omissions or duplicates', async () => {
  const pages = await Promise.all(Array.from({ length: 10 }, (_, index) => catalogPage(source(180), index + 1)))
  assert.ok(pages.every(page => page.results.length === 18 && page.total_pages === 10))
  assert.deepEqual(pages.flatMap(page => page.results), Array.from({ length: 180 }, (_, index) => index + 1))
})
test('last page and empty catalogs report their actual size', async () => {
  const last = await catalogPage(source(23), 2)
  assert.deepEqual(last.results, [19, 20, 21, 22, 23])
  assert.equal(last.total_pages, 2)
  assert.deepEqual((await catalogPage(source(0), 1)).results, [])
})
test('an upstream failure cannot silently skip the remainder of a page', async () => {
  await assert.rejects(catalogPage(async page => { if (page === 2) throw new Error('offline'); return source(100)(page) }, 2))
})
