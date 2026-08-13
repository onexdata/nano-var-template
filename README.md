# nano-var-template

[![CI](https://github.com/onexdata/nano-var-template/actions/workflows/ci.yml/badge.svg)](https://github.com/onexdata/nano-var-template/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/nano-var-template)](https://www.npmjs.com/package/nano-var-template)

The smallest safe variable template engine with N-pass composition.

No `eval`. No `new Function`. No ES6 backtick injection. Just `String.replace()` with a configurable regex — safe for userland input.

## Why this exists

Most template engines are single-pass: they take a template and a data object and produce output. nano-var-template is a **composable pipeline**. You create multiple instances with different delimiters, and pipe the output of one into the next. Each pass resolves its own markers and leaves everything else untouched.

This gives you layered abstraction:

```
Pass 1  ${}   Raw data         →  ${user.name}  →  "Jane"
Pass 2  #{}   Functions        →  #{avatar:jane.png}  →  "<img src='jane.png' />"
Pass 3  @{}   User references  →  @{42}  →  "Jane Doe, Admin"
Pass N  ~{}   Whatever you need next
```

Each pass's output can contain markers for subsequent passes, but never for prior ones. That's a directed pipeline — easy to reason about, easy to debug (inspect the string between passes), and it costs almost nothing to add another pass.

**This is the core idea.** The package is small because it's finished, not because it's trivial.

## Install

```
npm install nano-var-template
```

## Quick start

```js
const tpl = require('nano-var-template')()

tpl("Hello ${name}!", { name: "Jane" })
// → "Hello Jane!"
```

## Variable substitution

Supports full nested paths:

```js
const tpl = require('nano-var-template')()

const template = "Welcome to ${app}. You are ${person.name.first} ${person.name.last}!"

const data = {
  app: "Super App",
  person: {
    name: { first: "Jane", last: "Doe" }
  }
}

tpl(template, data)
// → "Welcome to Super App. You are Jane Doe!"
```

## Custom delimiters

```js
// Vue/Angular style
const tpl = require('nano-var-template')({ start: '{{', end: '}}' })
tpl("Hello {{name}}!", { name: "Jane" })
// → "Hello Jane!"

// Anything you want
const tpl2 = require('nano-var-template')({ start: '@#[', end: ']#' })
tpl2("Hello @#[name]#!", { name: "Jane" })
// → "Hello Jane!"
```

## Functions (plugins)

Enable function mode to call named functions from templates. Everything after `:` is passed as the argument string:

```js
const tpl = require('nano-var-template')({ functions: true })

const plugins = {
  upper: s => s.toUpperCase(),
  greet: name => `Welcome, ${name}!`,
  badge: type => `<span class="badge badge-${type}">${type}</span>`
}

tpl("#{upper:hello}", plugins)
// → "HELLO"

tpl("#{greet:Jane}", plugins)
// → "Welcome, Jane!"

tpl("#{badge:admin}", plugins)
// → '<span class="badge badge-admin">admin</span>'
```

Functions can be as complex as you need — any JavaScript function works. Split multiple arguments yourself:

```js
const plugins = {
  link: args => {
    const [url, text] = args.split(',')
    return `<a href="${url.trim()}">${text.trim()}</a>`
  }
}
tpl("#{link:https://example.com, Click here}", plugins)
// → '<a href="https://example.com">Click here</a>'
```

The argument is passed **verbatim** — everything between the first `:` and the
closing delimiter, whitespace included. The one thing an argument cannot
contain is the closing delimiter itself: `#{parse:{"a":1}}` ends at the first
`}`. If your arguments need `}`, give that pass a different closing delimiter
(`)`, `]`, `]]`, ...) — the same rule as choosing delimiters between passes.

### Namespaced plugins

Dotted names walk the plugin object, so related plugins can live under one
namespace. `this` is preserved, so methods can share state with their
namespace:

```js
const tpl = require('nano-var-template')({ functions: true })

const plugins = {
  format: {
    date: s => `DATE(${s})`,
    money: s => `$${s}`
  }
}

tpl("#{format.date:2026} costs #{format.money:5}", plugins)
// → "DATE(2026) costs $5"
```

### Async functions

A plugin function can return a Promise — useful for i18n lookups, database reads, or any async work. When every function invoked by a template resolves synchronously, `tpl()` returns a plain `string`, exactly as before — nothing changes for existing sync-only usage. But if *any* invoked function returns a Promise, `tpl()` returns `Promise<string>` instead, resolving once every call has settled:

```js
const tpl = require('nano-var-template')({ functions: true })

const plugins = {
  userName: id => db.users.findById(id).then(u => u.name)
}

const result = tpl("Hi #{userName:42}!", plugins)
// result is a Promise<string> here, because userName() returned one

await result
// → "Hi Jane Doe!"
```

Since you can't know in advance whether a given plugin set will resolve sync or async, treat the return value as possibly a Promise whenever any of your registered functions might be async: `await Promise.resolve(tpl(...))` works either way.

## N-pass composition

This is the architectural pattern that makes nano-var-template more than a string replacer. Create multiple instances with different delimiters and pipe them together:

### Two-pass: variables then functions

```js
const Tpl = require('nano-var-template')
const varTpl = Tpl()
const fnTpl = Tpl({ functions: true })

const template = "Hello #{greet:${name}}!"
const data = { name: "Jane" }
const plugins = { greet: name => `Welcome, ${name}` }

// Pass 1: resolve ${} variables
const pass1 = varTpl(template, data)
// → "Hello #{greet:Jane}!"

// Pass 2: resolve #{} functions (now with resolved data)
const pass2 = fnTpl(pass1, plugins)
// → "Hello Welcome, Jane!"
```

### Three-pass: variables, functions, and user references

```js
const Tpl = require('nano-var-template')
const varTpl = Tpl()
const fnTpl = Tpl({ functions: true })
const userTpl = Tpl({ start: '@{', end: '}' })

const template = "Hi @{${user.id}}! Avatar: #{avatar:${user.avatar}}"

const data = { user: { id: '42', avatar: 'cat.png' } }
const users = { 42: 'Jane Doe' }
const plugins = { avatar: src => `<img src="${src}" />` }

const result = userTpl(fnTpl(varTpl(template, data), plugins), users)
// → 'Hi Jane Doe! Avatar: <img src="cat.png" />'
```

### N-pass: as many layers as you need

Each pass is the same ~10-line function with a different delimiter. Adding a 4th, 5th, or Nth pass costs essentially nothing. The only rule: **choose delimiters for each pass so that output from one pass doesn't accidentally contain markers for a later pass.** For example, if a function produces output containing `}`, use `]` or `)` as the closing delimiter for subsequent passes.

```js
const Tpl = require('nano-var-template')
const dataTpl = Tpl()                                            // ${}
const tagTpl = Tpl({ functions: true })                          // #{}
const wrapTpl = Tpl({ start: '@{', end: '}', functions: true })  // @{}
const frameTpl = Tpl({ start: '~(', end: ')' })                  // ~()

const template = "~(before)@{wrap:#{tag:${word}}}~(after)"
// Function arguments can contain any characters (URLs, punctuation, etc.) -
// they just can't contain the *next* pass's own delimiters, per the rule below.

let result = template
result = dataTpl(result, { word: "hello" })       // → "~(before)@{wrap:#{tag:hello}}~(after)"
result = tagTpl(result, { tag: w => w.toUpperCase() }) // → "~(before)@{wrap:HELLO}~(after)"
result = wrapTpl(result, { wrap: s => `[${s}]` })      // → "~(before)[HELLO]~(after)"
result = frameTpl(result, { before: ">>>", after: "<<<" }) // → ">>>[HELLO]<<<"
```

## Escaping

To output template syntax literally, put a backslash immediately before the
start delimiter. Backslash pairs collapse (C-style parity), and backslashes
anywhere else in a template are not special at all:

```js
const tpl = require('nano-var-template')()

tpl("\\${name}", { name: "Jane" })      // → "${name}"     (literal, not substituted)
tpl("\\\\${name}", { name: "Jane" })    // → "\\Jane"      (literal backslash + value)
tpl("C:\\path ${name}", { name: "J" })  // → "C:\\path J"  (stray backslashes untouched)
```

(The doubled backslashes above are JavaScript string escapes — in a template
*file* you'd write `\${name}` and `\\${name}`.)

This works in both modes and with any custom delimiters: `\{{name}}`,
`\#{fn:arg}`, etc. Escapes are consumed by the pass that owns that delimiter,
so an escaped `${` survives to render as text even when later passes run.

## Error handling

By default, missing variables throw descriptive errors:

```js
const tpl = require('nano-var-template')()

tpl("Hello ${user.name}!", { user: {} })
// throws: "nano-var-template: 'name' missing in ${user.name}"
```

Set `warn: false` to silently leave unresolved tokens in place:

```js
const tpl = require('nano-var-template')({ warn: false })

tpl("Hello ${name}!", {})
// → "Hello ${name}!"
```

Errors are real `Error` instances (`err.message`, `err instanceof Error`), not strings.

## Security model

What "safe" means here, precisely:

- **No code execution from templates.** No `eval`, no `new Function`, no ES6
  backtick interpolation. A template can only *reference* names; the only code
  that ever runs is the plugin functions you registered yourself.
- **`Object.prototype` member names are always blocked** — `constructor`,
  `__proto__`, `toString`, `hasOwnProperty`, etc. resolve as *missing* in both
  modes, so a template can never read engine internals or invoke something you
  didn't put there. Everything else on a prototype chain works normally: class
  getters, class methods used as plugins, and `Object.create()` layering all
  resolve as you'd expect.
- **Malformed input is linear-time.** Template scanning does not backtrack, so
  a pathological or adversarial template (e.g. hundreds of KB of unclosed
  tags) costs milliseconds, not CPU-pinning seconds.
- **No HTML escaping.** Values are interpolated as-is. If you template into
  HTML with untrusted *data* (as opposed to untrusted templates), escape in
  your plugins or before passing data in — that's your layer, by design.

## Options

```js
const tpl = require('nano-var-template')({
  start: '${',    // Opening delimiter (any string)
  end: '}',       // Closing delimiter (any string)
  functions: false, // true = function mode (data object contains functions, not values)
  path: '[a-z0-9_$][\\.a-z0-9_$]*', // Regex for allowed variable paths
                                    // (in function mode: validates the function
                                    // name, i.e. the part before the first ':')
  warn: true       // true = throw on missing variables, false = leave token unchanged
})
```

## Design notes

**Why is this package so small?** Because it's a single, well-defined operation: regex match → path lookup → replace. There's nothing to add. The power comes from composing multiple instances, not from framework complexity.

**Why N-pass instead of one big template engine?** Single-pass engines need to eagerly compute every possible variable upfront. N-pass composition is lazy — each pass only evaluates what the template actually uses. New functions don't bloat existing templates. Template authors compose building blocks without understanding the internals.

**Is this the same idea as Unix pipes?** Yes. Each pass is a filter that transforms the string and passes it along. Same principle as compiler passes, middleware chains, and stream pipelines. The difference is that each filter ignores delimiters it doesn't own.

**Delimiter design:** When piping passes together, choose delimiters so that output from one pass can't accidentally contain markers for a later pass. For example, if your functions produce HTML containing `}`, don't use `}` as the closing delimiter for subsequent passes — use `]`, `)`, or a multi-character sequence like `]]` instead.

## License

MIT
