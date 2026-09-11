import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expandHome, HOME } from './safety.js'
import type { Group, Mode, Target } from './targets.js'

const CONFIG_PATHS = [
  path.join(HOME, '.cleankitrc.json'),
  path.join(HOME, '.config', 'cleankit', 'config.json'),
]

const GROUPS: Group[] = ['dev', 'xcode', 'system', 'bulk', 'advisory']
const MODES: Mode[] = ['self', 'contents']

export interface ConfigResult {
  targets: Target[]
  /** Problems found while reading the file, reported rather than thrown. */
  warnings: string[]
  /** Which file was used, if any. */
  file: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validates one user-supplied target. Anything malformed is rejected with a
 * reason rather than silently dropped — a typo in a config file that quietly
 * cleans nothing is worse than an error message.
 */
function parseTarget(raw: unknown, index: number): { target?: Target; warning?: string } {
  const where = `targets[${index}]`
  if (!isRecord(raw)) return { warning: `${where} is not an object` }

  const { id, label, group, mode, recovery, paths } = raw
  if (typeof id !== 'string' || id === '') return { warning: `${where} needs a string id` }
  if (typeof label !== 'string' || label === '') return { warning: `${where} (${id}) needs a label` }
  if (typeof group !== 'string' || !GROUPS.includes(group as Group)) {
    return { warning: `${where} (${id}) group must be one of ${GROUPS.join(', ')}` }
  }
  if (group === 'advisory') {
    return { warning: `${where} (${id}) cannot be advisory — advisory findings are built in` }
  }
  if (mode !== undefined && (typeof mode !== 'string' || !MODES.includes(mode as Mode))) {
    return { warning: `${where} (${id}) mode must be self or contents` }
  }
  if (!Array.isArray(paths) || paths.length === 0 || paths.some((entry) => typeof entry !== 'string')) {
    return { warning: `${where} (${id}) needs a non-empty array of string paths` }
  }

  return {
    target: {
      id,
      label,
      group: group as Group,
      mode: (mode as Mode) ?? 'contents',
      recovery: typeof recovery === 'string' ? recovery : 'user-defined target',
      // Resolved here so a relative path in a config file cannot mean
      // "wherever CleanKit happened to be run from".
      paths: (paths as string[]).map((entry) => path.resolve(expandHome(entry))),
    },
  }
}

/** Parses config file contents. Split out from IO so it can be tested directly. */
export function parseConfigText(text: string, file: string): ConfigResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return { targets: [], file, warnings: [`${file}: invalid JSON (${(error as Error).message})`] }
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.targets)) {
    return { targets: [], file, warnings: [`${file}: expected { "targets": [...] }`] }
  }

  const targets: Target[] = []
  const warnings: string[] = []
  parsed.targets.forEach((raw, index) => {
    const { target, warning } = parseTarget(raw, index)
    if (target) targets.push(target)
    if (warning) warnings.push(`${file}: ${warning}`)
  })
  return { targets, warnings, file }
}

/**
 * Loads extra targets from `~/.cleankitrc.json` (or `~/.config/cleankit/
 * config.json`), so a stack CleanKit does not ship with can be cleaned without
 * waiting for a release. The safety guards still apply to every path: a config
 * file cannot talk CleanKit into deleting `~/Documents`.
 */
export async function loadConfig(): Promise<ConfigResult> {
  for (const file of CONFIG_PATHS) {
    let text: string
    try {
      text = await readFile(file, 'utf8')
    } catch {
      continue
    }
    return parseConfigText(text, file)
  }
  return { targets: [], warnings: [], file: null }
}
