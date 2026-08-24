# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project does not
follow strict semver pre-1.0 conventions, but bumps are: patch = pure bug fix,
minor = additive/behavior-tightening, major = a documented breaking change.

## [2.4.0] - 2026-08-23

Results of an independent three-way review (architecture, adversarial
correctness, distribution) of 2.3.1.

### Fixed
- **A poisoned thenable could mask the real error and leak unhandled
  rejections**: if a plugin returned an object whose `then` throws when
  called, a synchronous throw later in the same template aborted the
  promise-silencing loop - the caller caught the poison error instead of the
  real one, and promises after the poisoned part escaped as unhandled
  rejections. Each part is now settled independently.
- **Custom delimiters containing letters matched case-insensitively in
  variable mode** (a `BEGIN`/`END` pass silently substituted into
  `begin...end` text) while function mode was case-sensitive for the same
  config. The `i` regex flag is gone; delimiters now match case-exactly in
  both modes. The default `path` spells out `a-zA-Z`, so `${Name}`/`${NAME}`
  match exactly as before - only custom `path` patterns that relied on the
  implicit `i` flag are affected.
- **Identical multi-char start/end delimiters destroyed the first of two
  adjacent tags** (`%%a:x%%%%b:y%%` with start = end = `%%` dropped the `a`
  tag): the 2.3.1 closer-run slide crossed into the next tag's opener. The
  slide is now suppressed when start and end are identical.
- The CI publish gate now **fails loudly on prerelease version strings**
  instead of silently skipping the publish forever with a green checkmark
  (`Number("2-beta")` is `NaN`, and `NaN` comparisons are always false).
- **Escaping is now uniform across both modes and every position**: a
  backslash run immediately before *any* occurrence of the start delimiter
  follows C-style parity - pairs collapse, an odd backslash renders the
  delimiter literally - whether or not what follows parses as a tag.
  Previously variable mode left backslashes before non-tags untouched while
  function mode consumed the odd backslash but never collapsed pairs in its
  literal paths; the README claimed the modes were identical. This uniformity
  is what makes the new `escape()` helper sound without knowing what a value
  will sit next to.

### Changed
- **An object's own keys always win over the prototype ban**: data like
  `{"toString": "x"}` or a plugin registry with an own `hasOwnProperty`
  function now resolves (previously silently unreachable - a real-world JSON
  hazard). Inherited `Object.prototype`/`Function.prototype` member names are
  blocked exactly as before; the rule is now uniform across both modes
  instead of function-lookup-only.

### Added
- **`tpl.escape(value)`** on every instance: escapes a value so it survives
  that instance's pass as literal text - the safe way to move untrusted data
  across pass boundaries. Correct backslash parity for any value (trailing
  backslash runs are doubled so a value can't interfere with adjacent
  template text), typed in `index.d.ts`, documented with pinned tests.
- README "Security model" now documents the pattern's central caveat:
  **untrusted data crossing pass boundaries becomes live markup for later
  passes** (same-pass injection remains inert by design), with the
  escape-the-delimiter mitigation - plus notes that `warn` covers missing
  names, not malformed tags (unclosed tags pass through as literal text),
  and that the `path` option is spliced in as raw regex.

## [2.3.1] - 2026-08-23

### Fixed
- **Template text could throw a raw engine `TypeError` through the `warn`
  contract**: `${f.caller}` / `#{fn.arguments:...}` on a function value hit
  `Function.prototype`'s poison accessors, crashing even with `warn: false`.
  Relatedly, `#{fn.call:x}` resolved `Function.prototype.call` as a
  "namespaced plugin" and silently invoked the plugin with no argument. When
  the holder is a function, names resolving to `Function.prototype`'s own
  members are now treated as missing - a function's own properties (`name`,
  `length`, attached sub-plugins) and plain-object keys named `call`/`caller`
  are unaffected.
- **Multi-char closers truncated arguments in overlapping runs**: with end
  `}}`, the template `{{parse:{"a":1}}}` matched the first `}}` alignment,
  silently passing the plugin `{"a":1` (broken JSON) while the re-emitted
  stray `}` made the *output* look correct. End-matching now slides to the
  last overlapping alignment, so the argument keeps its closing characters.
  (Single-char closers are unchanged - `%fn:a%%b%` still closes at the first
  `%`.) Tests now assert what plugins receive, not just template output.
- **The type definitions rejected two documented runtime features**: class
  instances as data (`Record<string, unknown>` demands an index signature that
  classes never have) and namespaced plugin objects
  (`Record<string, TplFunction>` forbade nesting). Variable-mode data is now
  typed `object`; function-mode data is an overload pair - a `TplFunctions`
  bag (exported; keeps contextual typing so plugin-lambda params infer as
  `string | undefined`) plus an `object` fallback for class-based registries.
- npm keywords no longer claim `XSS`/`scrubbed` - the engine intentionally
  does no HTML escaping (see the README "Security model" section); added
  `escaping`/`async` for the features it actually has.

## [2.3.0] - 2026-08-12

### Added
- **Escaping**: a backslash immediately before a start delimiter renders the
  tag literally (`\${name}` → `${name}`); backslash pairs collapse with
  C-style parity (`\\${name}` → `\` + value). Backslashes anywhere else are
  untouched. Works in both modes and with any custom delimiters.
- **Namespaced plugins**: dotted function names walk the plugin object
  (`#{format.date:...}` calls `plugins.format.date`), preserving `this`.
  Previously a dotted name always failed with a confusing "Missing function
  a.b" (looked up the literal key `"a.b"`) - a quirk dating to 2018.
- README examples are now an executable test suite (`test/readme.test.js`) -
  the docs can no longer silently drift from real behavior.
- CI: Node 24 in the test matrix, npm caching, and a test-coverage report.
- Dependabot (monthly, npm + GitHub Actions).
- README badges (CI status, npm version).

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
