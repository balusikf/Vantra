import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getMediaImages, getPopularMovies, getPopularTV, getTrending, type SpotlightMedia, type TMDBMedia } from '@/lib/tmdb'
import Preview from './Preview'

export const metadata = { title: 'Design preview' }

export default async function PreviewPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const results = await Promise.allSettled([getTrending(), getPopularMovies(), getPopularTV()])
  const catalog = results.map(result => result.status === 'fulfilled'
    ? (result.value.results as TMDBMedia[]).filter(item => item.media_type !== 'person')
    : [])

  const spotlight: SpotlightMedia[] = await Promise.all(catalog[0].filter(item => item.backdrop_path).slice(0, 4).map(async item => {
    try {
      const images = await getMediaImages(item.id, item.media_type === 'tv' ? 'tv' : 'movie')
      const logos = images.logos.filter(logo => logo.width > 0 && logo.height > 0)
      const title_logo = [...logos].sort((a, b) =>
        Number(b.iso_639_1 === 'en') - Number(a.iso_639_1 === 'en') || b.vote_average - a.vote_average
      )[0]
      return { ...item, title_logo }
    } catch {
      return item
    }
  }))

  return <Preview spotlight={spotlight} trending={catalog[0]} movies={catalog[1].map(item => ({ ...item, media_type: 'movie' }))}
    shows={catalog[2].map(item => ({ ...item, media_type: 'tv' }))} />
}
