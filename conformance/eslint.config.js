import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { importX } from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Build outputs and machine-local scratch; node_modules is ignored by
  // default. `.claude/worktrees/` is where the agent tooling checks the branch
  // out a second time, and linting a checkout of the repo from inside the
  // repo reports every dev dependency twice.
  { ignores: ['**/dist/', '**/.claude/'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A fixture's inputs are whatever the format lets a caller pass, and the
      // runner hands them to an adapter untyped by design; the unsafe-* family
      // would only restate that on every line they flow through, so it is off.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    plugins: { 'import-x': importX },
    rules: {
      // The published package has zero runtime dependencies, so any bare
      // import reachable from src/ or bin/ is a bug.
      'import-x/no-extraneous-dependencies': ['error', {
        devDependencies: [
          '**/*.config.ts',
          '**/*.config.js',
          'tests/**',
        ],
      }],
    },
  },
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/eol-last': 'error',
      '@stylistic/indent': ['error', 2],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/semi': ['error', 'always'],
    },
  },
  {
    // Plain JS (this config, the tsup config, the bin scripts) sits outside
    // tsconfig's program (no allowJs) — lint it untyped, with node globals.
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
);
