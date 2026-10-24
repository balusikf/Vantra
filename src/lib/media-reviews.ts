import type { NookCue } from './nook-personality'

export type MediaReview = {
  id: string
  author: string
  excerpt: string
  truncated: boolean
  source: 'TMDB' | 'AniList'
  url: string
  score: number | null
  scale: 10 | 100
  stars: number | null
}

function text(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, 50_000)
    .replace(/<(script|style|spoiler)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/~![\s\S]*?!~|\|\|[\s\S]*?\|\|/g, '[Spoiler omitted]')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/gi, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[entity.toLowerCase()] || '')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => {
      const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : ''
    })
    .replace(/[*_`#]+/g, '')
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

export function reviewStars(value: unknown, scale: 10 | 100): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= scale ? value / scale * 5 : null
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

// Return only a bounded plain-text preview, with canonical source links. Never
// render upstream HTML or use its URLs. AniList's rating is helpfulness, NOT the
// author's score: only `score` determines Nook's reaction there.
export function normalizeMediaReviews(source: 'TMDB' | 'AniList', value: unknown): MediaReview[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>(), result: MediaReview[] = []
  for (const raw of value.slice(0, 25)) {
    const review = record(raw), id = String(review.id ?? '')
    if (source === 'AniList' ? !/^[1-9]\d{0,9}$/.test(id) || review.private === true : !/^[\w-]{1,80}$/.test(id)) continue
    if (seen.has(id)) continue
    const body = text(source === 'AniList' ? review.summary : review.content)
    if (body.length < 15) continue
    const details = record(source === 'TMDB' ? review.author_details : review.user)
    const scale = source === 'TMDB' ? 10 : 100
    const score = source === 'TMDB' ? details.rating : review.score
    const stars = reviewStars(score, scale)
    let excerpt = body.slice(0, 180)
    if (body.length > 180) {
      const boundary = excerpt.lastIndexOf(' ')
      if (boundary >= 135) excerpt = excerpt.slice(0, boundary)
      excerpt += '…'
    }
    result.push({ id, source, excerpt, truncated: body.length > 180,
      author: text(source === 'TMDB' ? review.author || details.username : details.name).slice(0, 60) || `${source} member`,
      url: source === 'TMDB' ? `https://www.themoviedb.org/review/${id}` : `https://anilist.co/review/${id}`,
      score: stars === null ? null : score as number, scale, stars,
    })
    seen.add(id)
    if (result.length === 10) break
  }
  return result
}

export function reviewReaction(stars: number | null): NookCue & { speech: string } {
  if (stars === null || !Number.isFinite(stars) || stars < 0 || stars > 5)
    return { state: 'idle', emotion: 'attentive', expression: 'attentif', shape: 'galet', gesture: 'curious', speech: 'No score from this viewer. Just their words.' }
  if (stars >= 4.5) return { state: 'idle', emotion: 'excited', expression: 'excite', shape: 'nuage', gesture: 'happy', speech: 'This viewer loved it. Cue the happy little hops.' }
  if (stars >= 3.5) return { state: 'idle', emotion: 'happy', expression: 'heureux', shape: 'squircle', gesture: 'nod', speech: 'A happy viewer. That sounds like a good night.' }
  if (stars >= 2.5) return { state: 'idle', emotion: 'thoughtful', expression: 'confus', shape: 'hexagone', gesture: 'curious', speech: 'Mixed feelings on this one. Let’s hear them out.' }
  if (stars >= 1.5) return { state: 'idle', emotion: 'sad', expression: 'triste', shape: 'goutte', gesture: 'tired', speech: 'This viewer hoped for more. A little disappointed droop.' }
  return { state: 'idle', emotion: 'angry', expression: 'colere', shape: 'triangle', gesture: 'grumble', speech: 'Oh dear. This one really wasn’t for them.' }
}

export function pickMediaReview(reviews: readonly MediaReview[], seen: readonly string[], random = Math.random): MediaReview | null {
  if (!reviews.length) return null
  const fresh = reviews.filter(review => !seen.includes(review.id))
  const choices = fresh.length ? fresh : reviews.filter(review => review.id !== seen.at(-1))
  const pool = choices.length ? choices : reviews
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))]
}
