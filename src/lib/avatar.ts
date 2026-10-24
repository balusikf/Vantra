const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

// Profile fields are user-editable. Never turn an arbitrary stored URL into a
// browser request, even when next/image is rendered without its optimizer.
export function safeAvatarUrl(avatarUrl: string | null | undefined, userId: string | undefined, projectUrl: string | undefined): string | null {
  if (!avatarUrl || !userId || !projectUrl) return null
  const path = ownedAvatarPath(avatarUrl, userId, projectUrl)
  if (!path || !/\.(jpe?g|png|webp)$/i.test(path)) return null
  const url = new URL(avatarUrl)
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) return null
  url.hash = ''
  return url.href
}

export function validateAvatar(file: { type: string; size: number }) {
  if (!allowedTypes.has(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.')
}

// Only remove a file belonging to this user in this project's avatar bucket.
export function ownedAvatarPath(avatarUrl: string, userId: string, projectUrl: string): string | null {
  try {
    const url = new URL(avatarUrl)
    const prefix = '/storage/v1/object/public/avatars/'
    if (url.origin !== new URL(projectUrl).origin || !url.pathname.startsWith(prefix)) return null
    const path = decodeURIComponent(url.pathname.slice(prefix.length))
    if (path.includes('..') || path.includes('\\')) return null
    return path.startsWith(`${userId}/`) || new RegExp(`^${userId}\\.(jpg|jpeg|png|webp)$`, 'i').test(path) ? path : null
  } catch {
    return null
  }
}

export async function prepareAvatar(file: File): Promise<Blob> {
  validateAvatar(file)
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not process this image.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not process this image.')), 'image/webp', .85))
    if (blob.type !== 'image/webp' || blob.size > 2 * 1024 * 1024) throw new Error('Could not compress this image. Please choose another.')
    return blob
  } finally {
    bitmap.close()
  }
}

export async function persistAvatar<T>({ upload, saveProfile, remove, previous }: {
  upload: () => Promise<T>
  saveProfile: (uploaded: T) => Promise<void>
  remove: (path: T) => Promise<void>
  previous: T | null
}): Promise<{ uploaded: T; cleanupFailed: boolean }> {
  const uploaded = await upload()
  // A timeout may occur after the server committed the profile update.
  // Keep both files on failure; deleting either could break the saved profile.
  await saveProfile(uploaded)
  let cleanupFailed = false
  if (previous !== null && previous !== uploaded) {
    try { await remove(previous) } catch { cleanupFailed = true }
  }
  return { uploaded, cleanupFailed }
}
