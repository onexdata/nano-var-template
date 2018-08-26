// You can pass options to replace allowed variables, and the start and end brackets...
module.exports = (options = { start: "{{", end: "}}", path: "[a-z0-9_$][\\.a-z0-9_]*", warn: true}) => {
  const match = new RegExp(options.start + "\\s*(" + options.path + ")\\s*" + options.end, "gi")
  return (template, data) => {
    // Merge the passed data into the template strings...
    return template.replace(match, (tag, token) => {
      let path = token.split("."), lookup = data
      for (let i = 0; i < path.length; i++) {
        lookup = lookup[path[i]]
        // Property not found
        if (lookup === undefined && options.warn) throw "nano-var-template: '" + path[i] + "' missing in " + tag
        // Return the required value
        if (i === path.length - 1) return lookup
      }
    })
  }
} 