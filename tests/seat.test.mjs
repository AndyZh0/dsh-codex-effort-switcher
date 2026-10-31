import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { apply } from '../.test/client.js'

const EFFORTS = [
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' },
  { id: 'xhigh', name: 'Extra high' },
]

let cleanup
afterEach(async () => { if (cleanup) await cleanup(); cleanup = undefined })

function baseState() {
  return {
    current: { provider: 'acme', model: 'astra', reasoningEffort: 'high' },
    routable: true,
    groups: [{
      id: 'acme',
      name: 'Acme',
      models: [
        { id: 'astra', name: '6 Astra', reasoning: { efforts: EFFORTS, defaultEffort: 'medium' } },
        { id: 'sol', name: '6 Sol', reasoning: { efforts: EFFORTS, defaultEffort: 'low' } },
      ],
    }],
    failures: [],
    status: 'ready',
    pending: null,
    error: null,
  }
}

async function harness(options = {}) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLButtonElement']) {
    globalThis[key] = dom.window[key]
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true

  const listeners = new Set()
  let snapshot = Object.assign(baseState(), options.state ?? {})
  const loads = []
  const selections = []
  const disposeFns = []
  let selectResult = { ok: true, value: undefined }
  let registration
  let dictionaries
  let provided

  const directory = {
    store: {
      getSnapshot: () => snapshot,
      subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    },
    load: async () => { loads.push(snapshot); return snapshot },
    select: async (selection) => {
      selections.push(selection)
      // ModelDirectory publishes the submitted selection before it awaits, which
      // is what keeps the slider on the new level while the Host answers.
      setState({ status: 'selecting', pending: selection })
      // holdSelect leaves that publish standing, as an unanswered request does.
      if (options.holdSelect === true) return await new Promise(() => {})
      if (!selectResult.ok) {
        setState({ status: 'error', pending: null, error: selectResult.error.message })
        return selectResult
      }
      setState({ status: 'ready', pending: null, current: selection })
      return selectResult
    },
  }
  const setState = (patch) => {
    snapshot = Object.assign({}, snapshot, patch)
    for (const listener of [...listeners]) listener()
  }
  /** Publish a snapshot from test code, inside the act scope it belongs to. */
  const applyState = async (patch) => { await act(async () => { setState(patch) }) }
  const ctx = {
    effect: (callback) => { disposeFns.push(callback()) },
    on: () => () => {},
    reflect: { provide: (name, value) => { provided = { name, value }; return () => {} } },
    get: (name) => name === 'modelDirectories' ? { directoryFor: () => directory } : undefined,
    inject: (_deps, callback) => { callback(ctx) },
    locale: { register: (_ns, dicts) => { dictionaries = dicts; return () => {} } },
    sessions: { subagentAddress: () => options.addressed === true ? { parent: 'p' } : undefined },
    slots: {
      inject: (_name, callback) => { disposeFns.push(callback()) },
      register: (options_, component) => {
        registration = { options: options_, component }
        return () => { registration = undefined }
      },
    },
  }
  apply(ctx)

  const dictionary = dictionaries.en
  const t = (key, params) => {
    const text = dictionary[key] ?? key
    return params === undefined
      ? text
      : text.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match)
  }
  const face = registration.options.inject('session-1')
  const root = createRoot(document.getElementById('root'))
  const flush = async () => { await act(async () => {}) }
  const render = async () => {
    await act(async () => {
      root.render(React.createElement(registration.component, { locked: options.locked ?? false, t, ...face }))
    })
  }
  await render()
  cleanup = async () => {
    await act(async () => { root.unmount() })
    for (const dispose of disposeFns.reverse()) dispose()
    dom.window.close()
  }

  const query = (selector) => document.querySelector(selector)
  const all = (selector) => [...document.querySelectorAll(selector)]
  const click = async (node) => { await act(async () => { node.click() }) }
  // jsdom implements no layout or pointer capture, so the track is measured and
  // captured by hand; the seat itself only reads clientX and the bounding rect.
  const pointer = async (node, type, x) => {
    // The handler captures on the track, which the dispatched node bubbles to.
    node.setPointerCapture = () => {}
    const track = node.closest?.('.cx-slider')
    if (track) track.setPointerCapture = () => {}
    await act(async () => {
      node.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button: 0 }))
    })
  }
  const pointerClick = async (node) => {
    await pointer(node, 'pointerdown', 0)
    await click(node)
  }
  const drag = async (node, fromX, toX) => {
    node.getBoundingClientRect = () => ({ left: 0, right: 400, top: 0, bottom: 40, width: 400, height: 40, x: 0, y: 0 })
    await pointer(node, 'pointerdown', fromX)
    await pointer(node, 'pointermove', toX)
    await pointer(node, 'pointerup', toX)
  }
  const openCard = async () => { await click(query('.cx-trigger')) }
  const mousedownOutside = async () => {
    await act(async () => {
      document.body.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }))
    })
  }
  const key = async (value, init = {}) => {
    const target = query('.cx-card') ?? query('.cx-trigger')
    await act(async () => {
      target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...init }))
    })
  }
  return {
    t,
    flush,
    render,
    click,
    applyState,
    pointer,
    pointerClick,
    drag,
    openCard,
    mousedownOutside,
    key,
    query,
    all,
    setState,
    loads,
    selections,
    setSelectResult: (value) => { selectResult = value },
    get dictionaries() { return dictionaries },
    get registration() { return registration },
    get provided() { return provided },
  }
}

test('registration shadows the shipped seat and installs its own dictionary and stylesheet', async () => {
  const h = await harness()
  assert.equal(h.registration.options.name, 'conversation.input.model')
  assert.equal(h.registration.options.priority, -1)
  assert.equal(h.registration.options.locale, 'codexModelSelect')
  assert.deepEqual(
    Object.keys(h.dictionaries.zh).sort(),
    Object.keys(h.dictionaries.en).sort(),
  )
  assert.equal(document.querySelector('style[data-plugin="dsh-codex-effort-switcher"]') !== null, true)
})

test('the trigger keeps the shipped accessible name and opens the effort face', async () => {
  const h = await harness()
  const trigger = h.query('.cx-trigger')
  assert.equal(trigger.getAttribute('aria-label'), 'Select model, current 6 Astra, reasoning effort High')
  assert.equal(trigger.textContent, '6 AstraHigh')
  assert.equal(trigger.disabled, false)
  await h.openCard()
  assert.equal(h.query('.cx-card').getAttribute('role'), 'menu')
  assert.equal(h.loads.length, 1)
  assert.equal(h.query('.cx-effort-label').textContent, 'High')
  const track = h.query('.cx-slider')
  assert.equal(track.style.getPropertyValue('--cx-span'), '3')
  assert.equal(track.style.getPropertyValue('--cx-i'), '2')
  assert.equal(track.style.getPropertyValue('--cx-x'), '')
  assert.equal(h.query('.cx-slider .cx-fill') !== null, true)
  assert.equal(h.query('.cx-slider .cx-thumb') !== null, true)
  const cells = h.all('.cx-cell')
  assert.deepEqual(cells.map(node => node.getAttribute('aria-label')), ['Low', 'Medium', 'High', 'Extra high'])
  assert.deepEqual(cells.map(node => node.getAttribute('aria-checked')), ['false', 'false', 'true', 'false'])
  assert.equal(track.hasAttribute('data-ultra'), false)
})

test('the top tier carries the violet skin and its drifting spark field', async () => {
  const h = await harness({
    state: { current: { provider: 'acme', model: 'astra', reasoningEffort: 'xhigh' } },
  })
  await h.openCard()
  const track = h.query('.cx-slider')
  assert.equal(track.hasAttribute('data-ultra'), true)
  assert.equal(track.style.getPropertyValue('--cx-i'), '3')
  // The field is mounted with the pill so its fade can run; CSS gates visibility.
  assert.equal(h.all('.cx-sparks > span').length, 12)
  assert.equal(h.query('.cx-fill .cx-sparks') !== null, true)
})

test('a route offering one level renders no slider and no violet skin', async () => {
  const h = await harness({
    state: {
      current: { provider: 'acme', model: 'astra', reasoningEffort: 'high' },
      groups: [{
        id: 'acme',
        name: 'Acme',
        // A single advertised level only collapses the slider once the route
        // also names it as the default; otherwise the provider-default entry
        // makes two choices.
        models: [{ id: 'astra', name: '6 Astra', reasoning: { efforts: [{ id: 'high', name: 'High' }], defaultEffort: 'high' } }],
      }],
    },
  })
  await h.openCard()
  assert.equal(h.query('.cx-slider') === null, true)
  assert.equal(h.query('.cx-sparks') === null, true)
})

test('scrubbing the track commits the level under the pointer and swallows its click', async () => {
  const h = await harness()
  await h.openCard()
  await h.drag(h.query('.cx-slider'), 40, 310)
  assert.deepEqual(h.selections, [{ provider: 'acme', model: 'astra', reasoningEffort: 'xhigh' }])
  assert.equal(h.query('.cx-card') !== null, true)

  const held = await harness({ holdSelect: true })
  await held.openCard()
  await held.drag(held.query('.cx-slider'), 40, 160)
  assert.deepEqual(held.selections, [{ provider: 'acme', model: 'astra', reasoningEffort: 'medium' }])
  // Retire the in-flight publish so the rows take clicks again; the gesture's
  // trailing click must still belong to the drag, not to the cell under it.
  await held.applyState({ status: 'ready', pending: null })
  await held.click(held.all('.cx-cell')[3])
  assert.equal(held.selections.length, 1)
  // The next gesture owns its click again.
  await held.pointerClick(held.all('.cx-cell')[3])
  assert.equal(held.selections.length, 2)
})

test('every level effect follows a scrub before it is released', async () => {
  const h = await harness({ holdSelect: true })
  await h.openCard()
  const track = h.query('.cx-slider')
  const filled = () => h.all('.cx-cell').map(node => node.hasAttribute('data-filled'))
  track.getBoundingClientRect = () => ({ left: 0, right: 400, top: 0, bottom: 40, width: 400, height: 40, x: 0, y: 0 })
  await h.pointer(track, 'pointerdown', 200)
  assert.equal(h.query('.cx-effort-label').textContent, 'High')
  await h.pointer(track, 'pointermove', 390)
  assert.equal(track.hasAttribute('data-dragging'), true)
  // The label, the dots the pill has covered, and the top-tier skin all answer
  // the pointer, not the release.
  assert.equal(h.query('.cx-effort-label').textContent, 'Extra high')
  assert.equal(track.hasAttribute('data-ultra'), true)
  assert.deepEqual(filled(), [true, true, true, true])
  await h.pointer(track, 'pointermove', 30)
  assert.equal(h.query('.cx-effort-label').textContent, 'Low')
  assert.equal(track.hasAttribute('data-ultra'), false)
  assert.deepEqual(filled(), [true, false, false, false])
  await h.pointer(track, 'pointerup', 30)
  assert.deepEqual(h.selections, [{ provider: 'acme', model: 'astra', reasoningEffort: 'low' }])
  // Still the released level, not the one the store reported before it.
  assert.equal(h.query('.cx-effort-label').textContent, 'Low')
  assert.equal(h.query('.cx-slider').style.getPropertyValue('--cx-i'), '0')
})

test('an in-flight level owns the display until the Host answers', async () => {
  const h = await harness()
  await h.openCard()
  assert.equal(h.query('.cx-effort-label').textContent, 'High')
  await h.applyState({ status: 'selecting', pending: { provider: 'acme', model: 'astra', reasoningEffort: 'xhigh' } })
  assert.equal(h.query('.cx-effort-label').textContent, 'Extra high')
  assert.equal(h.query('.cx-slider').style.getPropertyValue('--cx-i'), '3')
  assert.equal(h.query('.cx-slider').hasAttribute('data-ultra'), true)
})

test('a press that never travels stays a click on its own dot', async () => {
  const h = await harness()
  await h.openCard()
  await h.pointerClick(h.all('.cx-cell')[1])
  assert.deepEqual(h.selections, [{ provider: 'acme', model: 'astra', reasoningEffort: 'medium' }])
})

test('pointer jitter inside the click threshold never starts a scrub', async () => {
  const held = await harness({ holdSelect: true })
  await held.openCard()
  const track = held.query('.cx-slider')
  await held.pointer(track, 'pointerdown', 200)
  await held.pointer(track, 'pointermove', 203)
  assert.equal(track.hasAttribute('data-dragging'), false)
  await held.pointer(track, 'pointerup', 203)
  // The press is still the cell's click, so the level it sits on is submitted.
  await held.click(held.all('.cx-cell')[1])
  assert.deepEqual(held.selections, [{ provider: 'acme', model: 'astra', reasoningEffort: 'medium' }])
})

test('a scrub that ends on the level already in use leaves the card open', async () => {
  const held = await harness({ holdSelect: true })
  await held.openCard()
  // 'High' is the third of four stops, so a drag released there changes nothing.
  await held.drag(held.query('.cx-slider'), 40, 260)
  assert.deepEqual(held.selections, [])
  assert.equal(held.query('.cx-card') !== null, true)
})

test('clicking a dot submits that level and leaves the card open', async () => {
  const h = await harness()
  await h.openCard()
  await h.click(h.all('.cx-cell')[0])
  assert.deepEqual(h.selections, [{ provider: 'acme', model: 'astra', reasoningEffort: 'low' }])
  assert.equal(h.query('.cx-card') !== null, true)
})

test('the reset control submits the model default effort and disables at that default', async () => {
  const h = await harness()
  await h.openCard()
  assert.equal(h.query('.cx-reset').disabled, false)
  await h.click(h.query('.cx-reset'))
  assert.deepEqual(h.selections, [{ provider: 'acme', model: 'astra', reasoningEffort: 'medium' }])

  const atDefault = await harness({ state: { current: { provider: 'acme', model: 'astra', reasoningEffort: 'medium' } } })
  await atDefault.openCard()
  assert.equal(atDefault.query('.cx-reset').disabled, true)
})

test('the model face lists the catalog without provider headings', async () => {
  const h = await harness()
  await h.openCard()
  await h.click(h.query('.cx-seat'))
  await h.flush()
  assert.equal(h.query('.cx-title').textContent, 'Choose model')
  const options = h.all('.cx-option')
  assert.deepEqual(options.map(node => node.textContent), ['6 Astra', '6 Sol'])
  assert.equal(options[0].getAttribute('aria-checked'), 'true')
  assert.equal(options[1].getAttribute('aria-checked'), 'false')
  assert.equal(h.all('.cx-group').length, 0)
})

test('provider headings appear for several groups', async () => {
  const h = await harness({
    state: {
      groups: [
        { id: 'acme', name: 'Acme', models: [{ id: 'astra', name: '6 Astra', reasoning: { efforts: EFFORTS, defaultEffort: 'medium' } }] },
        { id: 'rival', name: 'Rival', models: [{ id: 'sol', name: '6 Sol' }] },
      ],
    },
  })
  await h.openCard()
  await h.click(h.query('.cx-seat'))
  await h.flush()
  assert.deepEqual(h.all('.cx-group').map(node => node.textContent), ['Acme', 'Rival'])
  assert.deepEqual(h.all('.cx-option').map(node => node.textContent), ['6 Astra', '6 Sol'])
  await h.click(h.all('.cx-option')[1])
  assert.deepEqual(h.selections, [{ provider: 'rival', model: 'sol' }])
})

test('model rows adopt the target model default effort, and the current route is a no-op', async () => {
  const h = await harness()
  await h.openCard()
  await h.click(h.query('.cx-seat'))
  await h.flush()
  await h.click(h.all('.cx-option')[1])
  assert.deepEqual(h.selections, [{ provider: 'acme', model: 'sol', reasoningEffort: 'low' }])

  const same = await harness()
  await same.openCard()
  await same.click(same.query('.cx-seat'))
  await same.flush()
  // The first row is the route already in use, so it changes nothing.
  await same.click(same.all('.cx-option')[0])
  assert.deepEqual(same.selections, [])
  assert.equal(same.query('.cx-card') !== null, true)
})

test('the seat button carries both lines and opens the model list', async () => {
  const h = await harness()
  await h.openCard()
  const seat = h.query('.cx-seat')
  assert.equal(seat.textContent, 'High6 Astra')
  assert.equal(h.query('.cx-seat .cx-effort-label').textContent, 'High')
  assert.equal(h.query('.cx-seat .cx-model-name').textContent, '6 Astra')
  await h.click(seat)
  assert.equal(h.query('.cx-title').textContent, 'Choose model')
  assert.deepEqual(h.all('.cx-option').map(node => node.textContent), ['6 Astra', '6 Sol'])
})

test('the slider carries the provider default when the route names none', async () => {
  const h = await harness({
    state: {
      current: { provider: 'acme', model: 'astra', reasoningEffort: 'high' },
      groups: [{ id: 'acme', name: 'Acme', models: [{ id: 'astra', name: '6 Astra', reasoning: { efforts: EFFORTS } }] }],
    },
  })
  await h.openCard()
  assert.equal(h.query('.cx-effort-label').textContent, 'High')
  const cells = h.all('.cx-cell')
  assert.equal(cells.length, 5)
  assert.deepEqual(cells.map(node => node.getAttribute('aria-label')), ['Default', 'Low', 'Medium', 'High', 'Extra high'])
  await h.click(cells[0])
  assert.deepEqual(h.selections, [{ provider: 'acme', model: 'astra' }])
})

test('only an outside press or Escape dismisses the panel', async () => {
  const h = await harness()
  await h.openCard()
  await h.click(h.all('.cx-cell')[3])
  assert.equal(h.query('.cx-card') !== null, true)
  await h.key('Escape')
  assert.equal(h.query('.cx-card') === null, true)

  const outside = await harness()
  await outside.openCard()
  await outside.click(outside.all('.cx-cell')[3])
  assert.equal(outside.query('.cx-card') !== null, true)
  await outside.mousedownOutside()
  assert.equal(outside.query('.cx-card') === null, true)
})

test('a model without reasoning metadata opens the model face and drops the slider', async () => {
  const h = await harness({
    state: {
      current: { provider: 'acme', model: 'astra' },
      groups: [{ id: 'acme', name: 'Acme', models: [{ id: 'astra', name: '6 Astra' }] }],
    },
  })
  await h.openCard()
  assert.equal(h.query('.cx-title').textContent, 'Choose model')
  assert.equal(h.query('.cx-slider') === null, true)
  // With no level to show, the card opens straight on the model list.
  assert.equal(h.query('.cx-effort-label') === null, true)
  assert.equal(h.query('.cx-seat') === null, true)
})

test('a rejected selection announces through the transient toast and keeps the card open', async () => {
  const h = await harness()
  h.setSelectResult({ ok: false, error: { code: 'session/writer-held', message: 'held' } })
  await h.openCard()
  await h.click(h.all('.cx-cell')[0])
  assert.match(document.querySelector('[role=alert]').textContent, /already in use/)
  assert.equal(h.query('.cx-card') !== null, true)

  h.setSelectResult({ ok: false, error: { code: 'llm/unavailable', message: 'nope' } })
  await h.click(h.all('.cx-cell')[0])
  assert.match(document.querySelector('[role=alert]').textContent, /Model operation failed: llm\/unavailable: nope/)
})

test('a catalog failure offers Retry in the card and reloads on click', async () => {
  const h = await harness({ state: { error: 'boom', status: 'error' } })
  await h.openCard()
  const alert = document.querySelector('[role=alert]')
  assert.match(alert.textContent, /Model operation failed: boom/)
  await h.click(alert.querySelector('.cx-retry'))
  assert.equal(h.loads.length, 2)
})

test('a failing provider is listed as a warning with Retry', async () => {
  const h = await harness({
    state: { failures: [{ id: 'rival', name: 'Rival', message: 'unreachable' }] },
  })
  await h.openCard()
  await h.click(h.query('.cx-seat'))
  const warning = h.query('.cx-strip[data-tone=warning]')
  assert.match(warning.textContent, /Rival failed to load: unreachable/)
})

test('an empty catalog reports the empty state', async () => {
  const h = await harness({ state: { groups: [] } })
  await h.openCard()
  assert.equal(h.all('.cx-option').length, 0)
  assert.equal(h.query('.cx-empty').textContent, 'No models available.')
})

test('an in-flight selection disables the rows and spins the trigger', async () => {
  const h = await harness({
    state: { status: 'selecting', pending: { provider: 'acme', model: 'astra', reasoningEffort: 'low' } },
  })
  assert.equal(h.query('.cx-trigger [data-state-dot=ongoing]') !== null, true)
  await h.openCard()
  assert.equal(h.all('.cx-cell').every(node => node.disabled), true)
  assert.equal(h.query('.cx-seat').disabled, true)
})

test('Escape leaves a drilled face before closing the card', async () => {
  const h = await harness()
  await h.openCard()
  await h.click(h.query('.cx-seat'))
  await h.key('Escape')
  assert.equal(h.query('.cx-title') === null, true)
  assert.equal(h.query('.cx-slider') !== null, true)
  await h.key('Escape')
  assert.equal(h.query('.cx-card') === null, true)
})

test('a locked composer disables the trigger, and an addressed session renders no seat', async () => {
  const locked = await harness({ locked: true })
  assert.equal(locked.query('.cx-trigger').disabled, true)

  const addressed = await harness({ addressed: true })
  assert.equal(addressed.query('.cx-trigger') === null, true)
})

test('a contributed tier renders as the top cell and applies through the shared directory', async () => {
  const h = await harness()
  const calls = []
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const tier = {
    id: 'ultra',
    label: 'Ultra',
    description: 'For demanding work using multiple agents · highest usage',
    available: model => model?.id === 'astra',
    effort: () => 'xhigh',
    active: () => ({ getSnapshot: () => false, subscribe: () => () => {} }),
    apply: async (_sessionId, selection, _model, select) => {
      calls.push(selection)
      await gate
      return select({ provider: selection.provider, model: selection.model, reasoningEffort: 'xhigh' })
    },
  }
  const dispose = h.provided.value.register(tier)
  await h.flush()
  await h.openCard()
  const cells = h.all('.cx-cell')
  assert.deepEqual(cells.map(node => node.getAttribute('aria-label')), ['Low', 'Medium', 'High', 'Extra high', 'Ultra'])
  assert.equal(cells[4].getAttribute('title'), 'Ultra — For demanding work using multiple agents · highest usage')
  assert.equal(h.query('.cx-slider').hasAttribute('data-ultra'), false)
  await h.click(cells[4])
  assert.deepEqual(calls, [{ provider: 'acme', model: 'astra', reasoningEffort: 'high' }])
  // The optimistic tier owns the label while its mapped selection is still in
  // flight; otherwise the control flashes the old raw effort (High/Max) first.
  assert.deepEqual(h.selections, [])
  assert.equal(h.query('.cx-slider').hasAttribute('data-ultra'), true)
  assert.equal(h.query('.cx-cell[aria-checked="true"]').getAttribute('aria-label'), 'Ultra')
  assert.equal(h.query('.cx-trigger').getAttribute('aria-label'), 'Select model, current 6 Astra, reasoning effort Ultra')
  assert.equal(h.query('.cx-trigger').textContent, '6 AstraUltra')
  release()
  await h.flush()
  assert.deepEqual(h.selections, [{ provider: 'acme', model: 'astra', reasoningEffort: 'xhigh' }])
  assert.equal(h.query('.cx-slider').hasAttribute('data-ultra'), true)
  assert.equal(h.query('.cx-cell[aria-checked="true"]').getAttribute('aria-label'), 'Ultra')
  assert.equal(h.query('.cx-trigger').textContent, '6 AstraUltra')
  dispose()
  await h.flush()
  assert.equal(h.all('.cx-cell').length, 4)
})