/**
 * Recognises consola's warning and error lines — in both formats it uses.
 *
 * This is the part that has bitten twice, so it lives in one place: consola
 * picks its reporter by whether stdout is a TTY. Locally that is the fancy one
 *
 *     WARN  Duplicated imports "getSession" ...
 *
 * while CI has no TTY and gets the basic one
 *
 *     [warn] Duplicated imports "getSession" ...
 *
 * Colours are on in both cases, so the tags arrive wrapped in escape sequences.
 * A check that only knows one of these shapes passes everything in the other —
 * a gate that never fails, which is worse than no gate.
 */

/** Colour codes sit between the words we match on, so they have to go first. */
export function stripAnsi(line) {
  // eslint-disable-next-line no-control-regex -- matching escape sequences is the point
  return line.replace(/\[[0-9;]*m/g, '')
}

const WARN_OR_ERROR = /(?:^|\s)(?:WARN|ERROR)\s|\[(?:warn|error)\]/i
const ERROR_ONLY = /(?:^|\s)ERROR\s|\[error\]/i

export function isWarnOrError(line) {
  return WARN_OR_ERROR.test(stripAnsi(line))
}

export function isError(line) {
  return ERROR_ONLY.test(stripAnsi(line))
}
