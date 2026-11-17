import type { StreamProvider } from './stream-providers'

export function nextPlaybackSource(providers: StreamProvider[], active: StreamProvider | null): StreamProvider | null {
  const alternatives = providers.filter(provider => provider.url !== active?.url)
  if (!alternatives.length) return null
  const current = providers.findIndex(provider => provider.url === active?.url)
  return providers.slice(current + 1).find(provider => provider.url !== active?.url) || alternatives[0]
}
