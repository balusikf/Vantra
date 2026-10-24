'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useIsPresent, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { lockBodyScroll } from '@/lib/body-scroll-lock'
import NookCompanion, { useNookReactions } from './NookCompanion'
import NookPicker from './NookPicker'
import n from './nook.module.css'

export default function NookPanel({ userId, onClose, returnFocus }: { userId: string | null; onClose: () => void; returnFocus: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const mood = useNookReactions()
  const [busy, setBusy] = useState(false)
  const reduce = useReducedMotion()
  const present = useIsPresent()

  useEffect(() => {
    const element = dialog.current!
    element.showModal(); close.current?.focus({ preventScroll: true })
    const unlock = lockBodyScroll()
    window.addEventListener('popstate', onClose)
    return () => { element.close(); unlock(); window.removeEventListener('popstate', onClose); returnFocus() }
  }, [onClose, returnFocus])

  return <motion.dialog ref={dialog} className={n.dialog} aria-labelledby="nook-heading" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}
    initial={{ opacity: 0, y: reduce ? 0 : -10, scale: reduce ? 1 : .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : .98 }} transition={{ duration: reduce ? 0 : .24, ease: [.22, 1, .36, 1] }}>
    <div className={n.panelInner}>
      <header className={n.panelHeader}><div><p className={n.eyebrow}>YOUR LITTLE VANTRA COMPANION</p><h2 id="nook-heading">A moment with Nook<span>.</span></h2></div><button type="button" ref={close} className={n.close} onClick={onClose} aria-label="Close Nook"><X size={19} /></button></header>
      <NookCompanion reaction={mood.reaction} speech={mood.speech} interact={mood.interact} busy={busy} paused={!present} />
      <NookPicker userId={userId} active={present} respond={mood.respond} reactToGenres={mood.reactToGenres} onBusyChange={setBusy} onNavigate={onClose} />
      <footer className={n.panelFooter}><span>Small companion. Good company.</span><span><kbd>esc</kbd> to close</span></footer>
    </div>
  </motion.dialog>
}
