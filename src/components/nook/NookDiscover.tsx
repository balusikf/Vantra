'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Compass, Film, Shuffle } from 'lucide-react'
import { cachedMedia, fetchMedia } from '@/lib/client-media-cache'
import { emptyCatalogFilters, genreOptions, moodGenre, nookMoods, type NookMood } from '@/lib/catalog-filters'
import { catalogUrl } from '@/lib/catalog-request'
import { nookPoster, nookTitleKey, pickNookTitle, type NookKind, type NookTitle } from '@/lib/nook-selection'
import type { TMDBMedia } from '@/lib/tmdb'
import type { AniListMedia } from '@/lib/anilist'
import type { NookPickerProps } from './NookPicker'
import n from './nook.module.css'
type Title=NookTitle&{genres?:unknown}
type Pool={rows:Title[];page:number;hasMore:boolean}

export default function NookDiscover({userId,active=true,inline=false,onNavigate,respond,reactToGenres,onBusyChange}:NookPickerProps) {
  const [kind,setKind]=useState<NookKind>('all'),[mood,setMood]=useState<NookMood>('surprise')
  const [result,setResult]=useState<Title|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[broken,setBroken]=useState(false)
  const controller=useRef<AbortController|null>(null), pools=useRef(new Map<string,Pool>()),seen=useRef<string[]>([]),working=useRef(false)
  useEffect(()=>()=>{controller.current?.abort();pools.current.clear()},[])
  useEffect(()=>{if(!active){controller.current?.abort();working.current=false;queueMicrotask(()=>{setBusy(false);onBusyChange(false)})}},[active,onBusyChange])
  async function pick() {
    if(working.current||!active||!userId)return
    controller.current?.abort();const request=new AbortController();controller.current=request;working.current=true
    setBusy(true);onBusyChange(true);setNotice('');setResult(null);setBroken(false)
    respond({state:'thinking',speech:'Let’s look beyond your list. A new story is out there.'})
    try {
      const chosen=kind==='all'?(['movie','tv','anime'] as const)[Math.floor(Math.random()*3)]:kind
      const key=`${chosen}:${mood}`,old=pools.current.get(key)
      let pool=old
      if(!pool || pool.hasMore&&pool.rows.every(item=>seen.current.includes(nookTitleKey(item)))) {
        const page=old?old.page%10+1:1
        const filters={...emptyCatalogFilters,genre:moodGenre(mood,chosen)}
        const parsed=new URL(catalogUrl(chosen,'','popular',page,filters),'http://vantra.local')
        parsed.searchParams.set('released','1')
        if(chosen!=='anime'){parsed.searchParams.set('type','discover');parsed.searchParams.set('mediaType',chosen);parsed.searchParams.set('sort','popular')}
        const data=await fetchMedia<{results:(TMDBMedia|AniListMedia)[];total_pages?:number;hasMore?:boolean}>(`${parsed.pathname}?${parsed.searchParams}`,AbortSignal.any([request.signal,AbortSignal.timeout(15_000)]))
        if(request.signal.aborted)return
        const rows:Title[]=chosen==='anime'?(data.results as AniListMedia[]).map(item=>({tmdb_id:item.id,media_type:'anime',title:item.title.english||item.title.romaji,poster_path:item.coverImage.extraLarge||item.coverImage.large,genres:item.genres})):(data.results as TMDBMedia[]).map(item=>({tmdb_id:item.id,media_type:chosen,title:item.title||item.name||'Untitled',poster_path:item.poster_path}))
        pool={rows,page,hasMore:chosen==='anime'?!!data.hasMore:page<(data.total_pages||1)};pools.current.set(key,pool)
      }
      const next=pickNookTitle(pool.rows,chosen,seen.current) as Title|null
      if(!next){setNotice('No stories for that mood right now. Try another mood or title type.');respond({emotion:'curious',speech:'A different mood might open a new door.'});return}
      seen.current=[...seen.current.slice(-360),nookTitleKey(next)];setResult(next)
      const token=crypto.randomUUID()
      const detail=next.media_type==='anime'?`/api/anilist?type=detail&id=${next.tmdb_id}`:`/api/tmdb?type=${next.media_type}-detail&id=${next.tmdb_id}`
      const saved=cachedMedia<{genres?:unknown}>(detail)
      const genres=next.genres||saved?.genres||[genreOptions(chosen)[moodGenre(mood,chosen)]?.[0]].filter(Boolean)
      reactToGenres(genres,token)
      if(!next.genres&&!saved)void fetchMedia<{genres?:unknown}>(detail,AbortSignal.any([request.signal,AbortSignal.timeout(4500)])).then(data=>{if(data?.genres&&!request.signal.aborted)reactToGenres(data.genres,token,true)}).catch(()=>{})
    }catch{if(!request.signal.aborted){setNotice('The catalogue is taking a break. Try again shortly.');respond({speech:'A short intermission. We can try again.'})}}
    finally{if(controller.current===request)working.current=false;if(!request.signal.aborted){setBusy(false);onBusyChange(false)}}
  }
  const poster=result&&nookPoster(result)
  return <section className={`${n.picker} ${inline?n.inlinePicker:''}`} aria-label="Discover with Nook">
    <div className={n.moods} aria-label="Choose your evening mood">{nookMoods.map(item=><button type="button" key={item.id} title={item.hint} aria-pressed={mood===item.id} disabled={busy||!active} onClick={()=>{controller.current?.abort();setMood(item.id);setResult(null);setNotice('')}}>{item.label}</button>)}</div>
    <div className={n.kinds} aria-label="Discovery title type">{([{id:'all',label:'Anything'},{id:'movie',label:'Movie'},{id:'tv',label:'Series'},{id:'anime',label:'Anime'}] as const).map(item=><button type="button" key={item.id} aria-pressed={kind===item.id} disabled={busy||!active} onClick={()=>{controller.current?.abort();setKind(item.id);setResult(null);setNotice('')}}>{item.label}</button>)}</div>
    {userId?<button type="button" className={n.primary} disabled={busy||!active} onClick={()=>{void pick()}}>{busy?<Compass size={14}/>:<Shuffle size={14}/>} {busy?'Finding a new story…':result?'Discover another story':'Find my next story'}</button>:<Link className={n.primary} href="/login" onNavigate={onNavigate}>Sign in to discover <ArrowUpRight size={13}/></Link>}
    <div role="status" aria-live="polite" aria-busy={busy}>{result&&<div className={n.result}><Link className={n.resultPoster} href={`/${result.media_type}/${result.tmdb_id}`} onNavigate={onNavigate} aria-label={`More about ${result.title}`}>{poster&&!broken?<Image src={poster} alt="" width={76} height={114} onError={()=>setBroken(true)}/>:<Film size={24}/>}</Link><div><p className={n.resultType}>{result.media_type==='tv'?'SERIES':result.media_type.toUpperCase()} · FROM THE CATALOGUE</p><h4>{result.title}</h4><Link href={`/${result.media_type}/${result.tmdb_id}`} onNavigate={onNavigate}>Explore this story <ArrowUpRight size={14}/></Link></div></div>}{notice&&<p className={n.notice}>{notice}</p>}</div>
  </section>
}
