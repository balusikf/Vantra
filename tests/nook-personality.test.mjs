import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceNookConversation, blendNookPose, nookEmotionFromGenres, nookGenreFromGenres, nookGenreVariants, nookInteractionVariants, NookVariantDeck, nookGestureDuration, nookGesturePose } from '../src/lib/nook-personality.ts'

test('genre moods accept both TMDB and AniList metadata, with horror taking priority in mixed genres', () => {
  assert.equal(nookEmotionFromGenres([{ id: 27, name: 'Horror' }, { name: 'Comedy' }]), 'scared')
  assert.equal(nookEmotionFromGenres(['Psychological', 'Drama']), 'scared')
  assert.equal(nookEmotionFromGenres(['Comedy']), 'happy')
  assert.equal(nookEmotionFromGenres(['Romance']), 'shy')
  assert.equal(nookEmotionFromGenres(['Slice of Life']), 'tired')
  assert.equal(nookEmotionFromGenres([{ name: 'Science Fiction' }]), 'curious')
  assert.equal(nookEmotionFromGenres([{ name: 'Drama' }]), 'thoughtful')
  for (const missing of [null, undefined, [], [null, {}, 12]]) assert.equal(nookEmotionFromGenres(missing), 'curious')
})

test('specific genre reactions distinguish investigation, magic, space and music in either API format', () => {
  assert.equal(nookGenreFromGenres([{ name: 'Action' }, { name: 'Crime' }]), 'mystery')
  assert.equal(nookEmotionFromGenres(['Mystery']), 'suspicious')
  assert.equal(nookGenreFromGenres(['Action', 'Sci-Fi']), 'scifi')
  assert.equal(nookGenreFromGenres(['Adventure', 'Fantasy']), 'fantasy')
  assert.equal(nookGenreFromGenres(['Comedy', 'Music']), 'music')
  assert.equal(nookGenreFromGenres(['Drama', 'Sports']), 'sport')
  assert.equal(nookGenreFromGenres(['Drama', 'Documentary']), 'documentary')
  assert.equal(nookGenreFromGenres([' Action & Adventure ']), 'action')
  assert.equal(nookGenreFromGenres(['Crime', 'Thriller']), 'thriller')
  assert.equal(nookGenreFromGenres(['Family']), 'family')
  assert.equal(nookGenreFromGenres(['History', 'Drama']), 'history')
})

test('shuffle bags exhaust their variants and do not repeat across cycle boundaries', () => {
  const options = nookGenreVariants.comedy, deck = new NookVariantDeck(() => .99)
  let last = ''
  for (let cycle = 0; cycle < 6; cycle++) {
    const ids = []
    for (let count = 0; count < options.length; count++) {
      const choice = deck.choose('comedy', options)
      assert.notEqual(choice.id, last)
      ids.push(choice.id); last = choice.id
    }
    assert.equal(new Set(ids).size, options.length)
  }
  assert.equal(deck.choose('single', [options[0]]), options[0])
  assert.equal(deck.choose('single', [options[0]]), options[0])
  assert.throws(() => deck.choose('empty', []))
})

test('genre bubbles and visuals commit together and late metadata yields to a pat, trick or newer selection', () => {
  const initial = { reaction: { state: 'idle', serial: 0 }, speech: 'Hello' }
  const pending = advanceNookConversation(initial, { emotion: 'happy', selection: 'first', speech: 'Found one' })
  const genre = { ...nookGenreVariants.horror[0], selection: 'first' }
  const enriched = advanceNookConversation(pending, genre, 'first')
  assert.equal(enriched.speech, genre.speech)
  assert.equal(enriched.reaction.emotion, 'scared')
  assert.equal(enriched.reaction.shape, genre.shape)
  assert.equal(enriched.reaction.serial, 2)
  assert.equal(enriched.reaction.id, undefined)
  for (const cue of [nookInteractionVariants.pet[0], nookInteractionVariants.trick[0], { selection: 'new', speech: 'New story' }]) {
    const newer = advanceNookConversation(pending, cue)
    assert.equal(advanceNookConversation(newer, genre, 'first'), newer)
    assert.notEqual(newer.speech, genre.speech)
  }
  // Unrelated idle resets may keep speech, while clearing the selection guard.
  const reset = advanceNookConversation(enriched, { state: 'idle' })
  assert.equal(reset.speech, genre.speech)
  assert.equal(reset.reaction.selection, undefined)
})

test('each genre offers different silhouettes and speech, while every direct pat retains squash feedback', () => {
  const silhouettes = new Set(), expressions = new Set()
  for (const variants of Object.values(nookGenreVariants)) {
    assert.ok(new Set(variants.map(variant => variant.shape)).size >= 2)
    assert.equal(new Set(variants.map(variant => variant.speech)).size, variants.length)
    for (const variant of variants) {
      silhouettes.add(variant.shape); expressions.add(variant.expression)
      assert.ok(nookGestureDuration[variant.gesture] > 0)
      assert.equal(variant.state, 'idle') // Custom faces remain visible in bloub.
    }
  }
  assert.equal(silhouettes.size, 8)
  assert.ok(expressions.size >= 12)
  assert.ok(nookInteractionVariants.pet.every(variant => variant.gesture === 'pat'))
  assert.ok(nookInteractionVariants.five.every(variant => variant.gesture === 'happy'))
})

test('laughter, dance, float and peek have distinct body language with soft endpoints', () => {
  assert.ok(nookGesturePose('laugh', .4).sx !== 1)
  assert.ok(nookGesturePose('dance', .6).x !== 0)
  assert.ok(nookGesturePose('float', 1.6).y < -16)
  assert.ok(nookGesturePose('peek', 1.15).sy < .85)
  assert.ok(nookGesturePose('brave', .75).sy > 1.08)
  for (const kind of ['laugh', 'dance', 'float', 'peek', 'scan', 'brave', 'nod']) {
    assert.deepEqual(nookGesturePose(kind, 0), nookGesturePose('none', 0))
    const nearEnd = nookGesturePose(kind, nookGestureDuration[kind] - .001)
    assert.ok(Math.abs(nearEnd.x) + Math.abs(nearEnd.y) + Math.abs(nearEnd.rotate) < .001)
  }
})

test('a pat squashes first then recovers, and happiness has two separated hops', () => {
  const pressed = nookGesturePose('pat', .08)
  assert.ok(pressed.sx > 1.15 && pressed.sy < .8)
  const rebound = nookGesturePose('pat', .23)
  assert.ok(rebound.sx < 1 && rebound.sy > 1)
  assert.ok(nookGesturePose('happy', .37).y < -20)
  assert.equal(nookGesturePose('happy', .62).y, 0)
  assert.ok(nookGesturePose('happy', .98).y < -14)
})

test('fear wiggles in both directions briefly, and tiredness holds a slump before easing back', () => {
  assert.ok(nookGesturePose('scared', .02).x > 0)
  assert.ok(nookGesturePose('scared', .06).x < 0)
  assert.ok(nookGesturePose('tired', 1).y > 14)
  assert.deepEqual(nookGesturePose('tired', 1), nookGesturePose('tired', 2))
  assert.ok(nookGesturePose('tired', 3.5).y < 3)
})

test('gestures and rapid interruptions remain finite, bounded and settle to a neutral pose', () => {
  const neutral = nookGesturePose('none', 0)
  for (const [kind, duration] of Object.entries(nookGestureDuration)) {
    assert.deepEqual(nookGesturePose(kind, duration + 1), neutral)
    for (let time = 0; time < duration; time += .017) {
      const pose = nookGesturePose(kind, time)
      assert.ok(Object.values(pose).every(Number.isFinite))
      assert.ok(pose.sx >= .7 && pose.sx < 1.3 && pose.sy >= .7 && pose.sy < 1.2)
      assert.ok(Math.abs(pose.x) <= 8 && Math.abs(pose.y) <= 24)
    }
  }
  const interrupted = nookGesturePose('happy', .37), next = nookGesturePose('scared', .02)
  assert.deepEqual(blendNookPose(interrupted, next, 0), interrupted)
  const end = blendNookPose(interrupted, next, 1)
  for (const key of Object.keys(end)) assert.ok(Math.abs(end[key] - next[key]) < 1e-12)
})
