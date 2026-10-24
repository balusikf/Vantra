'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { tmdbTile, type MediaTile } from '@/lib/media-presentation'
import type { TMDBMedia } from '@/lib/tmdb'
import { fetchMedia } from '@/lib/client-media-cache'
import s from './vantra.module.css'

export function Wordmark() {
  return <svg className={s.wordmarkSvg} viewBox="0 0 176 30" fill="none" aria-hidden="true">
    <path d="M3 3 12 26 21 3M29 26 38 3 47 26M56 26V3L74 26V3M83 3H105M94 3V26M114 26V3H126C139 3 139 15 126 15H114M126 15 138 26M146 26 155 3 164 26M150 18H160" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="miter" />
    <circle cx="173" cy="25" r="2.4" className={s.brandDot} />
  </svg>
}

export function PosterCard({ item, rank }: { item: MediaTile; rank?: number }) {
  const router = useRouter()
  const intent = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(intent.current), [])
  function warm() {
    clearTimeout(intent.current)
    intent.current = setTimeout(() => {
      router.prefetch(item.href)
      const [, kind, id] = item.href.split('/')
      if (kind === 'movie' || kind === 'tv' || kind === 'anime') void fetchMedia(`/api/${kind === 'anime' ? 'anilist?type=detail' : `tmdb?type=${kind}-detail`}&id=${id}`).catch(() => {})
    }, 180)
  }
  return <div className={s.card}><Link prefetch={false} href={item.href} className={s.cardLink} onMouseEnter={warm} onFocus={warm} onMouseLeave={() => clearTimeout(intent.current)} onBlur={() => clearTimeout(intent.current)}>
    <div className={s.art}>
      {item.poster ? <Image src={item.poster} alt="" fill sizes="(max-width: 600px) 44vw, (max-width: 850px) 29vw, (max-width: 1200px) 18vw, 15vw" quality={85} className={s.cardImage} /> : <span className={s.missingPoster}>{item.title}</span>}
      {rank !== undefined && <span className={s.rank}>{String(rank).padStart(2, '0')}</span>}
      <span className={s.cardOpen}><span>Explore title <ArrowUpRight size={17} /></span></span>
      {item.rating !== null && <span className={s.score}><Star size={11} fill="currentColor" /> {item.rating.toFixed(1)}</span>}
    </div><h3>{item.title}</h3><p>{item.year}{item.year && <span>·</span>}{item.kind}</p>
  </Link></div>
}

export function Shelf({ items, label, eyebrow, href, filter, collectionKey = 'default' }: {
  items: TMDBMedia[]; label: string; eyebrow: string; href: string; filter?: ReactNode; collectionKey?: string
}) {
  const rail = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const scroll = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .8, behavior: reduce ? 'auto' : 'smooth' })
  return <motion.section className={s.shelf} initial={{ opacity: 0, y: reduce ? 0 : 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .08 }} transition={{ duration: reduce ? 0 : .6 }}>
    <div className={s.sectionHeading}><div><p className={s.eyebrow}>{eyebrow}</p><h2>{label}<span>.</span></h2></div>
      <div className={s.shelfActions}>{filter}{href && <Link href={href} className={s.explore}>View all <ArrowUpRight size={15} /></Link>}
        <div className={s.railControls}><button aria-label={`Scroll ${label} left`} onClick={() => scroll(-1)}><ChevronLeft size={18} /></button><button aria-label={`Scroll ${label} right`} onClick={() => scroll(1)}><ChevronRight size={18} /></button></div>
      </div></div>
    <motion.div ref={rail} className={s.rail} key={collectionKey} initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: reduce ? 0 : .035 } } }}>
      {items.slice(0, 18).map((item, index) => <motion.div key={`${item.media_type}:${item.id}`} variants={{ hidden: { opacity: 0, y: reduce ? 0 : 18 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: reduce ? 0 : .4 }}><PosterCard item={tmdbTile(item)} rank={index + 1} /></motion.div>)}
    </motion.div>{items.length === 0 && <p className={s.empty}>This collection is temporarily unavailable. Please try again later.</p>}
  </motion.section>
}

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return <motion.div className={className} initial={{ opacity: 0, y: reduce ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .35 }}>{children}</motion.div>
}

export function PosterSkeletons({ count = 18 }: { count?: number }) {
  return <div className={s.posterGrid} aria-label="Loading titles" aria-busy="true">{Array.from({ length: count }, (_, index) => <div className={s.posterSkeleton} key={index}><div /><span /><i /></div>)}</div>
}
