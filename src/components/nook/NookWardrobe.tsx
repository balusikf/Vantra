'use client'

import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, Shirt } from 'lucide-react'
import { bareNook, nookAccessoryNames, type NookAccessory } from '@/lib/nook-cosmetics'
import { useNook } from './NookProvider'
import NookIcon from './NookIcon'
import s from './nook-wardrobe.module.css'

const choices: NookAccessory[] = ['beanie', 'glasses', 'bow']

export default function NookWardrobe() {
  const { accessories, dress } = useNook()
  const [open, setOpen] = useState(false)
  const content = useId()
  const reduce = useReducedMotion()
  const count = choices.filter(key => accessories[key]).length

  return <div className={s.wardrobe} data-nook-wardrobe="">
    <button className={s.toggle} type="button" aria-expanded={open} aria-controls={content} onClick={() => setOpen(value => !value)}><span><Shirt size={14} /> Style Nook {count > 0 && <b>{count}</b>}</span><ChevronDown size={13} className={open ? s.turned : undefined} /></button>
    <AnimatePresence initial={false}>
      {open && <motion.div id={content} initial={{ height: reduce ? 'auto' : 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: reduce ? 'auto' : 0, opacity: 0 }} transition={{ duration: reduce ? 0 : .23, ease: [.22, 1, .36, 1] }} className={s.drawer}>
        <fieldset className={s.options}><legend>Little extras. Same Nook.</legend>
          <div className={s.grid}>{choices.map(key => <button type="button" key={key} className={s.option} aria-pressed={accessories[key]} onClick={() => dress(previous => ({ ...previous, [key]: !previous[key] }))}>
            <span className={s.preview}><NookIcon size={60} items={{ ...bareNook, [key]: true }} /></span>
            <span>{nookAccessoryNames[key]}</span><span className={s.check} aria-hidden="true">{accessories[key] && <Check size={11} />}</span>
          </button>)}</div>
        </fieldset>
        <div className={s.bottom}><p>Applies to every Nook.<br />Remembered on this browser when storage is available.</p><button type="button" disabled={!count} onClick={() => dress(() => bareNook)}>Remove all</button></div>
      </motion.div>}
    </AnimatePresence>
  </div>
}
