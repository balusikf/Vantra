import type { BotFrame } from '../vendor/bloub/engine'

export type NookAccessories = Readonly<{ beanie: boolean; glasses: boolean; bow: boolean }>
export type NookAccessory = keyof NookAccessories
export type NookAttachmentFrame = Pick<BotFrame, 'bodyAlpha' | 'attachments'>
export const bareNook: NookAccessories = Object.freeze({ beanie: false, glasses: false, bow: false })
export const nookAccessoryNames: Record<NookAccessory, string> = { beanie: 'Beanie', glasses: 'Round glasses', bow: 'Bow tie' }

export function parseNookAccessories(raw: string | null): NookAccessories {
  try {
    const value = raw ? JSON.parse(raw) : null
    if (!value || value.version !== 1 || !value.items || typeof value.items !== 'object') return bareNook
    return Object.freeze({ beanie: value.items.beanie === true, glasses: value.items.glasses === true, bow: value.items.bow === true })
  } catch { return bareNook }
}

export function encodeNookAccessories(items: NookAccessories) {
  return JSON.stringify({ version: 1, items: { beanie: items.beanie === true, glasses: items.glasses === true, bow: items.bow === true } })
}

const hiddenStates = new Set(['thinking', 'alert', 'exclaim', 'sleep', 'burst', 'comet'])
const clamp = (value: number) => Math.max(0, Math.min(1, value))

// Blinks compress the eye artwork, not the head. Use the engine's unblinked
// attachment anchors, including its depth, morph and silhouette-fit offsets.
export function nookAccessoryOpacity(frame: NookAttachmentFrame, state: string) {
  if (hiddenStates.has(state) || !frame.attachments.eyes.length) return 0
  const front = Math.max(...frame.attachments.eyes.map(eye => eye.depth))
  return clamp(frame.bodyAlpha) * clamp(frame.attachments.faceAlpha) * clamp((front - .04) / .18)
}

function radial(radii: number[], angle: number) {
  const turn = Math.PI * 2
  const index = ((angle % turn + turn) % turn) / turn * radii.length
  const a = Math.floor(index), amount = index - a
  return (radii[a % radii.length] ?? 1) * (1 - amount) + (radii[(a + 1) % radii.length] ?? 1) * amount
}

export function nookBodyAccessories(frame: NookAttachmentFrame, radius = 100) {
  const sil = frame.attachments.silhouette
  const cos = Math.cos(sil.rot), sin = Math.sin(sil.rot)
  const matrix = [sil.sx * cos, sil.sy * sin, -sil.sx * sin, sil.sy * cos, sil.cx * radius, sil.cy * radius]
  // Measure the current morph, rather than the target shape. A hat fitted to a
  // circle must not float above a triangle or jump on interrupted transitions.
  const leftAngle = -Math.PI + .58, rightAngle = -.58
  const leftRadius = radial(sil.radii, leftAngle) * radius
  const rightRadius = radial(sil.radii, rightAngle) * radius
  const left = { x: Math.cos(leftAngle) * leftRadius, y: Math.sin(leftAngle) * leftRadius }
  const right = { x: Math.cos(rightAngle) * rightRadius, y: Math.sin(rightAngle) * rightRadius }
  let top = 0
  for (let i = 0; i <= 32; i++) {
    const angle = -Math.PI + i / 32 * Math.PI
    top = Math.min(top, Math.sin(angle) * radial(sil.radii, angle) * radius)
  }
  const middle = (left.x + right.x) / 2
  const width = right.x - left.x
  const band = Math.max(left.y, right.y) + .07 * radius
  const crown = top - .15 * radius
  return { matrix, left, right, middle, width, band, crown, bowY: radial(sil.radii, Math.PI / 2) * radius * .73 }
}

export function transformNookPoint(matrix: readonly number[], x: number, y: number) {
  return { x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] }
}
