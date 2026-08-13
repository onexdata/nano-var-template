declare function Tpl(options?: Tpl.TplOptions & { functions?: false }): Tpl.VarTpl
declare function Tpl(options: Tpl.TplOptions & { functions: true }): Tpl.FunctionTpl
// Catch-all: an options value whose `functions` is only known to be `boolean`
// (e.g. a variable of type TplOptions) matches neither literal overload above.
declare function Tpl(options?: Tpl.TplOptions): Tpl.VarTpl | Tpl.FunctionTpl

declare namespace Tpl {
  interface TplOptions {
    /** Opening delimiter. Default: '${' (variable mode) or '#{' (function mode). */
    start?: string
    /** Closing delimiter. Default: '}'. */
    end?: string
    /**
     * Regex for allowed variable paths (variable mode) / function names
     * (function mode, matched against the part before the first ':').
     * Overriding this is an escape hatch - most consumers won't need it.
     */
    path?: string
    /** true = throw on a missing variable/function, false = leave the token unchanged. Default: true. */
    warn?: boolean
    /** true = data is a map of named functions to call, not values to look up. Default: false. */
    functions?: boolean
  }

  interface VarTpl {
    (template: string, data: Record<string, unknown>): string
  }

  /** A function-mode plugin. Receives everything after the token's first ':' as a single string argument. */
  type TplFunction = (arg: string | undefined) => unknown

  interface FunctionTpl {
    /**
     * Returns a plain string when every invoked plugin resolved synchronously.
     * Returns a Promise<string> instead as soon as any invoked plugin returns
     * a thenable - see the "Async functions" section of the README.
     */
    (template: string, data: Record<string, TplFunction>): string | Promise<string>
  }
}

export = Tpl
