# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project does not
follow strict semver pre-1.0 conventions, but bumps are: patch = pure bug fix,
minor = additive/behavior-tightening, major = a documented breaking change.

## [2.2.1] - 2026-08-12

Fixes for regressions introduced in 2.1.0/2.2.0, found by post-release review.
If you are on 2.1.0 or 2.2.0, upgrade.

### Fixed
- **Function mode could loop forever if a plugin re-entered the same `Tpl`
  instance** (the exec loop shared regex state across calls). Scanning is now
  stateless per call; recursive/nested use of one instance is safe.
- **A synchronous throw could crash the process via an orphaned promise**: if
  a template mixed an async plugin with a missing function (or a plugin that
  threw), promises already created were abandoned and surfaced as unhandled
  rejections after the caller caught the error. Function names are now
  validated before any plugin is invoked, and mid-template throws settle any
  in-flight promises.
- **Malformed templates scanned in quadratic time** (the 2.1.0 argument regex
  backtracked on unclosed tags — a CPU-DoS vector for userland templates).
  Function-mode scanning is now a linear `indexOf` walk with no backtracking.
- **An unclosed opener could swallow the next real tag**
  (`"#{a:x #{b:y} z"` fed `x #{b:y` to `a` and destroyed `#{b:y}`). An opener
  that doesn't close before the next opener is now left as literal text and
  the inner tag resolves, matching pre-2.1.0 behavior.
- **The 2.1.0 prototype-chain guard was too aggressive**: class-instance
  getters, class methods used as plugins, and `Object.create()` layering —
  all of which worked in 2.0.1 — threw "missing". Now only `Object.prototype`'s
  own member names (`constructor`, `__proto__`, `toString`, ...) are blocked,
  in both modes; all other inherited properties resolve normally.
- **Function mode threw a raw `TypeError` on null/undefined data** instead of
  following the `warn` convention like variable mode does.
- **`index.d.ts` failed to compile on TypeScript ≤ 6** (TS2309: the file mixed
  `export =` with named exports; only TS 7 accepts that). Rewritten in the
  canonical function-plus-namespace shape, and CI now also typechecks against
  TypeScript 5.
- **`Tpl(opts)` failed to typecheck when `opts` was of the exported
  `TplOptions` type** (its `functions: boolean` matched neither literal
  overload). Added a catch-all overload returning `VarTpl | FunctionTpl`.
- **`require.resolve('nano-var-template/package.json')` threw
  `ERR_PACKAGE_PATH_NOT_EXPORTED`** after 2.2.0's exports map; the subpath is
  now exported.
- **The CI publish gate compared versions with `!=` and failed open**: an
  older-than-published local version, or a transient `npm view` error, would
  attempt a doomed publish and turn master red. It now publishes only when
  the local version is strictly newer, fails closed on registry errors, and
  the workflow serializes concurrent runs.

### Changed
- Function arguments are now passed **verbatim** (everything after the first
  `:` up to the closing delimiter). Previously trailing — but not leading —
  whitespace was silently trimmed.
- README gained a "Security model" section stating precisely what "safe"
  means (no code execution, `Object.prototype` blocked, linear-time scanning,
  and explicitly **no** HTML escaping).

## [2.2.0] - 2026-08-12

### Added
- Function-mode plugins may now return a Promise. `tpl()` returns a plain
  `string` when every invoked plugin resolves synchronously (unchanged from
  before), and `Promise<string>` as soon as any invoked plugin returns a
  thenable. See the README's "Async functions" section.
- TypeScript definitions (`index.d.ts`), shipped in the package and pointed to
  by `types` and `exports.types`.
- `exports` field with `require`/`import`/`types` conditions for explicit dual
  CJS/ESM resolution (the package's code is unchanged - still one CommonJS
  file - this only formalizes how Node resolves it either way).
- `eslint.config.mjs`: `@eslint/js` recommended rules plus a small set of
  autofixable "invisible-diff prevention" rules (trailing whitespace, final
  newline, CRLF, stray blank lines). No formatting/style opinions.
- `.gitattributes` pinning text files to LF, so the lint rule above and a
  contributor's local git config can't disagree with each other.
- `npm run typecheck`, validating `index.d.ts` against `test/types.ts` via `tsc`.

## [2.1.0] - 2026-08-12

### Fixed
- Function-mode arguments containing a colon (e.g. `#{fn:a:b}`) were silently
  truncated after the first colon - only `a` reached the plugin, `:b` was
  dropped. Fixed to split on the first colon only, per the documented
  "everything after `:`" behavior.
- The function-mode argument regex excluded common characters (`/`, `-`, `=`,
  `&`, `?`, ...), so arguments containing them - including the README's own
  URL example - silently failed to match at all and were left unresolved,
  regardless of the `warn` option. Widened to accept any characters up to the
  configured end delimiter.
- Variable and function lookups resolved inherited `Object.prototype`
  members (`constructor`, `__proto__`, `toString`, ...) as if they were real
  data. Both now require an own property; inherited members are treated as
  missing like any other undefined key.
- Errors are now thrown as `Error` instances instead of raw strings, so
  `catch (e) { e.message }` and `e instanceof Error` work for consumers.

### Changed
- Published package now ships `index.js` only (`files` field added) - the
  test suite no longer inflates the installed tarball.

## [2.0.1] - 2026-03-01

### Fixed
- Regex special characters in custom delimiters (e.g. `$(`, `[`, `|`) broke
  the internally-constructed `RegExp` - delimiters are now escaped.
- A `null` intermediate path segment (e.g. `${a.b.c}` with `a.b === null`)
  threw an unhelpful raw `TypeError` instead of the library's own descriptive
  error/warn behavior.
- `warn: false` crashed instead of returning the original tag for a missing
  function or a missing intermediate path segment.

### Added
- 56-test suite using Node's built-in `node:test` runner (`npm test`).

### Changed
- README rewritten to document the N-pass composition pattern (chaining
  multiple `Tpl()` instances with different delimiters) as the core
  architectural idea, not just variable substitution.

## [2.0.0] - 2018-08-26

### Added
- Function/plugin mode (`{ functions: true }`): templates can call named
  functions from a data object instead of only looking up values.

## [1.0.0] - 2018-08-25

### Added
- Initial release: `${variable}`-style substitution with custom delimiters,
  nested dot-path lookups, and a `warn` option to throw vs. leave unresolved
  tokens in place.
