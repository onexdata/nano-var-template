# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project does not
follow strict semver pre-1.0 conventions, but bumps are: patch = pure bug fix,
minor = additive/behavior-tightening, major = a documented breaking change.

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
