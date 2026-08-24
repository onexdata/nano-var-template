const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const own = Object.prototype.hasOwnProperty

// Object.prototype's own member names (constructor, __proto__, toString, ...)
// are never treated as data, in either mode. Everything else on a prototype
// chain - class getters, methods, Object.create() layering - resolves normally.
const banned = key => own.call(Object.prototype, key)

// When the holder is a function, Function.prototype's own member names are
// blocked the same way: reading `caller`/`arguments` throws an engine
// TypeError (poison accessors) straight through the warn contract, and
// call/apply/bind are not plugins. A function's OWN properties (name, length,
// attached sub-plugins) and anything inherited from user code still resolve.
const fnBanned = (x, key) =>
  typeof x === "function" && own.call(Function.prototype, key) && !own.call(x, key)

// The one lookup guard both modes share - this predicate IS the prototype
// defense, so it exists exactly once. Object(x) boxes primitives so `in`
// never throws; x == null is checked first because Object(null) would lie.
const hasKey = (x, key) => x != null && !banned(key) && !fnBanned(x, key) && key in Object(x)

const Tpl = options => {
  // You can pass options to overide defaults...
  options = Object.assign(
    {
      start: options && options.functions
      ? "#{"
      : "${",
      end: "}",
      path: "[a-z0-9_$][\\.a-z0-9_$]*",
      warn: true,
      functions: false
    },
    options
  )
  // The two leading groups implement escaping: backslash PAIRS immediately
  // before a start delimiter collapse to literal backslashes, and an odd
  // remaining backslash suppresses the tag (renders it as literal text).
  // Backslashes anywhere else in a template are not special at all.
  const match = new RegExp(
    "((?:\\\\\\\\)*)(\\\\?)" +
      escapeRegex(options.start) + "\\s*(" + options.path + ")\\s*" + escapeRegex(options.end),
    "gi"
  )
  // Function mode validates the name (the part before ':') against the same
  // path option, anchored.
  const namePattern = new RegExp("^(?:" + options.path + ")$", "i")
  return (template, data) => {
    if (!options.functions) {
      // Merge the passed data into the template string we're sending back...
      // (String.replace collects every match before invoking the callback,
      // so a callback that re-enters this instance can't corrupt the scan.)
      return template.replace(match, (tag, pairs, esc, token) => {
        const prefix = "\\".repeat(pairs.length / 2)
        // Odd backslash: the tag is escaped - render it literally, minus the
        // escaping backslash (and with pairs collapsed).
        if (esc) return prefix + tag.slice(pairs.length + esc.length)
        const path = token.split("."),
          len = path.length
        let lookup = data
        for (let i = 0; i < len; i++) {
          if (!hasKey(lookup, path[i])) {
            if (options.warn) throw new Error(`nano-var-template: '${path[i]}' missing in ${tag}`)
            return tag
          }
          lookup = lookup[path[i]]
          // Property not found
          if (lookup === undefined) {
            if (options.warn) throw new Error(`nano-var-template: '${path[i]}' missing in ${tag}`)
            return tag
          }
          // Return the required value (raw when there's no prefix, so String
          // coercion happens exactly once, in replace itself)
          if (i === len - 1) return prefix ? prefix + lookup : lookup
        }
      })
    }

    // Function mode scans with indexOf instead of a regex: it's linear in the
    // template length no matter how malformed the input (a lazy regex here was
    // measurably O(n^2) on unclosed tags), and it holds no shared matcher
    // state, so a plugin that re-enters this same instance is harmless.
    const startD = options.start,
      endD = options.end
    // How many escape backslashes sit immediately before position i (capped
    // at `floor` so backslashes already emitted are never counted twice).
    const slashesBefore = (i, floor) => {
      let b = 0
      while (b < i - floor && template.charCodeAt(i - 1 - b) === 92) b++
      return b
    }
    // The next start delimiter at or after `from` that is NOT escaped.
    const nextOpener = from => {
      let i = template.indexOf(startD, from)
      while (i !== -1 && slashesBefore(i, from) & 1) i = template.indexOf(startD, i + startD.length)
      return i
    }
    const parts = []
    const calls = [] // { at: index into parts, name, arg, tag }
    let pos = 0
    let end = -1 // memoized "first end delimiter at or after `from`" - only ever moves forward
    for (;;) {
      const s = template.indexOf(startD, pos)
      if (s === -1) break
      const b = slashesBefore(s, pos)
      if (b & 1) {
        // Escaped opener: emit it literally, minus the escaping backslash
        // (and with backslash pairs collapsed), then keep scanning after it.
        parts.push(template.slice(pos, s - b) + "\\".repeat((b - 1) / 2) + startD)
        pos = s + startD.length
        continue
      }
      const from = s + startD.length
      if (end < from) end = template.indexOf(endD, from)
      if (end === -1) break
      // Multi-char closers: in a run like '}}}' with end '}}', the FIRST
      // alignment would steal the argument's final '}' ('{{parse:{"a":1}}}'
      // silently truncating the arg to '{"a":1'). Slide to the LAST
      // overlapping alignment so the argument keeps its closing characters.
      // (Never for single-char closers - '%fn:a%%b%' must close at the first
      // '%', or the slide would eat the next tag's opener.)
      if (endD.length > 1) {
        while (template.startsWith(endD, end + 1)) end++
      }
      // An unescaped opener before this tag closes means this opener is not a
      // tag (unclosed, or nested like "#{a:x #{b:y} z"). Emit it as literal
      // text and rescan from the inner opener, which may be a real tag.
      const inner = nextOpener(from)
      if (inner !== -1 && inner < end) {
        parts.push(template.slice(pos, inner))
        pos = inner
        continue
      }
      // Only the first ':' separates the function name from its argument -
      // everything after it (colons, spaces, anything) is the argument, verbatim.
      const token = template.slice(from, end)
      const ci = token.indexOf(":")
      const name = (ci === -1 ? token : token.slice(0, ci)).trim()
      const arg = ci === -1 ? undefined : token.slice(ci + 1)
      if (!namePattern.test(name)) {
        // Not a valid tag - leave the text alone, keep scanning past the opener
        parts.push(template.slice(pos, from))
        pos = from
        continue
      }
      const tagEnd = end + endD.length
      parts.push(template.slice(pos, s - b) + "\\".repeat(b / 2))
      calls.push({ at: parts.length, name, arg, tag: template.slice(s, tagEnd) })
      parts.push(null)
      pos = tagEnd
    }
    parts.push(template.slice(pos))

    // A dotted name walks the plugin object (namespaced plugins like
    // #{format.date:...}), with the same guards as variable mode. Returns
    // {fn, parent} so the call keeps its `this` (parent.method semantics).
    const lookupFn = name => {
      const seg = name.split(".")
      let parent = null,
        fn = data
      for (let i = 0; i < seg.length; i++) {
        if (!hasKey(fn, seg[i])) return null
        parent = fn
        fn = fn[seg[i]]
      }
      return typeof fn === "function" ? { fn, parent } : null
    }

    // Validate every name BEFORE invoking any plugin, so a missing-function
    // throw can't strand promises already returned by earlier plugins.
    for (const c of calls) {
      c.resolved = lookupFn(c.name)
      if (!c.resolved && options.warn) {
        throw new Error(`nano-var-template: Missing function ${c.name}`)
      }
    }
    let hasPromise = false
    try {
      for (const c of calls) {
        if (!c.resolved) {
          parts[c.at] = c.tag // warn: false - leave the tag in place
          continue
        }
        const result = c.resolved.fn.call(c.resolved.parent, c.arg)
        if (result && typeof result.then === "function") hasPromise = true
        parts[c.at] = result
      }
    } catch (err) {
      // A plugin threw synchronously mid-loop. Silence promises already in
      // flight so they can't crash the process as unhandled rejections after
      // the caller catches this error.
      for (const p of parts) {
        if (p && typeof p.then === "function") p.then(() => {}, () => {})
      }
      throw err
    }

    return hasPromise
      ? Promise.all(parts).then(resolved => resolved.map(String).join(""))
      : parts.map(String).join("")
  }
}
module.exports = Tpl
