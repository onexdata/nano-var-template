// Type-level smoke test, run via `npm run typecheck`.
// Not part of the `npm test` suite - tsc validates it, nothing here executes.
import Tpl = require("../index")

const varTpl = Tpl()
const s: string = varTpl("Hello ${name}!", { name: "Jane" })

const customVarTpl = Tpl({ start: "{{", end: "}}", warn: false })
const s2: string = customVarTpl("Hello {{name}}!", { name: "Jane" })

// A value of the exported options type - `functions` is only known to be
// `boolean | undefined`, so this exercises the catch-all overload.
const opts: Tpl.TplOptions = { start: "<<", end: ">>" }
const dynamicTpl: Tpl.VarTpl | Tpl.FunctionTpl = Tpl(opts)

// Class instances are valid data - prototype getters resolve at runtime,
// so the type must not demand an index signature.
class OrmRow { get name() { return "Jane" } }
const s3: string = varTpl("Hello ${name}!", new OrmRow())

const fnTpl = Tpl({ functions: true })
const result: string | Promise<string> = fnTpl("#{greet:Jane}", {
  greet: name => `Hi ${name}`
})

// FunctionTpl's return type is always `string | Promise<string>` - a plugin
// set that's entirely synchronous still can't narrow the static type to
// `string` alone, since nano-var-template can't know that ahead of a call.
// @ts-expect-error
const notNarrowedToString: string = fnTpl("#{greet:Jane}", { greet: () => "x" })

// Plugin lambdas in object literals get contextual typing (no implicit any) -
// `name` must infer as `string | undefined` under --strict.
const contextual = fnTpl("#{shout:hi}", {
  shout: name => (name ?? "").toUpperCase()
})

// Namespaced plugins: nested plugin objects are valid function-mode data,
// and the TplFunctions shape checks them when annotated explicitly.
const namespaced: Tpl.TplFunctions = {
  format: { date: s => `DATE(${s})` },
  greet: n => `hi ${n}`
}
const s4 = fnTpl("#{format.date:2026}", namespaced)

// Class-based plugin registries (methods on the prototype) are valid too.
class Plugins { greet(n: string | undefined) { return `hi ${n}` } }
const s5 = fnTpl("#{greet:x}", new Plugins())

// escape() exists on both instance shapes, takes anything, returns string.
const e1: string = varTpl.escape("untrusted #{x}")
const e2: string = fnTpl.escape(42)

console.log(s, s2, s3, s4, s5, result, notNarrowedToString, dynamicTpl, contextual, e1, e2)
