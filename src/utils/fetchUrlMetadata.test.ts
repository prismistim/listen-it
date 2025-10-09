import { describe, expect, it } from 'vitest'

import { checkTargetHost } from './fetchUrlMetadata'

describe('checkTargetHost', () => {
  it('returns true for an allowed primary host', () => {
    const result = checkTargetHost('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(result).toBe(true)
  })

  it('returns true for an allowed subdomain host', () => {
    const result = checkTargetHost('https://music.youtube.com/playlist?list=PL123')
    expect(result).toBe(true)
  })

  it('returns true when the hostname embeds a listed host', () => {
    const result = checkTargetHost('https://foo.bandcamp.com/releases')
    expect(result).toBe(true)
  })

  it('returns false for unsupported hosts', () => {
    const result = checkTargetHost('https://example.com/song')
    expect(result).toBe(false)
  })

  it('returns false for empty input', () => {
    const result = checkTargetHost('')
    expect(result).toBe(false)
  })

  it('returns false for moedev', () => {
    const result = checkTargetHost('https://moemoe.dev/@ai/pages/listen_it_20251009_18eh')
    expect(result).toBe(false)
  })
})
