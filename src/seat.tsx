/**
 * CodexModelSelect: the composer's model seat, replaced with a Codex-style picker.
 *
 * The trigger keeps the shipped seat's contract — chip geometry, the composer's
 * compact-mode display variables, and the same accessible name — so installing
 * this plugin does not change how the control row measures. The card it opens
 * is opaque and carries three faces: the effort face (effort label, model name,
 * reset, segmented slider), the model face (a 默认 row followed by the
 * provider-grouped catalog), and the effort list the label's chevron opens.
 * Data and submission ride the shared per-session ModelDirectory the /model
 * command also uses, so whatever one entry selects is what the other shows.
 */
import {
  Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  IconCheckOutlineRegular, IconChevronDownOutlineRegular, IconChevronRightOutlineRegular,
  IconDataOutlineRegular, IconRefreshOutlineRegular, IconWarningOutlineRegular,
  StateDot, Toast, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  CatalogModel, DirectoryState, DirectoryStore, ModelSelection, ProviderGroup, SeatFace, SeatOwner,
  SeatTier, SeatTierRegistry, Translate,
} from './ports.ts'

/** Which face the card shows: the effort seat or the model list it opens. */
type Face = 'effort' | 'model'

/** One selectable effort row; an undefined effort preserves the provider default. */
interface EffortChoice {
  key: string
  effort: string | undefined
  label: string
  description?: string
  tier?: SeatTier
}

/** Optimistic Ultra-like tier applied before the durable activation arrives. */
interface LocalTier {
  id: string
  provider: string
  model: string
  effort: string
  /** Raw effort that was current when the tier was chosen; allowed until the mapped effort lands. */
  baseEffort?: string
}

/** One selectable model row with the selection it submits. */
interface ModelChoice { group: ProviderGroup; model: ProviderGroup['models'][number]; selection: ModelSelection }

/** The snapshot a Session without model selection renders. */
const IDLE_STATE: DirectoryState = {
  current: null, routable: null, groups: [], failures: [], status: 'idle', pending: null, error: null,
}

/** A store that never changes, used while this Session exposes no model directory. */
export const IDLE_DIRECTORY: DirectoryStore = { getSnapshot: () => IDLE_STATE, subscribe: () => () => {} }

/**
 * Live tier list contributed by client plugins.
 * @param tiers - registry provided by this plugin.
 * @returns tiers in registration order.
 */
function useSeatTiers(tiers: SeatTierRegistry): readonly SeatTier[] {
  return useSyncExternalStore(
    listener => tiers.subscribe(listener),
    () => tiers.getSnapshot(),
  )
}

/**
 * First contributed tier whose durable activation is true.
 * @param tiers - current tier list.
 * @param sessionId - owning Session.
 * @returns the active tier id, or undefined.
 */
function useActiveTierId(tiers: readonly SeatTier[], sessionId: string): string | undefined {
  const subscribe = useCallback((listener: () => void) => {
    const disposers = tiers.map(tier => tier.active(sessionId).subscribe(listener))
    return () => { for (const dispose of disposers) dispose() }
  }, [tiers, sessionId])
  const getSnapshot = useCallback(
    () => tiers.find(tier => tier.active(sessionId).getSnapshot())?.id ?? '',
    [tiers, sessionId],
  )
  const id = useSyncExternalStore(subscribe, getSnapshot)
  return id === '' ? undefined : id
}

/** Unplaced portal card: hidden but laid out, so its measured size is real. */
const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

/** Margin kept between the card and the viewport edges. */
const VIEWPORT_MARGIN = 12

/** Gap between the trigger and the card. */
const ANCHOR_GAP = 8

/** Horizontal travel that turns a press on the slider into a scrub. A press
 * below this stays a click, so ordinary pointer jitter cannot start one. */
const DRAG_THRESHOLD = 6

/** One drifting mote of the highest-effort skin. */
interface Spark {
  /** Start position inside the pill, as a percentage of its box. */
  x: number
  y: number
  /** Diameter in pixels. */
  size: number
  /** Leftward travel in pixels, negative so the drift runs right to left. */
  travel: number
  /** Cycle length and phase offset in seconds; the delay is negative so the
   * field is already mid-flight the moment the tier is reached. */
  duration: number
  delay: number
}

/** Deterministic spark field: the same motes on every mount. The pill is only
 * 24px tall, so the motes stay in the middle band and hold enough diameter to
 * read at 1x. */
const SPARKS: readonly Spark[] = [
  { x: 92, y: 28, size: 3.6, travel: -170, duration: 2.4, delay: -0.2 },
  { x: 78, y: 62, size: 2.6, travel: -130, duration: 3.1, delay: -1.5 },
  { x: 100, y: 45, size: 3.2, travel: -190, duration: 2.8, delay: -2.2 },
  { x: 88, y: 72, size: 2.2, travel: -110, duration: 3.4, delay: -0.8 },
  { x: 96, y: 55, size: 4, travel: -150, duration: 2.2, delay: -1.9 },
  { x: 70, y: 34, size: 2.4, travel: -120, duration: 3.6, delay: -2.6 },
  { x: 64, y: 66, size: 3, travel: -140, duration: 2.9, delay: -0.5 },
  { x: 88, y: 40, size: 2.8, travel: -100, duration: 3.2, delay: -3.1 },
  { x: 74, y: 52, size: 4.2, travel: -180, duration: 2.6, delay: -1.2 },
  { x: 100, y: 62, size: 2.6, travel: -160, duration: 3.0, delay: -2.9 },
  { x: 82, y: 48, size: 3.4, travel: -210, duration: 2.5, delay: -1.1 },
  { x: 68, y: 44, size: 2.2, travel: -125, duration: 3.3, delay: -2.0 },
]

/** Account and official providers first; every other relative order is preserved. */
function orderProviders(groups: readonly ProviderGroup[]): ProviderGroup[] {
  const rank = (id: string): number => id === 'deepseek-account' ? 0 : id === 'deepseek-official' ? 1 : 2
  return groups.toSorted((left, right) => rank(left.id) - rank(right.id))
}

/** The selection a model row submits: the route plus that route's default effort. */
function selectionOf(group: ProviderGroup, model: CatalogModel): ModelSelection {
  return {
    provider: group.id,
    model: model.id,
    ...model.reasoning?.defaultEffort === undefined ? {} : { reasoningEffort: model.reasoning.defaultEffort },
  }
}

/** Pointer position inside the slider track, as a percentage of its width. */
function trackPercent(element: HTMLElement, clientX: number): number {
  const rect = element.getBoundingClientRect()
  /* v8 ignore next -- a rendered track has width; a zero-width rect would divide by zero. */
  if (rect.width === 0) return 0
  return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
}

/**
 * Render the composer model seat.
 * @param props - owner share (`locked`), the injected directory face, and the locale seat.
 * @returns the trigger and, while open, the portaled card.
 */
export function CodexModelSelect({
  locked, available, sessionId, tiers, directory, load, select, t,
}: SeatOwner & SeatFace & { t: Translate }) {
  const state = useSyncExternalStore(
    listener => directory.subscribe(listener),
    () => directory.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  const [face, setFace] = useState<Face>('effort')
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null)
  const [cardPos, setCardPos] = useState<CSSProperties | null>(null)
  // A rejected SELECTION announces through the toast; the in-card strip stays
  // the catalog-load surface, so it renders only while the latest
  // failure-capable action was a load.
  const lastActionRef = useRef<'load' | 'select'>('load')
  const toastSeq = useRef(0)
  const focusIntent = useRef<Face | null>(null)
  // Scrub state: while the gesture is held, one position drives both the pill
  // and the knob, so their edges cannot separate.
  const [dragX, setDragX] = useState<number | null>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; moved: boolean } | null>(null)
  const swallowClickRef = useRef(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const id = useId()
  const registeredTiers = useSeatTiers(tiers)
  const durableTierId = useActiveTierId(registeredTiers, sessionId)
  const [localTier, setLocalTier] = useState<LocalTier | null>(null)

  const groups = useMemo(() => orderProviders(state.groups), [state.groups])
  const choices = useMemo<readonly ModelChoice[]>(() => groups.flatMap(group => group.models.map(model => ({
    group, model, selection: selectionOf(group, model),
  }))), [groups])
  const currentChoice = choices.find(choice =>
    choice.selection.provider === state.current?.provider && choice.selection.model === state.current.model)
  const currentModel = currentChoice?.model
  const reasoning = currentModel?.reasoning
  const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort
  // A selection already on its way to the Host owns the display: without this
  // the pill and the label fall back to the previous level until the durable
  // projection answers, which reads as the control snapping back and forth.
  const inFlight = state.pending !== null
    && state.pending.provider === state.current?.provider
    && state.pending.model === state.current?.model
    ? state.pending
    : null
  const shownEffort = inFlight === null ? effectiveEffort : inFlight.reasoningEffort
  const displayedSelection = inFlight ?? state.current
  // The optimistic local tier owns the display as soon as it is chosen, even
  // while the mapped raw effort is still the previous level or in flight.
  // Waiting for the Host and the arm round-trip made the label flash Max first.
  const localTierChoice = localTier !== null && displayedSelection !== null
    && displayedSelection.provider === localTier.provider
    && displayedSelection.model === localTier.model
    ? registeredTiers.find(tier => tier.id === localTier.id && tier.available(currentModel))
    : undefined
  const durableTierChoice = durableTierId === undefined
    ? undefined
    : registeredTiers.find(tier => tier.id === durableTierId && tier.available(currentModel))
  const displayTier = localTierChoice ?? durableTierChoice
  const effortChoices = useMemo<readonly EffortChoice[]>(() => {
    const real: EffortChoice[] = reasoning === undefined ? [] : [
      ...reasoning.defaultEffort === undefined
        ? [{ key: 'provider-default', effort: undefined, label: t('effort.providerDefault') }]
        : [],
      ...reasoning.efforts.map(level => ({ key: 'effort:' + level.id, effort: level.id, label: level.name })),
    ]
    if (currentModel === undefined) return real
    const extra: EffortChoice[] = []
    for (const tier of registeredTiers) {
      const effort = tier.effort(currentModel)
      if (!tier.available(currentModel) || effort === undefined) continue
      extra.push({
        key: 'tier:' + tier.id,
        effort,
        label: tier.label,
        ...(tier.description === undefined ? {} : { description: tier.description }),
        tier,
      })
    }
    return [...real, ...extra]
  }, [reasoning, t, registeredTiers, currentModel])
  const tierIndex = displayTier === undefined
    ? -1
    : effortChoices.findIndex(choice => choice.tier?.id === displayTier.id)
  const activeEffortIndex = tierIndex >= 0
    ? tierIndex
    : effortChoices.findIndex(choice => choice.effort === shownEffort)
  // While a scrub is held, every level-driven effect follows the stop under the
  // pointer — the label, the dots the pill has passed, and the top tier's skin —
  // so the control answers the gesture instead of waiting for the release.
  const previewIndex = dragX === null || effortChoices.length === 0
    ? null
    : Math.min(effortChoices.length - 1, Math.floor((dragX / 100) * effortChoices.length))
  const shownIndex = previewIndex ?? activeEffortIndex
  const labelChoice = effortChoices[shownIndex]
  const labelEffort = labelChoice === undefined ? shownEffort : labelChoice.effort
  const effortLabel = reasoning === undefined
    ? state.retainedEffort
    : labelEffort === undefined
      ? t('effort.providerDefault')
      : labelChoice?.label ?? labelEffort
  const busy = state.pending !== null
  const waiting = state.current === null && state.status === 'loading'
  const modelLabel = waiting
    ? t('trigger.loading')
    : currentChoice?.model.name
      ?? (state.current === null ? t('trigger.fallback') : `${state.current.provider}/${state.current.model}`)
  const triggerLabel = effortLabel === undefined ? modelLabel : `${modelLabel} · ${effortLabel}`
  const triggerAria = waiting
    ? t('trigger.loading')
    : state.current === null
      ? t('trigger.selectAria')
      : effortLabel === undefined
        ? t('trigger.aria', { model: modelLabel })
        : t('trigger.ariaEffort', { model: modelLabel, effort: effortLabel })
  const resettable = reasoning !== undefined && (displayTier !== undefined || shownEffort !== reasoning.defaultEffort)
  const showGroupTitles = groups.filter(group => group.models.length > 0).length > 1
  // The top advertised tier carries the violet skin and its spark field.
  const highestEffort = effortChoices.length > 1 && shownIndex === effortChoices.length - 1
  const reload = (): void => {
    lastActionRef.current = 'load'
    load()
  }

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent): void => {
      // The portaled card lives outside the trigger subtree; check both.
      if (rootRef.current?.contains(event.target as Node) === true) return
      if (cardRef.current?.contains(event.target as Node) === true) return
      setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => { document.removeEventListener('mousedown', closeOutside) }
  }, [open])

  // A contributed tier may leave the current model's catalog; the optimistic
  // display must not outlive the model that offered it. While the tier's
  // selection is pending, the old raw effort (baseEffort) and the mapped effort
  // are both allowed; any unrelated selection clears the optimistic display.
  useEffect(() => {
    if (localTier === null) return
    const tier = registeredTiers.find(entry => entry.id === localTier.id)
    if (tier === undefined || !tier.available(currentModel)) { setLocalTier(null); return }
    if (state.pending !== null || state.current === null) return
    if (state.current.provider !== localTier.provider
      || state.current.model !== localTier.model
      || (state.current.reasoningEffort !== localTier.effort && state.current.reasoningEffort !== localTier.baseEffort)) {
      setLocalTier(null)
    }
  }, [localTier, registeredTiers, currentModel, state.current, state.pending])

  // A face switch unmounts the clicked row; land the keyboard on the new face.
  useLayoutEffect(() => {
    if (!open) return
    const intent = focusIntent.current
    focusIntent.current = null
    if (intent === null || intent !== face) return
    cardRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [open, face])

  /* jscpd:ignore-start -- deliberate mirror of the shipped seat's placement:
     the card aligns its right edge to the trigger and measures before paint,
     then flips below when the space above cannot hold it. */
  useLayoutEffect(() => {
    if (!open) { setCardPos(null); return }
    const place = (): void => {
      /* v8 ignore next 2 -- the trigger ref is attached whenever the card is open. */
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect === undefined) return
      const width = cardRef.current?.offsetWidth ?? 0
      const height = cardRef.current?.offsetHeight ?? 0
      const above = rect.top - ANCHOR_GAP - height
      const below = rect.bottom + ANCHOR_GAP
      const fitsBelow = below + height <= window.innerHeight - VIEWPORT_MARGIN
      let left = rect.right - width
      let top = above >= VIEWPORT_MARGIN || !fitsBelow ? above : below
      if (width > 0) left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - width - VIEWPORT_MARGIN)
      if (height > 0) top = Math.min(Math.max(top, VIEWPORT_MARGIN), window.innerHeight - height - VIEWPORT_MARGIN)
      setCardPos({ left, top })
    }
    // The first run measures the hidden pre-render (same commit as `open`),
    // so the card lands placed before anything paints.
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, face, state])
  /* jscpd:ignore-end */

  const focusableRows = (): HTMLButtonElement[] =>
    [...(cardRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]

  const moveFocus = (offset: number): void => {
    const rows = focusableRows()
    if (rows.length === 0) return
    const active = rows.findIndex(row => row === document.activeElement)
    // Focus outside the rows (the trigger, which keeps it while the card opens)
    // enters at the end the step comes from.
    const next = active === -1 ? (offset > 0 ? 0 : rows.length - 1) : (active + offset + rows.length) % rows.length
    rows[next]?.focus()
  }

  const close = (restoreFocus = false): void => {
    setOpen(false)
    setFace('effort')
    if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
  }

  const back = (from: Exclude<Face, 'effort'>): void => {
    focusIntent.current = from
    setFace('effort')
  }

  const drill = (next: Face): void => {
    focusIntent.current = next
    setFace(next)
  }

  const show = (): void => {
    triggerRef.current?.focus()
    setFace(state.current === null || reasoning === undefined ? 'model' : 'effort')
    setOpen(true)
    reload()
  }

  const settleSelection = (result: Awaited<ReturnType<SeatFace['select']>>): void => {
    if (result === undefined) return
    if (result.ok) return
    toastSeq.current += 1
    setToast({
      seq: toastSeq.current,
      text: result.error.code === 'session/writer-held'
        ? t('error.sessionInUse')
        : t('error.action', { message: `${result.error.code}: ${result.error.message}` }),
    })
  }

  const submit = (selection: ModelSelection): void => {
    lastActionRef.current = 'select'
    // Rows a selection in flight disabled cannot hold focus.
    triggerRef.current?.focus()
    void select(selection).then(settleSelection)
  }

  const choose = (selection: ModelSelection): void => {
    // Reselecting the route in use changes nothing, so it stays open.
    if (state.current?.provider === selection.provider && state.current.model === selection.model) return
    setLocalTier(null)
    submit(selection)
  }

  const chooseEffort = (effort: string | undefined, force = false): void => {
    if (state.current === null) return
    setLocalTier(null)
    // The level in use, or already on its way, is the answer; the card stays
    // open. A tier that maps to this same raw effort still requires the
    // submission: that model/selection event is what leaves the tier.
    if (!force && shownEffort === effort) return
    submit({
      provider: state.current.provider,
      model: state.current.model,
      ...effort === undefined ? {} : { reasoningEffort: effort },
    })
  }

  const chooseTier = (tier: SeatTier): void => {
    if (state.current === null || currentModel === undefined || busy) return
    if (displayTier?.id === tier.id) return
    const effort = tier.effort(currentModel)
    if (effort === undefined) return
    const applied: LocalTier = {
      id: tier.id,
      provider: state.current.provider,
      model: state.current.model,
      effort,
      ...state.current.reasoningEffort === undefined ? {} : { baseEffort: state.current.reasoningEffort },
    }
    lastActionRef.current = 'select'
    triggerRef.current?.focus()
    // Show the tier immediately; the mapped effort and arm route follow. A
    // rejection clears the optimistic display and falls back to the durable or
    // current selection instead of leaving a tier running that never armed.
    setLocalTier(applied)
    void Promise.resolve(tier.apply(sessionId, state.current, currentModel, select)).then((result) => {
      if (result === undefined || !result.ok) setLocalTier(null)
      settleSelection(result)
    }).catch((error: unknown) => {
      setLocalTier(null)
      toastSeq.current += 1
      setToast({ seq: toastSeq.current, text: t('error.action', { message: String(error) }) })
    })
  }

  const onSliderPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    // A fresh gesture owns its own trailing click, so an earlier swallow is stale.
    swallowClickRef.current = false
    if (busy || event.button !== 0) return
    // Capture is taken on the first move, not here: a press that never travels
    // must stay a plain click on its own dot.
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, moved: false }
  }

  const onSliderPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD) return
    if (!drag.moved) {
      drag.moved = true
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Capture only keeps the scrub alive outside the track; without it the
        // gesture still tracks while the pointer stays over the slider.
      }
    }
    setDragX(trackPercent(event.currentTarget, event.clientX))
  }

  const onSliderPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    // A press that never travelled stays a click on its own dot.
    if (!drag.moved) return
    const percent = trackPercent(event.currentTarget, event.clientX)
    setDragX(null)
    // The captured pointer may deliver a trailing click; it belongs to this
    // gesture, not to the cell under the finger.
    swallowClickRef.current = true
    const index = Math.min(effortChoices.length - 1, Math.floor((percent / 100) * effortChoices.length))
    const choice = effortChoices[index]
    if (choice === undefined) return
    if (choice.tier !== undefined) chooseTier(choice.tier)
    else chooseEffort(choice.effort, activeEffortIndex !== index)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      // Escape backs out of a drilled face first, then closes.
      if (face !== 'effort' && state.current !== null && reasoning !== undefined) back(face)
      else close(true)
      return
    }
    if (!open) return
    // Tab settles like Enter and Shift+Tab leaves like Escape, so the card's
    // keys mean what they mean in the composer. A control outside the rows
    // (the reset button, a retry) keeps the browser's own traversal.
    if (event.key === 'Tab') {
      const active = document.activeElement
      const onRow = active instanceof HTMLButtonElement && cardRef.current?.contains(active) === true
      if (event.shiftKey && (onRow || active === triggerRef.current)) {
        event.preventDefault()
        if (face !== 'effort' && state.current !== null && reasoning !== undefined) back(face)
        else close(true)
        return
      }
      if (!onRow) return
      event.preventDefault()
      if (busy) return
      ;(active as HTMLButtonElement).click()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(event.key === 'ArrowDown' ? 1 : -1)
    }
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget
    // Focus moving to a real element outside the card closes it. A null target is
    // a programmatic blur (a row disabling itself while a selection is in
    // flight), which must leave the card open.
    if (!(next instanceof Node)) return
    if (rootRef.current?.contains(next) === true || cardRef.current?.contains(next) === true) return
    close()
  }

  if (!available) return null

  const failureStrip = (key: string, text: string, tone?: 'warning') => (
    <div className="cx-strip" data-tone={tone} role={tone === undefined ? 'alert' : undefined} key={key}>
      <span>{text}</span>
      <button type="button" className="cx-retry" onClick={reload}>{t('action.reload')}</button>
    </div>
  )

  return (
    <div
      ref={rootRef}
      className="dsh-codex-model cx-root"
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onMouseDown={(event) => {
        // WebKit blurs a focused row before click unless the button's mousedown keeps focus.
        if (event.target instanceof Element && event.target.closest('button') !== null) event.preventDefault()
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="cx-trigger"
        aria-label={triggerAria}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-card` : undefined}
        title={triggerLabel}
        aria-busy={busy}
        disabled={locked}
        onClick={() => {
          if (open) close(true)
          else show()
        }}
      >
        <IconDataOutlineRegular className="cx-trigger-icon" size={16} />
        <span className="cx-trigger-label">{modelLabel}</span>
        {effortLabel !== undefined && <span className="cx-trigger-effort">{effortLabel}</span>}
        {busy
          ? <StateDot state="ongoing" />
          : <IconChevronDownOutlineRegular className="cx-chevron" data-open={open ? '' : undefined} />}
      </button>

      {/* Portaled to body so the sidebar and column overflow clips cannot crop
          the card; synthetic events still bubble through this React subtree,
          keeping onKeyDown/onBlur live. */}
      {open && createPortal(
        <div
          ref={cardRef}
          id={`${id}-card`}
          className="dsh-codex-model cx-card"
          style={cardPos ?? MEASURE_STYLE}
          role="menu"
          aria-label={t('menu.aria')}
          aria-busy={state.status === 'loading' || busy}
        >
          {face === 'effort' && <>
            {state.error !== null && lastActionRef.current === 'load'
              && failureStrip('load', t('error.action', { message: state.error }))}
            <div className="cx-seat-row">
              <button type="button" role="menuitem" className="cx-seat" disabled={busy} onClick={() => { drill('model') }}>
                {effortLabel !== undefined && (
                  <span className="cx-seat-line">
                    <span className="cx-effort-label">{effortLabel}</span>
                    <IconChevronRightOutlineRegular className="cx-effort-chevron" size={12} />
                  </span>
                )}
                <span className="cx-model-name">{modelLabel}</span>
              </button>
              {reasoning !== undefined && (
                <Tooltip label={t('effort.reset')} side="top">
                  <button
                    type="button"
                    className="cx-reset"
                    aria-label={t('effort.reset')}
                    disabled={busy || !resettable}
                    onClick={() => { chooseEffort(reasoning.defaultEffort, displayTier !== undefined) }}
                  >
                    <IconRefreshOutlineRegular size={16} />
                  </button>
                </Tooltip>
              )}
            </div>
            {effortChoices.length > 1 && (
              /* Segmented slider: a flat channel carries a pill whose leading
                 edge follows the knob, and one full-height cell per level
                 provides the dot's hit area. Stops run edge to edge, so the
                 top tier fills the track. */
              <div
                className="cx-slider"
                data-dragging={dragX === null ? undefined : ''}
                data-ultra={highestEffort ? '' : undefined}
                style={{
                  '--cx-span': effortChoices.length - 1,
                  '--cx-i': activeEffortIndex < 0 ? 0 : activeEffortIndex,
                  ...dragX === null ? {} : { '--cx-x': `${String(dragX)}%` },
                } as CSSProperties}
                onPointerDown={onSliderPointerDown}
                onPointerMove={onSliderPointerMove}
                onPointerUp={onSliderPointerUp}
                onPointerCancel={onSliderPointerUp}
              >
                <div className="cx-fill">
                  <span className="cx-sparks" aria-hidden="true">
                    {SPARKS.map((spark, index) => (
                      <span
                        key={index}
                        style={{
                          '--cx-sx': `${String(spark.x)}%`,
                          '--cx-sy': `${String(spark.y)}%`,
                          '--cx-ss': `${String(spark.size)}px`,
                          '--cx-travel': `${String(spark.travel)}px`,
                          '--cx-sd': `${String(spark.duration)}s`,
                          '--cx-sdel': `${String(spark.delay)}s`,
                        } as CSSProperties}
                      />
                    ))}
                  </span>
                </div>
                {effortChoices.map((choice, index) => (
                  <button
                    key={choice.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={index === activeEffortIndex}
                    aria-label={choice.label}
                    title={choice.description === undefined ? choice.label : choice.label + ' — ' + choice.description}
                    className="cx-cell"
                    data-filled={index <= shownIndex ? '' : undefined}
                    style={{ '--cx-i-cell': index } as CSSProperties}
                    disabled={busy}
                    onClick={() => {
                      if (swallowClickRef.current) {
                        swallowClickRef.current = false
                        return
                      }
                      if (choice.tier !== undefined) chooseTier(choice.tier)
                      else chooseEffort(choice.effort, activeEffortIndex !== index)
                    }}
                  >
                    <span className="cx-mark" />
                  </button>
                ))}
                <div className="cx-thumb" aria-hidden="true" />
              </div>
            )}
          </>}

          {face === 'model' && <>
            <div className="cx-title">{t('select.title')}</div>
            {/* The list is the only face that can render empty, so its first
                load reports here rather than in the always-populated effort face. */}
            {state.status === 'loading' && choices.length === 0 && (
              <div className="cx-strip" data-tone="status" role="status">{t('status.loading')}</div>
            )}
            {state.error !== null && lastActionRef.current === 'load'
              && failureStrip('load', t('error.action', { message: state.error }))}
            {state.failures.map(failure => failureStrip(failure.id, t('warning.groupLoad', {
              name: failure.id === 'deepseek-account' ? t('provider.account') : failure.name,
              message: failure.message,
            }), 'warning'))}
            <div className="cx-list">
              {groups.map(group => (
                <Fragment key={group.id}>
                  {showGroupTitles && (
                    <div className="cx-group">
                      {group.id === 'deepseek-account' ? t('provider.account') : group.name}
                    </div>
                  )}
                  {group.models.map((model) => {
                    const selected = state.current?.provider === group.id && state.current.model === model.id
                    const pending = state.pending?.provider === group.id && state.pending.model === model.id
                    return (
                      <button
                        key={model.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        className="cx-option"
                        title={model.name}
                        disabled={busy}
                        onClick={() => { choose(selectionOf(group, model)) }}
                      >
                        <span className="cx-option-copy">{model.name}</span>
                        <span className="cx-check">
                          {pending ? <StateDot state="ongoing" /> : selected ? <IconCheckOutlineRegular /> : null}
                        </span>
                      </button>
                    )
                  })}
                </Fragment>
              ))}
            </div>
            {state.status === 'ready' && choices.length === 0 && (
              <div className="cx-empty" role="status">{t('empty.models')}</div>
            )}
          </>}

        </div>,
        document.body,
      )}
      {toast !== null && (
        <Toast
          key={toast.seq}
          text={toast.text}
          icon={<IconWarningOutlineRegular />}
          anchor={rootRef.current?.closest<HTMLElement>('[data-composer-card]') ?? null}
          onDone={() => { setToast(null) }}
        />
      )}
    </div>
  )
}
