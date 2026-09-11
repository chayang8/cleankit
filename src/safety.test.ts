import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, symlink, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { HOME, resolveDeletable, tildify, UnsafePathError } from './safety.js'

let sandbox: string

beforeAll(async () => {
  // Inside HOME on purpose: the guards are about *where* in home, not whether.
  sandbox = await mkdtemp(path.join(HOME, '.moonstone-test-'))
})

afterAll(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

describe('resolveDeletable', () => {
  it('accepts a real directory inside home', async () => {
    const target = path.join(sandbox, 'cache')
    await mkdir(target)
    await expect(resolveDeletable(target)).resolves.toBe(target)
  })

  it('rejects home itself', async () => {
    await expect(resolveDeletable(HOME)).rejects.toThrow(UnsafePathError)
  })

  it('rejects protected user directories', async () => {
    await expect(resolveDeletable(path.join(HOME, 'Documents'))).rejects.toThrow(
      /protected directory|does not exist/,
    )
  })

  it('rejects paths outside home', async () => {
    await expect(resolveDeletable('/usr/lib')).rejects.toThrow(/outside home/)
  })

  it('rejects a symlink that escapes home', async () => {
    const link = path.join(sandbox, 'escape')
    await symlink('/usr/lib', link)
    await expect(resolveDeletable(link)).rejects.toThrow(/outside home/)
  })

  it('follows a symlink to its real target inside home', async () => {
    const real = path.join(sandbox, 'real')
    const link = path.join(sandbox, 'link')
    await mkdir(real)
    await symlink(real, link)
    await expect(resolveDeletable(link)).resolves.toBe(real)
  })

  it('rejects a path that does not exist', async () => {
    await expect(resolveDeletable(path.join(sandbox, 'ghost'))).rejects.toThrow(/does not exist/)
  })

  it('rejects traversal back out of an allowed path', async () => {
    await expect(resolveDeletable(path.join(sandbox, '..', '..', '..'))).rejects.toThrow(
      UnsafePathError,
    )
  })
})

describe('tildify', () => {
  it('shortens the home prefix', async () => {
    const file = path.join(sandbox, 'note.txt')
    await writeFile(file, '')
    expect(tildify(file).startsWith('~/')).toBe(true)
  })

  it('leaves other paths alone', () => {
    expect(tildify('/usr/lib')).toBe('/usr/lib')
  })
})
