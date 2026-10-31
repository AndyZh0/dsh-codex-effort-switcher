/**
 * Built-plugin smoke through an isolated, supported dsh web profile and a local
 * model endpoint: proves the installed bundle shadows the composer seat, drives
 * the Codex-style card, and still delivers the chosen model and effort to the
 * Host request.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve('../..')
await mkdir('.runtime', { recursive: true })
const run = await mkdtemp(resolve('.runtime/browser-'))
const environment = { ...process.env, DSH_HOME: resolve(run, 'home'), DSH_CODEX_SWITCHER_TEST_KEY: 'local-fixture' }

// The packed artifact is what a profile installs, so pack it rather than
// pointing the profile at lib/.
const packed = spawnSync('npm', ['pack', '--silent'], { cwd: resolve('.'), shell: true, encoding: 'utf8', timeout: 120000 })
assert.equal(packed.status, 0, 'npm pack failed: ' + packed.stderr)
const tarball = resolve(packed.stdout.trim().split(/\r?\n/).pop())
const installer = spawnSync(process.execPath, [
  resolve(root, 'apps/cli/lib/bin.js'), 'plugin', '--profile', 'web', 'add', tarball,
], { cwd: root, windowsHide: true, env: environment, encoding: 'utf8', timeout: 120000 })
await writeFile(resolve(run, 'install.log'), (installer.stdout ?? '') + (installer.stderr ?? ''))
assert.equal(installer.status, 0, 'Plugin install failed: ' + installer.stderr)
const installed = JSON.parse(await readFile(resolve(run, 'home/profiles/web/package.json'), 'utf8'))
assert.ok(installed.dsh.profile.bundles.includes('dsh-codex-effort-switcher'))

const requests = []
const server = createServer(async (request, response) => {
  let body = ''
  for await (const chunk of request) body += chunk
  if (request.url?.endsWith('/models')) {
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ data: [{ id: 'plugin-alpha', name: 'Plugin Alpha' }, { id: 'plugin-beta', name: 'Plugin Beta' }] }))
    return
  }
  requests.push(JSON.parse(body))
  response.writeHead(200, { 'content-type': 'text/event-stream' })
  for (const event of [
    { choices: [{ delta: { role: 'assistant', content: 'Codex switcher smoke passed.' }, index: 0, finish_reason: null }] },
    { choices: [{ delta: {}, index: 0, finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 3 } },
  ]) response.write('data: ' + JSON.stringify(event) + '\n\n')
  response.end('data: [DONE]\n\n')
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const modelURL = 'http://127.0.0.1:' + server.address().port + '/v1'
await writeFile(resolve(run, 'home/profiles/web/cordis.patch.yml'), '- id: llm-pi-ai\n' + [
  '  config:',
  '    providers:',
  '      plugin-fixture:',
  '        displayName: Plugin Fixture',
  '        api: openai-completions',
  '        baseURL: ' + JSON.stringify(modelURL),
  '        apiKeyEnv: DSH_CODEX_SWITCHER_TEST_KEY',
  '        models:',
  '          - id: plugin-alpha',
  '            name: Plugin Alpha',
  '            reasoningEfforts:',
  '              low: low',
  '              medium: medium',
  '              high: high',
  '          - id: plugin-beta',
  '            name: Plugin Beta',
  '            reasoningEfforts:',
  '              low: low',
  '              high: high',
  '- id: ui-settings-models',
  '  config:',
  '    credentialOnboarding: false',
  '- id: ui-settings-general',
  '  config:',
  "    welcomeNoticeVersion: '2026-09-28.1'",
  '',
].join('\n'))

const child = spawn(process.execPath, [
  resolve(root, 'apps/cli/lib/bin.js'), 'web',
  '--patch', resolve(root, 'apps/web/tests/pin-browse-picker.overlay.yml'), '--no-open', '--port', '0',
], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: environment })
let logs = ''
let browser
const errors = []
try {
  const url = await new Promise((resolveURL, reject) => {
    const timeout = setTimeout(() => reject(new Error('DSH did not publish its URL within 90 seconds')), 90000)
    const collect = (chunk) => {
      logs += chunk.toString()
      const match = logs.replace(/\x1b\[[0-9;]*m/g, '').match(/http:\/\/127\.0\.0\.1:\d+[^\s]*/)
      if (match) { clearTimeout(timeout); resolveURL(match[0]) }
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.once('exit', code => { clearTimeout(timeout); reject(new Error('DSH exited ' + code)) })
  })
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'en-US' })
  page.on('pageerror', error => errors.push(error.message))
  // A crashed slot entry abdicates to the shipped seat and only reports here.
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()) })
  await page.goto(url)

  const trigger = page.locator('.dsh-codex-model .cx-trigger')
  await trigger.waitFor({ timeout: 60000 })
  await trigger.click()

  const card = page.locator('.cx-card')
  await card.waitFor({ timeout: 10000 })
  assert.equal(await card.getAttribute('role'), 'menu')
  assert.equal(await page.locator('.cx-title').count(), 0, 'the root face is the effort card')

  // Model face, opened from the single seat button that carries both the level
  // and the model name.
  await page.locator('.cx-seat').click()
  await page.locator('.cx-title').waitFor({ timeout: 5000 })
  assert.equal((await page.locator('.cx-title').textContent()).trim(), 'Choose model')
  const options = page.locator('.cx-option')
  await options.nth(1).waitFor({ timeout: 5000 })
  const optionText = (await options.allTextContents()).map(text => text.trim())
  assert.ok(optionText.includes('Plugin Alpha') && optionText.includes('Plugin Beta'),
    'the fixture models are missing: ' + optionText.join(', '))
  assert.ok((await page.locator('.cx-group').allTextContents()).includes('Plugin Fixture'),
    'provider headings are missing for a multi-provider catalog')
  await page.screenshot({ path: resolve(run, 'models-light.png') })
  await page.locator('.cx-option', { hasText: 'Plugin Beta' }).click()
  // Picking a model updates the seat in place; the panel stays until dismissed.
  assert.match(await trigger.textContent(), /Plugin Beta/)
  // The first Escape leaves the model pane, the second dismisses the panel.
  await page.keyboard.press('Escape')
  await page.locator('.cx-slider').waitFor({ timeout: 5000 })
  await page.keyboard.press('Escape')
  await card.waitFor({ state: 'detached', timeout: 10000 })

  // Effort face: the declared effort map carries no default, so the
  // provider-default entry leads the advertised levels.
  await trigger.click()
  await card.waitFor({ timeout: 5000 })
  const cells = page.locator('.cx-cell')
  const levels = await cells.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))
  assert.deepEqual(levels, ['Default', 'Low', 'High'])
  assert.equal(await page.locator('.cx-slider .cx-fill').count(), 1)
  assert.equal(await page.locator('.cx-slider .cx-thumb').count(), 1)
  const checked = await cells.evaluateAll(nodes => nodes.findIndex(node => node.getAttribute('aria-checked') === 'true'))
  assert.ok(checked >= 0, 'no advertised level is marked current')

  // Both lines share the card's axis: the reset control is out of flow, so it
  // must not shift the seat.
  const cardBox = await card.boundingBox()
  const labelBox = await page.locator('.cx-seat').boundingBox()
  const offset = (labelBox.x + labelBox.width / 2) - (cardBox.x + cardBox.width / 2)
  assert.ok(Math.abs(offset) <= 1, 'the effort label is off the card axis by ' + String(offset) + 'px')

  // A press that jitters a couple of pixels is still a click: it selects the
  // level under the pointer instead of starting a scrub and closing the card.
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + 40)
  const sliderBox = await page.locator('.cx-slider').boundingBox()
  const jitterX = sliderBox.x + sliderBox.width * 0.5
  const jitterY = sliderBox.y + sliderBox.height / 2
  await page.mouse.move(jitterX, jitterY)
  await page.mouse.down()
  await page.mouse.move(jitterX + 2, jitterY)
  assert.equal(await page.locator('.cx-slider[data-dragging]').count(), 0,
    'a two-pixel jitter must not start a scrub')
  await page.mouse.up()
  // The level changed and the panel is still up: only an outside press or
  // Escape dismisses it.
  assert.equal(await card.count(), 1, 'adjusting the slider must not dismiss the panel')

  // A middle tier first, so the plain blue slider is what selector-*.png shows.
  const middle = checked === 1 ? 0 : 1
  await cells.nth(middle).click()
  assert.equal(await page.locator('.cx-slider[data-ultra]').count(), 0)
  const midTrack = await page.locator('.cx-slider').boundingBox()
  const midFill = await page.locator('.cx-fill').boundingBox()
  assert.ok(midFill.x + midFill.width < midTrack.x + midTrack.width - 20,
    'a middle tier should leave track uncovered to its right')
  await page.screenshot({ path: resolve(run, 'selector-light.png') })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(150)
  await page.screenshot({ path: resolve(run, 'selector-dark.png') })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.keyboard.press('Escape')
  await card.waitFor({ state: 'detached', timeout: 5000 })

  // The top tier is reached by scrubbing, which is also where the label has to
  // follow the pointer and the released level has to stick.
  await trigger.click()
  await card.waitFor({ timeout: 5000 })
  const topLevel = levels[levels.length - 1]
  const trackBox = await page.locator('.cx-slider').boundingBox()
  const centreY = trackBox.y + trackBox.height / 2
  await page.mouse.move(trackBox.x + trackBox.width * 0.5, centreY)
  await page.mouse.down()
  await page.mouse.move(trackBox.x + trackBox.width * 0.95, centreY, { steps: 6 })
  assert.equal(await page.locator('.cx-slider').getAttribute('data-dragging'), '',
    'a real drag must enter the scrub state')
  assert.equal((await page.locator('.cx-effort-label').textContent()).trim(), topLevel,
    'the level label must follow the pointer before the release')
  // The top-tier skin and its field answer the pointer while it is still down.
  assert.equal(await page.locator('.cx-slider[data-ultra]').count(), 1,
    'the violet skin must arrive with the pointer, not with the release')
  await page.waitForFunction(
    () => {
      const field = document.querySelector('.cx-sparks')
      return field !== null && Number(getComputedStyle(field).opacity) > 0.5
    },
    null,
    { timeout: 5000 },
  )
  // The dots the pill has covered turn white under the pointer too.
  assert.equal(await page.locator('.cx-cell[data-filled]').count(), levels.length,
    'every dot behind the pointer must already be filled')
  await page.screenshot({
    path: resolve(run, 'scrub-zoom.png'),
    clip: { x: trackBox.x - 6, y: trackBox.y - 6, width: trackBox.width + 12, height: trackBox.height + 12 },
  })
  await page.mouse.up()
  assert.equal((await page.locator('.cx-effort-label').textContent()).trim(), topLevel,
    'the released level must not snap back to the one the Host last reported')
  assert.equal(await card.count(), 1, 'the top tier must not dismiss the panel either')
  // The panel stays open, so the assertion waits for the Host to settle the
  // selection rather than for a reopen.
  await page.locator('.cx-slider[data-ultra]').waitFor({ timeout: 10000 })
  assert.equal(await page.locator('.cx-sparks > span').count(), 12)
  // The field fades in on the tier change, so wait for the fade to land.
  await page.waitForFunction(
    () => {
      const field = document.querySelector('.cx-sparks')
      return field !== null && getComputedStyle(field).opacity === '1'
    },
    null,
    { timeout: 5000 },
  )
  // Stops run edge to edge: the top tier covers the track and parks the knob
  // flush against its right edge.
  const track = await page.locator('.cx-slider').boundingBox()
  const fill = await page.locator('.cx-fill').boundingBox()
  const thumb = await page.locator('.cx-thumb').boundingBox()
  const trackRight = track.x + track.width
  assert.ok(trackRight - (fill.x + fill.width) <= 12,
    'the top tier leaves ' + String(trackRight - (fill.x + fill.width)) + 'px of track uncovered')
  assert.ok(fill.x - track.x <= 12,
    'the top tier leaves ' + String(fill.x - track.x) + 'px before the pill')
  // The knob caps the pill, and both stop short of the rounded end by that margin.
  assert.ok(Math.abs((thumb.x + thumb.width) - (fill.x + fill.width)) <= 1.5,
    'the knob no longer caps the pill at the top tier')
  // Every dot stays clear of the channel's rounded caps, whose radius is half
  // the channel's height however the slider is sized. Park the pointer first:
  // hovering grows a dot, and this measures where the dots live.
  await page.mouse.move(track.x + track.width / 2, track.y - 24)
  await page.waitForTimeout(200)
  const capRadius = track.height / 2
  const dots = await page.locator('.cx-mark').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()))
  for (const dot of dots) {
    const fromEdge = Math.min(dot.x - track.x, trackRight - (dot.x + dot.width))
    assert.ok(fromEdge >= capRadius,
      'a dot sits only ' + String(fromEdge) + 'px from the edge, inside the ' + String(capRadius) + 'px cap')
  }
  // Growing on hover must still leave the outer dot inside the channel.
  await page.locator('.cx-cell').first().hover()
  await page.waitForTimeout(200)
  const grown = await page.locator('.cx-mark').first().evaluate(node => node.getBoundingClientRect())
  assert.ok(grown.x > track.x && grown.x + grown.width < trackRight,
    'the hovered outer dot left the channel: ' + JSON.stringify([grown.x, track.x, trackRight]))
  // A crop of the pill at 1:1, where the motes are actually legible.
  await page.screenshot({
    path: resolve(run, 'ultra-zoom.png'),
    clip: { x: track.x - 6, y: track.y - 6, width: track.width + 12, height: track.height + 12 },
  })

  // Reduced motion is this machine's setting (Windows animations off), and the
  // drift is deliberately exempt from it, so the motes must still travel.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    true,
    'the reduced-motion emulation must reach the page',
  )
  const moteAnimation = await page.locator('.cx-sparks span').evaluateAll(nodes => nodes.map(node => ({
    name: getComputedStyle(node).animationName,
    duration: getComputedStyle(node).animationDuration,
  })))
  assert.ok(moteAnimation.every(mote => mote.name === 'cx-spark-drift'),
    'the drift must survive reduced motion: ' + JSON.stringify(moteAnimation.slice(0, 2)))
  const positions = async () => page.locator('.cx-sparks span')
    .evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().x)))
  const beforeDrift = await positions()
  await page.waitForTimeout(400)
  const afterDrift = await positions()
  assert.ok(beforeDrift.some((x, index) => x !== afterDrift[index]),
    'the motes must actually move under reduced motion: ' + JSON.stringify([beforeDrift, afterDrift]))
  await page.screenshot({
    path: resolve(run, 'ultra-reduced-zoom.png'),
    clip: { x: track.x - 6, y: track.y - 6, width: track.width + 12, height: track.height + 12 },
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.screenshot({ path: resolve(run, 'ultra-light.png') })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(150)
  await page.screenshot({ path: resolve(run, 'ultra-dark.png') })
  await page.emulateMedia({ colorScheme: 'light' })

  // The card stays inside the viewport on a narrow window.
  await page.setViewportSize({ width: 640, height: 620 })
  await page.waitForTimeout(250)
  const box = await card.boundingBox()
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 640 && box.y + box.height <= 620,
    'card outside the viewport: ' + JSON.stringify(box))
  await page.screenshot({ path: resolve(run, 'selector-narrow.png') })
  await page.setViewportSize({ width: 1280, height: 900 })

  // Escape closes the card and hands the keyboard back to the composer.
  await page.keyboard.press('Escape')
  await card.waitFor({ state: 'detached', timeout: 5000 })

  const input = page.locator('[data-composer-card] textarea, [data-composer-card] [contenteditable="true"]').first()
  await input.fill('Reply briefly with Codex switcher smoke passed.')
  await input.press('Enter')
  // The transcript renders the reply after the Host has routed the request.
  const deadline = Date.now() + 30000
  while (requests.every(request => request.messages === undefined) && Date.now() < deadline) {
    await page.waitForTimeout(200)
  }
  await page.locator('text="Codex switcher smoke passed."').last().waitFor({ timeout: 30000 })

  const sent = requests.filter(request => request.messages !== undefined)
  assert.ok(sent.length > 0, 'the host sent no model request')
  // Later requests in the same turn (title generation, follow-ups) may drop the
  // effort, so the routed proof is the request that carries both.
  assert.ok(
    sent.some(request => request.model === 'plugin-beta' && request.reasoning_effort === topLevel.toLowerCase()),
    'no request carried the selected model and effort: '
      + JSON.stringify(sent.map(request => ({ model: request.model, effort: request.reasoning_effort }))),
  )
  assert.deepEqual(errors, [])
  console.log('Installed plugin: card faces, model switch, effort slider, viewport fit, and the routed request passed')
} catch (error) {
  console.error(error.message)
  for (const entry of errors.slice(0, 4)) console.error('BROWSER: ' + entry.slice(0, 400))
  console.error(logs.slice(-5000).replace(/token=[^\s]+/g, 'token=<redacted>'))
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0]
    if (page) {
      console.error((await page.locator('body').innerText()).slice(-6000))
      await page.screenshot({ path: resolve(run, 'failure.png'), fullPage: true })
    }
  }
  process.exitCode = 1
} finally {
  await writeFile(resolve(run, 'host.log'), logs)
  await writeFile(resolve(run, 'evidence.json'), JSON.stringify({ errors, requests }, null, 2) + '\n')
  await browser?.close()
  if (child.exitCode === null) {
    const closed = once(child, 'exit')
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    else child.kill('SIGTERM')
    await closed
  }
  server.closeAllConnections()
  await new Promise(resolveClose => server.close(resolveClose))
  console.log('Evidence: ' + run)
}