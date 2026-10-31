/**
 * Additional-tier registry for the composer model seat.
 *
 * The switcher owns the slider and the shared model directory; an installed
 * client plugin may append effort-like tiers (for example a mode that maps to
 * an existing adapter effort). The registry is a small bare observable so the
 * seat can render tiers that register before or after it mounts.
 */
import type { SeatTier, SeatTierRegistry } from './ports.ts'

/**
 * Create an empty tier registry.
 * @returns a registry whose snapshots are immutable arrays in registration order.
 */
export function createSeatTierRegistry(): SeatTierRegistry {
  const tiers = new Map<string, SeatTier>()
  const listeners = new Set<() => void>()
  let snapshot: readonly SeatTier[] = Object.freeze([])

  const publish = (): void => {
    snapshot = Object.freeze([...tiers.values()])
    for (const listener of [...listeners]) listener()
  }

  return {
    register(tier: SeatTier): () => void {
      if (tiers.has(tier.id)) throw new Error(`a seat tier with id "${tier.id}" is already registered`)
      tiers.set(tier.id, tier)
      publish()
      let active = true
      return () => {
        if (!active) return
        active = false
        if (tiers.delete(tier.id)) publish()
      }
    },
    getSnapshot: (): readonly SeatTier[] => snapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
