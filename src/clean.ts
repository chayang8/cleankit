import { rm } from 'node:fs/promises'
import { resolveDeletable, UnsafePathError } from './safety.js'
import type { Finding } from './scan.js'

export interface RemovalResult {
  removed: string[]
  freed: number
  skipped: { path: string; reason: string }[]
}

export interface RemoveOptions {
  /** When true, every guard still runs but nothing is unlinked. */
  dryRun: boolean
  onProgress?: (path: string) => void
}

/**
 * Deletes the entries of `findings`, re-validating each path against the
 * safety guards immediately before removal — the scan may be minutes old, and
 * a path could have been replaced by a symlink in between. A path that fails a
 * guard is skipped and reported; it never aborts the run.
 */
export async function removeFindings(
  findings: Finding[],
  options: RemoveOptions,
): Promise<RemovalResult> {
  const result: RemovalResult = { removed: [], freed: 0, skipped: [] }

  for (const finding of findings) {
    // Advisory findings are reports, not plans: they name things only the
    // owner can judge (models, VMs, source trees) and are never unlinked.
    if (finding.group === 'advisory') {
      for (const entry of finding.entries) {
        result.skipped.push({ path: entry.path, reason: 'advisory — remove by hand' })
      }
      continue
    }

    for (const entry of finding.entries) {
      let resolved: string
      try {
        resolved = await resolveDeletable(entry.path)
      } catch (error) {
        const reason =
          error instanceof UnsafePathError ? error.message : String(error)
        result.skipped.push({ path: entry.path, reason })
        continue
      }

      options.onProgress?.(entry.path)
      if (!options.dryRun) {
        try {
          await rm(resolved, { recursive: true, force: true })
        } catch (error) {
          result.skipped.push({
            path: entry.path,
            reason: (error as NodeJS.ErrnoException).code ?? String(error),
          })
          continue
        }
      }
      result.removed.push(entry.path)
      result.freed += entry.bytes
    }
  }

  return result
}
