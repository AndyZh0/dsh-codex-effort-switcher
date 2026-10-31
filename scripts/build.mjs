/** Build the host marker and the browser factory a DSH profile loads. */
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'

await mkdir('lib', { recursive: true })
await build({
  entryPoints: ['src/index.ts'], outfile: 'lib/index.js',
  bundle: false, format: 'esm', platform: 'node', target: 'es2022',
})
await build({
  entryPoints: ['src/client.tsx'], outfile: 'lib/client.js', bundle: true,
  format: 'cjs', platform: 'browser', target: 'es2022', jsx: 'automatic',
  // Seed words of the frozen browser module table. Everything else — including
  // the client library this plugin uses inside those primitives — is bundled.
  external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
  sourcemap: true,
  banner: { js: 'window.__ModuleLoader__.load({ id: "dsh-codex-effort-switcher", factory: (require) => { var module = { exports: {} }; var exports = module.exports;' },
  footer: { js: 'return module.exports; } });' },
})
