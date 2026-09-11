import { homedir } from 'node:os'
import path from 'node:path'
import { realpath } from 'node:fs/promises'

export const HOME = homedir()

/**
 * Directories that must never be touched, no matter what a target definition
 * or a symlink claims. Checked against the *resolved* path, so a symlink
 * pointing into one of these still gets rejected.
 */
const FORBIDDEN = [
  HOME,
  path.join(HOME, 'Documents'),
  path.join(HOME, 'Desktop'),
  path.join(HOME, 'Downloads'),
  path.join(HOME, 'Pictures'),
  path.join(HOME, 'Music'),
  path.join(HOME, 'Movies'),
  path.join(HOME, 'Library'),
  path.join(HOME, 'Library', 'Keychains'),
  path.join(HOME, 'Library', 'Mobile Documents'),
  path.join(HOME, '.ssh'),
  path.join(HOME, '.gnupg'),
  path.join(HOME, '.aws'),
  path.join(HOME, '.config'),
]

export class UnsafePathError extends Error {
  constructor(readonly target: string, reason: string) {
    super(`refusing to touch ${target}: ${reason}`)
    this.name = 'UnsafePathError'
  }
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/**
 * Resolves `candidate` and throws unless it is a real, deletable location:
 * strictly inside $HOME, not a protected directory, and not reached through a
 * symlink that escapes $HOME. Returns the resolved path to delete.
 */
export async function resolveDeletable(candidate: string): Promise<string> {
  const absolute = path.resolve(candidate)

  let resolved: string
  try {
    resolved = await realpath(absolute)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') throw new UnsafePathError(absolute, 'does not exist')
    throw new UnsafePathError(absolute, `cannot resolve (${code})`)
  }

  // Checked before containment so that home itself reports as protected
  // rather than as "outside home", which reads like a bug.
  for (const forbidden of FORBIDDEN) {
    if (resolved === forbidden) {
      throw new UnsafePathError(absolute, 'protected directory')
    }
  }
  if (!isInside(resolved, HOME)) {
    throw new UnsafePathError(absolute, `resolves outside home (${resolved})`)
  }
  return resolved
}

/**
 * Expands a leading `~` to the home directory before resolving. The shell
 * does not expand a tilde that follows `=` (as in `--root=~/code`), so
 * without this the path silently resolves under the current directory and the
 * scan quietly finds nothing.
 */
export function expandHome(target: string): string {
  if (target === '~') return HOME
  if (target.startsWith('~/')) return path.join(HOME, target.slice(2))
  return target
}

/** Replaces the home prefix with `~` for display. */
export function tildify(target: string): string {
  return target.startsWith(HOME) ? `~${target.slice(HOME.length)}` : target
}
