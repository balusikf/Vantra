'use client'

import { useState } from 'react'
import { useAccount } from '@/components/vantra/AccountProvider'
import NookCompanion, { useNookReactions } from './NookCompanion'
import NookPicker from './NookPicker'
import { useNook } from './NookProvider'
import n from './nook.module.css'

function HomeCompanion({ userId, paused }: { userId: string | null; paused: boolean }) {
  const mood = useNookReactions('Good stories are even better with a little company.')
  const [busy, setBusy] = useState(false)
  return <section className={n.home} aria-labelledby="nook-home-heading" data-nook-home="">
    <div className={n.homeCopy}><p className={n.eyebrow}><span /> A LITTLE COMPANY</p><h2 id="nook-home-heading">Meet Nook<span>.</span></h2><p>Your tiny companion for a good night in.<br />A little playful. Surprisingly good at picking what’s next.</p></div>
    <div className={n.homeCompanion}><NookCompanion reaction={mood.reaction} speech={mood.speech} interact={mood.interact} paused={paused} busy={busy} /></div>
    <div className={n.homeSelection}>
      <NookPicker userId={userId} inline active={!paused} respond={mood.respond} reactToGenres={mood.reactToGenres} onBusyChange={setBusy} />
      <span className={n.homeNote}>Pick from your list, or discover a new story for tonight.</span>
    </div>
  </section>
}

export default function NookHome() {
  const { user } = useAccount()
  const nook = useNook()
  // Account changes discard both the private picker pool and its displayed result.
  return <HomeCompanion key={user?.id || 'guest'} userId={user?.id || null} paused={nook.open} />
}
