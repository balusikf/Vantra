'use client'

import { AniListMedia } from '@/lib/anilist'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface AnimeCardProps {
  anime: AniListMedia
}

export default function AnimeCard({ anime }: AnimeCardProps) {
  const router = useRouter()
  const title = anime.title.english || anime.title.romaji
  const year = anime.startDate.year || ''
  const rating = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A'

  return (
    <div
      onClick={() => router.push(`/anime/${anime.id}`)}
      className="relative flex-shrink-0 w-36 md:w-44 cursor-pointer group/card"
    >
      {/* Poster */}
      <div className="relative w-full aspect-[2/3] rounded-md overflow-hidden bg-zinc-800">
        {anime.coverImage.large ? (
          <Image
            src={anime.coverImage.large}
            alt={title}
            fill
            className="object-cover group-hover/card:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 144px, 176px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-sm">
            No Image
          </div>
        )}

        {/* ANIME badge */}
        <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded">
          ANIME
        </div>

        {/* Overlay pri hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-2 px-1">
        <p className="text-white text-sm font-medium truncate">{title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-yellow-400 text-xs">★ {rating}</span>
          {year && <span className="text-zinc-500 text-xs">{year}</span>}
          {anime.episodes && (
            <span className="text-zinc-500 text-xs">{anime.episodes} ep</span>
          )}
        </div>
      </div>
    </div>
  )
}