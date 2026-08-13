// Every code example in README.md, asserted with its exact documented inputs
// and outputs. The README's flagship URL example was once broken for years
// without anyone noticing - these tests make the docs load-bearing. If you
// change an example in README.md, change it here too (and vice versa).
const { describe, it } = require("node:test")
const assert = require("node:assert/strict")
const Tpl = require("../index")

describe("README: Quick start", () => {
  it("hello world", () => {
    const tpl = Tpl()
    assert.equal(tpl("Hello ${name}!", { name: "Jane" }), "Hello Jane!")
  })
})

describe("README: Variable substitution", () => {
  it("nested paths", () => {
    const tpl = Tpl()
    const template = "Welcome to ${app}. You are ${person.name.first} ${person.name.last}!"
    const data = {
      app: "Super App",
      person: { name: { first: "Jane", last: "Doe" } }
    }
    assert.equal(tpl(template, data), "Welcome to Super App. You are Jane Doe!")
  })
})

describe("README: Custom delimiters", () => {
  it("Vue/Angular style", () => {
    const tpl = Tpl({ start: "{{", end: "}}" })
    assert.equal(tpl("Hello {{name}}!", { name: "Jane" }), "Hello Jane!")
  })

  it("anything you want", () => {
    const tpl2 = Tpl({ start: "@#[", end: "]#" })
    assert.equal(tpl2("Hello @#[name]#!", { name: "Jane" }), "Hello Jane!")
  })
})

describe("README: Functions (plugins)", () => {
  const tpl = Tpl({ functions: true })
  const plugins = {
    upper: s => s.toUpperCase(),
    greet: name => `Welcome, ${name}!`,
    badge: type => `<span class="badge badge-${type}">${type}</span>`
  }

  it("upper", () => {
    assert.equal(tpl("#{upper:hello}", plugins), "HELLO")
  })

  it("greet", () => {
    assert.equal(tpl("#{greet:Jane}", plugins), "Welcome, Jane!")
  })

  it("badge", () => {
    assert.equal(tpl("#{badge:admin}", plugins), '<span class="badge badge-admin">admin</span>')
  })

  it("link (split multiple arguments yourself)", () => {
    const linkPlugins = {
      link: args => {
        const [url, text] = args.split(",")
        return `<a href="${url.trim()}">${text.trim()}</a>`
      }
    }
    assert.equal(
      tpl("#{link:https://example.com, Click here}", linkPlugins),
      '<a href="https://example.com">Click here</a>'
    )
  })

  it("an argument cannot contain the closing delimiter - use a different one", () => {
    // "#{parse:{\"a\":1}} ends at the first }" - and the documented fix:
    const tpl2 = Tpl({ functions: true, start: "{{", end: "}}" })
    assert.equal(tpl2('{{parse:{"a":1}}}', { parse: s => `GOT:${s}` }), 'GOT:{"a":1}')
  })
})

describe("README: Async functions", () => {
  it("userName example returns Promise<string>", async () => {
    const tpl = Tpl({ functions: true })
    const db = { users: { findById: id => Promise.resolve({ name: `Jane Doe (#${id})` }) } }
    const plugins = { userName: id => db.users.findById(id).then(u => u.name) }
    const result = tpl("Hi #{userName:42}!", plugins)
    assert.ok(result instanceof Promise)
    assert.equal(await result, "Hi Jane Doe (#42)!")
  })

  it("await Promise.resolve(tpl(...)) works either way", async () => {
    const tpl = Tpl({ functions: true })
    assert.equal(await Promise.resolve(tpl("#{s}", { s: () => "sync" })), "sync")
    assert.equal(await Promise.resolve(tpl("#{a}", { a: () => Promise.resolve("async") })), "async")
  })
})

describe("README: N-pass composition", () => {
  it("two-pass: variables then functions", () => {
    const varTpl = Tpl()
    const fnTpl = Tpl({ functions: true })
    const template = "Hello #{greet:${name}}!"
    const data = { name: "Jane" }
    const plugins = { greet: name => `Welcome, ${name}` }

    const pass1 = varTpl(template, data)
    assert.equal(pass1, "Hello #{greet:Jane}!")
    assert.equal(fnTpl(pass1, plugins), "Hello Welcome, Jane!")
  })

  it("three-pass: variables, functions, user references", () => {
    const varTpl = Tpl()
    const fnTpl = Tpl({ functions: true })
    const userTpl = Tpl({ start: "@{", end: "}" })

    const template = "Hi @{${user.id}}! Avatar: #{avatar:${user.avatar}}"
    const data = { user: { id: "42", avatar: "cat.png" } }
    const users = { 42: "Jane Doe" }
    const plugins = { avatar: src => `<img src="${src}" />` }

    assert.equal(
      userTpl(fnTpl(varTpl(template, data), plugins), users),
      'Hi Jane Doe! Avatar: <img src="cat.png" />'
    )
  })

  it("N-pass: as many layers as you need", () => {
    const dataTpl = Tpl()                                            // ${}
    const tagTpl = Tpl({ functions: true })                          // #{}
    const wrapTpl = Tpl({ start: "@{", end: "}", functions: true })  // @{}
    const frameTpl = Tpl({ start: "~(", end: ")" })                  // ~()

    let result = "~(before)@{wrap:#{tag:${word}}}~(after)"
    result = dataTpl(result, { word: "hello" })
    assert.equal(result, "~(before)@{wrap:#{tag:hello}}~(after)")
    result = tagTpl(result, { tag: w => w.toUpperCase() })
    assert.equal(result, "~(before)@{wrap:HELLO}~(after)")
    result = wrapTpl(result, { wrap: s => `[${s}]` })
    assert.equal(result, "~(before)[HELLO]~(after)")
    result = frameTpl(result, { before: ">>>", after: "<<<" })
    assert.equal(result, ">>>[HELLO]<<<")
  })
})

describe("README: Error handling", () => {
  it("missing variables throw descriptive errors", () => {
    const tpl = Tpl()
    assert.throws(
      () => tpl("Hello ${user.name}!", { user: {} }),
      err => err instanceof Error && err.message === "nano-var-template: 'name' missing in ${user.name}"
    )
  })

  it("warn: false leaves unresolved tokens in place", () => {
    const tpl = Tpl({ warn: false })
    assert.equal(tpl("Hello ${name}!", {}), "Hello ${name}!")
  })
})

describe("README: Security model", () => {
  it("Object.prototype member names are always blocked", () => {
    const tpl = Tpl({ warn: false })
    assert.equal(tpl("${constructor} ${__proto__}", {}), "${constructor} ${__proto__}")
  })

  it("prototype-chain data (class getters, Object.create) resolves normally", () => {
    class User { get name() { return "Jane" } }
    const cfg = Object.create({ theme: "dark" })
    assert.equal(Tpl()("${u.name} ${c.theme}", { u: new User(), c: cfg }), "Jane dark")
  })

  it("no HTML escaping - values interpolate as-is", () => {
    assert.equal(Tpl()("${html}", { html: "<b>&</b>" }), "<b>&</b>")
  })
})

describe("README: Escaping", () => {
  it("backslash before a tag renders it literally", () => {
    assert.equal(Tpl()("\\${name}", { name: "Jane" }), "${name}")
  })

  it("backslash pair collapses, tag substitutes", () => {
    assert.equal(Tpl()("\\\\${name}", { name: "Jane" }), "\\Jane")
  })
})
