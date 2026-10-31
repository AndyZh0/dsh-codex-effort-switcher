/** Run the package-local behavior suites without the DSH workspace runner. */
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

await build({
  entryPoints: ['src/client.tsx'], outfile: '.test/client.js', bundle: true,
  format: 'esm', platform: 'node', target: 'es2022', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
  // These suites assert this plugin's own DOM; the shared primitives belong to
  // the shell, so the unit lane stands in for them instead of testing them here.
  alias: { '@deepseek-ai/dsh-client-ui-primitives': resolve('tests/stub-primitives.tsx') },
})
const result = spawnSync(process.execPath, ['--test', 'tests/seat.test.mjs', 'tests/css.test.mjs'], { stdio: 'inherit' })
process.exitCode = result.status ?? 1
