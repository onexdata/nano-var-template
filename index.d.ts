export interface TplOptions {
  /** Opening delimiter. Default: '${' (variable mode) or '#{' (function mode). */
  start?: string
  /** Closing delimiter. Default: '}'. */
  end?: string
  /** Regex charset for the token body. Overriding this is an escape hatch - most consumers won't need it. */
  path?: string
  /** true = throw on a missing variable/function, false = leave the token unchanged. Default: true. */
  warn?: boolean
  /** true = data is a map of named functions to call, not values to look up. Default: false. */
  functions?: boolean
}

export interface VarTpl {
  (template: string, data: Record<string, unknown>): string
}

/** A function-mode plugin. Receives everything after the token's first ':' as a single string argument. */
export type TplFunction = (arg: string | undefined) => unknown

export interface FunctionTpl {
  /**
   * Returns a plain string when every invoked plugin resolved synchronously.
   * Returns a Promise<string> instead as soon as any invoked plugin returns
   * a thenable - see the "Async functions" section of the README.
   */
  (template: string, data: Record<string, TplFunction>): string | Promise<string>
}

declare function Tpl(options?: TplOptions & { functions?: false }): VarTpl
declare function Tpl(options: TplOptions & { functions: true }): FunctionTpl

export = Tpl
