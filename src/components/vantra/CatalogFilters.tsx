'use client'
import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { emptyCatalogFilters, genreOptions, type CatalogFilters as Values } from '@/lib/catalog-filters'
import s from './catalog-filters.module.css'
export default function CatalogFilters({ kind, value, onApply }: {kind:'movie'|'tv'|'anime';value:Values;onApply:(value:Values)=>void}) {
  const [open,setOpen]=useState(false), [draft,setDraft]=useState(value)
  const id=useId(),reduce=useReducedMotion(), options=genreOptions(kind)
  const labels={genre:options[value.genre]?.[0],year:value.year,score:value.score?`${value.score}+ rating`:'',runtime:value.runtime?`Up to ${value.runtime} min`:''}
  return <div className={s.root}><div className={s.bar}><button type="button" className={s.toggle} aria-expanded={open} aria-controls={id} onClick={()=>{setDraft(value);setOpen(!open)}}><SlidersHorizontal size={15}/>Refine your search<ChevronDown size={14} className={open?s.rotate:''}/></button><div className={s.chips}>{(Object.keys(labels) as (keyof Values)[]).filter(key=>value[key]).map(key=><button type="button" key={key} aria-label={`Remove ${labels[key]} filter`} onClick={()=>onApply({...value,[key]:''})}>{labels[key]}<X size={11}/></button>)}{Object.values(value).some(Boolean)&&<button type="button" className={s.clear} onClick={()=>onApply({...emptyCatalogFilters})}>Clear all</button>}</div></div>
  <AnimatePresence>{open&&<motion.form id={id} className={s.panel} initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:reduce?0:.22}} onSubmit={event=>{event.preventDefault();onApply(draft);setOpen(false)}}><div className={s.fields}>
  <label>Genre<select value={draft.genre} onChange={event=>setDraft({...draft,genre:event.target.value})}><option value="">Every genre</option>{Object.entries(options).map(([key,[label]])=><option key={key} value={key}>{label}</option>)}</select></label>
  <label>Release year<input type="number" min="1800" max="2100" placeholder="Any year" value={draft.year} onChange={event=>setDraft({...draft,year:event.target.value})}/></label>
  <label>Minimum rating<select value={draft.score} onChange={event=>setDraft({...draft,score:event.target.value})}><option value="">Any rating</option>{[5,6,7,8,9].map(score=><option key={score} value={score}>{score}+ / 10</option>)}</select></label>
  {kind!=='anime'&&<label>{kind==='tv'?'Episode length':'Movie length'}<select value={draft.runtime} onChange={event=>setDraft({...draft,runtime:event.target.value})}><option value="">Any length</option>{(kind==='tv'?[30,60,90]:[90,120,180,240]).map(minutes=><option key={minutes} value={minutes}>Up to {minutes} min</option>)}</select></label>}
  <button type="submit">Find my stories</button></div></motion.form>}</AnimatePresence></div>
}
