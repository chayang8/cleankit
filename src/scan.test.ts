import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { diskUsage, scanDsStore, scanNodeModules, scanTarget } from './scan.js'
import { HOME } from './safety.js'
import type { Target } from './targets.js'

let sandbox: string

beforeEach(async () => {
  sandbox = await mkdtemp(path.join(HOME, '.moonstone-test-'))
})

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

const DAY = 24 * 60 * 60 * 1000

async function makeProject(name: string, ageDays: number): Promise<string> {
  const project = path.join(sandbox, name)
  await mkdir(path.join(project, 'node_modules', 'left-pad'), { recursive: true })
  await writeFile(path.join(project, 'package.json'), '{}')
  await writeFile(path.join(project, 'node_modules', 'left-pad', 'index.js'), 'x')
  const when = new Date(Date.now() - ageDays * DAY)
  await utimes(path.join(project, 'package.json'), when, when)
  await utimes(project, when, when)
  return project
}

describe('diskUsage', () => {
  it('returns zero for a missing path instead of throwing', async () => {
    await expect(diskUsage(path.join(sandbox, 'ghost'))).resolves.toBe(0)
  })

  it('sums nested files', async () => {
    await mkdir(path.join(sandbox, 'nested'))
    await writeFile(path.join(sandbox, 'nested', 'a'), 'x'.repeat(4096))
    expect(await diskUsage(sandbox)).toBeGreaterThan(0)
  })
})

describe('scanTarget', () => {
  it('lists children for a contents-mode target', async () => {
    await mkdir(path.join(sandbox, 'a'))
    await mkdir(path.join(sandbox, 'b'))
    const target: Target = {
      id: 't', group: 'dev', label: 'test', recovery: 'n/a',
      mode: 'contents', paths: [sandbox],
    }

    const finding = await scanTarget(target)

    expect(finding.entries.map((entry) => path.basename(entry.path)).sort()).toEqual(['a', 'b'])
  })

  it('lists the directory itself for a self-mode target', async () => {
    const target: Target = {
      id: 't', group: 'dev', label: 'test', recovery: 'n/a',
      mode: 'self', paths: [sandbox],
    }

    const finding = await scanTarget(target)

    expect(finding.entries.map((entry) => entry.path)).toEqual([sandbox])
  })

  it('ignores paths that are not installed', async () => {
    const target: Target = {
      id: 't', group: 'dev', label: 'test', recovery: 'n/a',
      mode: 'contents', paths: [path.join(sandbox, 'not-here')],
    }

    expect((await scanTarget(target)).entries).toEqual([])
  })
})

describe('scanNodeModules', () => {
  it('reports node_modules of an idle project', async () => {
    const stale = await makeProject('stale', 200)

    const finding = await scanNodeModules([sandbox], 90)

    expect(finding.entries.map((entry) => entry.path)).toEqual([
      path.join(stale, 'node_modules'),
    ])
  })

  it('leaves a recently touched project alone', async () => {
    await makeProject('fresh', 1)

    const finding = await scanNodeModules([sandbox], 90)

    expect(finding.entries).toEqual([])
  })

  it('does not descend into node_modules of a matched project', async () => {
    const stale = await makeProject('stale', 200)
    const nested = path.join(stale, 'node_modules', 'pkg')
    await mkdir(path.join(nested, 'node_modules'), { recursive: true })

    const finding = await scanNodeModules([sandbox], 90)

    expect(finding.entries).toHaveLength(1)
  })
})

describe('scanDsStore', () => {
  it('finds .DS_Store files recursively', async () => {
    await mkdir(path.join(sandbox, 'deep', 'deeper'), { recursive: true })
    await writeFile(path.join(sandbox, '.DS_Store'), 'x')
    await writeFile(path.join(sandbox, 'deep', 'deeper', '.DS_Store'), 'x')

    const finding = await scanDsStore([sandbox])

    expect(finding.entries).toHaveLength(2)
  })

  it('returns nothing for a clean tree', async () => {
    expect((await scanDsStore([sandbox])).entries).toEqual([])
  })
})
