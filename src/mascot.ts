import { color } from './format.js'

/**
 * Sudsy — the CleanKit mascot.
 *
 * A soap bubble with stubby arms. Kept as literal frames rather than generated
 * art so the rim stays hand-tuned; `{}` marks the eyes so `paint` can brighten
 * them without disturbing the surrounding columns.
 */
type Pose = 'idle' | 'scrub' | 'done' | 'wary'

const FRAMES: Record<Pose, string[]> = {
  idle: [
    '      .-~~~~~-.      ',
    '    /` .     . `\\    ',
    '   |   {o}  {o}  |   ',
    '   |  `  \\___/  `|   ',
    '    \\  `     `  /    ',
    '     `-.,___,.-`     ',
    '       "  "  "       ',
  ],
  scrub: [
    '  o   .-~~~~~-.   °  ',
    '    /` .     . `\\    ',
    '  ~|   {^}  {^}  |~  ',
    '   |  `  \\___/  `|   ',
    '    \\  `     `  /    ',
    '     `-.,___,.-`     ',
    '     ~  "  "  "  ~   ',
  ],
  done: [
    '  *   .-~~~~~-.   *  ',
    '    /` .     . `\\    ',
    '   |   {^}  {^}  |   ',
    '   |  `  \\___/  `|   ',
    '    \\  `     `  /    ',
    '     `-.,___,.-`     ',
    '       "  "  "       ',
  ],
  wary: [
    '      .-~~~~~-.      ',
    '    /` .     . `\\    ',
    '   |   {o}  {O}  |   ',
    '   |  `   ~~~   `|   ',
    '    \\  `     `  /    ',
    '     `-.,___,.-`     ',
    '       "  "  "       ',
  ],
}

/** Row index of the bubble rim, identical across every pose. */
const RIM_ROW = 5

/**
 * Tints the rim and brightens the eyes, leaving the body plain. The `{x}` eye
 * marker is replaced by a *padded* character so the hand-tuned column
 * alignment survives — dropping the braces would shift the face.
 */
function paint(line: string, index: number): string {
  const eyed = line.replace(/\{(.)\}/g, (_, eye: string) => ` ${color.bold(eye)} `)
  return index === RIM_ROW ? color.cyan(eyed) : eyed
}

export function mascot(pose: Pose = 'idle'): string {
  return FRAMES[pose].map(paint).join('\n')
}

/** Mascot beside a speech line, for the banner. */
export function mascotSaying(pose: Pose, line: string): string {
  const art = FRAMES[pose]
  const bubbleRow = 2
  return art
    .map((row, index) => {
      if (index === bubbleRow) return `${paint(row, index)}  ${color.dim('<')} ${line}`
      return paint(row, index)
    })
    .join('\n')
}
