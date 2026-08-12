// Flat config. Two goals only:
//   1. @eslint/js recommended - catches real bugs (unused vars, undef refs, etc).
//   2. @stylistic's "invisible-diff prevention" rules - trailing whitespace, a
//      missing final newline, CRLF, a stray blank line. Every one of these
//      produces a diff a reviewer can't see, survives review, then conflicts
//      on a later merge for reasons nobody can explain. All are --fix-able,
//      so the cost of compliance is zero. .gitattributes pins what git
//      stores as LF; this pins what you write - both halves, or it drifts.
// Deliberately NOT here: prettier, or any indent/quote/semi opinion. Taste
// rules cost review time arguing about them; these don't, because there's
// nothing to argue about.
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    }
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/linebreak-style': ['error', 'unix'],
      'unicode-bom': ['error', 'never']
    }
  },
  // test/types.ts is TypeScript, checked separately by `npm run typecheck` -
  // this config has no TS parser, so ESLint would choke on its syntax.
  { ignores: ['node_modules/**', '*.tgz', 'test/types.ts'] }
]
