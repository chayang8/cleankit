import path from 'node:path'
import { readdir, stat } from 'node:fs/promises'
import { diskUsage, type Entry, type Finding } from './scan.js'
import { HOME } from './safety.js'

const home = (...segments: string[]) => path.join(HOME, ...segments)

/**
 * Splits an extension directory name (`publisher.name-1.2.3-darwin-arm64`)
 * into its identity and version. Returns null for anything that does not look
 * like a versioned extension directory.
 */
export function parseExtensionDir(name: string): { id: string; version: string } | null {
  const match = /^(.+?)-(\d+\.\d+\.\d+(?:[^-]*)?)(?:-.+)?$/.exec(name)
  if (!match) return null
  return { id: match[1], version: match[2] }
}

/** Numeric-aware version compare; returns >0 when `a` is newer than `b`. */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split(/[.\-+]/)
  const partsB = b.split(/[.\-+]/)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = Number(partsA[i] ?? 0)
    const numB = Number(partsB[i] ?? 0)
    if (Number.isFinite(numA) && Number.isFinite(numB)) {
      if (numA !== numB) return numA - numB
    } else {
      const cmp = (partsA[i] ?? '').localeCompare(partsB[i] ?? '')
      if (cmp !== 0) return cmp
    }
  }
  return 0
}

/**
 * Given every directory name in an extensions folder, returns the superseded
 * ones — each extension keeps only its newest version. VS Code is supposed to
 * prune these itself and frequently does not; on a busy machine the leftovers
 * are the single largest reclaimable pile.
 */
export function supersededExtensions(names: string[]): string[] {
  const byId = new Map<string, { name: string; version: string }[]>()
  for (const name of names) {
    const parsed = parseExtensionDir(name)
    if (!parsed) continue
    const list = byId.get(parsed.id) ?? []
    list.push({ name, version: parsed.version })
    byId.set(parsed.id, list)
  }

  const stale: string[] = []
  for (const versions of byId.values()) {
    if (versions.length < 2) continue
    versions.sort((a, b) => compareVersions(b.version, a.version))
    stale.push(...versions.slice(1).map((entry) => entry.name))
  }
  return stale.sort()
}

async function sizedEntries(base: string, names: string[]): Promise<Entry[]> {
  const entries: Entry[] = []
  for (const name of names) {
    const target = path.join(base, name)
    entries.push({ path: target, bytes: await diskUsage(target) })
  }
  return entries
}

/** Superseded VS Code / Cursor / Windsurf extension versions. */
export async function scanEditorExtensions(): Promise<Finding> {
  const roots = [home('.vscode', 'extensions'), home('.cursor', 'extensions'), home('.windsurf', 'extensions')]
  const entries: Entry[] = []

  for (const root of roots) {
    let names: string[]
    try {
      names = await readdir(root)
    } catch {
      continue
    }
    entries.push(...(await sizedEntries(root, supersededExtensions(names))))
  }

  return {
    targetId: 'editor-extensions',
    group: 'bulk',
    label: 'Superseded editor extensions',
    recovery: 'the newest version of each extension is kept',
    entries,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
  }
}

/**
 * gvm package sets for Go toolchains that are not the newest few. Each pkgset
 * is rebuilt by `go get`, so this is recoverable, just slow.
 */
export async function scanGvmPkgsets(keep = 2): Promise<Finding> {
  const root = home('.gvm', 'pkgsets')
  let names: string[]
  try {
    names = await readdir(root)
  } catch {
    return emptyBulk('gvm-pkgsets', 'Old gvm package sets', 'rebuilt by go get')
  }

  const versions = names
    .filter((name) => name.startsWith('go'))
    .sort((a, b) => compareVersions(b.slice(2), a.slice(2)))
  const entries = await sizedEntries(root, versions.slice(keep))

  return {
    targetId: 'gvm-pkgsets',
    group: 'bulk',
    label: `Old gvm package sets (keeping newest ${keep})`,
    recovery: 'rebuilt by go get',
    entries,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
  }
}

function emptyBulk(targetId: string, label: string, recovery: string): Finding {
  return { targetId, group: 'bulk', label, recovery, entries: [], bytes: 0 }
}

/**
 * Piles that are large but only their owner knows whether they are still
 * wanted — models, SDK images, virtual disks. These are reported with the
 * command that removes them and are never deleted by CleanKit itself.
 */
export async function scanAdvisories(): Promise<Finding[]> {
  const findings: Finding[] = []

  const ollama = home('.ollama', 'models')
  const ollamaBytes = await diskUsage(ollama)
  if (ollamaBytes > 0) {
    findings.push({
      targetId: 'ollama-models',
      group: 'advisory',
      label: 'Ollama models',
      recovery: 're-pulled with ollama pull',
      advice: 'ollama list, then: ollama rm <model>',
      entries: [{ path: ollama, bytes: ollamaBytes }],
      bytes: ollamaBytes,
    })
  }

  const images = home('Library', 'Android', 'sdk', 'system-images')
  const imagesBytes = await diskUsage(images)
  if (imagesBytes > 0) {
    findings.push({
      targetId: 'android-images',
      group: 'advisory',
      label: 'Android emulator system images',
      recovery: 're-downloaded by sdkmanager',
      advice: 'sdkmanager --uninstall "system-images;android-NN;..."',
      entries: [{ path: images, bytes: imagesBytes }],
      bytes: imagesBytes,
    })
  }

  const avd = home('.android', 'avd')
  const avdBytes = await diskUsage(avd)
  if (avdBytes > 0) {
    findings.push({
      targetId: 'android-avd',
      group: 'advisory',
      label: 'Android virtual devices',
      recovery: 'recreated in Device Manager',
      advice: 'avdmanager list avd, then: avdmanager delete avd -n <name>',
      entries: [{ path: avd, bytes: avdBytes }],
      bytes: avdBytes,
    })
  }

  const dockerData = home('Library', 'Containers', 'com.docker.docker', 'Data', 'vms')
  const dockerBytes = await diskUsage(dockerData)
  if (dockerBytes > 0) {
    findings.push({
      targetId: 'docker-vm',
      group: 'advisory',
      label: 'Docker virtual disk',
      recovery: 'images and volumes are rebuilt or re-pulled',
      advice: 'docker system prune -a --volumes',
      entries: [{ path: dockerData, bytes: dockerBytes }],
      bytes: dockerBytes,
    })
  }

  return findings
}

/**
 * Project directories that have shown no activity for `staleDays`, ranked by
 * size. Reported only — CleanKit never deletes source code.
 */
export async function scanColdProjects(roots: string[], staleDays: number, limit = 5): Promise<Finding> {
  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000
  const candidates: Entry[] = []

  for (const root of roots) {
    let names
    try {
      names = await readdir(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of names) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const dir = path.join(root, entry.name)
      let info
      try {
        info = await stat(dir)
      } catch {
        continue
      }
      if (info.mtimeMs >= cutoff) continue
      candidates.push({ path: dir, bytes: await diskUsage(dir) })
    }
  }

  const entries = candidates.sort((a, b) => b.bytes - a.bytes).slice(0, limit)
  return {
    targetId: 'cold-projects',
    group: 'advisory',
    label: `Cold project folders (untouched ${staleDays}+ days)`,
    recovery: 'source code — archive it, do not delete blindly',
    advice: 'move to external storage or push to a remote, then remove',
    entries,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
  }
}
