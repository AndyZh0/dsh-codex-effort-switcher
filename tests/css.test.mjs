import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/styles.ts', import.meta.url), 'utf8')
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

const marker = 'export const css = \`'
const sheet = source.slice(source.indexOf(marker) + marker.length, source.lastIndexOf('\`'))
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** Contract entries allowed to carry a literal color, and in which form. */
const SHADOW_ENTRIES = new Set(['cx-thumb-shadow'])
const SKIN_ENTRIES = new Set(['cx-ultra', 'cx-ultra-soft'])
const SHADOW_COLORS = ['rgba(0, 0, 0,', 'rgba(255, 255, 255,']

test('every rule is scoped to the plugin class', () => {
  const preludes = [...sheet.matchAll(/(^|})\s*([^{}@]+)\{/g)].map(match => (match[2] ?? '').trim())
  assert.ok(preludes.length > 20, 'the stylesheet should define the seat surfaces')
  for (const prelude of preludes) {
    for (const selector of prelude.split(',')) {
      // Keyframe steps are the only selectors that are bare percentages.
      if (/^[\d.]+%$/.test(selector.trim())) continue
      assert.match(selector.trim(), /^\.dsh-codex-model(\s|$|\.)/, 'unscoped selector: ' + selector)
    }
  }
})

test('theme colors outside the component contract are tokens, never literals', () => {
  const withoutContract = sheet.replace(/--cx-[a-z-]+:[^;]*;/g, '')
  assert.doesNotMatch(withoutContract, /#[0-9a-fA-F]{3,8}/)
  assert.doesNotMatch(withoutContract, /\b(?:rgba?|hsla?)\(/)
  assert.doesNotMatch(withoutContract, /:\s*(?:white|black|red|green|blue|gray|grey|silver|orange|yellow)\b/)
})

test('the component contract keeps its literals to whole-value shadows and skin stops', () => {
  const contract = [...sheet.matchAll(/--(cx-[a-z-]+):\s*([^;]*);/g)]
    .map(match => ({ name: match[1], value: (match[2] ?? '').trim() }))
  assert.ok(contract.length >= 6, 'the card declares metrics, its one shadow, and the violet skin')

  for (const { name, value } of contract) {
    const hasLiteral = /#[0-9a-fA-F]{3,8}|\b(?:rgba?|hsla?)\(/.test(value)
    if (SHADOW_ENTRIES.has(name)) {
      assert.ok(hasLiteral, '--' + name + ' should declare a shadow')
      assert.doesNotMatch(value, /#[0-9a-fA-F]{3,8}|\b(?:rgb|hsl)\(/)
      for (const color of value.match(/rgba\([^)]*\)/g) ?? []) {
        assert.ok(SHADOW_COLORS.some(prefix => color.startsWith(prefix)), 'unexpected shadow color: ' + color)
      }
      continue
    }
    if (SKIN_ENTRIES.has(name)) {
      assert.match(value, /^#[0-9a-f]{6}$/, '--' + name + ' is one hex stop')
      continue
    }
    assert.equal(hasLiteral, false, '--' + name + ' is a metric, not a color')
  }
})

test('every full-round radius pairs with a circular corner shape', () => {
  const radii = [...sheet.matchAll(/border-radius:\s*([^;]*);/g)].map(match => (match[1] ?? '').trim())
  const full = radii.filter(value => value === '999px' || value === '50%')
  assert.ok(full.length > 0, 'the slider uses full-round radii')
  const shapes = (sheet.match(/corner-shape:\s*round/g) ?? []).length
  assert.ok(shapes >= full.length, 'each full-round radius pairs with corner-shape: round')
})

test('the spark field only animates while the top tier is selected', () => {
  assert.match(sheet, /\.cx-slider\[data-ultra\] \.cx-sparks \{ opacity: 1; \}/)
  assert.match(sheet, /@keyframes cx-spark-drift/)
  assert.match(sheet, /translateX\(var\(--cx-travel/)
})

test('the spark drift is never suppressed, including under reduced motion', () => {
  const media = sheet.slice(sheet.indexOf('@media (prefers-reduced-motion'))
  assert.ok(media.length > 0, 'the sheet declares a reduced-motion branch')
  assert.doesNotMatch(media, /\.cx-sparks span/, 'the drift stays out of the reduced-motion branch')
})

test('the published payload leaves the design references behind', () => {
  assert.deepEqual(manifest.files, ['lib', 'cordis.patch.yml', 'README.md', 'README.zh.md'])
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
})
