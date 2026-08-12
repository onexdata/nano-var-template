const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const Tpl = options => {
  // You can pass options to overide defaults...
  options = Object.assign(
    {
      start: options && options.functions
      ? "#{"
      : "${",
      end: "}",
      path:
        options && options.functions
          ? "[a-z0-9_$][.a-z0-9_$]*(?::[\\s\\S]*?)?"
          : "[a-z0-9_$][\\.a-z0-9_]*",
      warn: true,
      functions: false
    },
    options
  )
  const match = new RegExp(
    escapeRegex(options.start) + "\\s*(" + options.path + ")\\s*" + escapeRegex(options.end),
    "gi"
  )
  return (template, data) => {
    if (!options.functions) {
      // Merge the passed data into the template string we're sending back...
      return template.replace(match, (tag, token) => {
        const path = token.split("."),
          len = path.length
        let lookup = data
        for (let i = 0; i < len; i++) {
          // lookup == null short-circuits before hasOwnProperty, which throws on null/undefined
          if (lookup == null || !Object.prototype.hasOwnProperty.call(lookup, path[i])) {
            if (options.warn) throw new Error(`nano-var-template: '${path[i]}' missing in ${tag}`)
            return tag
          }
          lookup = lookup[path[i]]
          // Property not found
          if (lookup === undefined) {
            if (options.warn) throw new Error(`nano-var-template: '${path[i]}' missing in ${tag}`)
            return tag
          }
          // Return the required value
          if (i === len - 1) return lookup
        }
      })
    }

    // Function mode can't use String.replace() directly: a plugin function
    // may return a Promise, and replace()'s callback must return synchronously.
    // So we scan matches by hand, call each function, and only fall back to
    // Promise.all + reassembly if a plugin actually returned a thenable -
    // fully-synchronous plugins (the common case) still return a plain string.
    let hasPromise = false
    const parts = []
    let lastIndex = 0
    match.lastIndex = 0
    let m
    while ((m = match.exec(template)) !== null) {
      parts.push(template.slice(lastIndex, m.index))
      const tag = m[0],
        token = m[1]
      // Only the first ':' separates the function name from its argument -
      // everything after it (including further colons) is the argument.
      const i = token.indexOf(":")
      const name = i === -1 ? token : token.slice(0, i)
      const arg = i === -1 ? undefined : token.slice(i + 1)
      if (!Object.prototype.hasOwnProperty.call(data, name) || typeof data[name] !== "function") {
        if (options.warn) throw new Error(`nano-var-template: Missing function ${name}`)
        parts.push(tag)
      } else {
        const result = data[name](arg)
        if (result && typeof result.then === "function") hasPromise = true
        parts.push(result)
      }
      lastIndex = m.index + tag.length
    }
    parts.push(template.slice(lastIndex))

    return hasPromise
      ? Promise.all(parts).then(resolved => resolved.map(String).join(""))
      : parts.map(String).join("")
  }
}
module.exports = Tpl
