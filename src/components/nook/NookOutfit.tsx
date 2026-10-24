import { nookAccessoryOpacity, nookBodyAccessories, transformNookPoint, type NookAccessories, type NookAttachmentFrame } from '@/lib/nook-cosmetics'

const matrix = (values: readonly number[]) => `matrix(${values.join(' ')})`

// This layer shares the avatar's breathing/gesture groups. Body accessories use
// the sampled silhouette; eyewear uses the same unblinked tangent as each eye.
export default function NookOutfit({ items, frame, state = 'idle', clipId }: { items: NookAccessories; frame: NookAttachmentFrame; state?: string; clipId?: string }) {
  if (!items.beanie && !items.glasses && !items.bow) return null
  const opacity = nookAccessoryOpacity(frame, state)
  const fit = nookBodyAccessories(frame)
  const { left: l, right: r, middle: mid, width, crown, band } = fit
  const cuff = 14
  const eyes = frame.attachments.eyes
  const lensSize = (eye: typeof eyes[number]) => ({ x: Math.max(24, eye.width / 2 + 3), y: Math.max(26, eye.height / 2 + 4) })
  const leftEye = eyes.find(eye => eye.index === 0), rightEye = eyes.find(eye => eye.index === 1)
  const bridgeA = leftEye ? transformNookPoint(leftEye.matrix, lensSize(leftEye).x, -2) : null
  const bridgeB = rightEye ? transformNookPoint(rightEye.matrix, -lensSize(rightEye).x, -2) : null

  return <g data-nook-outfit="" data-nook-outfit-visible={opacity > .01 ? 'true' : 'false'} opacity={opacity} pointerEvents="none">
    {items.beanie && <g transform={matrix(fit.matrix)} data-nook-accessory="beanie">
      <path d={`M${l.x} ${l.y} C${l.x - 5} ${crown + 8} ${mid - width * .27} ${crown - 4} ${mid} ${crown} C${mid + width * .33} ${crown - 3} ${r.x + 5} ${crown + 12} ${r.x} ${r.y} Q${mid} ${band + 10} ${l.x} ${l.y}Z`} fill="#292b34" stroke="#747480" strokeWidth="2" />
      {[-.30, -.15, 0, .15, .30].map(amount => <path key={amount} d={`M${mid + width * amount * .72} ${crown + 9 + Math.abs(amount) * 12} Q${mid + width * amount} ${(crown + band) / 2} ${mid + width * amount * 1.1} ${band - 9}`} fill="none" stroke="#4b4d59" strokeWidth="2.2" strokeLinecap="round" />)}
      <path d={`M${l.x - 2} ${l.y - 7} Q${mid} ${band - 2} ${r.x + 2} ${r.y - 7} L${r.x + 1} ${r.y + cuff - 7} Q${mid} ${band + cuff} ${l.x - 1} ${l.y + cuff - 7}Z`} fill="#454650" stroke="#85838e" strokeWidth="1.6" strokeLinejoin="round" />
      {[-.35, -.25, -.15, -.05, .05, .15, .25, .35].map(amount => <path key={amount} d={`M${mid + width * amount} ${band - 3 - Math.abs(amount) * 15} l0 9`} stroke="#6e6e7a" strokeWidth="1.5" strokeLinecap="round" />)}
      <g transform={`translate(${mid + width * .20} ${band - 6})`}><rect width="15" height="15" rx="3" fill="#efdadf" /><path d="m4 4 3.5 6L11 4" fill="none" stroke="#bb263e" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>}
    {items.bow && <g transform={`${matrix(fit.matrix)} translate(3 ${fit.bowY})`} data-nook-accessory="bow">
      <path d="M-3-4C-12-13-25-17-27-10L-28 10C-26 18-12 12-3 5ZM3-4C12-13 25-17 27-10L28 10C26 18 12 12 3 5Z" fill="#efd6de" stroke="#a75d73" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m-20-6 13 6-13 6M20-6 7 0l13 6" fill="none" stroke="#c98a9f" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="-6" y="-8" width="12" height="16" rx="4" fill="#d994aa" stroke="#a75d73" strokeWidth="1.7" />
      <path d="M-3-5v10" stroke="#f8e9ef" strokeWidth="1.6" strokeLinecap="round" />
    </g>}
    {items.glasses && <g data-nook-accessory="glasses" clipPath={clipId ? `url(#${clipId})` : undefined} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {bridgeA && bridgeB && <path d={`M${bridgeA.x} ${bridgeA.y} Q${(bridgeA.x + bridgeB.x) / 2} ${(bridgeA.y + bridgeB.y) / 2 - 8} ${bridgeB.x} ${bridgeB.y}`} stroke="#e8dce4" strokeWidth="3.3" opacity={Math.min(1, leftEye!.depth / .18, rightEye!.depth / .18)} />}
      {eyes.map(eye => {
        const size = lensSize(eye)
        return <g key={eye.index} transform={matrix(eye.matrix)} opacity={Math.min(1, eye.depth / .18)}>
          <path d={`M${eye.index === 0 ? -size.x : size.x} -2 l${eye.index === 0 ? -13 : 13} -5`} stroke="#e8dce4" strokeWidth="3.3" />
          <ellipse rx={size.x} ry={size.y} stroke="#39202c" strokeWidth="6" />
          <ellipse rx={size.x} ry={size.y} fill="#f6e7ee0a" stroke="#f2dee8" strokeWidth="3.3" />
          <path d={`M${-size.x * .6} ${-size.y * .35} q0 ${-size.y * .35} ${size.x * .35} ${-size.y * .4}`} stroke="#fff5f6" strokeWidth="1.4" opacity=".45" />
        </g>
      })}
    </g>}
  </g>
}
