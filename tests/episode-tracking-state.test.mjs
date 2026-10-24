import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEpisodeTrackingState } from '../src/lib/episode-tracking-state.ts'

const id='11111111-1111-4111-8111-111111111111'
test('episode state preserves sparse visible marks and full season counts beyond the visible window',()=>{
  const state=parseEpisodeTrackingState({watchlistId:id,seen:[1,3,24],seasonCounts:{0:120}},24)
  assert.deepEqual([...state.seen],[1,3,24])
  assert.equal(state.seasonCounts[0],120)
  assert.equal(state.watchlistId,id)
})
test('unsaved titles have no watched marks, and malformed or out-of-range states fail closed',()=>{
  assert.deepEqual(parseEpisodeTrackingState({watchlistId:null,seen:[],seasonCounts:{}},24).seasonCounts,{})
  for(const state of [
    {watchlistId:null,seen:[1],seasonCounts:{}},
    {watchlistId:id,seen:[25],seasonCounts:{}},
    {watchlistId:id,seen:[.5],seasonCounts:{}},
    {watchlistId:id,seen:[],seasonCounts:{1001:1}},
    {watchlistId:id,seen:[],seasonCounts:{0:-1}},
    {watchlistId:'invalid',seen:[],seasonCounts:{}},
  ])assert.throws(()=>parseEpisodeTrackingState(state,24))
})
