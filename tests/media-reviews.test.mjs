import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMediaReviews, pickMediaReview, reviewReaction, reviewStars } from '../src/lib/media-reviews.ts'
import { validateMediaParams } from '../src/lib/api-policy.ts'

test('author ratings normalize to five stars without borrowing title averages or review helpfulness', () => {
  const [tmdb] = normalizeMediaReviews('TMDB', [{ id: 'abc123', content: 'A wonderful experience worth sharing.', author: 'Alice', author_details: { rating: 9 }, vote_average: 2 }])
  const [anime] = normalizeMediaReviews('AniList', [{ id: 42, summary: 'A wonderful experience worth sharing.', score: 90, rating: 1, user: { name: 'Bob' } }])
  assert.equal(tmdb.stars, 4.5); assert.equal(anime.stars, 4.5)
  assert.equal(tmdb.score, 9); assert.equal(tmdb.scale, 10)
  assert.equal(anime.score, 90); assert.equal(anime.scale, 100)
  assert.equal(reviewReaction(tmdb.stars).emotion, 'excited')
  assert.equal(reviewReaction(anime.stars).emotion, 'excited')
  const [unrated] = normalizeMediaReviews('AniList', [{ id: 43, summary: 'A review without a media score.', rating: 100, user: { name: 'Bob' } }])
  assert.equal(unrated.stars, null)
  assert.equal(reviewReaction(unrated.stars).emotion, 'attentive')
})

test('missing or invalid ratings stay unknown, while genuine zero and fractional scores remain valid', () => {
  for (const value of [null, undefined, '9', -1, NaN, Infinity, 11]) assert.equal(reviewStars(value, 10), null)
  assert.equal(reviewStars(0, 10), 0)
  assert.equal(reviewStars(8.5, 10), 4.25)
  assert.ok(Math.abs(reviewStars(83, 100) - 4.15) < 1e-10)
  assert.equal(reviewStars(101, 100), null)
  for (const value of [null, -1, 6, NaN, Infinity]) assert.equal(reviewReaction(value).emotion, 'attentive')
})

test('rating bands distinguish delighted, pleased, mixed, disappointed and angry authors', () => {
  for (const [stars, emotion] of [[5, 'excited'], [4.5, 'excited'], [4.49, 'happy'], [3.5, 'happy'], [3.49, 'thoughtful'], [2.5, 'thoughtful'], [2.49, 'sad'], [1.5, 'sad'], [1.49, 'angry'], [0, 'angry']]) {
    assert.equal(reviewReaction(stars).emotion, emotion)
    assert.equal(reviewReaction(stars).state, 'idle')
  }
})

test('review previews are bounded plain text and source URLs are rebuilt from validated review IDs', () => {
  const [review] = normalizeMediaReviews('TMDB', [{ id: 'safe-id', author: '<b>Alice</b>', author_details: { rating: 2 }, url: 'javascript:alert(1)', content: '<script>danger()</script><b>A real review</b> with [a link](https://evil.example) &amp; some text. ~!The hidden ending!~ ' + 'long sentence '.repeat(100) }])
  assert.equal(review.author, 'Alice')
  assert.equal(review.url, 'https://www.themoviedb.org/review/safe-id')
  assert.ok(review.excerpt.length <= 181)
  assert.ok(review.excerpt.endsWith('…'))
  assert.equal(review.truncated, true)
  assert.ok(!/script|danger|<b>|evil.example|hidden ending/.test(review.excerpt))
  assert.ok(review.excerpt.includes('[Spoiler omitted]'))
  assert.ok(review.excerpt.includes('& some text'))
  assert.equal(normalizeMediaReviews('TMDB', [{ id: '../escape', content: 'A sufficiently long review.' }]).length, 0)
})

test('AniList uses short published summaries, excludes private reviews, and caps duplicate-free batches', () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, summary: 'A short published opinion.', body: 'This full body should never be returned.', score: 80, private: index === 0, user: { name: 'Reader' } }))
  const reviews = normalizeMediaReviews('AniList', [rows[0], rows[1], rows[1], ...rows.slice(2)])
  assert.equal(reviews.length, 10)
  assert.equal(new Set(reviews.map(review => review.id)).size, 10)
  assert.equal(reviews[0].id, '2')
  assert.equal(reviews[0].excerpt, 'A short published opinion.')
  assert.equal(reviews[0].url, 'https://anilist.co/review/2')
  assert.deepEqual(normalizeMediaReviews('AniList', null), [])
  assert.deepEqual(normalizeMediaReviews('TMDB', [null, {}, { id: 'ok', content: 'short' }]), [])
})

test('review picks exhaust the batch and avoid repeating the last review on a new cycle', () => {
  const reviews = normalizeMediaReviews('AniList', [1, 2, 3].map(id => ({ id, summary: 'A real community perspective.', score: 80 })))
  let seen = [], previous = ''
  for (let cycle = 0; cycle < 3; cycle++) {
    const batch = []
    for (let count = 0; count < 3; count++) {
      const review = pickMediaReview(reviews, seen, () => .99)
      assert.notEqual(review.id, previous)
      if (seen.length >= reviews.length) seen = []
      seen.push(review.id); batch.push(review.id); previous = review.id
    }
    assert.equal(new Set(batch).size, 3)
  }
  assert.equal(pickMediaReview([], []), null)
  assert.equal(pickMediaReview([reviews[0]], [reviews[0].id]), reviews[0])
})

test('review endpoints require valid title IDs and accept only the single bounded batch', () => {
  for (const [provider, type] of [['tmdb', 'movie-reviews'], ['tmdb', 'tv-reviews'], ['anilist', 'reviews']]) {
    assert.doesNotThrow(() => validateMediaParams(provider, new URLSearchParams({ type, id: '123' })))
    for (const extra of ['', '&page=2', '&query=hello', '&url=https://evil.example', '&id=456']) {
      const params = extra === '' ? new URLSearchParams({ type }) : new URLSearchParams(`type=${type}&id=123${extra}`)
      assert.throws(() => validateMediaParams(provider, params))
    }
  }
})
