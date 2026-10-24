"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, Database, HardDrive, LockKeyhole, RefreshCw } from 'lucide-react'
import Shell from './Shell'
import { quotaState } from '@/lib/supabase-usage'
import { parseLiveCapacity, type LiveCapacity } from '@/lib/usage-capacity'
import s from './usage.module.css'

const dashboard = 'https://supabase.com/dashboard/org/iveqxxqtcmdteeobgxws/usage'
const number = (n: number, digits = 2) => n.toLocaleString('en-GB', { maximumFractionDigits: digits })
const timestamp = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : 'No reading yet'
const size = (bytes: number | null) => bytes == null ? 'Not reported' : bytes >= 1_000_000_000 ? number(bytes / 1_000_000_000) + ' GB' : bytes >= 1_000_000 ? number(bytes / 1_000_000) + ' MB' : bytes >= 1_000 ? number(bytes / 1_000) + ' KB' : number(bytes) + ' B'
const percentage = (value: number | null | undefined, limit: number) => {
  const state = quotaState(value, limit)
  return state ? state.percent > 0 && state.percent < .01 ? '<0.01%' : number(state.percent) + '%' : '—'
}

function UsageRing({ value, limit, compact = false }: { value: number | null | undefined; limit: number; compact?: boolean }) {
  const state = quotaState(value, limit), reducedMotion = useReducedMotion()
  const circumference = 2 * Math.PI * 46
  return <div className={`${s.ring} ${compact ? s.ringCompact : ''}`} data-status={state?.status}>
    <svg viewBox="0 0 112 112" aria-hidden="true"><circle className={s.ringOutline} cx="56" cy="56" r="55" /><circle className={s.ringTrack} cx="56" cy="56" r="46" /><motion.circle className={s.ringFill} cx="56" cy="56" r="46" strokeDasharray={`${circumference} ${circumference}`} initial={{ strokeDashoffset: circumference }} whileInView={{ strokeDashoffset: circumference * (1 - (state?.barPercent ?? 0) / 100) }} viewport={{ once: true }} transition={{ duration: reducedMotion ? 0 : 1.1, ease: [.22, 1, .36, 1] }} /></svg>
    <div className={s.ringLabel}><strong>{percentage(value, limit)}</strong><span>{state ? 'USED' : 'NO READING'}</span></div>
  </div>
}
export default function UsagePanel({ initialCapacity }: { initialCapacity: LiveCapacity | null }) {
  const [capacity, setCapacity] = useState(initialCapacity)
  const [capacityBusy, setCapacityBusy] = useState(false)
  const [capacityError, setCapacityError] = useState(initialCapacity ? '' : 'Live capacity could not be loaded. Refresh to try again.')
  const capacityPending = useRef(false), lastAttempt = useRef(0)
  const refreshCapacity = useCallback(async (signal?: AbortSignal) => {
    if (capacityPending.current) return false
    capacityPending.current = true; lastAttempt.current = Date.now(); setCapacityBusy(true)
    try {
      const response = await fetch('/api/account/usage/capacity', { cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) })
      const result = await response.json()
      if (!response.ok) throw new Error('Live capacity is unavailable.')
      const next = parseLiveCapacity(result)
      if (signal?.aborted) return false
      setCapacity(next); setCapacityError(''); return true
    } catch {
      if (!signal?.aborted) setCapacityError('Live capacity could not be refreshed. The last successful reading is still shown, if available.')
      return false
    } finally { capacityPending.current = false; if (!signal?.aborted) setCapacityBusy(false) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    lastAttempt.current = Date.now()
    const refresh = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAttempt.current >= 60_000) void refreshCapacity(controller.signal)
    }
    const timer = window.setInterval(refresh, 300_000)
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [refreshCapacity])
  const database = quotaState(capacity?.databaseBytes, 500_000_000)
  const storage = quotaState(capacity?.storageBytes, 1_000_000_000)
  const percentages = [database, storage].filter(value => value !== null).map(value => value.percent)
  const highest = percentages.length ? Math.max(...percentages) : null

  return <Shell><div className={s.page}>
    <Link href="/profile" className={s.back}><ArrowLeft size={15} /> Back to profile</Link>
    <header className={s.hero}>
      <div><p className={s.eyebrow}>VANTRA / CONTROL ROOM</p><h1>Small footprint.<br /><span>Room to grow.</span></h1><p className={s.description}>Your project’s database and file storage, measured automatically. A private view of your Supabase Free plan capacity.</p></div>
      <span className={s.owner}><LockKeyhole size={14} /> OWNER ONLY</span>
    </header>
    <div className={s.summary}>
      <div><span className={s.cardLabel}>CONFIGURED PLAN</span><strong>Free<span className={s.redDot} /></strong><p>Database & file storage</p></div>
      <div><span className={s.cardLabel}>LAST MEASUREMENT</span><strong className={s.cycle}>{timestamp(capacity?.observedAt ?? null)}</strong><p>Automatic refresh · up to 1 minute of server cache</p></div>
      <div className={s.summaryUsage}><div><span className={s.cardLabel}>HIGHEST CAPACITY USAGE</span><strong>{highest == null ? '—' : number(highest) + '%'}</strong><p>{highest == null ? 'No measurement available' : highest >= 100 ? 'An allowance has been reached' : highest >= 80 ? 'An allowance is getting close' : 'Plenty of room to grow'}</p></div><UsageRing value={highest} limit={100} compact /></div>
    </div>
    <section className={s.section} aria-labelledby="capacity-heading">
      <div className={s.sectionHeading}><div><p className={s.eyebrow}>AUTOMATIC CAPACITY</p><h2 id="capacity-heading">Space for the stories<span>.</span></h2></div><a className={s.button} href={dashboard} target="_blank" rel="noopener noreferrer">Supabase dashboard<ArrowUpRight size={15} /></a></div>
      <div className={s.autoStatus}><div role="status"><span className={s.snapshotBadge} data-stale={!!capacityError}>{capacityBusy ? 'Refreshing capacity…' : capacityError ? 'Automatic refresh unavailable' : 'Automatic · read-only'}</span><p>Refreshes on open, every 5 minutes while visible and when you return.</p></div><button className={s.button} onClick={() => void refreshCapacity()} disabled={capacityBusy}><RefreshCw size={14} className={capacityBusy ? s.spin : undefined} />Refresh capacity</button></div>
      {capacityError && <p className={s.error} role="alert">{capacityError}</p>}
      <div className={s.capacityGrid}>
        <article className={s.capacity}>
          <div className={s.capacityTitle}><Database size={20} /><h3>Database size</h3><span>VANTRA PROJECT</span></div>
          <div className={s.capacityBody}><div><span className={s.cardLabel}>SPACE USED</span><strong>{size(capacity?.databaseBytes ?? null)}</strong><p className={s.metricLimit}>of <strong>500 MB</strong> included</p><span className={s.capacityRemaining}>{database ? size(database.remaining) + ' available' : 'Not reported'}</span></div><UsageRing value={capacity?.databaseBytes} limit={500_000_000} /></div>
          <p>Current Postgres database size, including indexes and system data. Billing uses a period average; total disk usage also includes other files.</p>
        </article>
        <article className={s.capacity}>
          <div className={s.capacityTitle}><HardDrive size={20} /><h3>Stored files</h3><span>VANTRA PROJECT</span></div>
          <div className={s.capacityBody}><div><span className={s.cardLabel}>SPACE USED</span><strong>{size(capacity?.storageBytes ?? null)}</strong><p className={s.metricLimit}>of <strong>1 GB</strong> included</p><span className={s.capacityRemaining}>{storage ? size(storage.remaining) + ' available' : 'Not reported'}</span></div><UsageRing value={capacity?.storageBytes} limit={1_000_000_000} /></div>
          <p>Current project file sizes from object metadata, compared with the organization allowance. Other projects are not included; billing uses a period average.</p>
        </article>
      </div>
      <p className={s.footnote}>Deleting database rows may not immediately shrink physical size. Unavailable measurements remain blank.</p>
    </section>
    <aside className={s.info}><LockKeyhole size={19} /><div><h3>Automatic. Private. Lightweight.</h3><p>Only your account can access these measurements. One read-only query and a short cache keep the panel lightweight, with no measurement history written to the database.</p><p>For monthly traffic and other billing totals, open the Supabase dashboard.</p></div></aside>
  </div></Shell>
}
