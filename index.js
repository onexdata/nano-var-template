const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const own = Object.prototype.hasOwnProperty

// The one lookup guard both modes share - this predicate IS the prototype
// defense, so it exists exactly once. The rule: an object's OWN keys are
// always data, even ones named `toString`/`constructor` (real-world JSON has
// such keys). But a name that would resolve to Object.prototype's own
// members (constructor, __proto__, toString, ...) - or Function.prototype's
// (call, apply, bind, plus the caller/arguments poison accessors that throw
// raw TypeErrors on read) when the holder is a function - is missing, so a
// template can never reach engine internals. Everything else on a prototype
// chain resolves normally: class getters, methods, Object.create() layering.
// Object(x) boxes primitives so the checks never throw; x == null is checked
// first because Object(null) would lie.
const hasKey = (x, key) => {
  if (x == null) return false
  const o = Object(x)
  if (own.call(o, key)) return true
  if (own.call(Object.prototype, key)) return false
  if (typeof x === "function" && own.call(Function.prototype, key)) return false
  return key in o
}

const Tpl = options => {
  // You can pass options to overide defaults...
  options = Object.assign(
    {
      start: options && options.functions
      ? "#{"
      : "${",
      end: "}",
      path: "[a-zA-Z0-9_$][\\.a-zA-Z0-9_$]*",
      warn: true,
      functions: false
    },
    options
  )
  // The escaping rule, identical in both modes: a backslash run immediately
  // before ANY occurrence of the start delimiter follows C-style parity -
  // pairs collapse to literal backslashes, an odd remaining backslash renders
  // the delimiter (and so the tag, if it was one) as literal text. Backslashes
  // anywhere else are not special at all. The parity rule applying to every
  // occurrence - not just real tags - is what makes `tpl.escape()` sound: it
  // can escape a value without knowing what the value will sit next to.
  //
  // First alternative: a real tag, with the two escape groups in front.
  // Second alternative: any other start-delimiter occurrence - no tag to
  // substitute, but the same parity applies to the backslashes before it.
  //
  // No "i" flag: delimiters must match case-exactly (a BEGIN/END pass must
  // not consume "begin...end", and function mode's indexOf scan is already
  // case-sensitive). The default path pattern spells out A-Z instead.
  const startRe = escapeRegex(options.start)
  const match = new RegExp(
    "((?:\\\\\\\\)*)(\\\\?)" + startRe + "\\s*(" + options.path + ")\\s*" + escapeRegex(options.end) +
      "|((?:\\\\\\\\)*)(\\\\?)" + startRe,
    "g"
  )
  // Function mode validates the name (the part before ':') against the same
  // path option, anchored.
  const namePattern = new RegExp("^(?:" + options.path + ")$")
  const escRun = new RegExp("(\\\\*)" + startRe, "g")
  const tpl = (template, data) => {
    if (!options.functions) {
      // Merge the passed data into the template string we're sending back...
      // (String.replace collects every match before invoking the callback,
      // so a callback that re-enters this instance can't corrupt the scan.)
      return template.replace(match, (tag, pairs, esc, token, pairs2) => {
        // Second alternative: a start delimiter that isn't part of a valid
        // tag. Nothing to substitute - apply backslash parity and move on.
        if (token === undefined) return "\\".repeat(pairs2.length / 2) + options.start
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
    let end = -1 // memoized "first end delimiter at or after `from`" - only moves forward; Infinity = none left
    let slid = -1 // memoized closer-run slide for the current `end`
    const findEnd = from => {
      if (end !== Infinity && end < from) {
        end = template.indexOf(endD, from)
        if (end === -1) end = Infinity
      }
      return end
    }
    for (;;) {
      const s = template.indexOf(startD, pos)
      if (s === -1) break
      const b = slashesBefore(s, pos)
      const from = s + startD.length
      let name, arg, e
      // An opener is a tag when its backslash run is even (odd = escaped),
      // a closer exists, no unescaped inner opener pre-empts it (unclosed or
      // nested like "#{a:x #{b:y} z" - the inner opener may be a real tag),
      // and the name validates.
      let isTag = !(b & 1) && findEnd(from) !== Infinity
      if (isTag) {
        e = end
        // Multi-char closers: in a run like '}}}' with end '}}', the FIRST
        // alignment would steal the argument's final '}' ('{{parse:{"a":1}}}'
        // silently truncating the arg to '{"a":1'). Slide to the LAST
        // overlapping alignment so the argument keeps its closing characters.
        // (Never for single-char closers - '%fn:a%%b%' must close at the
        // first '%', or the slide would eat the next tag's opener. Never when
        // start and end are identical either: '%%a:x%%%%b:y%%' would slide
        // into the next tag's opener and destroy the first tag. Memoized so
        // repeated non-tag openers before one long run can't go quadratic.)
        if (endD.length > 1 && startD !== endD) {
          if (slid < e) {
            slid = e
            while (template.startsWith(endD, slid + 1)) slid++
          }
          e = slid
        }
        const inner = nextOpener(from)
        if (inner !== -1 && inner < e) isTag = false
        else {
          // Only the first ':' separates the function name from its argument -
          // everything after it (colons, spaces, anything) is the argument, verbatim.
          const token = template.slice(from, e)
          const ci = token.indexOf(":")
          name = (ci === -1 ? token : token.slice(0, ci)).trim()
          arg = ci === -1 ? undefined : token.slice(ci + 1)
          isTag = namePattern.test(name)
        }
      }
      if (!isTag) {
        // Literal opener - escaped, unclosed, pre-empted by an inner opener,
        // or an invalid name. Backslash parity applies exactly as it would
        // for a tag: pairs collapse, an odd backslash is consumed escaping
        // the opener. Keep scanning after the opener.
        parts.push(template.slice(pos, s - b) + "\\".repeat(b >> 1) + startD)
        pos = from
        continue
      }
      const tagEnd = e + endD.length
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
      // the caller catches this error. Each part is guarded: a poisoned
      // thenable (whose `then` itself throws) must neither mask `err` nor
      // stop the parts after it from being settled.
      for (const p of parts) {
        try {
          if (p && typeof p.then === "function") p.then(() => {}, () => {})
        } catch { /* poisoned thenable - nothing in flight to settle */ }
      }
      throw err
    }

    return hasPromise
      ? Promise.all(parts).then(resolved => resolved.map(String).join(""))
      : parts.map(String).join("")
  }
  // Escape a value so it survives THIS instance's pass as literal text -
  // the safe way to move untrusted data across pass boundaries. Every
  // occurrence of the start delimiter gets its backslash run doubled (parity
  // preserved) plus one escaping backslash; a trailing backslash run is
  // doubled too, so the value can't escape (or pair-collapse into) whatever
  // the template puts right after it.
  tpl.escape = value => String(value)
    .replace(escRun, (m, bs) => bs + bs + "\\" + options.start)
    .replace(/\\+$/, m => m + m)
  return tpl
}
module.exports = Tpl
