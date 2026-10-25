import { apiJson, mediaApiAccount } from '@/lib/media-api'
import { createTokenBucket } from '@/lib/api-policy'
import { libraryReleases } from '@/lib/library-releases'
import type { EpisodeRelease } from '@/lib/library-tracking'

const limit=createTokenBucket(12,60_000)
export async function GET(request:Request) {
  const params=new URL(request.url).searchParams
  const ids=[...new Set((params.get('ids')||'').split(','))]
  if(params.getAll('ids').length!==1||[...params.keys()].some(key=>key!=='ids')||ids.length>18||!ids.every(id=>/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)))return apiJson({error:'Invalid library selection.'},400)
  const account=await mediaApiAccount()
  if(account.status!==200)return apiJson({error:account.error},account.status,account.retryAfter)
  const {client,user}=account
  const retry=limit(user.id)
  if(retry)return apiJson({error:'Please wait before checking releases again.'},429,retry)
  const saved=await client.from('watchlist').select('id,tmdb_id,media_type,completed_at').eq('user_id',user.id).eq('watch_status','completed').in('id',ids).not('completed_at','is',null)
  if(saved.error)return apiJson({error:'Could not check your library.'},503,15)
  const updates:Record<string,{count:number;partial:boolean}>={}
  const candidates:EpisodeRelease[]=[]
  let cursor=0
  const deadline=Date.now()+15_000
  await Promise.all(Array.from({length:Math.min(3,saved.data.length)},async()=>{
    while(cursor<saved.data.length) {
      const item=saved.data[cursor++]
      try {
        const result=await libraryReleases(item,deadline)
        // One bounded RPC batch, even for long-running titles.
        const remaining=2048-candidates.length
        candidates.push(...result.candidates.slice(0,remaining))
        updates[item.id]={count:0,partial:result.partial||result.candidates.length>remaining}
      }catch{updates[item.id]={count:0,partial:true}}
    }
  }))
  if(candidates.length) {
    const result=await client.rpc('unseen_library_episodes',{candidates})
    if(result.error)return apiJson({error:'Could not compare watched episodes.'},503,15)
    for(const item of result.data as {watchlist_id:string;new_episodes:number}[]) if(updates[item.watchlist_id])updates[item.watchlist_id].count=Number(item.new_episodes)
  }
  return apiJson({updates})
}
