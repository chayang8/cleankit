import path from 'node:path'
import { HOME } from './safety.js'

export type Group = 'dev' | 'xcode' | 'system' | 'bulk' | 'advisory'

/** How a target is emptied: wipe the directory itself, or only its children. */
export type Mode = 'self' | 'contents'

export interface Target {
  id: string
  group: Group
  label: string
  /** What is lost, and how it comes back. Shown before anything is deleted. */
  recovery: string
  mode: Mode
  paths: string[]
}

const home = (...segments: string[]) => path.join(HOME, ...segments)

/**
 * The same cache under every layout it might use: macOS `~/Library/Caches`,
 * the XDG default, and a plain dotfolder. Missing paths cost nothing — a
 * target that does not exist on this machine is simply never reported — so
 * listing all three keeps one target definition working across platforms.
 */
const cache = (...segments: string[]) => [
  home('Library', 'Caches', ...segments),
  home('.cache', ...segments),
]

export const GROUP_LABELS: Record<Group, string> = {
  dev: 'Dev caches',
  xcode: 'Xcode junk',
  system: 'Trash, logs & .DS_Store',
  bulk: 'Duplicate installs',
  advisory: 'Big, but your call',
}

export const TARGETS: Target[] = [
  // ---- JavaScript ----
  {
    id: 'npm',
    group: 'dev',
    label: 'npm cache',
    recovery: 'refetched on next install',
    mode: 'contents',
    paths: [home('.npm', '_cacache')],
  },
  {
    id: 'pnpm',
    group: 'dev',
    label: 'pnpm store',
    recovery: 'refetched on next install',
    mode: 'contents',
    paths: [home('Library', 'pnpm', 'store'), home('.pnpm-store'), home('.local', 'share', 'pnpm', 'store')],
  },
  {
    id: 'yarn',
    group: 'dev',
    label: 'yarn cache',
    recovery: 'refetched on next install',
    mode: 'contents',
    paths: [...cache('Yarn'), home('.yarn', 'berry', 'cache')],
  },
  {
    id: 'bun',
    group: 'dev',
    label: 'bun cache',
    recovery: 'refetched on next install',
    mode: 'contents',
    paths: [home('.bun', 'install', 'cache')],
  },
  {
    id: 'deno',
    group: 'dev',
    label: 'Deno cache',
    recovery: 'refetched on next run',
    mode: 'contents',
    paths: [...cache('deno'), home('.deno')],
  },
  {
    id: 'node-gyp',
    group: 'dev',
    label: 'node-gyp headers',
    recovery: 're-downloaded when a native module builds',
    mode: 'contents',
    paths: [...cache('node-gyp'), home('.node-gyp')],
  },
  {
    id: 'browser-binaries',
    group: 'dev',
    label: 'Playwright / Puppeteer / Cypress browsers',
    recovery: 're-downloaded on next test run (hundreds of MB)',
    mode: 'contents',
    paths: [
      ...cache('ms-playwright'),
      ...cache('puppeteer'),
      ...cache('Cypress'),
      home('.cache', 'ms-playwright'),
    ],
  },
  {
    id: 'electron',
    group: 'dev',
    label: 'Electron & electron-builder cache',
    recovery: 're-downloaded on next build',
    mode: 'contents',
    paths: [...cache('electron'), ...cache('electron-builder')],
  },

  // ---- Python ----
  {
    id: 'pip',
    group: 'dev',
    label: 'pip cache',
    recovery: 'refetched on next pip install',
    mode: 'contents',
    paths: [...cache('pip'), home('.cache', 'pip')],
  },
  {
    id: 'uv-poetry',
    group: 'dev',
    label: 'uv / poetry / pipenv caches',
    recovery: 'refetched on next install',
    mode: 'contents',
    paths: [...cache('uv'), ...cache('pypoetry'), ...cache('pipenv'), home('Library', 'Caches', 'pip-tools')],
  },

  // ---- Rust / Go / JVM ----
  {
    id: 'cargo',
    group: 'dev',
    label: 'cargo registry cache',
    recovery: 'refetched on next cargo build',
    mode: 'contents',
    paths: [home('.cargo', 'registry', 'cache'), home('.cargo', 'registry', 'src')],
  },
  {
    id: 'go-build',
    group: 'dev',
    label: 'Go build cache',
    recovery: 'rebuilt on next go build (slower first build)',
    mode: 'contents',
    paths: [...cache('go-build')],
  },
  {
    id: 'gradle',
    group: 'dev',
    label: 'Gradle caches',
    recovery: 'rebuilt on next Gradle run (slow first build)',
    mode: 'contents',
    paths: [home('.gradle', 'caches'), home('.gradle', 'daemon')],
  },
  {
    id: 'maven',
    group: 'dev',
    label: 'Maven repository',
    recovery: 'refetched on next mvn build',
    mode: 'contents',
    paths: [home('.m2', 'repository')],
  },

  // ---- Other ecosystems ----
  {
    id: 'cocoapods',
    group: 'dev',
    label: 'CocoaPods & Carthage caches',
    recovery: 'refetched on next pod install',
    mode: 'contents',
    paths: [...cache('CocoaPods'), ...cache('org.carthage.CarthageKit')],
  },
  {
    id: 'pub',
    group: 'dev',
    label: 'Dart / Flutter pub cache',
    recovery: 'refetched on next pub get',
    mode: 'contents',
    paths: [home('.pub-cache', 'hosted'), home('.pub-cache', '.pub-cache')],
  },
  {
    id: 'nuget',
    group: 'dev',
    label: 'NuGet packages',
    recovery: 'refetched on next restore',
    mode: 'contents',
    paths: [home('.nuget', 'packages')],
  },
  {
    id: 'composer',
    group: 'dev',
    label: 'Composer cache',
    recovery: 'refetched on next composer install',
    mode: 'contents',
    paths: [...cache('composer'), home('.composer', 'cache')],
  },
  {
    id: 'rubygems',
    group: 'dev',
    label: 'RubyGems & Bundler cache',
    recovery: 'refetched on next bundle install',
    mode: 'contents',
    paths: [home('.gem', 'specs'), home('.bundle', 'cache')],
  },
  {
    id: 'homebrew',
    group: 'dev',
    label: 'Homebrew downloads',
    recovery: 're-downloaded on next brew install',
    mode: 'contents',
    paths: [...cache('Homebrew')],
  },

  // ---- Editors & IDEs ----
  {
    id: 'jetbrains',
    group: 'dev',
    label: 'JetBrains caches & logs',
    recovery: 'reindexed on next project open (slow first open)',
    mode: 'contents',
    paths: [
      home('Library', 'Caches', 'JetBrains'),
      home('.cache', 'JetBrains'),
      home('Library', 'Logs', 'JetBrains'),
    ],
  },
  {
    id: 'editor-caches',
    group: 'dev',
    label: 'VS Code workspace cache',
    recovery: 'rebuilt as you reopen workspaces',
    mode: 'contents',
    paths: [
      home('Library', 'Application Support', 'Code', 'Cache'),
      home('Library', 'Application Support', 'Code', 'CachedData'),
      home('Library', 'Application Support', 'Code', 'CachedExtensionVSIXs'),
      home('.config', 'Code', 'Cache'),
      home('.config', 'Code', 'CachedData'),
    ],
  },

  // ---- Xcode ----
  {
    id: 'derived-data',
    group: 'xcode',
    label: 'Xcode DerivedData',
    recovery: 'rebuilt on next Xcode build',
    mode: 'contents',
    paths: [home('Library', 'Developer', 'Xcode', 'DerivedData')],
  },
  {
    id: 'archives',
    group: 'xcode',
    label: 'Xcode archives',
    recovery: 'GONE — re-archive needed to resymbolicate old crash logs',
    mode: 'contents',
    paths: [home('Library', 'Developer', 'Xcode', 'Archives')],
  },
  {
    id: 'device-support',
    group: 'xcode',
    label: 'iOS DeviceSupport',
    recovery: 're-extracted when that iOS device is reconnected',
    mode: 'contents',
    paths: [
      home('Library', 'Developer', 'Xcode', 'iOS DeviceSupport'),
      home('Library', 'Developer', 'Xcode', 'watchOS DeviceSupport'),
    ],
  },
  {
    id: 'simulator-caches',
    group: 'xcode',
    label: 'Simulator caches',
    recovery: 'regenerated by the simulator',
    mode: 'contents',
    paths: [
      home('Library', 'Developer', 'CoreSimulator', 'Caches'),
      home('Library', 'Developer', 'CoreSimulator', 'Devices', 'Restore'),
    ],
  },

  // ---- System ----
  {
    id: 'app-updaters',
    group: 'system',
    label: 'App updater downloads',
    recovery: 're-downloaded by the app when it next updates',
    mode: 'contents',
    paths: [home('Library', 'Caches', 'Sparkle'), home('Library', 'Caches', 'com.apple.dt.Xcode')],
  },
  {
    id: 'trash',
    group: 'system',
    label: 'Trash',
    recovery: 'GONE — this is the point of the Trash',
    mode: 'contents',
    paths: [home('.Trash'), home('.local', 'share', 'Trash')],
  },
  {
    id: 'logs',
    group: 'system',
    label: 'User logs',
    recovery: 'regenerated by apps as they run',
    mode: 'contents',
    paths: [home('Library', 'Logs')],
  },
]

export function targetsForGroups(groups: Group[]): Target[] {
  return TARGETS.filter((target) => groups.includes(target.group))
}
