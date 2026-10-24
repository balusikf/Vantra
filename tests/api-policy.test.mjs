import test from 'node:test'
import assert from 'node:assert/strict'
import { validateMediaParams, createTokenBucket } from '../src/lib/api-policy.ts'
import { createUpstreamGate, CatalogUnavailableError, retrySeconds } from '../src/lib/upstream-policy.ts'
import { isAlignedAnimeSeason, toAnimeEpisodePreview } from '../src/lib/anime-artwork-policy.ts'
import { catalogUrl } from '../src/lib/catalog-request.ts'

test('invalid, duplicate and oversized API parameters fail before any service calls', () => {
 for (const query of ['type=search&query='+ 'x'.repeat(121), 'type=movie-detail&id=-1', 'type=search&type=trending&query=a', 'type=season-detail&id=1', 'type=search&query=%00', 'type=trending&page=501', 'type=trending&url=https://evil.example']) assert.throws(()=>validateMediaParams('tmdb', new URLSearchParams(query)))
 const params=new URLSearchParams('type=search&query=%20Dune%20%20Part%20Two%20&pageSize=18')
 validateMediaParams('tmdb',params); assert.equal(params.get('query'),'Dune Part Two')
 assert.doesNotThrow(()=>validateMediaParams('stream',new URLSearchParams('id=1&type=anime&episode=1&anilistId=1')))
})
test('per-account quota refills, isolates accounts and refuses new keys when full', () => {
 let now=0; const consume=createTokenBucket(2,2000,2,()=>now)
 assert.equal(consume('a'),0); assert.equal(consume('a'),0); assert.equal(consume('a'),1)
 assert.equal(consume('b'),0); assert.equal(consume('c'),2)
 now=1000; assert.equal(consume('a'),0); assert.equal(consume('a'),1)
 now=4000; assert.equal(consume('c'),0)
})
test('cold concurrent metadata requests share work, distinct keys remain distinct', async () => {
 const run=createUpstreamGate(); let calls=0; let release
 const a=run('title',()=>{calls++;return new Promise(r=>{release=r})})
 const b=run('title',()=>{calls++;return 2})
 await Promise.resolve(); assert.equal(calls,1); release(42)
 assert.deepEqual(await Promise.all([a,b]),[42,42]); assert.equal(await run('other',async()=>7),7)
})
test('provider cooldown blocks repeated and different requests, then recovers', async () => {
 let now=0,calls=0; const run=createUpstreamGate(()=>now)
 await assert.rejects(run('first',async()=>{calls++;throw new CatalogUnavailableError(15)}))
 for(let i=0;i<9;i++) await assert.rejects(run(String(i),async()=>{calls++;return 1}),{retryAfter:15})
 assert.equal(calls,1); now=15000; assert.equal(await run('recovered',async()=>8),8)
 assert.equal(retrySeconds('9999'),60); assert.equal(retrySeconds('bad'),15)
})
test('a full upstream queue rejects new work but still shares existing work', async () => {
 const run=createUpstreamGate(Date.now,1); let release
 const work=run('a',()=>new Promise(r=>{release=r})); await Promise.resolve()
 await assert.rejects(run('b',async()=>2),{retryAfter:2}); const shared=run('a',async()=>3)
 release(1); assert.deepEqual(await Promise.all([work,shared]),[1,1])
})
test('anime suggestions and full results produce the same cache key', () => {
 assert.equal(catalogUrl('anime','  Frieren  ','trending',1),catalogUrl('anime','Frieren','popular',1))
 assert.notEqual(catalogUrl('movie','Dune','popular',1),catalogUrl('tv','Dune','popular',1))
})
test('anime previews allow a matching leading cour and reject wrong dates or insufficient episodes', () => {
 const anime={episodes:12,startDate:{year:2023,month:10,day:1}}
 assert.equal(isAlignedAnimeSeason(anime,{episodes:Array(12),air_date:'2023-10-02'}),true)
 assert.equal(isAlignedAnimeSeason(anime,{episodes:Array(24),air_date:'2023-10-01'}),true)
 for(const season of [{episodes:Array(6),air_date:'2023-10-01'},{episodes:Array(12),air_date:'2024-01-01'},{episodes:Array(12),air_date:null}]) assert.equal(isAlignedAnimeSeason(anime,season),false)
 assert.equal(isAlignedAnimeSeason({...anime,startDate:{year:2023}},{episodes:Array(12),air_date:'2023-10-01'}),false)
})

test('anime episode metadata preserves actual runtime and synopsis without inventing missing values', () => {
 const episode={episode_number:1,name:'First episode',still_path:'/still.jpg',air_date:'2023-09-29'}
 assert.deepEqual(toAnimeEpisodePreview({...episode,runtime:24,overview:'  A real episode synopsis.  '}),{...episode,runtime:24,overview:'A real episode synopsis.'})
 assert.deepEqual(toAnimeEpisodePreview(episode),{...episode,runtime:null,overview:null})
 for(const runtime of [0,-1,NaN,Infinity]) assert.equal(toAnimeEpisodePreview({...episode,runtime}).runtime,null)
 assert.equal(toAnimeEpisodePreview({...episode,overview:'   '}).overview,null)
})
