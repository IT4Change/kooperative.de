import {
  eslint as it4cEslint,
  security,
  comments,
  json,
  yaml,
  vitest,
  prettier,
  typescript as it4cTypescript,
  vue3 as it4cVue3,
  importX as it4cImportX,
  node as it4cNode,
  promise as it4cPromise,
} from 'eslint-config-it4c'

import withNuxt from './.nuxt/eslint.config.mjs'

// it4c ESLint base rules (recommended + custom, no plugin/parser overlap with Nuxt)
const it4cEslintRules = Object.assign({}, ...it4cEslint.map((c) => c.rules))

// it4c TypeScript rules (plugin/parser setup is provided by Nuxt via tsconfigPath)
const it4cTsRules = Object.assign({}, ...it4cTypescript.map((c) => c.rules))

// it4c Vue3 rules (plugin/parser setup is provided by Nuxt)
const it4cVue3Rules = Object.assign({}, ...it4cVue3.map((c) => c.rules))

// it4c import-x rules, renamed to Nuxt's plugin name `import`
// (Nuxt registers eslint-plugin-import-x as `import`, it4c as `import-x`)
const it4cImportRules = Object.fromEntries(
  Object.entries(Object.assign({}, ...it4cImportX.map((c) => c.rules))).map(([key, value]) => [
    key.replace('import-x/', 'import/'),
    value,
  ]),
)

// The settings must come along: they select the TypeScript resolver. Without them
// eslint-plugin-import-x falls back to its legacy `node` resolver, which crashes
// import/no-cycle. Settings keys stay `import-x/*` — the plugin reads them by that
// name regardless of the alias Nuxt registers it under.
const it4cImportSettings = Object.assign({}, ...it4cImportX.map((c) => c.settings))

// no-catch-all ships with the it4c eslint base module. Since only the rules of the
// it4c modules are adopted here (Nuxt provides plugins/parser), its plugin has to be
// registered alongside them.
const it4cEslintPlugins = Object.assign({}, ...it4cEslint.map((c) => c.plugins))

export default withNuxt(
  { ignores: ['.claude/', 'dist/', 'logs/', 'public/'] },
  // it4c ESLint base rules (recommended + no-console, no-unused-vars, no-void)
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,vue}'],
    plugins: it4cEslintPlugins,
    rules: it4cEslintRules,
  },
  {
    rules: {
      // The TypeScript equivalents (@typescript-eslint/*) do this job better
      'no-unused-vars': 'off',
      // TypeScript checks undefined statically; Nuxt auto-imports cause false positives
      'no-undef': 'off',
      // Allow console.warn/error for error handling, only forbid console.log
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  // it4c Vue3 rules (plugin is provided by Nuxt)
  {
    files: ['**/*.vue', '**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    rules: it4cVue3Rules,
  },
  // it4c TypeScript rules (strictTypeChecked + custom rules)
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    rules: it4cTsRules,
  },
  // it4c import rules (plugin is provided by Nuxt as `import`)
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,vue}'],
    settings: it4cImportSettings,
    rules: it4cImportRules,
  },
  {
    rules: {
      // TypeScript + Nuxt aliases (~, #imports, #app) are not resolved
      'import/no-unresolved': 'off',
      // The Nuxt-generated export (withNuxt) is default and named at the same time
      'import/no-named-as-default': 'off',
      // Nuxt convention: relative parent imports (../components/) are common
      'import/no-relative-parent-imports': 'off',
      // .vue/.svg extensions are required in Nuxt
      'import/extensions': 'off',
      // Namespace imports for types (import type * as X) are common
      'import/no-namespace': 'off',
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      // Nuxt names pages/layouts after the file path — single-word names are correct
      'vue/multi-word-component-names': 'off',
    },
  },
  // it4c modules (self-contained, no Nuxt overlap)
  ...it4cNode,
  {
    // Build, test and script level read environment variables directly — inside the
    // app itself Nuxt's runtimeConfig does that, so the rule stays active there.
    files: ['*.config.ts', 'scripts/**'],
    rules: {
      'n/no-process-env': 'off',
    },
  },
  {
    // Maintenance scripts run without event-loop pressure and need console output
    files: ['scripts/**'],
    rules: {
      'n/no-sync': 'off',
      'no-console': 'off',
      'import/no-extraneous-dependencies': 'off',
    },
  },
  {
    // Nuxt generates the flat config as .mjs, the import needs the extension
    files: ['eslint.config.ts'],
    rules: {
      'n/file-extension-in-import': 'off',
    },
  },
  ...it4cPromise,
  {
    // Maintenance scripts wrap signal handlers and readline prompts, which are
    // callback-based by nature and cannot be expressed as plain awaits.
    files: ['scripts/**'],
    rules: {
      'promise/avoid-new': 'off',
      'promise/param-names': 'off',
    },
  },
  {
    // mysql2 and the fs log writer expose callback APIs that have no promise variant
    files: ['server/utils/**'],
    rules: {
      'promise/prefer-await-to-callbacks': 'off',
    },
  },
  ...security,
  {
    rules: {
      // Too many false positives on ordinary array/object access
      'security/detect-object-injection': 'off',
    },
  },
  {
    // The write log path comes from the app's own config, not from user input
    files: ['server/utils/dbWriteLog.ts', 'scripts/**'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
      // Query filters for the kill script are assembled from CLI arguments
      'security/detect-non-literal-regexp': 'off',
    },
  },
  ...comments,
  ...json,
  ...yaml,
  // The vitest module keys off **/*.spec.ts, which also matches the Playwright
  // specs under e2e/. Keep it away from them — they are a different runner.
  ...vitest.map((c) => ({ ...c, ignores: [...(c.ignores ?? []), 'e2e/**'] })),
  {
    files: ['e2e/**'],
    rules: {
      // The suite is configured through .env.e2e, deliberately outside runtimeConfig
      'n/no-process-env': 'off',
      'import/no-extraneous-dependencies': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**'],
    rules: {
      // Test-setup side-effect imports (import '../test/setup-server') are the point
      'import/no-unassigned-import': 'off',
      // devDependencies in tests are correct
      'import/no-extraneous-dependencies': 'off',
      // The project uses vitest globals via config
      'vitest/prefer-importing-vitest-globals': 'off',
      // Padding rules are noise for this codebase
      'vitest/padding-around-all': 'off',
      'vitest/padding-around-expect-groups': 'off',
      // Table-driven cases legitimately assert more than the default budget
      'vitest/max-expects': 'off',
      'vitest/prefer-lowercase-title': 'off',
      'vitest/prefer-describe-function-title': 'off',
      // Type parameters on a bare vi.fn() mock add noise without adding safety
      'vitest/require-mock-type-parameters': 'off',
      // Several specs share one beforeEach across sibling describe blocks
      'vitest/require-top-level-describe': 'off',
      // Fake timers and flush helpers legitimately construct promises
      'promise/avoid-new': 'off',
      // Tests deliberately set globals and env vars
      'n/no-process-env': 'off',
    },
  },

  // Relaxations of the it4c TypeScript rules (strictTypeChecked)
  {
    rules: {
      // `any` from mysql2 row results and other untyped external APIs floods these
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Numbers/arrays in template literals are safe in JS
      '@typescript-eslint/restrict-template-expressions': 'off',
      // Method references are a common pattern
      '@typescript-eslint/unbound-method': 'off',
      // Non-null assertion (!) is a common pattern (e.g. find()! after validation)
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Return types on exports: useful for libraries, too strict for project code
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // The project uses || for env vars and optional strings (empty string = missing)
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
  {
    // TODO(lint-debt): the 44 catch blocks this flags predate the linter. Rewriting
    // them into narrowed error handling changes runtime behaviour, which is not safe
    // to do before the unit test suite covers them. Re-enable once coverage is there.
    rules: {
      'no-catch-all/no-catch-all': 'off',
    },
  },
  {
    // TODO(lint-debt): mailer/auth/adminAuth/dbWrite read process.env at module scope
    // instead of going through Nuxt's runtimeConfig. Migrating them is a separate,
    // behaviour-touching change — tracked as follow-up.
    files: ['server/**'],
    rules: {
      'n/no-process-env': 'off',
    },
  },

  // Prettier (MUST be last)
  ...prettier,
)
