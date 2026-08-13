const { describe, it } = require("node:test")
const assert = require("node:assert/strict")
const Tpl = require("../index")

// ─── Basic variable substitution ────────────────────────────────────────────

describe("basic variable substitution", () => {
  const tpl = Tpl()

  it("replaces a single variable", () => {
    assert.equal(tpl("Hello ${name}!", { name: "Jane" }), "Hello Jane!")
  })

  it("replaces multiple variables", () => {
    assert.equal(
      tpl("${greeting} ${name}!", { greeting: "Hi", name: "Jane" }),
      "Hi Jane!"
    )
  })

  it("replaces the same variable used multiple times", () => {
    assert.equal(
      tpl("${x} and ${x}", { x: "ok" }),
      "ok and ok"
    )
  })

  it("leaves non-matching text untouched", () => {
    assert.equal(tpl("no vars here", {}), "no vars here")
  })

  it("handles empty template string", () => {
    assert.equal(tpl("", { x: 1 }), "")
  })

  it("handles template with no matching vars in data", () => {
    // warn defaults to true, so missing var throws
    assert.throws(() => tpl("${missing}", {}), /missing/)
  })
})

// ─── Nested path access ────────────────────────────────────────────────────

describe("nested path access", () => {
  const tpl = Tpl()

  it("resolves a two-level path", () => {
    assert.equal(
      tpl("${user.name}", { user: { name: "Jane" } }),
      "Jane"
    )
  })

  it("resolves a deep path", () => {
    const data = { a: { b: { c: { d: "deep" } } } }
    assert.equal(tpl("${a.b.c.d}", data), "deep")
  })

  it("throws on missing intermediate property (warn: true)", () => {
    assert.throws(
      () => tpl("${user.name}", { user: {} }),
      /name.*missing/
    )
  })

  it("throws when traversing through a non-object (warn: true)", () => {
    assert.throws(
      () => tpl("${user.name.first}", { user: { name: "Jane" } }),
      /first.*missing/
    )
  })
})

// ─── Falsy but valid values ─────────────────────────────────────────────────

describe("falsy but valid values", () => {
  const tpl = Tpl()

  it("resolves 0", () => {
    assert.equal(tpl("${count}", { count: 0 }), "0")
  })

  it("resolves false", () => {
    assert.equal(tpl("${flag}", { flag: false }), "false")
  })

  it("resolves empty string", () => {
    assert.equal(tpl("${empty}", { empty: "" }), "")
  })

  it("resolves null (returns 'null' as string)", () => {
    // null is a valid value — String.replace coerces to "null"
    assert.equal(tpl("${val}", { val: null }), "null")
  })
})

// ─── warn: false (silent mode) ─────────────────────────────────────────────

describe("warn: false (silent mode)", () => {
  const tpl = Tpl({ warn: false })

  it("returns original tag for missing top-level variable", () => {
    assert.equal(tpl("Hello ${name}!", {}), "Hello ${name}!")
  })

  it("returns original tag for missing nested property", () => {
    assert.equal(
      tpl("${user.name}", { user: {} }),
      "${user.name}"
    )
  })

  it("returns original tag when traversing through null", () => {
    assert.equal(
      tpl("${a.b.c}", { a: { b: null } }),
      "${a.b.c}"
    )
  })

  it("returns original tag when traversing through a primitive", () => {
    assert.equal(
      tpl("${user.name.first}", { user: { name: "Jane" } }),
      "${user.name.first}"
    )
  })

  it("still resolves variables that do exist", () => {
    assert.equal(
      tpl("${found} ${missing}", { found: "yes" }),
      "yes ${missing}"
    )
  })
})

// ─── Custom delimiters ─────────────────────────────────────────────────────

describe("custom delimiters", () => {
  it("supports {{ }} (Vue/Angular style)", () => {
    const tpl = Tpl({ start: "{{", end: "}}" })
    assert.equal(tpl("Hello {{name}}!", { name: "Jane" }), "Hello Jane!")
  })

  it("supports @#[ ]# (arbitrary custom)", () => {
    const tpl = Tpl({ start: "@#[", end: "]#" })
    assert.equal(tpl("Hello @#[name]#!", { name: "Jane" }), "Hello Jane!")
  })

  it("supports delimiters with regex special characters", () => {
    const tpl = Tpl({ start: "$(", end: ")" })
    assert.equal(tpl("Hello $(name)!", { name: "Jane" }), "Hello Jane!")
  })

  it("supports [ ] delimiters", () => {
    const tpl = Tpl({ start: "[", end: "]" })
    assert.equal(tpl("Hello [name]!", { name: "Jane" }), "Hello Jane!")
  })

  it("supports single-char delimiters", () => {
    const tpl = Tpl({ start: "%", end: "%" })
    assert.equal(tpl("Hello %name%!", { name: "Jane" }), "Hello Jane!")
  })
})

// ─── Whitespace handling ────────────────────────────────────────────────────

describe("whitespace in tokens", () => {
  const tpl = Tpl()

  it("handles leading whitespace inside delimiters", () => {
    assert.equal(tpl("Hello ${ name}!", { name: "Jane" }), "Hello Jane!")
  })

  it("handles trailing whitespace inside delimiters", () => {
    assert.equal(tpl("Hello ${name }!", { name: "Jane" }), "Hello Jane!")
  })

  it("handles whitespace on both sides", () => {
    assert.equal(tpl("Hello ${ name }!", { name: "Jane" }), "Hello Jane!")
  })
})

// ─── Case sensitivity ───────────────────────────────────────────────────────

describe("case sensitivity", () => {
  const tpl = Tpl()

  it("matches variable names case-insensitively in the template", () => {
    // regex has 'i' flag so ${NAME} matches, but token preserves original case
    // for data lookup — so data key must match the template's case
    assert.equal(tpl("${Name}", { Name: "Jane" }), "Jane")
  })

  it("data key case must match template token case", () => {
    // ${NAME} looks up data["NAME"], not data["name"]
    assert.throws(() => tpl("${NAME}", { name: "Jane" }))
  })
})

// ─── Function / plugin mode ────────────────────────────────────────────────

describe("function mode", () => {
  const tpl = Tpl({ functions: true })

  it("calls a function with no arguments", () => {
    const plugins = { greet: () => "Hello!" }
    assert.equal(tpl("#{greet}", plugins), "Hello!")
  })

  it("calls a function with a string argument", () => {
    const plugins = { upper: s => s.toUpperCase() }
    assert.equal(tpl("#{upper:hello}", plugins), "HELLO")
  })

  it("passes everything after : as the argument string", () => {
    const plugins = { echo: s => s }
    assert.equal(
      tpl("#{echo:a, b, c}", plugins),
      "a, b, c"
    )
  })

  it("function receives undefined when no argument given", () => {
    const plugins = {
      check: arg => (arg === undefined ? "none" : arg)
    }
    assert.equal(tpl("#{check}", plugins), "none")
  })

  it("throws on missing function (warn: true)", () => {
    assert.throws(() => tpl("#{nope}", {}), /Missing function/)
  })

  it("returns original tag on missing function (warn: false)", () => {
    const quietTpl = Tpl({ functions: true, warn: false })
    assert.equal(quietTpl("#{nope}", {}), "#{nope}")
  })

  it("returns original tag when value is not a function (warn: false)", () => {
    const quietTpl = Tpl({ functions: true, warn: false })
    assert.equal(quietTpl("#{notfn}", { notfn: "string" }), "#{notfn}")
  })

  it("supports custom function delimiters", () => {
    const tpl2 = Tpl({ functions: true, start: "@{", end: "}" })
    const plugins = { greet: () => "Hi" }
    assert.equal(tpl2("@{greet}", plugins), "Hi")
  })

  it("only splits on the first ':' - later colons stay in the argument", () => {
    const plugins = { echo: s => s }
    assert.equal(tpl("#{echo:a:b:c}", plugins), "a:b:c")
  })

  it("accepts arguments with URL-safe characters (/, -, ?, =, &)", () => {
    const plugins = {
      link: args => {
        const [url, text] = args.split(", ")
        return `<a href="${url}">${text}</a>`
      }
    }
    assert.equal(
      tpl("#{link:https://example.com/a-b?x=1&y=2, Click here}", plugins),
      '<a href="https://example.com/a-b?x=1&y=2">Click here</a>'
    )
  })

  it("does not treat inherited Object.prototype members as callable functions", () => {
    assert.throws(() => tpl("#{constructor}", {}), /Missing function/)
  })
})

// ─── Prototype-chain data (allowed) vs Object.prototype (blocked) ──────────

describe("prototype-chain data", () => {
  const tpl = Tpl()
  const fnTpl = Tpl({ functions: true })

  it("resolves class-instance getters (variable mode)", () => {
    class User {
      get name() { return "Jane" }
    }
    assert.equal(tpl("${u.name}", { u: new User() }), "Jane")
  })

  it("resolves Object.create() default layering (variable mode)", () => {
    const cfg = Object.create({ theme: "dark" })
    cfg.lang = "en"
    assert.equal(tpl("${c.theme} ${c.lang}", { c: cfg }), "dark en")
  })

  it("calls class-instance methods as plugins (function mode)", () => {
    class Plugins {
      greet(n) { return `hi ${n}` }
    }
    assert.equal(fnTpl("#{greet:x}", new Plugins()), "hi x")
  })

  it("still blocks Object.prototype members even via a class instance", () => {
    class User {}
    assert.throws(() => tpl("${u.constructor}", { u: new User() }), /constructor.*missing/)
  })
})

// ─── Malformed input safety ─────────────────────────────────────────────────

describe("malformed input safety (function mode)", () => {
  const tpl = Tpl({ functions: true })
  const quiet = Tpl({ functions: true, warn: false })

  it("an unclosed opener before a real tag stays literal - the real tag still resolves", () => {
    const result = tpl("#{a:x #{b:y} z", { a: s => `[${s}]`, b: s => s.toUpperCase() })
    assert.equal(result, "#{a:x Y z")
  })

  it("a plugin that re-enters the same instance is safe", () => {
    const plugins = {
      outer: () => tpl("#{inner:x}", plugins),
      inner: s => `I(${s})`
    }
    assert.equal(tpl("a #{outer:1} b", plugins), "a I(x) b")
  })

  it("null/undefined data follows the warn convention instead of TypeError-ing", () => {
    assert.equal(quiet("#{a}", null), "#{a}")
    assert.throws(() => tpl("#{a}", undefined), err =>
      err instanceof Error && /Missing function/.test(err.message))
  })

  it("handles a large adversarial unclosed-tag template in linear time", () => {
    const bomb = "#{a:".repeat(100000) + "}"
    const started = Date.now()
    const result = quiet(bomb, { a: s => `[${s}]` })
    assert.ok(Date.now() - started < 2000, "scan should be linear, not quadratic")
    assert.ok(result.endsWith("#{a:[]"))
  })

  it("a missing function throws before any plugin runs - no orphaned promises", async () => {
    let rejected = null
    const handler = r => { rejected = r }
    process.on("unhandledRejection", handler)
    try {
      let aRan = false
      assert.throws(() => tpl("#{a}#{nope}", {
        a: () => { aRan = true; return Promise.reject(new Error("orphaned")) }
      }), /Missing function nope/)
      assert.equal(aRan, false, "plugins must not run when validation fails")
      await new Promise(r => setTimeout(r, 50))
      assert.equal(rejected, null, "no unhandled rejection may escape")
    } finally {
      process.removeListener("unhandledRejection", handler)
    }
  })

  it("a plugin throwing mid-template does not orphan earlier plugins' promises", async () => {
    let rejected = null
    const handler = r => { rejected = r }
    process.on("unhandledRejection", handler)
    try {
      assert.throws(() => tpl("#{a}#{boom}", {
        a: () => Promise.reject(new Error("orphaned")),
        boom: () => { throw new Error("sync boom") }
      }), /sync boom/)
      await new Promise(r => setTimeout(r, 50))
      assert.equal(rejected, null, "no unhandled rejection may escape")
    } finally {
      process.removeListener("unhandledRejection", handler)
    }
  })
})

// ─── Function argument fidelity ─────────────────────────────────────────────

describe("function argument fidelity", () => {
  const tpl = Tpl({ functions: true })

  it("passes the argument verbatim, whitespace included", () => {
    assert.equal(tpl("#{echo: x }", { echo: s => JSON.stringify(s) }), '" x "')
  })

  it("an explicit ':' with nothing after it passes empty string, not undefined", () => {
    assert.equal(tpl("#{echo:}", { echo: s => (s === "" ? "empty" : "?") }), "empty")
  })

  it("tolerates whitespace around the function name", () => {
    assert.equal(tpl("#{ greet :Jane}", { greet: n => `Hi ${n}` }), "Hi Jane")
  })
})

// ─── Function-mode delimiter coverage ───────────────────────────────────────

describe("function-mode delimiters", () => {
  it("supports multi-character end delimiters", () => {
    const tpl = Tpl({ functions: true, start: "{{", end: "}}" })
    assert.equal(tpl("x {{fn:a}} y", { fn: s => `[${s}]` }), "x [a] y")
  })

  it("a multi-char end delimiter lets arguments contain its single-char pieces", () => {
    const tpl = Tpl({ functions: true, start: "{{", end: "}}" })
    assert.equal(
      tpl('{{parse:{"a":1}}}', { parse: s => `GOT:${s}` }),
      'GOT:{"a":1}'
    )
  })

  it("supports identical start and end delimiters", () => {
    const tpl = Tpl({ functions: true, start: "%", end: "%" })
    assert.equal(tpl("x %fn:a% y", { fn: s => `[${s}]` }), "x [a] y")
  })
})

// ─── Namespaced plugins (dotted function names) ─────────────────────────────

describe("namespaced plugins", () => {
  const tpl = Tpl({ functions: true })
  const plugins = {
    format: {
      date: s => `DATE(${s})`,
      money: s => `$${s}`
    },
    greet: n => `hi ${n}`
  }

  it("resolves dotted names through nested plugin objects", () => {
    assert.equal(
      tpl("#{format.date:2026} #{format.money:5} #{greet:x}", plugins),
      "DATE(2026) $5 hi x"
    )
  })

  it("preserves `this` for namespaced methods", () => {
    const ns = { util: { prefix: ">>", tag(s) { return this.prefix + s } } }
    assert.equal(tpl("#{util.tag:hello}", ns), ">>hello")
  })

  it("throws Missing function for a missing namespace member", () => {
    assert.throws(() => tpl("#{format.nope:x}", plugins), /Missing function format\.nope/)
  })

  it("throws Missing function when the path dead-ends past a function", () => {
    assert.throws(() => tpl("#{format.date.deeper:x}", plugins), /Missing function/)
  })

  it("blocks Object.prototype members mid-path", () => {
    assert.throws(() => tpl("#{format.constructor:x}", plugins), /Missing function/)
  })
})

// ─── Escaping ───────────────────────────────────────────────────────────────

describe("escaping", () => {
  const tpl = Tpl()
  const fnTpl = Tpl({ functions: true })
  const data = { name: "Jane" }

  it("a backslash before a tag renders it literally (variable mode)", () => {
    assert.equal(tpl("\\${name}", data), "${name}")
  })

  it("a backslash pair collapses and the tag substitutes", () => {
    assert.equal(tpl("\\\\${name}", data), "\\Jane")
  })

  it("odd/even backslash runs follow C-style parity", () => {
    assert.equal(tpl("\\\\\\${name}", data), "\\${name}")     // 3 -> \ + literal
    assert.equal(tpl("\\\\\\\\${name}", data), "\\\\Jane")    // 4 -> \\ + value
  })

  it("backslashes anywhere else are not special", () => {
    assert.equal(tpl("a\\b c\\\\d ${name}", data), "a\\b c\\\\d Jane")
  })

  it("escapes work in function mode - the plugin is not called", () => {
    let called = false
    assert.equal(fnTpl("\\#{fn}", { fn: () => { called = true; return "X" } }), "#{fn}")
    assert.equal(called, false)
  })

  it("a backslash pair in function mode collapses and the plugin runs", () => {
    assert.equal(fnTpl("\\\\#{fn:x}", { fn: s => `[${s}]` }), "\\[x]")
  })

  it("escapes work with custom delimiters", () => {
    const t = Tpl({ start: "{{", end: "}}" })
    assert.equal(t("\\{{name}} {{name}}", data), "{{name}} Jane")
  })

  it("backslashes inside function arguments pass through verbatim", () => {
    assert.equal(fnTpl("#{echo:a\\b}", { echo: s => s }), "a\\b")
  })

  it("an escaped tag mixed with live tags", () => {
    assert.equal(tpl("real ${name}, literal \\${name}", data), "real Jane, literal ${name}")
  })
})

// ─── Async plugin functions ─────────────────────────────────────────────────

describe("async plugin functions", () => {
  const tpl = Tpl({ functions: true })

  it("returns a plain string when every plugin is synchronous", () => {
    const result = tpl("#{greet:Jane}", { greet: n => `Hi ${n}` })
    assert.equal(typeof result, "string")
    assert.equal(result, "Hi Jane")
  })

  it("returns a Promise<string> when a plugin returns a Promise", async () => {
    const result = tpl("Hello #{fetchName:1}!", {
      fetchName: id => Promise.resolve(`Jane-${id}`)
    })
    assert.ok(result instanceof Promise)
    assert.equal(await result, "Hello Jane-1!")
  })

  it("resolves multiple async plugins in the same template", async () => {
    const result = tpl("#{a} #{b}", {
      a: () => Promise.resolve("X"),
      b: () => Promise.resolve("Y")
    })
    assert.equal(await result, "X Y")
  })

  it("mixes sync and async plugins in the same template", async () => {
    const result = tpl("#{a} #{b}", {
      a: () => "X",
      b: () => Promise.resolve("Y")
    })
    assert.equal(await result, "X Y")
  })

  it("propagates a rejected plugin promise", async () => {
    const result = tpl("#{fail}", { fail: () => Promise.reject(new Error("boom")) })
    await assert.rejects(result, /boom/)
  })

  it("still throws synchronously for a missing function, even in an async template", () => {
    assert.throws(() => tpl("#{nope}", { ok: () => Promise.resolve("x") }), /Missing function/)
  })
})

// ─── Multi-pass composition (the core architectural pattern) ────────────────

describe("multi-pass composition", () => {
  it("two-pass: variables then functions", () => {
    const varTpl = Tpl()
    const fnTpl = Tpl({ functions: true })

    const template = "Hello #{greet:${name}}!"
    const data = { name: "Jane" }
    const plugins = { greet: name => `Welcome, ${name}` }

    // Pass 1: resolve ${} variables
    const pass1 = varTpl(template, data)
    assert.equal(pass1, "Hello #{greet:Jane}!")

    // Pass 2: resolve #{} functions
    const pass2 = fnTpl(pass1, plugins)
    assert.equal(pass2, "Hello Welcome, Jane!")
  })

  it("three-pass: variables, then functions, then user references", () => {
    const varTpl = Tpl()
    const fnTpl = Tpl({ functions: true })
    const userTpl = Tpl({ start: "@{", end: "}" })

    const template = "Hi @{${user.id}}! Avatar: #{avatar:${user.avatar}}"
    const data = { user: { id: "42", avatar: "cat.png" } }
    const users = { 42: "Jane Doe" }
    const plugins = { avatar: src => `<img src="${src}" />` }

    // Pass 1: resolve ${} variables
    const pass1 = varTpl(template, data)
    assert.equal(pass1, 'Hi @{42}! Avatar: #{avatar:cat.png}')

    // Pass 2: resolve #{} functions
    const pass2 = fnTpl(pass1, plugins)
    assert.equal(pass2, 'Hi @{42}! Avatar: <img src="cat.png" />')

    // Pass 3: resolve @{} user references
    const pass3 = userTpl(pass2, users)
    assert.equal(pass3, 'Hi Jane Doe! Avatar: <img src="cat.png" />')
  })

  it("four-pass: data → components → layout → final", () => {
    // Four passes with simple string values to demonstrate N-pass depth.
    const dataTpl = Tpl()                                          // pass 1: ${}
    const tagTpl = Tpl({ functions: true })                        // pass 2: #{}
    const wrapTpl = Tpl({ start: "@{", end: "}", functions: true })// pass 3: @{}
    const frameTpl = Tpl({ start: "~(", end: ")" })                // pass 4: ~()

    const template = "~(before)@{wrap:#{tag:${word}}}~(after)"

    // Pass 1: resolve ${} — inject raw data
    const p1 = dataTpl(template, { word: "hello" })
    assert.equal(p1, "~(before)@{wrap:#{tag:hello}}~(after)")

    // Pass 2: resolve #{} — tag function transforms the word
    const p2 = tagTpl(p1, { tag: w => w.toUpperCase() })
    assert.equal(p2, "~(before)@{wrap:HELLO}~(after)")

    // Pass 3: resolve @{} — wrap function adds decoration
    const p3 = wrapTpl(p2, { wrap: s => `[${s}]` })
    assert.equal(p3, "~(before)[HELLO]~(after)")

    // Pass 4: resolve ~() — inject frame variables
    const p4 = frameTpl(p3, { before: ">>>", after: "<<<" })
    assert.equal(p4, ">>>[HELLO]<<<")
  })

  it("passes are order-independent — later delimiters survive earlier passes", () => {
    const pass1 = Tpl()
    const pass2 = Tpl({ functions: true })

    // #{} tokens survive pass 1 because pass 1 only matches ${}
    const template = "#{fn:${val}}"
    const result1 = pass1(template, { val: "x" })
    assert.equal(result1, "#{fn:x}")

    // ${} tokens would NOT survive pass 2 if any remained — but they don't
    const result2 = pass2(result1, { fn: v => v.toUpperCase() })
    assert.equal(result2, "X")
  })
})

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe("edge cases", () => {
  const tpl = Tpl()

  it("handles variables at start of string", () => {
    assert.equal(tpl("${x}!", { x: "hi" }), "hi!")
  })

  it("handles variables at end of string", () => {
    assert.equal(tpl("say ${x}", { x: "hi" }), "say hi")
  })

  it("handles adjacent variables with no separator", () => {
    assert.equal(tpl("${a}${b}", { a: "1", b: "2" }), "12")
  })

  it("handles numeric values", () => {
    assert.equal(tpl("count: ${n}", { n: 42 }), "count: 42")
  })

  it("handles boolean values", () => {
    assert.equal(tpl("${a} ${b}", { a: true, b: false }), "true false")
  })

  it("handles underscore and $ in variable names", () => {
    assert.equal(tpl("${_private}", { _private: "yes" }), "yes")
    assert.equal(tpl("${$special}", { $special: "yes" }), "yes")
  })

  it("does not resolve inherited Object.prototype members", () => {
    assert.throws(() => tpl("${constructor}", {}), /constructor.*missing/)
    assert.throws(() => tpl("${__proto__}", {}), /__proto__.*missing/)
  })

  it("does not match empty delimiters", () => {
    // ${} has no valid path inside — regex requires at least one char
    assert.equal(tpl("${}", {}), "${}")
  })

  it("treats a property explicitly set to undefined as missing", () => {
    assert.throws(() => tpl("${x}", { x: undefined }), /'x' missing/)
    const quiet = Tpl({ warn: false })
    assert.equal(quiet("${x}", { x: undefined }), "${x}")
  })

  it("function mode leaves empty or invalid tokens as literal text", () => {
    const fnTpl = Tpl({ functions: true })
    // "" and "not a name" both fail the name pattern -> literal, not an error
    assert.equal(fnTpl("#{} #{not a name} #{ok}", { ok: () => "OK" }), "#{} #{not a name} OK")
  })
})

// ─── Regex escaping in delimiters ───────────────────────────────────────────

describe("regex-safe delimiters", () => {
  it("handles $( ) which contains regex special chars", () => {
    const tpl = Tpl({ start: "$(", end: ")" })
    assert.equal(tpl("$(name)", { name: "Jane" }), "Jane")
  })

  it("handles [ ] which are regex character class markers", () => {
    const tpl = Tpl({ start: "[", end: "]" })
    assert.equal(tpl("[name]", { name: "Jane" }), "Jane")
  })

  it("handles pipes | which are regex alternation", () => {
    const tpl = Tpl({ start: "|", end: "|" })
    assert.equal(tpl("|name|", { name: "Jane" }), "Jane")
  })

  it("handles ${{ }} (double-brace like GitHub Actions)", () => {
    const tpl = Tpl({ start: "${{", end: "}}" })
    assert.equal(tpl("Hello ${{ name }}!", { name: "Jane" }), "Hello Jane!")
  })
})

// ─── Independent instance isolation ─────────────────────────────────────────

describe("instance isolation", () => {
  it("two instances with different delimiters don't interfere", () => {
    const tplA = Tpl({ start: "${", end: "}" })
    const tplB = Tpl({ start: "{{", end: "}}" })

    assert.equal(tplA("${x} and {{y}}", { x: "A" }), "A and {{y}}")
    assert.equal(tplB("${x} and {{y}}", { y: "B" }), "${x} and B")
  })

  it("variable and function instances are independent", () => {
    const varTpl = Tpl()
    const fnTpl = Tpl({ functions: true })

    // varTpl ignores #{} and fnTpl ignores ${}
    assert.equal(varTpl("${x} #{fn}", { x: "hi" }), "hi #{fn}")
    assert.equal(fnTpl("${x} #{fn}", { fn: () => "called" }), "${x} called")
  })
})

// ─── Error messages ─────────────────────────────────────────────────────────

describe("error messages", () => {
  const tpl = Tpl()

  it("throws real Error instances, not strings", () => {
    assert.throws(() => tpl("${missing}", {}), err => err instanceof Error)
  })

  it("includes the variable path in the error", () => {
    assert.throws(
      () => tpl("${user.name}", { user: {} }),
      err => err.message.includes("name") && err.message.includes("${user.name}")
    )
  })

  it("includes 'Missing function' for function mode errors", () => {
    const fnTpl = Tpl({ functions: true })
    assert.throws(
      () => fnTpl("#{nope}", {}),
      err => err.message.includes("Missing function")
    )
  })
})
