'use client'

import type { NookAccessories, NookAttachmentFrame } from '@/lib/nook-cosmetics'
import { useNook } from './NookProvider'
import NookOutfit from './NookOutfit'

const iconFrame: NookAttachmentFrame = { bodyAlpha: 1, attachments: {
  faceAlpha: 1, silhouette: { radii: new Array(32).fill(1), rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 },
  eyes: [
    { index: 0, matrix: [1, 0, 0, 1, -39.48, -9.87], depth: 1, width: 24, height: 45 },
    { index: 1, matrix: [1, 0, 0, 1, 35.19, -16.74], depth: 1, width: 24, height: 45 },
  ],
} }

// The launcher stays static and lightweight; it never loads the animation engine.
export default function NookIcon({ size = 26, items }: { size?: number; items?: NookAccessories }) {
  const { accessories } = useNook()
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" data-nook-icon=""><path d="M27.3 16.2c0 7.2-4.6 11.6-11.6 11.6C8.6 27.8 4 23 4 16.1 4 9.2 8.6 4.2 15.7 4.2c6.9 0 11.6 5 11.6 12Z" fill="currentColor" /><path d="M11.4 12.2v5.3M20.1 11.4v5.3" stroke="#161619" strokeWidth="2.8" strokeLinecap="round" /><g transform="translate(16 16) scale(.1165)"><NookOutfit items={items ?? accessories} frame={iconFrame} /></g></svg>
}
