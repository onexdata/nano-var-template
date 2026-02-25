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
          ? "[a-z0-9_$][: ,\\.a-z0-9_]*"
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
    // Merge the passed data into the template string we're sending back...
    return template.replace(match, (tag, token) => {
      var delim = options.functions ? ":" : "."
      var path = token.split(delim),
        lookup = data
      if (options.functions) {
        if (typeof data[path[0]] !== "function") {
          if (options.warn) throw `nano-var-template: Missing function ${path}`
          return tag
        }
        return data[path[0]](path[1])
      }
      for (let i = 0; i < path.length; i++) {
        if (lookup == null) {
          if (options.warn) throw `nano-var-template: '${path[i]}' missing in ${tag}`
          return tag
        }
        lookup = lookup[path[i]]
        // Property not found
        if (lookup === undefined) {
          if (options.warn) throw `nano-var-template: '${path[i]}' missing in ${tag}`
          return tag
        }
        // Return the required value
        if (i === path.length - 1) return lookup
      }
    })
  }
}
module.exports = Tpl
