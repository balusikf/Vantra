'use client'

import NookIcon from './NookIcon'
import { useNook } from './NookProvider'
import n from './nook.module.css'

export default function NookTrigger({ onOpen }: { onOpen: () => void }) {
  const nook = useNook()
  return <button type="button" className={n.trigger} aria-label="Meet Nook" aria-haspopup="dialog" aria-expanded={nook.open} onClick={event => { onOpen(); nook.show(event.currentTarget) }}><NookIcon /><span className={n.tooltip}>Meet Nook</span></button>
}
