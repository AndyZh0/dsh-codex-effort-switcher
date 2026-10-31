/**
 * Structural views of the public DSH client services this plugin consumes.
 *
 * The plugin depends on no DSH package at runtime: every declaration here
 * mirrors the contract it reads across the plugin boundary, so the browser
 * bundle stays a plain module-table citizen.
 */
import type { ComponentType } from 'react'
import type { CopyKey } from './locales.ts'

/** Answer envelope shared by the client remote services. */
export type RemoteResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } }

/** One adapter-owned reasoning level of an exact model route. */
export interface ReasoningEffort {
  readonly id: string
  readonly name: string
  readonly description?: string
}

/** Reasoning metadata advertised for an exact model route. */
export interface ModelReasoning {
  readonly efforts: readonly ReasoningEffort[]
  readonly defaultEffort?: string
}

/** One model inside its provider group. */
export interface CatalogModel {
  readonly id: string
  readonly name: string
  readonly reasoning?: ModelReasoning
}

/** One provider with a successfully loaded catalog. */
export interface ProviderGroup {
  readonly id: string
  readonly name: string
  readonly models: readonly CatalogModel[]
}

/** One provider whose catalog lookup failed. */
export interface CatalogFailure {
  readonly id: string
  readonly name: string
  readonly message: string
}

/** Complete provider/model/effort selection for one Session. */
export interface ModelSelection {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string
}

/** Identity-stable bare observable: the renderer's subscription contract. */
export interface ObservableSnapshot<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/**
 * One additional effort-like tier contributed by another client plugin.
 *
 * The switcher owns the slider, the model catalog, and the shared directory
 * submission; a tier owns its own label, availability, live activation, and
 * apply operation. This is a generic extension point: it contains no
 * product-specific vocabulary, so a tier contributor depends on the switcher
 * and never the reverse.
 */
export interface SeatTier {
  /** Stable identity among registered tiers. */
  readonly id: string
  /** Localized row label; the switcher renders it verbatim. */
  readonly label: string
  /** Optional localized explanation for the row title. */
  readonly description?: string
  /** Whether this tier applies to the current model. */
  available(model: CatalogModel | undefined): boolean
  /** Concrete adapter effort this tier selects, used for display and fallback. */
  effort(model: CatalogModel): string | undefined
  /** Live activation for one Session. */
  active(sessionId: string): ObservableSnapshot<boolean>
  /**
   * Apply this tier for one Session.
   * @param sessionId - owning Session.
   * @param selection - current selection before the tier is applied.
   * @param model - current catalog model.
   * @param select - the shared directory submission function.
   * @returns the selection outcome, or undefined when this Session cannot select.
   */
  apply(
    sessionId: string,
    selection: ModelSelection,
    model: CatalogModel,
    select: (selection: ModelSelection) => Promise<RemoteResult<void> | undefined>,
  ): Promise<RemoteResult<void> | undefined>
}

/** Registry of additional tiers rendered by the switcher. */
export interface SeatTierRegistry {
  /** Register one tier; returns its disposer. Duplicate ids throw. */
  register(tier: SeatTier): () => void
  /** Current tiers in registration order. */
  getSnapshot(): readonly SeatTier[]
  /** Notify when the tier set changes. */
  subscribe(listener: () => void): () => void
}

/** Snapshot the composer seat renders from; owned by the shipped model directory. */
export interface DirectoryState {
  /** Saved selection, retained even when its provider or model left the catalog. */
  readonly current: ModelSelection | null
  /** Saved effort caption retained while the selected model is unavailable. */
  readonly retainedEffort?: string
  /** Whether the current selection is present in the available catalog; null while unresolved. */
  readonly routable: boolean | null
  /** Successfully loaded provider groups. */
  readonly groups: readonly ProviderGroup[]
  /** Provider-local failures from the last load; usable groups stay usable. */
  readonly failures: readonly CatalogFailure[]
  /** Lifecycle of the in-flight operation. */
  readonly status: 'idle' | 'loading' | 'ready' | 'selecting' | 'error'
  /** Selection submitted by the latest select until it settles; null otherwise. */
  readonly pending: ModelSelection | null
  /** Whole-request or selection failure text; null when none. */
  readonly error: string | null
}

/** Observable store handle of one Session's model directory. */
export interface DirectoryStore {
  getSnapshot(): DirectoryState
  subscribe(listener: () => void): () => void
}

/** One Session's shared model directory. */
export interface Directory {
  readonly store: DirectoryStore
  load(): Promise<DirectoryState>
  select(selection: ModelSelection): Promise<RemoteResult<void>>
}

/** The model directory service the shipped model-selection plugin provides. */
export interface ModelDirectories {
  directoryFor(sessionId: string): Directory
}

/** Client session face this plugin reads. */
export interface Sessions {
  subagentAddress(sessionId: string): unknown
}

/** Locale runtime face. */
export interface Locale {
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): () => void
}

/** Translate function bound to this plugin's namespace. */
export type Translate = (key: CopyKey, params?: Record<string, string>) => string

/** Business face the seat component receives from its registration's inject factory. */
export interface SeatFace {
  /** Whether this Session supports Agent-bound model selection. */
  readonly available: boolean
  /** Owning Session identity, passed to tier contributions. */
  readonly sessionId: string
  /** Additional tiers contributed by installed plugins. */
  readonly tiers: SeatTierRegistry
  /** The Session's shared directory store. */
  readonly directory: DirectoryStore
  /** Ensure the advisory catalog is loaded (errors land on the store). */
  load(): void
  /**
   * Select a complete provider/model/effort selection.
   * @param selection - model selection and optional adapter-owned effort.
   * @returns the Host outcome, or undefined when this Session cannot select.
   */
  select(selection: ModelSelection): Promise<RemoteResult<void> | undefined>
}

/** Owner props the composer passes to the model seat. */
export interface SeatOwner {
  /** Whether the composer currently refuses interaction. */
  readonly locked: boolean
}

/** Registration options the slot registry accepts for this seat. */
export interface RegisterOptions {
  name: string
  /** Cell shadowing rank; lower renders, so -1 replaces the shipped seat. */
  priority: number
  locale: string
  inject(sessionId: string): SeatFace
}

/** Contribution registry face. */
export interface Slots {
  inject(name: string, callback: () => () => void): void
  register(
    options: RegisterOptions,
    component: ComponentType<SeatOwner & SeatFace & { t: Translate }>,
  ): () => void
}

/** The public browser services this plugin's apply consumes. */
export interface ClientContext {
  effect(callback: () => () => void, label?: string): void
  /** Provide a browser service to other client plugins; returns the disposer. */
  reflect: { provide(name: string, value: unknown): () => void }
  /** Strict service lookup (global store), for dependencies a nested inject already gated. */
  get(name: string): unknown
  /** Run a callback once its services exist; the callback body is a child fiber. */
  inject(dependencies: readonly string[], callback: (scope: ClientContext) => void): unknown
  readonly locale: Locale
  readonly sessions: Sessions
  readonly slots: Slots
}
