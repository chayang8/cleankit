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

describe('scanBuildArtifacts', () => {
  it('only reports build output that sits next to its marker file, and only when stale', async () => {
    const { mkdtemp, mkdir, writeFile, utimes } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const pathMod = await import('node:path')
    const { scanBuildArtifacts } = await import('./heavy.js')

    const root = await mkdtemp(pathMod.join(tmpdir(), 'cleankit-build-'))
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000)

    // A stale Rust project: target/ next to Cargo.toml.
    const rust = pathMod.join(root, 'rust-app')
    await mkdir(pathMod.join(rust, 'target'), { recursive: true })
    await writeFile(pathMod.join(rust, 'Cargo.toml'), '[package]')
    await writeFile(pathMod.join(rust, 'target', 'blob'), 'x'.repeat(1024))
    await utimes(pathMod.join(rust, 'target'), old, old)

    // A `dist` with no manifest beside it: somebody's data, not a build.
    const data = pathMod.join(root, 'photos')
    await mkdir(pathMod.join(data, 'dist'), { recursive: true })
    await writeFile(pathMod.join(data, 'dist', 'blob'), 'x'.repeat(1024))
    await utimes(pathMod.join(data, 'dist'), old, old)

    // An active project: marker present, but the output was touched today.
    const active = pathMod.join(root, 'web-app')
    await mkdir(pathMod.join(active, '.next'), { recursive: true })
    await writeFile(pathMod.join(active, 'package.json'), '{}')

    const finding = await scanBuildArtifacts([root], 90)
    const found = finding.entries.map((entry) => entry.path)

    expect(found).toEqual([pathMod.join(rust, 'target')])
    expect(finding.bytes).toBeGreaterThan(0)

    await (await import('node:fs/promises')).rm(root, { recursive: true, force: true })
  })
})
