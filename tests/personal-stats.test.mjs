import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePersonalStats, statsAxisMaximum, statsMonthLabel, statsPercentage, statsTimezone, statsTitleHref } from '../src/lib/personal-stats.ts'

function fixture() {
  const empty = () => ({ total: 0, rated: 0, average_rating: null, notes: 0, episodes: 0, statuses: { planned: 0, watching: 0, completed: 0, paused: 0, dropped: 0 }, media: { movie: 0, tv: 0, anime: 0 }, ratings: Array.from({ length: 10 }, (_, i) => ({ rating: i + 1, count: 0 })), months: Array.from({ length: 12 }, (_, i) => ({ month: `${i < 2 ? 2025 : 2026}-${String((i + 10) % 12 + 1).padStart(2, '0')}`, saved: 0, completed: 0, episodes: 0 })), top: [] })
  return { generated_at: '2026-10-24T12:00:00Z', timezone: 'Europe/Bratislava', collections: 0, scopes: { all: empty(), movie: empty(), tv: empty(), anime: empty() } }
}

test('a real empty library remains zero with an unknown personal average', () => {
  const value = parsePersonalStats(fixture())
  assert.equal(value.scopes.all.total, 0)
  assert.equal(value.scopes.all.average_rating, null)
  assert.equal(statsPercentage(0, 0), 0)
  assert.equal(statsAxisMaximum([0, 0]), 4)
})

test('summaries retain private scores and reject inconsistent totals or invalid rating data', () => {
  const value = fixture(), scope = value.scopes.all
  Object.assign(scope, { total: 2, rated: 1, average_rating: 8, episodes: 3, notes: 1 })
  scope.statuses.completed = 1; scope.statuses.planned = 1; scope.media.tv = 2
  scope.ratings[7].count = 1
  scope.top.push({ id: 42, kind: 'tv', title: 'A personal favourite', poster: null, rating: 8 })
  assert.equal(parsePersonalStats(value).scopes.all.average_rating, 8)
  for (const change of [s => { s.total = 3 }, s => { s.average_rating = NaN }, s => { s.average_rating = 0 }, s => { s.rated = 2 }, s => { s.episodes = -1 }, s => { s.top[0].rating = 11 }, s => { s.notes = 3 }]) {
    const broken = structuredClone(value); change(broken.scopes.all)
    assert.throws(() => parsePersonalStats(broken))
  }
  const unrated = fixture(); unrated.scopes.all.average_rating = 0
  assert.throws(() => parsePersonalStats(unrated), 'unrated must never be shown as zero out of ten')
})

test('month windows cover exactly twelve consecutive months across the year boundary', () => {
  const value = fixture()
  assert.equal(parsePersonalStats(value).scopes.all.months[0].month, '2025-11')
  assert.equal(value.scopes.all.months.at(-1).month, '2026-10')
  const gap = structuredClone(value); gap.scopes.all.months[3].month = '2026-03'
  assert.throws(() => parsePersonalStats(gap))
  const invalid = structuredClone(value); invalid.scopes.movie.months[4].month = '2026-13'
  assert.throws(() => parsePersonalStats(invalid))
  assert.equal(statsMonthLabel('2026-01', true), 'January 2026')
})

test('chart axes stay bounded, have integer half-ticks and never invent nonzero zero values', () => {
  for (const peak of [0, 1, 4, 5, 9, 10, 11, 99, 101, 5001, 123456]) {
    const max = statsAxisMaximum([0, peak])
    assert.ok(max >= peak && Number.isInteger(max / 2))
    assert.ok(statsPercentage(peak, max) >= 0 && statsPercentage(peak, max) <= 100)
  }
  assert.equal(statsPercentage(0, 100), 0)
  assert.equal(statsPercentage(1, 4), 25)
  assert.equal(statsPercentage(9, 4), 100)
})

test('timezone input is validated and equal numeric media IDs retain their provider route', () => {
  assert.equal(statsTimezone(null), 'UTC')
  assert.equal(statsTimezone('Europe/Bratislava'), 'Europe/Bratislava')
  for (const invalid of ['not/a/timezone', '../secret', 'x'.repeat(65), "UTC');drop table watchlist;--"]) assert.throws(() => statsTimezone(invalid))
  assert.equal(statsTitleHref({ kind: 'movie', id: 42 }), '/movie/42')
  assert.equal(statsTitleHref({ kind: 'tv', id: 42 }), '/tv/42')
  assert.equal(statsTitleHref({ kind: 'anime', id: 42 }), '/anime/42')
})
