// settle-see · options - which of a settle's options changed between two renders.
//
// <claudes_code_comments>
// ** Function List **
// changedOptions(prev, next) - the keys of next whose value differs from prev (by a JSON key; a function by its text)
//
// ** Technical Review **
// The React <Settle> hands only these to handle.set(): set() re-targets (and restarts a cycling schedule) whenever
// items, shape, word or target appears in what it is given, so handing it every option on each change sent a
// cycling settle back to its first item whenever fps or poke changed.
// </claudes_code_comments>

const keyOf = (v) => JSON.stringify(v, (k, x) => (typeof x === 'function' ? x.toString() : x));

export function changedOptions(prev, next) {
  return Object.fromEntries(Object.entries(next).filter(([k, v]) => keyOf(v) !== keyOf(prev[k])));
}
