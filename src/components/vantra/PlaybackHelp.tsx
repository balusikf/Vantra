'use client'

import { useEffect, useRef } from 'react'
import { ArrowRight, Captions, CircleHelp, RefreshCw, ShieldCheck, X } from 'lucide-react'
import type { StreamProvider } from '@/lib/stream-providers'
import s from './playback.module.css'

export default function PlaybackHelp({ open, active, next, onClose, onNext, onReload }: {
  open: boolean
  active: StreamProvider | null
  next: StreamProvider | null
  onClose: () => void
  onNext: () => void
  onReload: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (open && !element?.open) element?.showModal()
    if (!open && element?.open) element.close()
  }, [open])

  return <dialog ref={dialog} className={s.helpDialog} aria-labelledby="playback-help-title" onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className={s.helpTop}><span><CircleHelp size={15} /> PLAYBACK HELP</span><button aria-label="Close playback help" onClick={onClose}><X size={19} /></button></div>
    <div className={s.helpBody}>
      <p className={s.helpEyebrow}>A LITTLE INTERMISSION</p>
      <h2 id="playback-help-title">Back to your story<span>.</span></h2>
      <p className={s.helpIntro}>Black screen, frozen picture or no sound? A fresh source is usually the best place to start.</p>
      {active && <div className={s.currentSource}><span>CURRENT SOURCE</span><strong><i />{active.name}</strong></div>}
      <div className={s.helpActions}>
        <button className={s.helpPrimary} disabled={!next} onClick={() => { onNext(); onClose() }}><span>Try another source<small>{next ? `Switch to ${next.name}` : 'No other source available for this title'}</small></span><ArrowRight size={19} /></button>
        <button className={s.helpSecondary} disabled={!active} onClick={() => { onReload(); onClose() }}><RefreshCw size={16} /> Reload current player</button>
      </div>
      <div className={s.helpTips}>
        <div><Captions size={17} /><p><strong>Sound & subtitles</strong>Look for audio and subtitle options in the player’s own settings. Availability varies by source.</p></div>
        <div><ShieldCheck size={17} /><p><strong>Keep unwanted tabs away</strong>Some sources contain ads. An ad blocker is recommended. Ignore download and sign-up prompts inside ads.</p></div>
      </div>
      <p className={s.helpFootnote}>You decide when to switch. We can’t inspect playback inside an external player.</p>
    </div>
  </dialog>
}
