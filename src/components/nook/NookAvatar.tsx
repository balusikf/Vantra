'use client'

import { memo, useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { BotEngine } from '@/vendor/bloub/engine'
import type { DotRender } from '@/vendor/bloub/decor'
import { EXPRESSION_BY_ID } from '@/vendor/bloub/expressions'
import { SHAPE_BY_ID, mixHex } from '@/vendor/bloub/skins'
import { RAYON, DEMI_VIEWBOX as VB } from '@/vendor/bloub/repere'
import { POSES, STATE_BY_ID, type StateId } from '@/vendor/bloub/states'
import { nookGaze, nookBreathing, NookIdleClock } from '@/lib/nook-behavior'
import { blendNookPose, nookGestureDuration, nookGesturePose, nookGestureTransform, nookPersonalities, nookGenreVariants, NookVariantDeck, type NookEmotion, type NookGesture, type NookReaction, type NookCue } from '@/lib/nook-personality'
import type { ShapeId } from '@/vendor/bloub/skins'
import { useNook } from './NookProvider'
import NookOutfit from './NookOutfit'

const ink = '#ed2638', paper = '#fff1f2'

function personality(engine: BotEngine, emotion: NookEmotion, now: number, variation: NookCue = {}) {
  const config = nookPersonalities[emotion]
  engine.setExpression(EXPRESSION_BY_ID.get(variation.expression ?? config.expression)!, now)
  engine.setShape(SHAPE_BY_ID.get(variation.shape ?? config.shape)!.radii, now)
}

function Dot({ dot }: { dot: DotRender }) {
  const fill = dot.color ?? (dot.depth === undefined ? ink : mixHex('#161619', ink, dot.depth))
  return dot.d ? <path d={dot.d} transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})`} fill={fill} opacity={dot.opacity} /> : <circle cx={dot.x} cy={dot.y} r={dot.r} fill={fill} opacity={dot.opacity} />
}

function NookAvatar({ reaction, paused = false, idleEnabled = true, holdEmotion = false }: { reaction: NookReaction; paused?: boolean; idleEnabled?: boolean; holdEmotion?: boolean }) {
  const { accessories } = useNook()
  const id = useId().replace(/:/g, '')
  const svg = useRef<SVGSVGElement>(null)
  const [engine] = useState(() => new BotEngine(RAYON, 'idle', SHAPE_BY_ID.get('galet')!.radii, EXPRESSION_BY_ID.get('attentif')!))
  const [rendered, setRendered] = useState(() => ({ frame: engine.sample(0), state: 'idle' as StateId, shape: 'galet' as ShapeId, breathing: nookBreathing(0, 1), emotion: 'attentive' as NookEmotion, gesture: 'none' as NookGesture, gestureTransform: nookGestureTransform(nookGesturePose('none', 0)) }))
  const [idleDeck] = useState(() => new NookVariantDeck())
  const frame = rendered.frame
  const clock = useRef(0)
  const endAt = useRef(Infinity)
  const current = useRef<StateId>('idle')
  const idleClock = useRef<NookIdleClock | null>(null)
  const breathAmount = useRef(1)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const emotion = useRef<NookEmotion>('attentive')
  const shape = useRef<ShapeId>('galet')
  const emotionUntil = useRef(Infinity)
  const lastPose = useRef(nookGesturePose('none', 0))
  const motion = useRef({ kind: 'none' as NookGesture, start: 0, from: nookGesturePose('none', 0) })
  const reduce = useReducedMotion()

  useEffect(() => {
    // Upstream ignores setState(current). A same-frame transition through idle
    // preserves its composite pose while replaying a repeated trick.
    if (current.current === reaction.state && reaction.state !== 'idle' && reaction.state !== 'thinking') engine.setState('idle', clock.current)
    engine.setState(reaction.state, clock.current)
    current.current = reaction.state
    emotion.current = reaction.emotion || 'attentive'
    personality(engine, emotion.current, clock.current, reaction)
    shape.current = reaction.shape ?? nookPersonalities[emotion.current].shape
    motion.current = { kind: reaction.gesture || nookPersonalities[emotion.current].gesture, start: clock.current, from: lastPose.current }
    emotionUntil.current = holdEmotion || reaction.state === 'thinking' || emotion.current === 'attentive' ? Infinity : clock.current + 7
    endAt.current = reaction.state === 'idle' || reaction.state === 'thinking' ? Infinity : clock.current + STATE_BY_ID.get(reaction.state)!.duration
    if (!idleClock.current) idleClock.current = new NookIdleClock()
    idleClock.current.postpone(clock.current)
  }, [engine, reaction, holdEmotion])

  useEffect(() => {
    const element = svg.current
    if (!element) return
    let raf = 0, last = 0, inView = false, disposed = false, listening = false, pointerDirty = true
    function follow(event: PointerEvent) {
      if (event.pointerType === 'touch') return
      pointer.current = { x: event.clientX, y: event.clientY }; pointerDirty = true
    }
    function release() { pointer.current = null; engine.setLook(null, clock.current) }
    function moved() { pointerDirty = true }
    function listen(enabled: boolean) {
      if (listening === enabled) return
      listening = enabled
      if (enabled) {
        window.addEventListener('pointermove', follow, { passive: true })
        window.addEventListener('scroll', moved, { passive: true, capture: true })
        window.addEventListener('resize', moved, { passive: true })
        window.addEventListener('blur', release)
        document.addEventListener('pointerleave', release)
      } else {
        window.removeEventListener('pointermove', follow)
        window.removeEventListener('scroll', moved, true)
        window.removeEventListener('resize', moved)
        window.removeEventListener('blur', release)
        document.removeEventListener('pointerleave', release)
      }
    }
    function tick(timestamp: number) {
      if (disposed) return
      // Visibility/intersection changes reset `last`. Preserve real elapsed
      // visible time on slower devices instead of stretching every reaction.
      const delta = last ? Math.max((timestamp - last) / 1000, 0) : 0
      clock.current += delta
      last = timestamp
      if (clock.current >= endAt.current) {
        engine.setState('idle', clock.current); current.current = 'idle'; endAt.current = Infinity
        idleClock.current?.postpone(clock.current)
      }
      if (clock.current >= emotionUntil.current) {
        emotion.current = 'attentive'; emotionUntil.current = Infinity
        shape.current = 'galet'
        personality(engine, 'attentive', clock.current)
      }
      const beat = idleClock.current?.sample(clock.current, current.current, idleEnabled)
      if (beat === 'happy' || beat === 'curious' || beat === 'tired') {
        const variants = nookGenreVariants[beat === 'happy' ? 'comedy' : beat === 'tired' ? 'cozy' : 'discovery']
        const variation = idleDeck.choose(`idle:${beat}`, variants)
        emotion.current = beat; personality(engine, beat, clock.current, variation); emotionUntil.current = clock.current + 7
        shape.current = variation.shape ?? nookPersonalities[beat].shape
        motion.current = { kind: variation.gesture ?? nookPersonalities[beat].gesture, start: clock.current, from: lastPose.current }
      } else if (beat) {
        engine.setState(beat, clock.current); current.current = beat; endAt.current = clock.current + STATE_BY_ID.get(beat)!.duration
      }
      if (pointerDirty && pointer.current) {
        const look = nookGaze(pointer.current, element!.getBoundingClientRect())
        if (look) engine.setLook(look, clock.current)
        pointerDirty = false
      }
      const elapsed = clock.current - motion.current.start
      const gesture: NookGesture = elapsed < nookGestureDuration[motion.current.kind] ? motion.current.kind : 'none'
      const pose = blendNookPose(motion.current.from, nookGesturePose(motion.current.kind, elapsed), elapsed / .09)
      lastPose.current = pose
      breathAmount.current += ((current.current === 'idle' && gesture === 'none' ? 1 : 0) - breathAmount.current) * Math.min(delta * 5, 1)
      setRendered({ frame: engine.sample(clock.current), state: current.current, shape: shape.current, breathing: nookBreathing(clock.current, breathAmount.current), emotion: emotion.current, gesture, gestureTransform: nookGestureTransform(pose) })
      raf = requestAnimationFrame(tick)
    }
    function sync() {
      cancelAnimationFrame(raf); last = 0
      const active = !disposed && inView && !paused && !reduce && document.visibilityState === 'visible'
      listen(active)
      element!.setAttribute('data-nook-active', String(active))
      if (active) { pointerDirty = true; raf = requestAnimationFrame(tick) }
    }
    const observer = new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting || false; sync() })
    observer.observe(element)
    document.addEventListener('visibilitychange', sync)
    // Reduced motion uses the upstream's representative static pose, without RAF.
    if (reduce) {
      const mood = reaction.emotion || 'attentive', config = nookPersonalities[mood]
      const silhouette = reaction.shape ?? config.shape
      const still = new BotEngine(RAYON, reaction.state, SHAPE_BY_ID.get(silhouette)!.radii, EXPRESSION_BY_ID.get(reaction.expression ?? config.expression)!)
      queueMicrotask(() => { if (!disposed) setRendered({ frame: still.sample(POSES[reaction.state]), state: reaction.state, shape: silhouette, breathing: nookBreathing(0, 0), emotion: mood, gesture: 'none', gestureTransform: nookGestureTransform(nookGesturePose('none', 0)) }) })
    }
    return () => { disposed = true; cancelAnimationFrame(raf); listen(false); element.setAttribute('data-nook-active', 'false'); observer.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [engine, paused, reduce, reaction, idleEnabled, idleDeck])

  return <svg ref={svg} viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`} aria-hidden="true" data-nook-avatar="" data-nook-state={rendered.state} data-nook-shape={rendered.shape} data-nook-emotion={rendered.emotion} data-nook-gesture={rendered.gesture}>
    <defs>
      <clipPath id={`${id}-body-clip`}><path d={frame.bodyPath} /></clipPath>
      <linearGradient id={`${id}-body`} x1="0%" y1="0%" x2="80%" y2="100%"><stop stopColor="#ff6470" /><stop offset=".45" stopColor={ink} /><stop offset="1" stopColor="#c90926" /></linearGradient>
      <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x={-VB} y={-VB} width={VB * 2} height={VB * 2}>
        <path d={frame.bodyPath} fill="#fff" />
        {frame.eyes.map((eye, i) => <path key={i} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />)}
        {frame.notch && <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" />}
      </mask>
      {frame.arcs.map(arc => <linearGradient key={arc.id} id={`${id}-${arc.id}`} gradientUnits="userSpaceOnUse" x1={arc.grad.x1} y1={arc.grad.y1} x2={arc.grad.x2} y2={arc.grad.y2}>{arc.grad.stops.map((color, i) => <stop key={i} offset={i / (arc.grad.stops.length - 1)} stopColor={color} />)}</linearGradient>)}
    </defs>
    <g transform={rendered.breathing}>
    <g transform={rendered.gestureTransform}>
    <g fill="none" strokeLinecap="round">{frame.arcs.map(arc => <path key={arc.id} d={arc.back} stroke={`url(#${id}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} />)}</g>
    {frame.dotsBehind && frame.dots.map((dot, i) => <Dot key={i} dot={dot} />)}
    <g opacity={frame.bodyAlpha}><path d={frame.bodyPath} fill={paper} /><g mask={`url(#${id}-mask)`}><rect x={-VB} y={-VB} width={VB * 2} height={VB * 2} fill={`url(#${id}-body)`} /></g></g>
    <NookOutfit items={accessories} frame={frame} state={rendered.state} clipId={`${id}-body-clip`} />
    {!frame.dotsBehind && frame.dots.map((dot, i) => <Dot key={i} dot={dot} />)}
    {frame.notif && <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill={ink} />}
    <g fill="none" strokeLinecap="round">{frame.arcs.map(arc => <path key={arc.id} d={arc.front} stroke={`url(#${id}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} />)}</g>
    </g>
    </g>
  </svg>
}

export default memo(NookAvatar)
