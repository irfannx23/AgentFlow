import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores(['.next/**', 'node_modules/**']),
  {
    rules: {
      '@next/next/no-img-element': 'off',
      // Provider hydration and browser-only preferences intentionally synchronize
      // React state from external auth/storage systems after mount.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
])
