/** Test-only stand-ins for the shared primitives the seat renders through. */
import type { ReactNode } from 'react'

/** Props every stub icon accepts; only the class name reaches the DOM. */
interface IconProps { className?: string; size?: number }

/** One stub icon factory, keyed by the primitive it replaces. */
const icon = (name: string) => function StubIcon({ className }: IconProps) {
  return <span data-icon={name} className={className} />
}

export const IconCheckOutlineRegular = icon('check')
export const IconChevronDownOutlineRegular = icon('chevron-down')
export const IconChevronRightOutlineRegular = icon('chevron-right')
export const IconDataOutlineRegular = icon('data')
export const IconRefreshOutlineRegular = icon('refresh')
export const IconWarningOutlineRegular = icon('warning')

/** @returns the state marker the seat asserts on. */
export function StateDot({ state }: { state: string }) {
  return <span data-state-dot={state} />
}

/** @returns the banner text as an alert, without the real fade lifecycle. */
export function Toast({ text }: { text: string; icon?: ReactNode; anchor?: unknown; onDone: () => void }) {
  return <div role="alert">{text}</div>
}

/** @returns the anchor unchanged, annotated with the label it would show. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return <span data-tooltip={label}>{children}</span>
}
