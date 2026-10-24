import type { MediaType } from './watch-metadata'

export interface StreamProvider { name: string; url: string }
type EmbedBuilder = (id: number, season: number, episode: number) => string
interface ProviderDefinition {
  name: string
  animeIdType?: 'anilist'
  embeds: Partial<Record<MediaType, EmbedBuilder>>
}

// Only advertise ID types and routes documented by each provider.
// VidCore: https://vidcore.io/ (TMDB movies/TV)
// VidNest: https://vidnest.fun/ (TMDB movies/TV, AniList anime)
// VidFast: https://vidfast.vc/ (TMDB movies/TV)
// MultiEmbed: https://superembed.stream/#installation
// VidLink: https://vidlink.pro/ (anime: MAL ID / episode / sub|dub)
// AutoEmbed: https://autoembed.co/ (TMDB movies/TV only)
const providers: ProviderDefinition[] = [
  {
    name: 'MultiEmbed',
    embeds: {
      movie: id => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
      tv: (id, season, episode) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`,
    },
  },
  {
    name: 'VidCore',
    embeds: {
      movie: id => `https://vidcore.io/movie/${id}?theme=e50914&autoPlay=false`,
      tv: (id, season, episode) => `https://vidcore.io/tv/${id}/${season}/${episode}?theme=e50914&autoPlay=false`,
    },
  },
  {
    name: 'VidNest',
    animeIdType: 'anilist',
    embeds: {
      movie: id => `https://vidnest.fun/movie/${id}`,
      tv: (id, season, episode) => `https://vidnest.fun/tv/${id}/${season}/${episode}`,
      anime: (anilistId, _season, episode) => `https://vidnest.fun/anime/${anilistId}/${episode}/sub`,
    },
  },
  {
    name: 'VidFast',
    embeds: {
      movie: id => `https://vidfast.vc/movie/${id}?theme=e50914&autoPlay=false`,
      tv: (id, season, episode) => `https://vidfast.vc/tv/${id}/${season}/${episode}?theme=e50914&autoPlay=false`,
    },
  },
  {
    name: 'VidLink',
    embeds: {
      movie: id => `https://vidlink.pro/movie/${id}`,
      tv: (id, season, episode) => `https://vidlink.pro/tv/${id}/${season}/${episode}`,
      anime: (malId, _season, episode) => `https://vidlink.pro/anime/${malId}/${episode}/sub`,
    },
  },
  {
    name: 'AutoEmbed',
    embeds: {
      movie: id => `https://autoembed.co/movie/tmdb/${id}`,
      tv: (id, season, episode) => `https://autoembed.co/tv/tmdb/${id}-${season}-${episode}`,
    },
  },
]

export function getStreamProviders(type: MediaType, id: number, season = 1, episode = 1, anilistId?: number): StreamProvider[] {
  if (!['movie', 'tv', 'anime'].includes(type) || !Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(season) || season < 0 || !Number.isSafeInteger(episode) || episode < 1) {
    throw new Error('Invalid media, season or episode')
  }
  if (anilistId !== undefined && (!Number.isSafeInteger(anilistId) || anilistId < 1)) {
    throw new Error('Invalid media AniList identifier')
  }
  return providers.flatMap(provider => {
    const embed = provider.embeds[type]
    // The watch route carries a MAL ID; never guess an AniList ID from it.
    const providerId = type === 'anime' && provider.animeIdType === 'anilist' ? anilistId : id
    return embed && providerId !== undefined ? [{ name: provider.name, url: embed(providerId, season, episode) }] : []
  })
}
