#!/usr/bin/env node
import path from 'node:path'
import { createRequire } from 'node:module'
import { createInterface } from 'node:readline/promises'
import { removeFindings } from './clean.js'
import { bytes, color, padEnd, padStart } from './format.js'
import { mascot, mascotSaying } from './mascot.js'
import { expandHome, HOME, tildify } from './safety.js'
import { scanDsStore, scanNodeModules, scanTarget, type Finding } from './scan.js'
import {
  scanAdvisories,
  scanBuildArtifacts,
  scanColdProjects,
  scanEditorExtensions,
  scanGvmPkgsets,
} from './heavy.js'
import { loadConfig } from './config.js'
import { writeHtmlReport } from './report.js'
import { GROUP_LABELS, targetsForGroups, type Group, type Target } from './targets.js'

// Read from the manifest so `--version` cannot drift from what was published.
const VERSION: string = createRequire(import.meta.url)('../package.json').version
const ALL_GROUPS: Group[] = ['dev', 'xcode', 'system', 'bulk', 'advisory']

interface Options {
  command: 'scan' | 'clean' | 'help' | 'version'
  groups: Group[]
  staleDays: number
  roots: string[]
  assumeYes: boolean
  dryRun: boolean
  showMascot: boolean
  html: string | null
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    command: 'scan',
    groups: [...ALL_GROUPS],
    staleDays: 90,
    roots: [path.join(HOME, 'Developer'), path.join(HOME, 'Projects'), path.join(HOME, 'src')],
    assumeYes: false,
    dryRun: false,
    showMascot: true,
    html: null,
  }

  for (const arg of argv) {
    if (arg === 'scan' || arg === 'clean') options.command = arg
    else if (arg === '--help' || arg === '-h') options.command = 'help'
    else if (arg === '--version' || arg === '-v') options.command = 'version'
    else if (arg === '--yes' || arg === '-y') options.assumeYes = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--no-mascot') options.showMascot = false
    else if (arg.startsWith('--html=')) {
      options.html = path.resolve(expandHome(arg.slice('--html='.length)))
    }
    else if (arg.startsWith('--only=')) {
      const requested = arg
        .slice('--only='.length)
        .split(',')
        .map((group) => group.trim())
        .filter((group) => group !== '') as Group[]
      if (requested.length === 0) fail(`--only needs at least one group: ${ALL_GROUPS.join(', ')}`)
      const unknown = requested.filter((group) => !ALL_GROUPS.includes(group))
      if (unknown.length > 0) {
        fail(`unknown group: ${unknown.join(', ')} (known: ${ALL_GROUPS.join(', ')})`)
      }
      options.groups = requested
    } else if (arg.startsWith('--stale-days=')) {
      const days = Number(arg.slice('--stale-days='.length))
      if (!Number.isFinite(days) || days < 0) fail(`--stale-days needs a number, got ${arg}`)
      options.staleDays = days
    } else if (arg.startsWith('--root=')) {
      const roots = arg
        .slice('--root='.length)
        .split(',')
        .map((root) => root.trim())
        .filter((root) => root !== '')
      if (roots.length === 0) fail('--root needs at least one directory')
      options.roots = roots.map((root) => path.resolve(expandHome(root)))
    } else fail(`unknown argument: ${arg}`)
  }

  return options
}

function fail(message: string): never {
  console.error(`${color.red('cleankit:')} ${message}`)
  process.exit(2)
}

function help(): void {
  console.log(`${mascot('idle')}

${color.bold('cleankit')} — Sudsy scrubs your Mac clean.

${color.bold('Usage')}
  cleankit [scan|clean] [options]

${color.bold('Commands')}
  scan            Report what could be freed. Deletes nothing. (default)
  clean           Delete after showing the plan and asking for confirmation.

${color.bold('Options')}
  --only=a,b      Limit to groups: dev, xcode, system, bulk, advisory
  --stale-days=N  node_modules idle this long counts as stale (default 90)
  --root=a,b      Where to hunt for node_modules and .DS_Store
                  (default ~/Developer, ~/Projects, ~/src)
  --html=FILE     Also write a shareable HTML report (with Sudsy)
  --dry-run       With clean: run every safety check, delete nothing
  -y, --yes       Skip the confirmation prompt
  --no-mascot     No Sudsy

${color.bold('Custom targets')}
  Add your own cache paths in ~/.cleankitrc.json:
  { "targets": [{ "id": "sbt", "label": "sbt cache", "group": "dev",
                  "recovery": "refetched on next build", "paths": ["~/.sbt"] }] }
  -h, --help      This
  -v, --version   Print version

${color.dim('Only an allowlist of known cache paths inside your home directory is ever')}
${color.dim('touched. Documents, Desktop, Downloads and keys are hard-blocked, and')}
${color.dim('"Big, but your call" findings print a command and are never deleted.')}`)
}

async function collect(options: Options, extraTargets: Target[]): Promise<Finding[]> {
  const custom = extraTargets.filter((target) => options.groups.includes(target.group))
  const findings = await Promise.all([
    ...targetsForGroups(options.groups).map(scanTarget),
    ...custom.map(scanTarget),
    options.groups.includes('dev')
      ? scanNodeModules(options.roots, options.staleDays)
      : emptyFinding('node-modules', 'dev'),
    options.groups.includes('dev')
      ? scanBuildArtifacts(options.roots, options.staleDays)
      : emptyFinding('build-artifacts', 'dev'),
    options.groups.includes('system')
      ? scanDsStore(options.roots)
      : emptyFinding('ds-store', 'system'),
    options.groups.includes('bulk')
      ? scanEditorExtensions()
      : emptyFinding('editor-extensions', 'bulk'),
    options.groups.includes('bulk') ? scanGvmPkgsets() : emptyFinding('gvm-pkgsets', 'bulk'),
    options.groups.includes('advisory')
      ? scanColdProjects(options.roots, Math.max(options.staleDays, 180))
      : emptyFinding('cold-projects', 'advisory'),
  ])
  if (options.groups.includes('advisory')) findings.push(...(await scanAdvisories()))
  // A cache directory that exists but holds nothing is noise, not a finding.
  return findings.filter((finding) => finding.entries.length > 0 && finding.bytes > 0)
}

function emptyFinding(targetId: string, group: Group): Promise<Finding> {
  return Promise.resolve({ targetId, group, label: '', recovery: '', entries: [], bytes: 0 })
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function report(findings: Finding[]): number {
  // Advisory findings are excluded from the total: CleanKit will not delete
  // them, so counting them would overstate what `clean` actually frees.
  const total = findings
    .filter((finding) => finding.group !== 'advisory')
    .reduce((sum, finding) => sum + finding.bytes, 0)
  const labelWidth = Math.max(24, ...findings.map((finding) => finding.label.length))

  for (const group of ALL_GROUPS) {
    const inGroup = findings.filter((finding) => finding.group === group)
    if (inGroup.length === 0) continue
    console.log(`\n${color.bold(GROUP_LABELS[group])}`)
    for (const finding of inGroup) {
      const risky = finding.recovery.startsWith('GONE')
      console.log(
        `  ${padEnd(finding.label, labelWidth)} ${padStart(bytes(finding.bytes), 9)}  ` +
          `${color.dim(plural(finding.entries.length, 'item'))}  ` +
          `${risky ? color.yellow(finding.recovery) : color.dim(finding.recovery)}`,
      )
      if (finding.advice) {
        console.log(`    ${color.cyan('run yourself:')} ${color.dim(finding.advice)}`)
      }
    }
  }
  return total
}

async function confirm(total: number): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(
      `\n${color.yellow('Delete the above and free ~' + bytes(total) + '?')} type ${color.bold('yes')} to continue: `,
    )
    return answer.trim().toLowerCase() === 'yes'
  } finally {
    rl.close()
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.command === 'help') return help()
  if (options.command === 'version') return console.log(VERSION)

  if (options.showMascot) {
    console.log(mascotSaying('scrub', color.dim('sniffing around...')))
  }

  const config = await loadConfig()
  for (const warning of config.warnings) console.error(color.yellow(`cleankit: ${warning}`))

  const findings = await collect(options, config.targets)
  if (findings.length === 0) {
    console.log(`\n${color.green('Nothing to clean.')} Machine is already tidy.`)
    if (config.file) console.log(color.dim(`  (extra targets loaded from ${tildify(config.file)})`))
    return
  }

  const total = report(findings)
  console.log(`\n  ${color.bold('Total reclaimable')} ${color.green(bytes(total))}`)

  if (options.html) {
    await writeHtmlReport(options.html, findings)
    console.log(color.dim(`  report written to ${tildify(options.html)}`))
  }

  const deletable = findings.filter((finding) => finding.group !== 'advisory')
  if (options.command === 'clean' && findings.length > deletable.length) {
    console.log(
      color.dim('\n  "Big, but your call" findings are reports — clean will not touch them.'),
    )
  }

  if (options.command === 'scan') {
    console.log(color.dim('\nNothing was deleted. Run `cleankit clean` to act on this.'))
    return
  }

  if (!options.assumeYes && !options.dryRun) {
    if (!process.stdin.isTTY) {
      fail('clean needs a terminal to confirm — pass --yes to run unattended')
    }
    if (!(await confirm(total))) {
      console.log(`\n${mascotSaying('wary', color.dim('nothing touched.'))}`)
      return
    }
  }

  const result = await removeFindings(deletable, { dryRun: options.dryRun })
  const verb = options.dryRun ? 'Would free' : 'Freed'
  console.log(
    `\n${mascotSaying('done', color.green(`${verb} ${bytes(result.freed)}`))}\n` +
      color.dim(`  ${result.removed.length} paths ${options.dryRun ? 'planned' : 'removed'}`),
  )

  if (result.skipped.length > 0) {
    console.log(color.yellow(`\n  ${result.skipped.length} skipped:`))
    for (const skip of result.skipped.slice(0, 10)) {
      console.log(color.dim(`    ${tildify(skip.path)} — ${skip.reason}`))
    }
    if (result.skipped.length > 10) {
      console.log(color.dim(`    + ${result.skipped.length - 10} more`))
    }
  }
}

main().catch((error) => {
  console.error(`${color.red('cleankit:')} ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
