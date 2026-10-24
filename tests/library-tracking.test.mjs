import test from 'node:test'
import assert from 'node:assert/strict'
import { releasedAfterCompletion, collectionName, watchStatuses } from '../src/lib/library-tracking.ts'
test('release alerts require an actual release strictly after completion and no later than now',()=>{
 const completed='2026-10-20T16:00:00Z',now=Date.parse('2026-10-22T12:00:00Z')
 assert.equal(releasedAfterCompletion('2026-10-21T00:00:00Z',completed,now),true)
 for(const date of [completed,'2026-10-19','2026-10-23','unknown'])assert.equal(releasedAfterCompletion(date,completed,now),false)
 assert.equal(releasedAfterCompletion('2026-10-21','unknown',now),false)
})
test('collection names are normalized and bounded without accepting blank shelves',()=>{
 assert.equal(collectionName('  Movie   nights  '),'Movie nights')
 for(const name of ['','   ','x'.repeat(51)])assert.throws(()=>collectionName(name))
 assert.equal(collectionName('x'.repeat(50)).length,50)
 assert.deepEqual(Object.keys(watchStatuses),['planned','watching','completed','paused','dropped'])
})
