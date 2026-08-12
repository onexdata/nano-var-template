// Type-level smoke test, run via `npm run typecheck`.
// Not part of the `npm test` suite - tsc validates it, nothing here executes.
import Tpl = require("../index")

const varTpl = Tpl()
const s: string = varTpl("Hello ${name}!", { name: "Jane" })

const customVarTpl = Tpl({ start: "{{", end: "}}", warn: false })
const s2: string = customVarTpl("Hello {{name}}!", { name: "Jane" })

const fnTpl = Tpl({ functions: true })
const result: string | Promise<string> = fnTpl("#{greet:Jane}", {
  greet: name => `Hi ${name}`
})

// FunctionTpl's return type is always `string | Promise<string>` - a plugin
// set that's entirely synchronous still can't narrow the static type to
// `string` alone, since nano-var-template can't know that ahead of a call.
// @ts-expect-error
const notNarrowedToString: string = fnTpl("#{greet:Jane}", { greet: () => "x" })

console.log(s, s2, result, notNarrowedToString)
