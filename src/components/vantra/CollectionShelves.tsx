'use client'
import Image from 'next/image'
import { FolderHeart, Layers } from 'lucide-react'
import type { LibraryCollection, CollectionPoster } from '@/lib/library-tracking'
import { nookPoster } from '@/lib/nook-selection'
import c from './collections.module.css'
export function collectionPoster(item:CollectionPoster) {return nookPoster({tmdb_id:1,media_type:item.media_type,title:item.title,poster_path:item.poster_path})}
export default function CollectionShelves({collections,selected,onSelect}:{collections:LibraryCollection[];selected:string;onSelect:(id:string)=>void}) {
  if(!collections.length)return null
  return <section className={c.shelves} aria-label="Your private collections"><div className={c.shelfHeading}><span>YOUR OWN LITTLE WORLDS</span>{selected!=='all'&&<button type="button" onClick={()=>onSelect('all')}>Show all titles</button>}</div><div className={c.rail}>{collections.map(item=><button type="button" key={item.id} aria-pressed={selected===item.id} onClick={()=>onSelect(selected===item.id?'all':item.id)} className={c.shelf}>
    <div className={`${c.art} ${item.cover_watchlist_id?c.single:''}`}>{item.posters?.length?item.posters.slice(0,item.cover_watchlist_id?1:4).map(poster=>{const url=collectionPoster(poster);return <div key={poster.id}>{url?<Image src={url} alt="" fill sizes="260px" className={c.poster}/>:<FolderHeart size={30}/>}</div>}):<FolderHeart className={c.emptyArt} size={40} strokeWidth={1}/>}</div>
    <span className={c.shade}/><span className={c.shelfName}><strong>{item.name}</strong><span><Layers size={11}/>{item.member_count??0} {(item.member_count??0)===1?'title':'titles'}</span></span>
  </button>)}</div></section>
}
