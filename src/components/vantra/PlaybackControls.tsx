'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, RefreshCw, Settings2, X } from 'lucide-react'
import s from './playback.module.css'

interface Provider { name: string; url: string }

const sourcesWithAds = new Set(['VidCore', 'VidNest', 'VidFast'])

export default function PlaybackControls({ providers, activeProvider, onProviderChange, onReload, onBack }: {
  providers: Provider[]
  activeProvider: Provider | null
  onProviderChange: (provider: Provider) => void
  onReload: () => void
  onBack: () => void
}) {
  const [visible, setVisible] = useState(true)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const controls = useRef<HTMLDivElement>(null)
  const sourceTrigger = useRef<HTMLButtonElement>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const wake = useCallback(() => {
    setVisible(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (!sourcesOpen) idleTimer.current = setTimeout(() => {
      // Keep keyboard navigation and an actively used control visible.
      if (!controls.current?.matches(':hover') && !controls.current?.querySelector(':focus-visible')) setVisible(false)
    }, 2800)
  }, [sourcesOpen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSourcesOpen(false)
        if (sourcesOpen) sourceTrigger.current?.focus()
      }
      wake()
    }
    // Pointer events inside a third-party video iframe cannot cross its origin.
    // The top-edge reveal button remains available when that iframe has focus.
    window.addEventListener('pointermove', wake, { passive: true })
    window.addEventListener('pointerdown', wake, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('focus', wake)
    const initialTimer = setTimeout(wake, 0)
    return () => {
      clearTimeout(initialTimer)
      if (idleTimer.current) clearTimeout(idleTimer.current)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('focus', wake)
    }
  }, [wake, sourcesOpen])

  return <>
    <button className={s.reveal} aria-label="Show playback controls" tabIndex={visible ? -1 : 0} onPointerEnter={wake} onClick={wake}><span>Show controls</span></button>
    <div ref={controls} className={s.controls} data-visible={visible || sourcesOpen} onPointerLeave={wake} onFocusCapture={wake}>
      <button className={s.back} onClick={onBack}><ArrowLeft size={18} /><span>Back</span></button>
      <div className={s.sourceControls}>
        <button ref={sourceTrigger} className={s.sourceTrigger} aria-label="Playback sources" aria-expanded={sourcesOpen} aria-controls="playback-sources" onClick={() => setSourcesOpen(open => !open)}>{sourcesOpen ? <X size={18} /> : <Settings2 size={18} />}</button>
        {sourcesOpen && <section id="playback-sources" className={s.sourcePanel} aria-label="Playback sources">
          <p>Playback source</p>
          <div className={s.sourceList}>{providers.length ? providers.map(provider => <button key={provider.name} aria-pressed={activeProvider?.name === provider.name} onClick={() => { onProviderChange(provider); setSourcesOpen(false); sourceTrigger.current?.focus() }}><span>{provider.name}</span><span className={s.sourceIndicators}>{sourcesWithAds.has(provider.name) && <span className={s.adsBadge} title="Contains advertisements"><span aria-hidden="true">ADS</span><span className="sr-only">Contains advertisements</span></span>}{activeProvider?.name === provider.name && <Check size={15} aria-hidden="true" />}</span></button>) : <span>No sources loaded yet.</span>}</div>
          <button className={s.reload} disabled={!activeProvider} onClick={() => { onReload(); setSourcesOpen(false); sourceTrigger.current?.focus() }}><RefreshCw size={14} /> Reload player</button>
        </section>}
      </div>
    </div>
  </>
}
