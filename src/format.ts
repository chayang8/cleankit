const enabled =
  process.stdout.isTTY === true && !process.env.NO_COLOR && process.env.TERM !== 'dumb'

const wrap = (open: number, close: number) => (text: string) =>
  enabled ? `\u001b[${open}m${text}\u001b[${close}m` : text

export const color = {
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  cyan: wrap(36, 39),
  bold: wrap(1, 22),
  dim: wrap(2, 22),
}

/** Human-readable size. Binary units, because that is what disks report. */
export function bytes(value: number): string {
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`
}

export function padEnd(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length)
}

export function padStart(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text
}
