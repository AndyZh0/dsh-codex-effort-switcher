/**
 * Codex-style composer model selector, browser half.
 *
 * The composer's model seat is a single-occupant slot whose shipped occupant is
 * the default two-level picker. This plugin registers a second occupant at
 * priority -1, which shadows the shipped one without unloading it: the /model
 * command, the shared per-session ModelDirectory, and the Host selection path
 * keep running unchanged, and removing this plugin restores the shipped seat.
 *
 * The directory is reached only through the `modelDirectories` Cordis service,
 * inside a nested `ctx.inject` so a composition without it leaves the slot
 * empty instead of leaving this boot entry pending.
 */
import { IDLE_DIRECTORY, CodexModelSelect } from './seat.tsx'
import { createSeatTierRegistry } from './tiers.ts'
import { en, zh } from './locales.ts'
import { css } from './styles.ts'
import type { ClientContext, ModelDirectories, ModelSelection, SeatFace } from './ports.ts'

/** Module-table id, style-tag owner, and cordis row id of this plugin. */
const PLUGIN_ID = 'dsh-codex-effort-switcher'

/** Dictionary namespace owned by this plugin. */
const NS = 'codexModelSelect'

/**
 * Services this plugin's apply requires; every one is a shipped client service.
 *
 * `remote.session` is never read here directly. The shared model directory
 * resolves its own Host calls through the *caller's* context, so a caller that
 * omits the service it uses makes `directoryFor` throw inside the shipped
 * plugin. Keep it listed alongside the directory service.
 */
export const inject = ['slots', 'locale', 'sessions', 'remote', 'remote.session']

/**
 * Register the Codex-style seat over the shared model directory.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // The tier registry is a browser service other client plugins consume. It is
  // created before the seat registration so a tier registered from a sibling
  // plugin reaches both an already-mounted and a later-mounted seat.
  const tiers = createSeatTierRegistry()
  const disposeTiers = ctx.reflect.provide('codexModelTiers', tiers)
  ctx.effect(() => () => { void disposeTiers() }, 'codex-effort-switcher: tier service')

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'codex-effort-switcher: dictionaries')
  ctx.effect(() => {
    const style = document.createElement('style')
    // The tag names the module id, so the client module system removes this
    // sheet with the plugin (including on HMR invalidation).
    style.dataset.plugin = PLUGIN_ID
    style.textContent = css
    document.head.append(style)
    return () => { style.remove() }
  }, 'codex-effort-switcher: styles')

  ctx.inject(['modelDirectories'], (scope: ClientContext) => {
    const service = scope.get('modelDirectories')
    /* v8 ignore next -- the nested inject only runs once that service exists. */
    if (service === undefined) return
    const directories = service as ModelDirectories
    scope.slots.inject('conversation.input.model', () => scope.slots.register({
      name: 'conversation.input.model',
      // Lower priority shadows the shipped seat (registered at the default 0).
      priority: -1,
      locale: NS,
      inject: (sessionId: string): SeatFace => {
        const available = scope.sessions.subagentAddress(sessionId) === undefined
        const directory = available ? directories.directoryFor(sessionId) : undefined
        return {
          available,
          sessionId,
          tiers,
          directory: directory?.store ?? IDLE_DIRECTORY,
          load: () => {
            if (directory === undefined) return
            void directory.load().catch(() => { /* surfaced on the store */ })
          },
          select: (selection: ModelSelection) => directory === undefined
            ? Promise.resolve(undefined)
            : directory.select(selection),
        }
      },
    }, CodexModelSelect))
  })
}
