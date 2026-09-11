import path from 'node:path'
import { lstat, readdir, stat } from 'node:fs/promises'
import type { Group, Target } from './targets.js'

export interface Entry {
  path: string
  bytes: number
}

export interface Finding {
  targetId: string
  group: Group
  label: string
  recovery: string
  /** Present on advisory findings: the command that removes this, run by hand. */
  advice?: string
  entries: Entry[]
  bytes: number
}

/** Runs `work` over `items` with at most `limit` in flight. */
async function pool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await work(items[index])
    }
  })
  await Promise.all(runners)
  return results
}

/**
 * Disk usage of `target`, in allocated bytes (blocks × 512), never following
 * symlinks. Unreadable entries count as zero rather than aborting the scan —
 * a permission-denied cache folder should not kill the whole report.
 */
export async function diskUsage(target: string): Promise<number> {
  let info
  try {
    info = await lstat(target)
  } catch {
    return 0
  }
  if (info.isSymbolicLink()) return 0
  if (!info.isDirectory()) return info.blocks * 512

  let names: string[]
  try {
    names = await readdir(target)
  } catch {
    return info.blocks * 512
  }

  const children = await pool(names, 16, (name) => diskUsage(path.join(target, name)))
  return children.reduce((sum, bytes) => sum + bytes, info.blocks * 512)
}

/** Expands one target definition into the concrete paths that would be removed. */
export async function scanTarget(target: Target): Promise<Finding> {
  const entries: Entry[] = []

  for (const base of target.paths) {
    let info
    try {
      info = await lstat(base)
    } catch {
      continue // not installed on this machine
    }

    if (target.mode === 'self' || !info.isDirectory()) {
      entries.push({ path: base, bytes: await diskUsage(base) })
      continue
    }

    let names: string[]
    try {
      names = await readdir(base)
    } catch {
      continue
    }
    const sized = await pool(names, 8, async (name) => {
      const child = path.join(base, name)
      return { path: child, bytes: await diskUsage(child) }
    })
    entries.push(...sized)
  }

  return {
    targetId: target.id,
    group: target.group,
    label: target.label,
    recovery: target.recovery,
    entries,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
  }
}

const SKIP_DIRS = new Set([
  'node_modules',
  'Library',
  'Applications',
  '.Trash',
  '.git',
  'Pictures',
  'Music',
  'Movies',
])

/** Most recent sign of life for a project: git activity, else its manifest. */
async function lastTouched(projectDir: string): Promise<number> {
  const candidates = [
    path.join(projectDir, '.git'),
    path.join(projectDir, 'package.json'),
    projectDir,
  ]
  let newest = 0
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate)
      newest = Math.max(newest, info.mtimeMs)
    } catch {
      // missing candidate just doesn't contribute
    }
  }
  return newest
}

/**
 * Finds `node_modules` directories under `roots` whose project has shown no
 * git or manifest activity for `staleDays`. Recursion stops at node_modules
 * itself, so nested copies inside a package are never reported separately.
 */
export async function scanNodeModules(roots: string[], staleDays: number): Promise<Finding> {
  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000
  const entries: Entry[] = []

  const visit = async (dir: string, depth: number): Promise<void> => {
    if (depth > 6) return
    let names
    try {
      names = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    if (names.some((entry) => entry.isDirectory() && entry.name === 'node_modules')) {
      if ((await lastTouched(dir)) < cutoff) {
        const modules = path.join(dir, 'node_modules')
        entries.push({ path: modules, bytes: await diskUsage(modules) })
        return // do not descend into a project already slated for cleanup
      }
    }

    const subdirs = names.filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !SKIP_DIRS.has(entry.name),
    )
    await pool(subdirs, 4, (entry) => visit(path.join(dir, entry.name), depth + 1))
  }

  await pool(roots, 2, (root) => visit(root, 0))

  return {
    targetId: 'node-modules',
    group: 'dev',
    label: `Stale node_modules (untouched ${staleDays}+ days)`,
    recovery: 'reinstall with npm/pnpm/yarn install',
    entries,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
  }
}

/** Finds .DS_Store files under `roots`. Tiny individually, endless in aggregate. */
export async function scanDsStore(roots: string[]): Promise<Finding> {
  const entries: Entry[] = []

  const visit = async (dir: string, depth: number): Promise<void> => {
    if (depth > 8) return
    let names
    try {
      names = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of names) {
      if (entry.isFile() && entry.name === '.DS_Store') {
        const file = path.join(dir, entry.name)
        entries.push({ path: file, bytes: await diskUsage(file) })
      }
    }
    const subdirs = names.filter(
      (entry) => entry.isDirectory() && !entry.isSymbolicLink() && !SKIP_DIRS.has(entry.name),
    )
    await pool(subdirs, 4, (entry) => visit(path.join(dir, entry.name), depth + 1))
  }

  await pool(roots, 2, (root) => visit(root, 0))

  return {
    targetId: 'ds-store',
    group: 'system',
    label: '.DS_Store files',
    recovery: 'Finder recreates them on next folder visit',
    entries,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
  }
}
