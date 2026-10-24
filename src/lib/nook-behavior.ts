type Point = { x: number; y: number }
type Box = { left: number; top: number; width: number; height: number }
const clamp = (value: number) => Math.max(-1, Math.min(1, value))

// The eye model uses positive pitch for UP. Bound the angle even when the
// pointer is far across the page, so both eyes remain on the silhouette.
export function nookGaze(pointer: Point, box: Box) {
  if (box.width <= 0 || box.height <= 0 || !Number.isFinite(pointer.x + pointer.y + box.left + box.top + box.width + box.height)) return null
  return {
    yaw: clamp((pointer.x - box.left - box.width / 2) / Math.max(180, box.width * 1.5)) * 36,
    pitch: clamp((box.top + box.height / 2 - pointer.y) / Math.max(160, box.height * 1.5)) * 25,
    mix: 1, spin: 0, wander: .08,
  }
}

// Only the active avatar's RAF advances this visible-time clock. User reactions
// always postpone the next spontaneous beat; no background timer is needed.
export class NookIdleClock {
  private next: number
  private index = 0
  private random: () => number
  constructor(random = Math.random) { this.random = random; this.next = 9 + random() * 6 }
  postpone(now: number) { this.next = now + 10 + this.random() * 8 }
  sample(now: number, state: string, enabled: boolean): 'wink' | 'wide' | 'egg' | 'happy' | 'curious' | 'tired' | null {
    if (!enabled || state !== 'idle' || now < this.next) return null
    this.postpone(now)
    return (['wink', 'wide', 'wink', 'happy', 'curious', 'tired', 'egg'] as const)[this.index++ % 7]
  }
}

export function nookBreathing(time: number, amount: number) {
  const breath = Math.sin(time * Math.PI * 2 / 4.8) * amount
  return `translate(0 ${(-1.5 * breath).toFixed(3)}) rotate(${(.7 * Math.sin(time * .65) * amount).toFixed(3)}) scale(${(1 - .006 * breath).toFixed(4)} ${(1 + .012 * breath).toFixed(4)})`
}
