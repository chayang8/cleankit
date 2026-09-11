import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { removeFindings } from './clean.js'
import { HOME } from './safety.js'
import type { Finding } from './scan.js'

let sandbox: string

beforeEach(async () => {
  sandbox = await mkdtemp(path.join(HOME, '.moonstone-test-'))
})

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

function finding(paths: string[]): Finding {
  return {
    targetId: 'test',
    group: 'dev',
    label: 'test',
    recovery: 'n/a',
    entries: paths.map((p) => ({ path: p, bytes: 100 })),
    bytes: paths.length * 100,
  }
}

describe('removeFindings', () => {
  it('deletes allowed paths and reports the freed bytes', async () => {
    const victim = path.join(sandbox, 'cache')
    await mkdir(victim)
    await writeFile(path.join(victim, 'blob'), 'x')

    const result = await removeFindings([finding([victim])], { dryRun: false })

    expect(result.removed).toEqual([victim])
    expect(result.freed).toBe(100)
    await expect(stat(victim)).rejects.toThrow()
  })

  it('dry run touches nothing but still reports the plan', async () => {
    const victim = path.join(sandbox, 'cache')
    await mkdir(victim)

    const result = await removeFindings([finding([victim])], { dryRun: true })

    expect(result.removed).toEqual([victim])
    expect(result.freed).toBe(100)
    await expect(stat(victim)).resolves.toBeTruthy()
  })

  it('skips unsafe paths without aborting the rest of the run', async () => {
    const victim = path.join(sandbox, 'cache')
    await mkdir(victim)

    const result = await removeFindings([finding(['/usr/lib', victim])], { dryRun: false })

    expect(result.removed).toEqual([victim])
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].reason).toMatch(/outside home/)
  })

  it('never deletes home even if a finding names it', async () => {
    const result = await removeFindings([finding([HOME])], { dryRun: false })

    expect(result.removed).toEqual([])
    expect(result.skipped[0].reason).toMatch(/protected directory/)
    await expect(stat(HOME)).resolves.toBeTruthy()
  })

  it('reports progress for each entry', async () => {
    const victim = path.join(sandbox, 'cache')
    await mkdir(victim)
    const seen: string[] = []

    await removeFindings([finding([victim])], { dryRun: true, onProgress: (p) => seen.push(p) })

    expect(seen).toEqual([victim])
  })
})
