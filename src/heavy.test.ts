import { describe, expect, it } from 'vitest'
import { compareVersions, parseExtensionDir, supersededExtensions } from './heavy.js'

describe('parseExtensionDir', () => {
  it('splits publisher.name and version', () => {
    expect(parseExtensionDir('eamodio.gitlens-17.4.1')).toEqual({ id: 'eamodio.gitlens', version: '17.4.1' })
  })

  it('drops the platform suffix', () => {
    expect(parseExtensionDir('openai.chatgpt-26.908.31748-darwin-arm64')).toEqual({
      id: 'openai.chatgpt',
      version: '26.908.31748',
    })
  })

  it('returns null for unversioned directories', () => {
    expect(parseExtensionDir('extensions.json')).toBeNull()
    expect(parseExtensionDir('.obsolete')).toBeNull()
  })
})

describe('compareVersions', () => {
  it('compares numerically, not lexically', () => {
    expect(compareVersions('26.908.31748', '26.908.9')).toBeGreaterThan(0)
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0)
    expect(compareVersions('3.1.4', '3.1.4')).toBe(0)
  })
})

describe('supersededExtensions', () => {
  it('keeps the newest version of each extension', () => {
    const stale = supersededExtensions([
      'openai.chatgpt-26.825.32147-darwin-arm64',
      'openai.chatgpt-26.908.31748-darwin-arm64',
      'openai.chatgpt-26.903.71938-darwin-arm64',
      'eamodio.gitlens-17.4.1',
    ])
    expect(stale).toEqual([
      'openai.chatgpt-26.825.32147-darwin-arm64',
      'openai.chatgpt-26.903.71938-darwin-arm64',
    ])
  })

  it('reports nothing when every extension is unique', () => {
    expect(supersededExtensions(['a.b-1.0.0', 'c.d-2.0.0'])).toEqual([])
  })

  it('ignores files that are not versioned extension directories', () => {
    expect(supersededExtensions(['extensions.json', '.obsolete', 'a.b-1.0.0'])).toEqual([])
  })
})
