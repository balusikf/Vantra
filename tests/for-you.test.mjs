import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRecommendationSeeds, recommendationCard, selectRecommendations } from '../src/lib/for-you.ts'

const seed={id:100,kind:'tv',title:'A favourite'}
const tv=(id,extra={})=>({id,name:'Story '+id,poster_path:'/poster.jpg',first_air_date:'2020-01-01',vote_average:8,...extra})
const card=(id,source=seed)=>recommendationCard(tv(id),source,'2026-10-24')
test('seed responses are bounded and never carry ratings or private notes outside the library',()=>{
  assert.deepEqual(parseRecommendationSeeds([{...seed,personal_rating:10,personal_note:'private'}]),[seed])
  for(const input of [[{...seed,id:0}],[{...seed,kind:'person'}],Array(4).fill(seed)])assert.throws(()=>parseRecommendationSeeds(input))
})
test('recommendation normalization filters adults, future/unknown releases and unsafe images or IDs',()=>{
  assert.equal(card(1).tile.href,'/tv/1')
  for(const change of [{adult:true},{first_air_date:'2027-01-01'},{first_air_date:null},{first_air_date:'2026-02-30'},{poster_path:'https://evil.test/p.jpg'},{id:-1}])assert.equal(recommendationCard(tv(1,change),seed,'2026-10-24'),null)
})
test('anime IDs remain AniList IDs and unreleased or adult suggestions never enter the shelf',()=>{
  const anime={id:12,title:{english:'Anime',romaji:'Anime'},coverImage:{extraLarge:'https://s4.anilist.co/file/anilistcdn/media/anime/cover/1.jpg'},averageScore:85,status:'FINISHED',startDate:{year:2020},isAdult:false}
  const source={...seed,kind:'anime'}
  assert.equal(recommendationCard(anime,source,'2026-10-24').tile.href,'/anime/12')
  assert.equal(recommendationCard(anime,source,'2026-10-24').tile.rating,8.5)
  assert.equal(recommendationCard({...anime,status:'NOT_YET_RELEASED'},source),null)
  assert.equal(recommendationCard({...anime,isAdult:true},source),null)
  assert.equal(recommendationCard({...anime,coverImage:{large:'https://example.org/a.jpg'}},source),null)
})
test('picks interleave seeds, deduplicate overlaps and exclude saved/history titles and the seeds themselves',()=>{
  const second={id:200,kind:'tv',title:'Another favourite'}
  const result=selectRecommendations([[card(1),card(2),card(100),card(4)],[card(3,second),card(1,second),card(5,second)]],new Set(['tv:2']),6)
  assert.deepEqual(result.map(item=>item.tile.id),['tv:1','tv:3','tv:5','tv:4'])
})
test('candidate exclusion keeps catalogue namespaces separate and the final shelf stays bounded',()=>{
  const anime={tile:{...card(1).tile,id:'anime:1',href:'/anime/1'},seed:{...seed,kind:'anime'}}
  assert.deepEqual(selectRecommendations([[card(1),anime]],new Set(['tv:1'])).map(c=>c.tile.id),['anime:1'])
  assert.equal(selectRecommendations([Array.from({length:18},(_,i)=>card(i+1))],new Set()).length,6)
  assert.deepEqual(selectRecommendations([],new Set()),[])
})
