import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createTokenBucket } from '@/lib/api-policy'
import { apiJson } from '@/lib/media-api'
import { getTitleRecommendations } from '@/lib/tmdb'
import { getAnimeRecommendations } from '@/lib/anilist'
import { parseRecommendationSeeds, recommendationCard, recommendationKey, selectRecommendations } from '@/lib/for-you'

const quota=createTokenBucket(12,60_000)
export async function GET(request:Request) {
  if(new URL(request.url).search)return apiJson({error:'Invalid recommendation request.'},400)
  const client=await createServerSupabaseClient()
  const {data:{user},error:authError}=await client.auth.getUser()
  if(authError||!user)return apiJson({error:'Sign in to see your recommendations.'},401)
  const retry=quota(user.id)
  if(retry)return apiJson({error:'Please wait before refreshing your picks again.'},429,retry)
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(20_000)])
  try {
    const seedsResult=await client.rpc('recommendation_seeds').abortSignal(signal)
    if(seedsResult.error)throw seedsResult.error
    const seeds=parseRecommendationSeeds(seedsResult.data)
    if(!seeds.length)return apiJson({cards:[],empty:'no-seeds',partial:false})
    const results=await Promise.allSettled(seeds.map(async seed=>{
      const items=seed.kind==='anime'?await getAnimeRecommendations(seed.id):(await getTitleRecommendations(seed.id,seed.kind)).results
      if(!Array.isArray(items))throw new Error('Invalid catalogue')
      return items.slice(0,18).map(item=>recommendationCard(item,seed)).filter(card=>card!==null)
    }))
    if(signal.aborted)throw new Error('Aborted')
    const pools=results.map(result=>result.status==='fulfilled'?result.value:[])
    if(results.every(result=>result.status==='rejected'))return apiJson({error:'Your recommendations could not be loaded. Please try again.'},503,15)
    const candidates=[...new Map(pools.flat().map(card=>[card.tile.id,{kind:card.seed.kind,id:Number(card.tile.id.split(':')[1])}])).values()]
    let excluded=new Set<string>()
    if(candidates.length){
      const result=await client.rpc('recommendation_exclusions',{candidates}).abortSignal(signal)
      if(result.error)throw result.error
      if(!Array.isArray(result.data))throw new Error('Invalid exclusions')
      excluded=new Set(result.data.map((row:{kind:string;id:number})=>recommendationKey(row.kind,row.id)))
    }
    const cards=selectRecommendations(pools,excluded)
    return apiJson({cards,empty:cards.length?null:'no-matches',partial:results.some(result=>result.status==='rejected')})
  }catch{return apiJson({error:'Your recommendations could not be checked. Please try again.'},503,15)}
}
