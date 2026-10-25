import test from 'node:test'
import assert from 'node:assert/strict'
import { validateMediaParams } from '../src/lib/api-policy.ts'
import { catalogUrl } from '../src/lib/catalog-request.ts'
import { animeMinimumScore, emptyCatalogFilters, genreOptions, pageCatalogFilters } from '../src/lib/catalog-filters.ts'
import { pendingSeasonEpisodes } from '../src/lib/season-tracking.ts'
import { moveCollectionItem } from '../src/lib/library-tracking.ts'
import { presentPerson } from '../src/lib/people.ts'

test('discovery filter requests keep provider-specific genres and all pagination parameters',()=>{
  for(const kind of ['movie','tv','anime'])for(const genre of Object.keys(genreOptions(kind))) {
    const url=new URL(catalogUrl(kind,'','top-rated',3,{...emptyCatalogFilters,genre,year:'2022',score:'8'}),'http://vantra.local')
    assert.equal(url.searchParams.get('page'),'3');assert.equal(url.searchParams.get('pageSize'),'18')
    assert.equal(url.searchParams.get('genre'),genre);assert.equal(url.searchParams.get('year'),'2022')
    assert.doesNotThrow(()=>validateMediaParams(kind==='anime'?'anilist':'tmdb',url.searchParams))
  }
  const filtered=catalogUrl('movie','','popular',1,{...emptyCatalogFilters,genre:'comedy'})
  assert.notEqual(filtered,catalogUrl('movie','','popular',1))
  // Title searches never silently apply discovery-only filters.
  assert.equal(catalogUrl('movie','Dune','popular',1,{...emptyCatalogFilters,genre:'comedy'}),catalogUrl('movie','Dune','popular',1))
})
test('invalid filters fail closed before reaching providers',()=>{
  for(const extra of ['genre=not-a-genre','year=99999','score=10','runtime=-1','released=true','genre=comedy&genre=drama','url=https://evil.example'])assert.throws(()=>validateMediaParams('tmdb',new URLSearchParams(`type=discover&mediaType=movie&${extra}`)))
  assert.throws(()=>validateMediaParams('tmdb',new URLSearchParams('type=discover&genre=comedy')))
  assert.throws(()=>validateMediaParams('tmdb',new URLSearchParams('type=search&query=hello&genre=comedy')))
  assert.throws(()=>validateMediaParams('anilist',new URLSearchParams('type=catalog&runtime=30')))
  assert.throws(()=>validateMediaParams('tmdb',new URLSearchParams('type=person&id=42&query=other')))
})
test('page URLs restore valid filters while rejecting unsupported and repeated values',()=>{
  assert.deepEqual(pageCatalogFilters('movie',{genre:'comedy',year:'2022',score:'8',runtime:'120'}),{genre:'comedy',year:'2022',score:'8',runtime:'120'})
  assert.deepEqual(pageCatalogFilters('anime',{genre:'not-valid',year:['2022','2023'],score:'100',runtime:'120'}),emptyCatalogFilters)
})
test('an eight-out-of-ten minimum maps to AniList’s inclusive 80-point boundary, not 79',()=>{
  assert.equal(animeMinimumScore('8'),80);assert.equal(animeMinimumScore('9'),90);assert.equal(animeMinimumScore(''),undefined)
})
test('bulk season marking only adds missing released episodes and never mutates previous marks',()=>{
  const seen=new Set([1,3]),released=[3,2,1,2,4]
  assert.deepEqual(pendingSeasonEpisodes(released,seen),[2,4])
  assert.deepEqual([...seen],[1,3]);assert.deepEqual(released,[3,2,1,2,4])
  assert.deepEqual(pendingSeasonEpisodes([1,3],seen),[])
  for(const invalid of [[0],[1.5],[-1],[100001],Array.from({length:1001},(_,i)=>i+1)])assert.throws(()=>pendingSeasonEpisodes(invalid,seen))
})
test('collection arranging preserves all members and supports both keyboard directions',()=>{
  const original=['a','b','c']
  assert.deepEqual(moveCollectionItem(original,0,2),['b','c','a'])
  assert.deepEqual(moveCollectionItem(original,2,0),['c','a','b'])
  assert.deepEqual(moveCollectionItem(original,-1,0),original)
  assert.deepEqual(original,['a','b','c'])
})
test('filmographies merge duplicate roles but keep movie and TV identities separate',()=>{
  const person=presentPerson({id:1,name:'Person',biography:'Biography',profile_path:'/portrait.jpg',combined_credits:{cast:[{id:10,media_type:'movie',title:'A',character:'Lead',popularity:50,vote_average:8,vote_count:12},{id:10,media_type:'movie',title:'A',character:'Voice'},{id:10,media_type:'tv',name:'B',character:'Guest'},{id:-1,media_type:'movie'},{id:2,media_type:'person'}],crew:[{id:10,media_type:'movie',title:'A',job:'Director'}]}})
  assert.equal(person.credits.length,2)
  assert.equal(person.credits[0].media_type,'movie')
  assert.deepEqual(person.credits[0].roles,['Lead','Voice','Director'])
  assert.equal(person.credits[0].acting,true);assert.equal(person.credits[0].crew,true)
  assert.equal(person.credits[1].media_type,'tv')
  assert.equal(presentPerson({id:2,name:'Other',profile_path:'https://evil.example/p.jpg'}).profile_path,null)
})
