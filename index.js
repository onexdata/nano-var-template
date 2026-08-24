const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const own = Object.prototype.hasOwnProperty
const isProtoOf = Object.prototype.isPrototypeOf

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
  // Function.prototype's own members (call/apply/bind + the caller/arguments
  // poison accessors) are blocked for anything with Function.prototype in its
  // chain - not just callables, but e.g. Object.create(someFunction), which is
  // an object yet still inherits them. A function's own name/length are caught
  // by the own-key check above, so they still resolve.
  if (own.call(Function.prototype, key) && isProtoOf.call(Function.prototype, o)) return false
  return key in o
}

const Tpl = options => {
  // You can pass options to override defaults. An explicit `undefined` for any
  // key falls back to the default rather than clobbering it (Object.assign
  // would copy the undefined over, crashing on `start` and silently flipping
  // `warn` to falsy).
  const src = options || {}
  const defaults = {
    start: src.functions ? "#{" : "${",
    end: "}",
    path: "[a-zA-Z0-9_$][\\.a-zA-Z0-9_$]*",
    warn: true,
    functions: false
  }
  options = {}
  for (const k in defaults) options[k] = src[k] !== undefined ? src[k] : defaults[k]
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
        // A missing name renders the tag literally - but the leading backslash
        // pairs still collapse (dropping them would make the same template
        // yield a different backslash count depending on whether the name
        // happens to exist).
        const literal = prefix + tag.slice(pairs.length)
        const path = token.split("."),
          len = path.length
        let lookup = data
        for (let i = 0; i < len; i++) {
          if (!hasKey(lookup, path[i])) {
            if (options.warn) throw new Error(`nano-var-template: '${path[i]}' missing in ${tag}`)
            return literal
          }
          lookup = lookup[path[i]]
          // Property not found
          if (lookup === undefined) {
            if (options.warn) throw new Error(`nano-var-template: '${path[i]}' missing in ${tag}`)
            return literal
          }
          // Return the required value. String() (not implicit coercion) so a
          // Symbol value follows the warn contract instead of throwing a raw
          // TypeError - matching function mode.
          if (i === len - 1) return prefix + String(lookup)
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
        // Only the first ':' separates the name from its argument. `head` is
        // the token at the UNSLID closer; the name (and so the colon that
        // matters) always lies before it. Slicing to `e` bounds this scan to
        // the token - a plain indexOf(':', from) would run to end-of-string on
        // colon-less input and go quadratic over many tags.
        const head = template.slice(from, e)
        const ci = head.indexOf(":")
        // Multi-char closers: in a run like '}}}' with end '}}', the FIRST
        // alignment would steal the argument's final '}' ('{{parse:{"a":1}}}'
        // silently truncating the arg to '{"a":1'). Slide to the LAST
        // overlapping alignment so the argument keeps its closing characters.
        // Only for a tag that HAS an argument: a name-only tag ('{{a}}}') can
        // never legitimately contain the closer, so sliding would just corrupt
        // its name to 'a}' and drop the tag. (Never for single-char closers -
        // '%fn:a%%b%' must close at the first '%', or the slide would eat the
        // next tag's opener. Never when start and end are identical either:
        // '%%a:x%%%%b:y%%' would slide into the next tag's opener and destroy
        // the first tag. Memoized so repeated openers before one long run
        // can't go quadratic.)
        if (ci !== -1 && endD.length > 1 && startD !== endD) {
          if (slid < e) {
            slid = e
            while (template.startsWith(endD, slid + 1)) slid++
          }
          e = slid
        }
        const inner = nextOpener(from)
        if (inner !== -1 && inner < e) isTag = false
        else {
          name = (ci === -1 ? head : head.slice(0, ci)).trim()
          // arg re-slices to the (possibly slid) closer so it keeps trailing
          // closer characters; the name came from the unslid `head`.
          arg = ci === -1 ? undefined : template.slice(from + ci + 1, e)
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
        // Reflect.apply, not fn.call: a plugin may itself have an own `call`
        // property (own keys are data - a documented feature), which would
        // otherwise shadow Function.prototype.call and break invocation.
        const result = Reflect.apply(c.resolved.fn, c.resolved.parent, [c.arg])
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
  // Neutralize this instance's start delimiter inside a value so a complete
  // delimiter the value contains can't start a tag in this pass. Each start
  // delimiter gets its backslash run doubled (parity preserved) plus one
  // escaping backslash; a trailing backslash run is doubled so it can't escape
  // a delimiter the template places immediately after.
  //
  // This is best-effort defense-in-depth, NOT a complete sandbox: it cannot
  // neutralize a value ending in a *partial* delimiter (which fuses with
  // following text into a tag it never saw), it doesn't touch the end
  // delimiter (a value inside a tag's argument can still inject a closer),
  // and each pass needs its own escape. The airtight mitigation is to inject
  // untrusted data only in the last / a non-interpreted pass - see the
  // README "Untrusted data in multi-pass pipelines" section.
  tpl.escape = value => String(value)
    .replace(escRun, (m, bs) => bs + bs + "\\" + options.start)
    .replace(/\\+$/, m => m + m)
  return tpl
}
module.exports = Tpl
