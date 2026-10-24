import type { ExpressionId } from '@/vendor/bloub/expressions'
import type { ShapeId } from '@/vendor/bloub/skins'
import type { StateId } from '@/vendor/bloub/states'

export type NookEmotion = 'attentive' | 'happy' | 'scared' | 'tired' | 'curious' | 'shy' | 'thoughtful' | 'suspicious' | 'excited' | 'dreamy' | 'proud' | 'sad' | 'angry'
export type NookGesture = 'none' | 'pat' | 'happy' | 'scared' | 'tired' | 'curious' | 'shy' | 'laugh' | 'dance' | 'float' | 'peek' | 'scan' | 'brave' | 'nod' | 'grumble'
export const nookPersonalities: Record<NookEmotion, { expression: ExpressionId; shape: ShapeId; gesture: NookGesture }> = {
  attentive: { expression: 'attentif', shape: 'galet', gesture: 'none' },
  happy: { expression: 'heureux', shape: 'squircle', gesture: 'happy' },
  scared: { expression: 'effraye', shape: 'goutte', gesture: 'scared' },
  tired: { expression: 'somnolent', shape: 'galet', gesture: 'tired' },
  curious: { expression: 'curieux', shape: 'galet', gesture: 'curious' },
  shy: { expression: 'timide', shape: 'goutte', gesture: 'shy' },
  thoughtful: { expression: 'attentif', shape: 'squircle', gesture: 'curious' },
  suspicious: { expression: 'mefiant', shape: 'hexagone', gesture: 'scan' },
  excited: { expression: 'excite', shape: 'triangle', gesture: 'brave' },
  dreamy: { expression: 'surpris', shape: 'nuage', gesture: 'float' },
  proud: { expression: 'fier', shape: 'hexagone', gesture: 'nod' },
  sad: { expression: 'triste', shape: 'goutte', gesture: 'tired' },
  angry: { expression: 'colere', shape: 'triangle', gesture: 'grumble' },
}

export type NookGenre = 'horror' | 'thriller' | 'mystery' | 'romance' | 'music' | 'comedy' | 'family' | 'cozy' | 'scifi' | 'fantasy' | 'action' | 'sport' | 'documentary' | 'history' | 'drama' | 'discovery'
export function nookGenreFromGenres(value: unknown): NookGenre {
  const genres = Array.isArray(value) ? value.flatMap(item => {
    const name = typeof item === 'string' ? item : item && typeof item.name === 'string' ? item.name : null
    return name ? [name.trim().toLowerCase()] : []
  }) : []
  const has = (...names: string[]) => names.some(name => genres.includes(name))
  // Specific genres win over broad ones, independently of the API's ordering.
  if (has('horror')) return 'horror'
  if (has('thriller', 'psychological')) return 'thriller'
  if (has('mystery', 'crime')) return 'mystery'
  if (has('romance')) return 'romance'
  if (has('music', 'musical')) return 'music'
  if (has('comedy')) return 'comedy'
  if (has('family', 'kids')) return 'family'
  if (has('slice of life', 'iyashikei')) return 'cozy'
  if (has('sci-fi', 'science fiction', 'mecha')) return 'scifi'
  if (has('fantasy', 'supernatural', 'sci-fi & fantasy', 'mahou shoujo')) return 'fantasy'
  if (has('sports', 'sport')) return 'sport'
  if (has('action', 'adventure', 'action & adventure', 'war', 'war & politics', 'western')) return 'action'
  if (has('documentary')) return 'documentary'
  if (has('history')) return 'history'
  if (has('drama')) return 'drama'
  return 'discovery'
}

export const nookGenreEmotions: Record<NookGenre, NookEmotion> = { horror: 'scared', thriller: 'scared', mystery: 'suspicious', romance: 'shy', music: 'happy', comedy: 'happy', family: 'happy', cozy: 'tired', scifi: 'curious', fantasy: 'dreamy', action: 'excited', sport: 'proud', documentary: 'thoughtful', history: 'thoughtful', drama: 'thoughtful', discovery: 'curious' }
export function nookEmotionFromGenres(value: unknown): NookEmotion { return nookGenreEmotions[nookGenreFromGenres(value)] }

export type NookReaction = { state: StateId; serial: number; emotion?: NookEmotion; gesture?: NookGesture; shape?: ShapeId; expression?: ExpressionId; selection?: string }
export type NookCue = Omit<NookReaction, 'serial' | 'state'> & { state?: StateId; speech?: string }
export type NookConversation = { reaction: NookReaction; speech: string }

// Speech and animation commit together. A slow genre lookup cannot replace a
// newer pick, pat or trick. Updaters stay pure even under React Strict Mode.
export function advanceNookConversation(previous: NookConversation, cue: NookCue, expectedSelection?: string): NookConversation {
  if (expectedSelection !== undefined && previous.reaction.selection !== expectedSelection) return previous
  const { speech, state, emotion, shape, expression, gesture, selection } = cue
  return { speech: speech ?? previous.speech, reaction: { state: state ?? 'idle', emotion, shape, expression, gesture, selection, serial: previous.reaction.serial + 1 } }
}

export type NookVariant = NookCue & { id: string; speech: string }
const variant = (id: string, emotion: NookEmotion, shape: ShapeId, expression: ExpressionId, gesture: NookGesture, speech: string, state: StateId = 'idle'): NookVariant => ({ id, emotion, shape, expression, gesture, speech, state })

export const nookGenreVariants: Record<NookGenre, readonly NookVariant[]> = {
  horror: [
    variant('horror-shiver', 'scared', 'goutte', 'effraye', 'scared', 'Horror? Brave choice. I’ll be right here, trying not to wobble.'),
    variant('horror-peek', 'scared', 'capsule', 'mefiant', 'peek', 'Something spooky. I’ll peek first. You tell me when it’s safe.'),
    variant('horror-cloud', 'scared', 'nuage', 'effraye', 'scared', 'A scary story. If I turn into a nervous little cloud, you know why.'),
  ],
  thriller: [
    variant('thriller-peek', 'scared', 'capsule', 'mefiant', 'peek', 'Something tense. I’ll stay low and keep my eyes open.'),
    variant('thriller-shiver', 'scared', 'goutte', 'effraye', 'scared', 'A little suspense. That wobble? Just my nerves warming up.'),
    variant('thriller-scan', 'scared', 'hexagone', 'mefiant', 'scan', 'A tense story tonight. I’m preparing my most suspicious little face.'),
  ],
  mystery: [
    variant('mystery-scan', 'suspicious', 'hexagone', 'mefiant', 'scan', 'A mystery. Everyone is a suspect. Except you. Probably.'),
    variant('mystery-tilt', 'suspicious', 'triangle', 'confus', 'curious', 'A puzzle for tonight. Tiny detective, very big questions.'),
    variant('mystery-peek', 'suspicious', 'galet', 'curieux', 'peek', 'Something to investigate. I’ll keep an eye on the suspicious ones.'),
  ],
  romance: [
    variant('romance-blush', 'shy', 'goutte', 'timide', 'shy', 'Romance? Oh. Suddenly I don’t know where to look.'),
    variant('romance-cloud', 'shy', 'nuage', 'heureux', 'float', 'A love story. I may get a little soft around the edges.'),
    variant('romance-sway', 'shy', 'cercle', 'timide', 'dance', 'Romance tonight. I’m rooting for the butterflies.'),
  ],
  music: [
    variant('music-dance', 'happy', 'capsule', 'excite', 'dance', 'Music? My tiny dance floor is officially open.'),
    variant('music-bounce', 'happy', 'squircle', 'hilare', 'happy', 'A musical night. I brought the bounce. You bring the rhythm.'),
    variant('music-cloud', 'happy', 'nuage', 'heureux', 'dance', 'Music selected. Please excuse the enthusiastic wiggling.'),
  ],
  comedy: [
    variant('comedy-laugh', 'happy', 'squircle', 'hilare', 'laugh', 'Comedy. Excellent. My serious face needed a break.'),
    variant('comedy-jelly', 'happy', 'capsule', 'hilare', 'laugh', 'Something fun. I’m already a little wobbly with anticipation.'),
    variant('comedy-hop', 'happy', 'cercle', 'heureux', 'happy', 'A lighter kind of night. Permission to be delightfully silly.'),
  ],
  family: [
    variant('family-cloud', 'happy', 'nuage', 'heureux', 'float', 'A family story. There’s room for one more tiny companion, right?'),
    variant('family-round', 'happy', 'cercle', 'excite', 'happy', 'Something for a family night. I’m bringing the cheerful little hops.'),
    variant('family-soft', 'happy', 'squircle', 'heureux', 'dance', 'A family pick. Good company makes a good story even better.'),
  ],
  cozy: [
    variant('cozy-pillow', 'tired', 'capsule', 'somnolent', 'tired', 'A quiet little story. I’ll become the world’s smallest pillow.'),
    variant('cozy-cloud', 'tired', 'nuage', 'blase', 'float', 'Slice of life. No rush. Just a soft landing after a long day.'),
    variant('cozy-pebble', 'tired', 'galet', 'somnolent', 'tired', 'Something gentle. Blanket energy, tiny companion included.'),
  ],
  scifi: [
    variant('scifi-scan', 'curious', 'hexagone', 'curieux', 'scan', 'Sci-fi. Coordinates set. Let’s leave this planet for a while.'),
    variant('scifi-float', 'curious', 'cercle', 'surpris', 'float', 'Science fiction. Testing my zero-gravity mode… looking promising.'),
    variant('scifi-probe', 'curious', 'triangle', 'attentif', 'nod', 'A sci-fi night. Small shape, very large universe.'),
  ],
  fantasy: [
    variant('fantasy-cloud', 'dreamy', 'nuage', 'surpris', 'float', 'Fantasy? I knew this evening had a little magic in it.'),
    variant('fantasy-drop', 'dreamy', 'goutte', 'curieux', 'curious', 'A fantasy adventure. I volunteer as the tiny enchanted sidekick.'),
    variant('fantasy-circle', 'dreamy', 'cercle', 'excite', 'float', 'Something magical. Practising my levitation, just in case.'),
  ],
  action: [
    variant('action-hero', 'excited', 'triangle', 'fier', 'brave', 'Action selected. Tiny hero reporting for duty.'),
    variant('action-ready', 'excited', 'hexagone', 'excite', 'brave', 'An adventure. Let me put on my most aerodynamic shape.'),
    variant('action-hop', 'excited', 'squircle', 'excite', 'happy', 'A little adrenaline tonight. I’ll cheer from this very safe spot.'),
  ],
  sport: [
    variant('sport-cheer', 'proud', 'hexagone', 'fier', 'happy', 'Sports night. Tiny cheering section, maximum enthusiasm.'),
    variant('sport-ready', 'proud', 'triangle', 'excite', 'brave', 'A sporting story. Warming up my celebratory bounce.'),
    variant('sport-nod', 'proud', 'cercle', 'fier', 'nod', 'Sports selected. I believe in a good underdog. Especially a small one.'),
  ],
  documentary: [
    variant('documentary-study', 'thoughtful', 'hexagone', 'attentif', 'nod', 'A little discovery tonight. My curious face is ready.'),
    variant('documentary-question', 'thoughtful', 'galet', 'curieux', 'curious', 'Something to learn. I’ve made room for at least three new facts.'),
    variant('documentary-scan', 'thoughtful', 'squircle', 'surpris', 'scan', 'A documentary. Let’s find something worth knowing.'),
  ],
  history: [
    variant('history-study', 'thoughtful', 'hexagone', 'attentif', 'nod', 'A little history. Tiny time traveller, ready when you are.'),
    variant('history-question', 'thoughtful', 'galet', 'curieux', 'curious', 'A story from another time. I have a few very small questions.'),
    variant('history-proud', 'thoughtful', 'triangle', 'fier', 'brave', 'A historical story. Putting on my most distinguished shape.'),
  ],
  drama: [
    variant('drama-support', 'thoughtful', 'galet', 'triste', 'nod', 'A little drama. I’ll bring the emotional support.'),
    variant('drama-soft', 'thoughtful', 'nuage', 'attentif', 'curious', 'A dramatic story. I’m settling in for the feelings.'),
    variant('drama-drop', 'thoughtful', 'goutte', 'triste', 'shy', 'Drama tonight. If the feelings get big, we can be small together.'),
  ],
  discovery: [
    variant('discovery-pebble', 'curious', 'galet', 'curieux', 'curious', 'A new story to discover. Shall we give it a chance?'),
    variant('discovery-cloud', 'curious', 'nuage', 'surpris', 'float', 'Something waiting in your list. Let’s see where it takes us.'),
    variant('discovery-nod', 'curious', 'squircle', 'attentif', 'nod', 'Found a possibility. The best evenings start with a little curiosity.'),
  ],
}

export const nookInteractionVariants = {
  pet: [
    variant('pet-squircle', 'happy', 'squircle', 'heureux', 'pat', 'A little affection. A very good evening.'),
    variant('pet-cloud', 'happy', 'nuage', 'timide', 'pat', 'You’ve turned me into a very content little cloud.'),
    variant('pet-pillow', 'happy', 'capsule', 'hilare', 'pat', 'Squish received. Happiness successfully increased.'),
    variant('pet-drop', 'shy', 'goutte', 'timide', 'pat', 'Oh. That was nice. One tiny happy wobble for you.'),
    variant('pet-round', 'happy', 'cercle', 'heureux', 'pat', 'Round, soft, and very pleased to be here with you.'),
  ],
  five: [
    variant('joy-round', 'happy', 'cercle', 'excite', 'happy', 'Two taps. Two little jumps. That’s my kind of evening.'),
    variant('joy-cloud', 'happy', 'nuage', 'hilare', 'happy', 'Double tap, double joy. Watch the landing!'),
    variant('joy-square', 'proud', 'squircle', 'fier', 'happy', 'A tiny celebration. I practised those two hops just for you.'),
  ],
  trick: [
    variant('trick-egg', 'curious', 'goutte', 'curieux', 'none', 'New shape. Same Nook.', 'egg'),
    variant('trick-orbit', 'curious', 'cercle', 'surpris', 'none', 'Just a little showing off. Please remain in orbit.', 'orbit'),
    variant('trick-comet', 'dreamy', 'goutte', 'excite', 'none', 'A tiny shooting star. Make a wish.', 'comet'),
    variant('trick-burst', 'happy', 'squircle', 'hilare', 'none', 'A tiny burst of happiness. All for you.', 'burst'),
    variant('trick-hexagon', 'proud', 'hexagone', 'fier', 'none', 'Six sides. One very proud little companion.', 'hexagon'),
    variant('trick-swirl', 'dreamy', 'nuage', 'surpris', 'none', 'A little swirl of magic. I’ll untangle myself in a moment.', 'swirl'),
    variant('trick-jelly', 'happy', 'capsule', 'hilare', 'laugh', 'Behold: professional jelly. Years of imaginary training.'),
    variant('trick-levitate', 'dreamy', 'triangle', 'curieux', 'float', 'No strings. Just a very determined little triangle.'),
  ],
} satisfies Record<string, readonly NookVariant[]>

// A private per-companion shuffle bag: use every variant before cycling, and
// never repeat the last one at the boundary. No timers, storage or network.
export class NookVariantDeck {
  private remaining = new Map<string, string[]>()
  private last = new Map<string, string>()
  private random: () => number
  constructor(random = Math.random) { this.random = random }
  choose(key: string, options: readonly NookVariant[]): NookVariant {
    if (!options.length) throw new Error('Nook needs at least one reaction')
    let ids = this.remaining.get(key) ?? []
    if (!ids.length) ids = options.map(option => option.id)
    const candidates = ids.filter(id => ids.length === 1 || id !== this.last.get(key))
    const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(this.random() * candidates.length)))
    const id = candidates[index]
    this.remaining.set(key, ids.filter(value => value !== id)); this.last.set(key, id)
    return options.find(option => option.id === id)!
  }
}

export const nookGestureDuration: Record<NookGesture, number> = { none: 0, pat: .64, happy: 1.35, scared: .7, tired: 3.8, curious: 1.8, shy: 1.5, laugh: 1.6, dance: 2.6, float: 3.2, peek: 2.3, scan: 2.4, brave: 1.5, nod: 1.8, grumble: 1.4 }
export type NookPose = { x: number; y: number; rotate: number; sx: number; sy: number }
const neutral = (): NookPose => ({ x: 0, y: 0, rotate: 0, sx: 1, sy: 1 })
const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3)
const smooth = (t: number) => { const p = Math.max(0, Math.min(1, t)); return p * p * (3 - 2 * p) }

export function nookGesturePose(kind: NookGesture, elapsed: number): NookPose {
  const pose = neutral(), duration = nookGestureDuration[kind]
  if (elapsed <= 0 || elapsed >= duration || !Number.isFinite(elapsed)) return pose
  if (kind === 'pat') {
    const frames = [[0, 1, 1], [.08, 1.22, .74], [.23, .93, 1.1], [.40, 1.04, .97], [.64, 1, 1]]
    const end = frames.findIndex(frame => frame[0] > elapsed), a = frames[end - 1], b = frames[end]
    const k = smooth((elapsed - a[0]) / (b[0] - a[0]))
    pose.sx = a[1] + (b[1] - a[1]) * k; pose.sy = a[2] + (b[2] - a[2]) * k
  } else if (kind === 'happy') {
    // Two distinct little hops, with a soft landing between them.
    if (elapsed < .12) { const k = Math.sin(elapsed / .12 * Math.PI); pose.sx += .08 * k; pose.sy -= .08 * k }
    else if (elapsed < .62) pose.y = -23 * Math.sin((elapsed - .12) / .5 * Math.PI)
    else if (elapsed < .75) { const k = Math.sin((elapsed - .62) / .13 * Math.PI); pose.sx += .1 * k; pose.sy -= .08 * k }
    else if (elapsed < 1.21) pose.y = -15 * Math.sin((elapsed - .75) / .46 * Math.PI)
    else { const k = Math.sin((elapsed - 1.21) / .14 * Math.PI); pose.sx += .06 * k; pose.sy -= .05 * k }
  } else if (kind === 'scared') {
    const wave = Math.sin(elapsed * Math.PI * 2 * 13) * Math.pow(1 - elapsed / duration, 2)
    pose.x = wave * 8; pose.rotate = wave * 2.5
  } else if (kind === 'tired') {
    const slump = elapsed < .7 ? ease(elapsed / .7) : elapsed < 2.4 ? 1 : 1 - smooth((elapsed - 2.4) / 1.4)
    pose.y = 16 * slump; pose.rotate = -7 * slump; pose.sx += .035 * slump; pose.sy -= .09 * slump
  } else if (kind === 'curious') {
    const k = Math.pow(Math.sin(elapsed / duration * Math.PI), 2)
    pose.rotate = -9 * k; pose.y = -2 * k
  } else if (kind === 'shy') {
    const k = Math.pow(Math.sin(elapsed / duration * Math.PI), 2)
    pose.rotate = 6 * k; pose.y = 3 * k; pose.sx -= .025 * k
  } else {
    // All extended gestures start and finish softly; silhouette morphing is
    // handled by bloub while these motions carry the complete masked SVG.
    const progress = elapsed / duration, envelope = Math.pow(Math.sin(progress * Math.PI), 2)
    if (kind === 'laugh') {
      const giggle = Math.sin(progress * Math.PI * 10) * envelope
      pose.rotate = 5 * giggle; pose.y = -3 * Math.abs(giggle); pose.sx += .07 * giggle; pose.sy -= .07 * giggle
    } else if (kind === 'dance') {
      const sway = Math.sin(progress * Math.PI * 6) * envelope
      pose.x = 6 * sway; pose.rotate = 8 * sway; pose.y = -4 * Math.abs(sway); pose.sx += .035 * sway; pose.sy -= .035 * sway
    } else if (kind === 'float') {
      pose.y = -17 * envelope; pose.rotate = 5 * Math.sin(progress * Math.PI * 2) * envelope; pose.sx -= .025 * envelope; pose.sy += .035 * envelope
    } else if (kind === 'peek') {
      pose.y = 13 * envelope; pose.sx += .08 * envelope; pose.sy -= .16 * envelope; pose.rotate = -6 * Math.sin(progress * Math.PI * 2) * envelope
    } else if (kind === 'scan') {
      pose.x = 4 * Math.sin(progress * Math.PI * 2) * envelope; pose.rotate = 9 * Math.sin(progress * Math.PI * 2) * envelope; pose.sy += .035 * envelope
    } else if (kind === 'brave') {
      pose.y = -5 * envelope; pose.sx -= .035 * envelope; pose.sy += .09 * envelope; pose.rotate = -4 * Math.sin(progress * Math.PI * 2) * envelope
    } else if (kind === 'nod') {
      pose.y = 4 * Math.pow(Math.sin(progress * Math.PI * 3), 2) * envelope; pose.sy -= .035 * envelope; pose.rotate = -3 * envelope
    } else if (kind === 'grumble') {
      pose.rotate = 6 * Math.sin(progress * Math.PI * 8) * envelope; pose.x = 3 * Math.sin(progress * Math.PI * 8) * envelope; pose.sx += .045 * envelope; pose.sy -= .055 * envelope
    }
  }
  return pose
}

export function nookGestureTransform(pose: NookPose) {
  // Squash about the feet, keeping the character grounded while its top gives.
  return `translate(${pose.x.toFixed(3)} ${pose.y.toFixed(3)}) rotate(${pose.rotate.toFixed(3)}) translate(0 100) scale(${pose.sx.toFixed(4)} ${pose.sy.toFixed(4)}) translate(0 -100)`
}

export function blendNookPose(from: NookPose, to: NookPose, progress: number): NookPose {
  const k = smooth(progress)
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, rotate: from.rotate + (to.rotate - from.rotate) * k, sx: from.sx + (to.sx - from.sx) * k, sy: from.sy + (to.sy - from.sy) * k }
}
