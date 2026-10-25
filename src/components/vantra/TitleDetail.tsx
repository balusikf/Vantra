'use client'

import { PLAYER_IFRAME_ALLOW } from '@/lib/player-permissions'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Bookmark, Check, ChevronRight, Clock, Eye, ImageIcon, Play, Star, X } from 'lucide-react'
import type { MovieDetail, TVDetail } from '@/types/media'
import type { AniListMedia, AnimeEpisodeData } from '@/lib/anilist'
import type { TMDBEpisode } from '@/lib/tmdb'
import { hasAired } from '@/lib/media-presentation'
import { cachedMedia, fetchMedia } from '@/lib/client-media-cache'
import WatchlistButton from '@/components/media/WatchlistButton'
import Shell, { DetailLoading, ErrorPanel } from './Shell'
import { Reveal, Shelf } from './Primitives'
import EpisodeRow from './EpisodeRow'
import NookReviews from '@/components/nook/NookReviews'
import SeasonPicker from './SeasonPicker'
import FilmCollectionLink from './FilmCollectionLink'
import sp from './season-picker.module.css'
import ps from './person.module.css'
import { useEpisodeTracking } from '@/hooks/useEpisodeTracking'
import t from './library-tracking.module.css'
import s from './vantra.module.css'

type Kind = 'movie' | 'tv' | 'anime'
const image = (path?: string | null, size = 'w1280') => path ? `https://image.tmdb.org/t/p/${size}${path}` : null
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function Trailer({ id, backdrop, title }: { id: string; backdrop: string | null; title: string }) {
  const [playing, setPlaying] = useState(false)
  return <section id="trailer" className={s.detailSection}><p className={s.eyebrow}>A FIRST LOOK</p><h2>Official trailer<span>.</span></h2><div className={s.trailerFrame}>{playing
    ? <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={`${title} trailer`} allow={PLAYER_IFRAME_ALLOW} allowFullScreen />
    : <button className={s.trailerPoster} onClick={() => setPlaying(true)} aria-label={`Play ${title} trailer`}>{backdrop && <Image src={backdrop} alt="" fill sizes="(max-width: 700px) 90vw, 480px" className={s.backdrop} />}<span className={s.trailerShade} /><span className={s.trailerPlay}><Play size={22} fill="currentColor" /></span><span className={s.trailerCaption}>Watch trailer <ChevronRight size={16} /></span></button>}</div><a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className={s.externalTrailer}>Open on YouTube <ArrowUpRight size={13} /></a></section>
}

function Episodes({ id, season, seasons, onSeason, title, poster }: { id: number; season: number; seasons: TVDetail['seasons']; onSeason: (season: number) => void; title: string; poster: string }) {
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [loadedSeason,setLoadedSeason]=useState<number | null>(null)
  const tracking = useEpisodeTracking({ id, kind:'tv', season, maxEpisode:100000, title, poster })
  useEffect(() => {
    const controller = new AbortController()
    async function fetchEpisodes() {
      setLoading(true); setError(false); setEpisodes([])
      try {
        const data = await fetchMedia<{ episodes: TMDBEpisode[] }>(`/api/tmdb?type=season-detail&id=${id}&season=${season}`, controller.signal)
        if (!controller.signal.aborted) {setEpisodes(data.episodes || []);setLoadedSeason(season)}
      } catch { if (!controller.signal.aborted) setError(true) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void fetchEpisodes()
    return () => controller.abort()
  }, [id, season, retry])
  const currentLoading=loading||(!error&&loadedSeason!==season)
  const released=episodes.filter(episode=>hasAired(episode.air_date)).map(episode=>episode.episode_number)
  const allSeen=released.length>0&&released.every(episode=>tracking.seen.has(episode))
  return <section id="episodes" className={s.detailSection}><div className={`${s.episodeHeading} ${sp.heading}`}><div><p className={s.eyebrow}>SETTLE IN</p><h2>Episodes<span>.</span></h2></div><SeasonPicker seasons={seasons} value={season} onChange={onSeason} counts={tracking.seasonCounts} disabled={tracking.busy!==null}/></div>
    {!currentLoading&&!error&&released.length>0&&<div className={sp.bulk}><button type="button" aria-pressed={allSeen} disabled={tracking.loading||tracking.busy!==null||!!tracking.error||allSeen} onClick={()=>{void tracking.markSeason(released)}}>{allSeen?<Check size={15}/>:<Eye size={15}/>} {allSeen?'All released episodes watched':'Mark season watched'}</button><span>{released.filter(episode=>tracking.seen.has(episode)).length}/{released.length} released episodes watched</span>{tracking.canUndo&&<button type="button" disabled={tracking.busy!==null} onClick={()=>{void tracking.undoSeason()}}>Undo season marks</button>}</div>}
    {currentLoading ? <div className={s.episodeSkeleton} aria-busy="true">Loading episodes…</div> : error ? <ErrorPanel message="We couldn’t load this season. Please try again." retry={() => setRetry(value => value + 1)} /> : episodes.length === 0 ? <p className={s.muted}>Episode information hasn’t been announced yet.</p> : <div className={s.episodeList}>{episodes.map(episode => {
      const available = hasAired(episode.air_date)
      return <EpisodeRow key={`${season}:${episode.episode_number}`} number={episode.episode_number} title={episode.name} overview={episode.overview} runtime={episode.runtime} date={episode.air_date ? dateLabel(episode.air_date) : null} still={image(episode.still_path, 'w780')} available={available} href={`/watch/tv/${id}?season=${season}&episode=${episode.episode_number}`} playLabel={`Play season ${season} episode ${episode.episode_number}: ${episode.name}`} watched={tracking.seen.has(episode.episode_number)} trackingDisabled={tracking.loading || tracking.busy !== null || !!tracking.error} onWatchedChange={()=>{void tracking.toggle(episode.episode_number)}} />
    })}</div>}{tracking.error ? <p className={t.error} role="alert">{tracking.error} <button className={s.explore} onClick={tracking.retry}>Try again</button></p> : <p className={t.trackingNotice}>Use the eye button to mark an episode watched. Your choices stay private in your library.</p>}
  </section>
}

function AnimeEpisodes({ anime }: { anime: AniListMedia }) {
  const [data, setData] = useState<AnimeEpisodeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [visible, setVisible] = useState(24)
  const [now] = useState(() => Date.now())
  const tracking = useEpisodeTracking({ id:anime.id, kind:'anime', season:0, maxEpisode:visible, title:anime.title.english || anime.title.romaji, poster:anime.coverImage.extraLarge || anime.coverImage.large })
  useEffect(() => {
    const controller = new AbortController()
    async function fetchEpisodes() {
      setLoading(true); setFailed(false)
      try {
        const episodes = await fetchMedia<AnimeEpisodeData>(`/api/anilist?type=episodes&id=${anime.id}`, controller.signal)
        if (!controller.signal.aborted) setData(episodes)
      } catch { if (!controller.signal.aborted) setFailed(true) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void fetchEpisodes()
    return () => controller.abort()
  }, [anime.id, retry])
  const count = data?.episodes || anime.episodes || (data?.nextAiringEpisode ? Math.max(0, data.nextAiringEpisode.episode - 1) : 0)
  return <section id="episodes" className={s.detailSection}><div className={`${s.episodeHeading} ${sp.heading}`}><div><p className={s.eyebrow}>SETTLE IN</p><h2>Episodes<span>.</span></h2></div>{!loading && count > 0 && <span className={s.episodeCount}>{count} episodes</span>}</div>{loading ? <div className={s.episodeSkeleton} aria-busy="true">Loading episodes…</div> : failed ? <ErrorPanel message="Episode information is temporarily unavailable." retry={() => setRetry(value => value + 1)} /> : !count ? <p className={s.muted}>Episode information hasn’t been announced yet.</p> : <><div className={s.episodeList}>{Array.from({ length: Math.min(count, visible) }, (_, index) => {
    const episode = index + 1
    const schedule = data?.airingSchedule?.nodes?.find(node => node.episode === episode)
    const available = Boolean(anime.idMal) && (schedule ? schedule.airingAt * 1000 <= now : data?.nextAiringEpisode ? episode < data.nextAiringEpisode.episode : anime.status === 'FINISHED')
    const preview = data?.previews?.find(item => item.episode_number === episode)
    const title = preview?.name || `Episode ${String(episode).padStart(2, '0')}`
    const airDate = preview?.air_date || (schedule ? new Date(schedule.airingAt * 1000).toISOString().slice(0, 10) : null)
    return <EpisodeRow key={episode} number={episode} title={title} overview={preview?.overview} runtime={preview?.runtime} date={airDate ? dateLabel(airDate) : null} still={image(preview?.still_path, 'w780')} fallback={anime.artwork?.backdrop ? image(anime.artwork.backdrop, 'w780') : anime.coverImage.extraLarge || anime.coverImage.large} available={available} href={`/watch/anime/${anime.idMal}?episode=${episode}&anilistId=${anime.id}`} playLabel={`Play episode ${episode}: ${title}`} watched={tracking.seen.has(episode)} trackingDisabled={tracking.loading || tracking.busy !== null || !!tracking.error} onWatchedChange={()=>{void tracking.toggle(episode)}} />
  })}</div>{visible < count && <button className={s.secondary} disabled={tracking.busy !== null} onClick={() => setVisible(value => value + 24)}>Show more episodes</button>}</>}{tracking.error ? <p className={t.error} role="alert">{tracking.error} <button className={s.explore} onClick={tracking.retry}>Try again</button></p> : <p className={t.trackingNotice}>Use the eye button to mark an episode watched. Your choices stay private in your library.</p>}</section>
}

function Gallery({ paths, title }: { paths: string[]; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  return <section id="gallery" className={s.detailSection}><p className={s.eyebrow}>INSIDE THE STORY</p><h2>Frames worth keeping<span>.</span></h2><div className={s.gallery}>{paths.map((path, index) => <button key={path} onClick={() => { setSelected(path); dialog.current?.showModal() }} aria-label={`Open ${title} still ${index + 1}`}><Image src={image(path, 'w780')!} alt={`${title} still ${index + 1}`} fill sizes="(max-width: 600px) 75vw, 350px" className={s.backdrop} /><ImageIcon size={18} /></button>)}</div><dialog ref={dialog} className={s.imageDialog} aria-label={`${title} gallery`} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}><button className={s.dialogClose} onClick={() => dialog.current?.close()} aria-label="Close gallery"><X size={22} /></button>{selected && <Image src={image(selected)!} alt={`${title} still`} width={1280} height={720} className={s.fullStill} />}</dialog></section>
}

export default function TitleDetail({ kind, id }: { kind: Kind; id: number }) {
  const url = `/api/${kind === 'anime' ? 'anilist?type=detail' : `tmdb?type=${kind === 'tv' ? 'tv' : 'movie'}-detail`}&id=${id}`
  const [data, setData] = useState<MovieDetail | TVDetail | AniListMedia | null>(() => cachedMedia(url) || null)
  const [loading, setLoading] = useState(() => !cachedMedia(url))
  const [retry, setRetry] = useState(0)
  const [season, setSeason] = useState<number | null>(null)
  const [failedLogo, setFailedLogo] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    async function fetchDetail() {
      if (!cachedMedia(url)) setLoading(true)
      try {
        const item = await fetchMedia<MovieDetail | TVDetail | AniListMedia>(url, controller.signal)
        if (!item?.id) throw new Error('Invalid title')
        if (!controller.signal.aborted) setData(item)
      } catch { if (!controller.signal.aborted) setData(null) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void fetchDetail()
    return () => controller.abort()
  }, [url, retry])

  if (loading) return <DetailLoading active={kind} />
  if (!data) return <Shell active={kind}><div className={s.detailError}><ErrorPanel title="This story is taking a break." message={kind === 'anime' ? 'The anime provider is temporarily unavailable, or this title couldn’t be found. Please try again shortly.' : 'We couldn’t load this title. Please try again.'} retry={() => setRetry(value => value + 1)} /><Link href={kind === 'anime' ? '/anime' : `/browse?type=${kind}`} className={s.explore}>Back to the collection <ArrowRightIcon /></Link></div></Shell>

  const movie = kind === 'movie' ? data as MovieDetail : null
  const show = kind === 'tv' ? data as TVDetail : null
  const anime = kind === 'anime' ? data as AniListMedia : null
  const tmdb = movie || show
  const name = movie?.title || show?.name || anime?.title.english || anime?.title.romaji || 'Untitled'
  const poster = anime ? anime.coverImage.extraLarge || anime.coverImage.large : image(tmdb?.poster_path, 'w342')
  const backdrop = anime ? image(anime.artwork?.backdrop, 'original') || anime.bannerImage : image(tmdb?.backdrop_path, 'original')
  const logo = anime?.artwork?.logo || [...(tmdb?.images?.logos || [])].sort((a, b) => Number(b.iso_639_1 === 'en') - Number(a.iso_639_1 === 'en'))[0]
  const release = movie?.release_date || show?.first_air_date
  const year = release?.slice(0, 4) || String(anime?.startDate?.year || '')
  const rating = anime ? anime.averageScore ? anime.averageScore / 10 : null : tmdb?.vote_count ? tmdb.vote_average : null
  const genres = anime?.genres || tmdb?.genres?.map(genre => genre.name) || []
  const description = anime ? anime.description?.replace(/<[^>]*>/g, '') || 'No synopsis is available yet.' : tmdb?.overview || 'No synopsis is available yet.'
  const seasons = show?.seasons?.filter(item => item.episode_count > 0) || []
  const regularSeasonCount = seasons.filter(item => item.season_number > 0).length
  const selectedSeason = season ?? seasons.find(item => item.season_number > 0)?.season_number ?? 1
  const seasonRelease = seasons.find(item => item.season_number === selectedSeason)?.air_date
  const canPlay = anime ? Boolean(anime.idMal && anime.startDate?.year && anime.startDate.year <= new Date().getFullYear() && anime.status !== 'NOT_YET_RELEASED') : hasAired(show && seasonRelease !== undefined ? seasonRelease : release || null)
  const playHref = anime ? `/watch/anime/${anime.idMal}?episode=1&anilistId=${id}` : show ? `/watch/tv/${id}?season=${selectedSeason}&episode=1` : `/watch/movie/${id}`
  const trailerKey = anime?.trailer?.site === 'youtube' ? anime.trailer.id : tmdb?.videos?.results?.find(video => video.site === 'YouTube' && video.type === 'Trailer')?.key
  const trailer = trailerKey && /^[\w-]{11}$/.test(trailerKey) ? trailerKey : null
  const cast = tmdb?.credits?.cast?.slice(0, 10) || []
  const creators=[...(show?.created_by||[]).map(person=>({...person,job:'Creator'})),...(tmdb?.credits?.crew||[]).filter(person=>['Director','Writer','Screenplay','Series Director'].includes(person.job))].filter((person,index,all)=>all.findIndex(other=>other.id===person.id)===index).slice(0,8)
  const backdrops = tmdb?.images?.backdrops?.slice(0, 6).map(item => item.file_path) || []
  const similar = tmdb?.similar?.results?.map(item => ({ ...item, media_type: kind })) || []
  const runtime = movie?.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null
  const storyHeading = tmdb?.tagline || 'Worth your time'

  return <Shell active={kind}><Reveal><section className={s.detailHero}>
    {backdrop && <div className={s.heroImage}><Image src={backdrop} alt="" fill sizes="100vw" quality={85} loading="eager" className={s.backdrop} /></div>}<div className={s.heroShade} />
    <div className={s.detailHeroContent}><Link href={kind === 'anime' ? '/anime' : `/browse?type=${kind}`} className={s.breadcrumb}>{kind === 'tv' ? 'Series' : kind === 'anime' ? 'Anime' : 'Movies'} <ChevronRight size={12} /> {name}</Link><p className={s.heroKicker}><span />{kind === 'tv' ? 'A STORY TO STAY WITH' : kind === 'anime' ? 'ENTER ANOTHER WORLD' : 'TONIGHT’S FEATURE'}</p>
      <h1 className={s.heroTitle}>{logo && !failedLogo ? <Image src={image(logo.file_path, 'original')!} alt={name} width={logo.width || 420} height={logo.height || 150} className={s.titleLogo} onError={() => setFailedLogo(true)} sizes="(max-width: 600px) 80vw, 420px" /> : <span className={`${s.titleFallback} ${name.length > 35 ? s.compactTitle : ''}`}>{name}</span>}</h1>
      <div className={s.heroMeta}>{rating !== null && <span className={s.heroRating}><Star size={13} fill="currentColor" />{rating.toFixed(1)}</span>}<span>{year}</span>{runtime && <span>{runtime}</span>}<span className={s.typeBadge}>{show ? `${regularSeasonCount} ${regularSeasonCount === 1 ? 'season' : 'seasons'}` : anime ? 'Anime' : 'Movie'}</span>{genres.slice(0, 3).map(genre => <span key={genre}>{genre}</span>)}</div><p className={s.synopsis}>{description}</p>
      <div className={s.heroButtons}>{canPlay ? <Link prefetch={false} href={playHref} className={s.primary}><Play size={17} fill="currentColor" />{show ? `Watch S${selectedSeason} · E1` : anime ? 'Watch episode 1' : 'Watch now'}</Link> : <span className={`${s.secondary} ${s.unavailable}`}><Clock size={16} />{anime && !anime.idMal ? 'Playback unavailable' : 'Coming soon'}</span>}<WatchlistButton tmdbId={id} mediaType={kind} title={name} posterPath={anime ? anime.coverImage.large : tmdb?.poster_path || ''} className={s.secondary} />{trailer && <a href="#trailer" className={s.trailerLink}><Play size={15} /> Trailer</a>}</div>
    </div></section>
    <div className={s.detailContent}>{movie && <FilmCollectionLink value={movie.belongs_to_collection} />}<nav className={s.detailTabs} aria-label="Title sections"><a href="#overview">Overview</a>{(show || anime) && <a href="#episodes">Episodes</a>}{trailer && <a href="#trailer">Trailer</a>}{cast.length > 0 && <a href="#cast">Cast</a>}{backdrops.length > 0 && <a href="#gallery">Gallery</a>}</nav>
      <div className={s.overviewGrid}><section id="overview" className={s.detailSection}><p className={s.eyebrow}>THE STORY</p><h2>{storyHeading}{!/[.!?…]$/.test(storyHeading) && <span>.</span>}</h2><p className={s.fullDescription}>{description}</p><div className={s.genreChips}>{genres.map(genre => <span key={genre}>{genre}</span>)}</div><NookReviews key={`${kind}:${id}`} kind={kind} id={id} genres={genres} /></section>{trailer ? <Trailer id={trailer} backdrop={backdrop || poster} title={name} /> : <section className={s.detailSection}><p className={s.eyebrow}>IN FOCUS</p><h2>About this title<span>.</span></h2><p className={s.muted}>Every story starts somewhere. Explore the details below.</p></section>}</div>
      <div className={s.titleFacts}>{poster && <div className={s.factPoster}><Image src={poster} alt={`${name} poster`} fill sizes="100px" className={s.cardImage} /></div>}<dl>{year && <div><dt>Released</dt><dd>{release ? dateLabel(release) : year}</dd></div>}{runtime && <div><dt>Runtime</dt><dd>{runtime}</dd></div>}{data.status && <div><dt>Status</dt><dd>{data.status.replaceAll('_', ' ').toLowerCase()}</dd></div>}{movie && movie.budget > 0 && <div><dt>Budget</dt><dd>{money(movie.budget)}</dd></div>}{movie && movie.revenue > 0 && <div><dt>Box office</dt><dd>{money(movie.revenue)}</dd></div>}{show?.networks?.length ? <div><dt>Network</dt><dd>{show.networks.map(network => network.name).join(', ')}</dd></div> : null}{anime?.studios?.nodes?.length ? <div><dt>Studio</dt><dd>{anime.studios.nodes.map(studio => studio.name).join(', ')}</dd></div> : null}{anime?.episodes && <div><dt>Episodes</dt><dd>{anime.episodes}</dd></div>}<div><dt>Collection</dt><dd><Bookmark size={13} /> {kind === 'anime' ? 'Anime' : kind === 'tv' ? 'Series' : 'Movies'}</dd></div></dl></div>
      {show && seasons.length > 0 && <Episodes id={id} season={selectedSeason} seasons={seasons} onSeason={setSeason} title={name} poster={show.poster_path || ''} />}{anime && <AnimeEpisodes anime={anime} />}
      {cast.length > 0 && <section id="cast" className={s.detailSection}><p className={s.eyebrow}>THE PEOPLE BEHIND THE STORY</p><h2>Meet the cast<span>.</span></h2><div className={s.cast}>{cast.map(actor => <Link className={ps.personLink} href={`/person/${actor.id}`} key={actor.id}><div className={s.actorPhoto}>{actor.profile_path ? <Image src={image(actor.profile_path, 'w185')!} alt="" fill sizes="100px" className={s.cardImage} /> : <span>{actor.name[0]}</span>}</div><h3>{actor.name}</h3><p>{actor.character}</p></Link>)}</div></section>}
      {creators.length>0&&<section className={`${s.detailSection} ${ps.creators}`}><p className={s.eyebrow}>BEHIND THE CAMERA</p><h2>The storytellers<span>.</span></h2><div className={ps.creatorList}>{creators.map(person=><Link key={person.id} href={`/person/${person.id}`}><strong>{person.name}</strong><span>{person.job}</span></Link>)}</div></section>}
      {backdrops.length > 0 && <Gallery paths={backdrops} title={name} />}{similar.length > 0 && <Shelf items={similar} label="Stay in this world" eyebrow="MORE LIKE THIS" href={`/browse?type=${kind}`} />}
    </div></Reveal></Shell>
}

function ArrowRightIcon() { return <ChevronRight size={16} /> }
