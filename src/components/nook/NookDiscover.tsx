'use client'
import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, ChevronDown, Compass, Film, Shuffle } from 'lucide-react'
import { cachedMedia, fetchMedia } from '@/lib/client-media-cache'
import { discoveryCollections, discoveryGenres, discoveryKinds, discoveryLanes, discoveryUrl, drawDiscoveryChoice, type DiscoveryCollection, type DiscoveryLane, type DiscoveryPage, type DiscoveryTitle } from '@/lib/nook-discovery'
import { nookPoster, nookTitleKey, pickNookTitle, type NookKind } from '@/lib/nook-selection'
import type { NookPickerProps } from './NookPicker'
import n from './nook.module.css'
type Title=DiscoveryTitle
type Pool=DiscoveryPage&{loadedAt:number}

export default function NookDiscover({userId,active=true,inline=false,onNavigate,respond,reactToGenres,onBusyChange}:NookPickerProps) {
  const [kind,setKind]=useState<NookKind>('all'),[collection,setCollection]=useState<DiscoveryCollection>('mixed'),[genre,setGenre]=useState('')
  const [result,setResult]=useState<Title|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[broken,setBroken]=useState(false)
  const controller=useRef<AbortController|null>(null), pools=useRef(new Map<string,Pool>()),seen=useRef<string[]>([]),working=useRef(false)
  const bags=useRef(new Map<string,(string|number)[]>()),genreId=useId()
  const selectedCollection=discoveryCollections.find(item=>item.id===collection)!
  function draw<T extends string|number>(key:string,options:readonly T[]):T {
    const choice=drawDiscoveryChoice(options,(bags.current.get(key)||[]) as T[])
    if(!bags.current.has(key)&&bags.current.size>=64)bags.current.delete(bags.current.keys().next().value!)
    bags.current.set(key,choice.used);return choice.value
  }
  useEffect(()=>()=>{controller.current?.abort();pools.current.clear();bags.current.clear()},[])
  useEffect(()=>{if(!active){controller.current?.abort();working.current=false;queueMicrotask(()=>{setBusy(false);onBusyChange(false)})}},[active,onBusyChange])
  async function pick() {
    if(working.current||!active||!userId)return
    controller.current?.abort();const request=new AbortController();controller.current=request;working.current=true
    setBusy(true);onBusyChange(true);setNotice('');setResult(null);setBroken(false)
    respond({state:'thinking',speech:collection==='mixed'?'A new release, an older favourite, or something you might have missed. Let’s explore.':`Let’s find a title in ${selectedCollection.label.toLowerCase()}.`})
    try {
      const chosen=draw(`kind:${kind}:${genre}`,discoveryKinds(kind,genre))
      const lane:DiscoveryLane=collection==='mixed'?draw('mixed-collections',discoveryLanes):collection
      const key=`${chosen}:${lane}:${genre}`
      let pool=pools.current.get(key)
      const fresh=()=>pool?.results.filter(item=>!seen.current.includes(nookTitleKey(item)))||[]
      // Sample beyond page one; retry once for a sparse or shorter catalogue.
      for(let attempt=0;attempt<2&&(!fresh().length||!pool||Date.now()-pool.loadedAt>300_000);attempt++) {
        const maxPage=pool?.totalPages||(lane==='trending'?3:10)
        const page=draw(`page:${key}`,Array.from({length:maxPage},(_,index)=>index+1))
        const data=await fetchMedia<DiscoveryPage>(discoveryUrl(chosen,lane,genre,page),AbortSignal.any([request.signal,AbortSignal.timeout(15_000)]))
        if(request.signal.aborted)return
        if(!Array.isArray(data.results)||data.results.length>20||!Number.isInteger(data.totalPages)||data.totalPages<1||data.totalPages>10)throw new Error('Invalid catalogue page.')
        pool={...data,loadedAt:Date.now()}
        if(!pools.current.has(key)&&pools.current.size>=32)pools.current.delete(pools.current.keys().next().value!)
        pools.current.set(key,pool)
      }
      const next=pickNookTitle(fresh(),chosen,seen.current) as Title|null
      if(!next){setNotice('No new picks in this selection right now. Try another genre, category or title type.');respond({emotion:'curious',speech:'Let’s try another corner of the catalogue.'});return}
      seen.current=[...seen.current.slice(-359),nookTitleKey(next)];setResult(next)
      const token=crypto.randomUUID()
      const detail=next.media_type==='anime'?`/api/anilist?type=detail&id=${next.tmdb_id}`:`/api/tmdb?type=${next.media_type}-detail&id=${next.tmdb_id}`
      const saved=cachedMedia<{genres?:unknown}>(detail)
      const genres=next.genres.length?next.genres:saved?.genres
      if(genres)reactToGenres(genres,token)
      else respond({state:'idle',emotion:'curious',selection:token,speech:'Here’s a different story to explore.'})
      if(!genres)void fetchMedia<{genres?:unknown}>(detail,AbortSignal.any([request.signal,AbortSignal.timeout(4500)])).then(data=>{if(data?.genres&&!request.signal.aborted)reactToGenres(data.genres,token,true)}).catch(()=>{})
    }catch{if(!request.signal.aborted){setNotice('The catalogue is taking a break. Try again shortly.');respond({speech:'A short intermission. We can try again.'})}}
    finally{if(controller.current===request)working.current=false;if(!request.signal.aborted){setBusy(false);onBusyChange(false)}}
  }
  const poster=result&&nookPoster(result)
  return <section className={`${n.picker} ${inline?n.inlinePicker:''}`} aria-label="Discover with Nook">
    <div className={n.discoveryCollections} role="group" aria-label="Discovery category">{discoveryCollections.map(item=><button type="button" key={item.id} title={item.hint} aria-pressed={collection===item.id} disabled={busy||!active} onClick={()=>{controller.current?.abort();setCollection(item.id);setResult(null);setNotice('')}}>{item.label}</button>)}</div>
    <p className={n.discoveryHint}>{selectedCollection.hint}</p>
    <div className={n.kinds} role="group" aria-label="Discovery title type">{([{id:'all',label:'Anything'},{id:'movie',label:'Movie'},{id:'tv',label:'Series'},{id:'anime',label:'Anime'}] as const).map(item=><button type="button" key={item.id} aria-pressed={kind===item.id} disabled={busy||!active} onClick={()=>{controller.current?.abort();setKind(item.id);if(genre&&!Object.hasOwn(discoveryGenres(item.id),genre))setGenre('');setResult(null);setNotice('')}}>{item.label}</button>)}</div>
    <div className={n.discoveryGenre}><label htmlFor={genreId}>Genre</label><div><select id={genreId} value={genre} disabled={busy||!active} onChange={event=>{controller.current?.abort();setGenre(event.target.value);setResult(null);setNotice('')}}><option value="">Any genre</option>{Object.entries(discoveryGenres(kind)).sort((a,b)=>a[1][0].localeCompare(b[1][0])).map(([id,[label]])=><option value={id} key={id}>{label}</option>)}</select><ChevronDown size={13} aria-hidden="true"/></div></div>
    {userId?<button type="button" className={n.primary} disabled={busy||!active} onClick={()=>{void pick()}}>{busy?<Compass size={14}/>:<Shuffle size={14}/>} {busy?'Finding a title…':result?'Find another title':'Find a title'}</button>:<Link className={n.primary} href="/login" onNavigate={onNavigate}>Sign in to discover <ArrowUpRight size={13}/></Link>}
    <div role="status" aria-live="polite" aria-busy={busy}>{result&&<div className={n.result}><Link className={n.resultPoster} href={`/${result.media_type}/${result.tmdb_id}`} onNavigate={onNavigate} aria-label={`More about ${result.title}`}>{poster&&!broken?<Image src={poster} alt="" width={76} height={114} onError={()=>setBroken(true)}/>:<Film size={24}/>}</Link><div><p className={n.resultType}>{result.media_type==='tv'?'SERIES':result.media_type.toUpperCase()} · {result.year} · {discoveryCollections.find(item=>item.id===result.collection)?.label.toUpperCase()}</p><h4>{result.title}</h4><Link href={`/${result.media_type}/${result.tmdb_id}`} onNavigate={onNavigate}>Explore this story <ArrowUpRight size={14}/></Link></div></div>}{notice&&<p className={n.notice}>{notice}</p>}</div>
  </section>
}
