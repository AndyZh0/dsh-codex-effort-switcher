/**
 * Ambient declaration of the shared browser primitives this plugin renders
 * through.
 *
 * That package is a seed word of the shell's frozen module table rather than
 * an installed dependency, so the consumed surface is declared here the same
 * way src/ports.ts declares the consumed services.
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ReactNode } from 'react'

  /** Shared geometry props of the icon set. */
  export interface PrimitiveIconProps {
    className?: string
    size?: number
  }

  export function IconCheckOutlineRegular(props: PrimitiveIconProps): ReactNode
  export function IconChevronDownOutlineRegular(props: PrimitiveIconProps): ReactNode
  export function IconChevronRightOutlineRegular(props: PrimitiveIconProps): ReactNode
  export function IconDataOutlineRegular(props: PrimitiveIconProps): ReactNode
  export function IconRefreshOutlineRegular(props: PrimitiveIconProps): ReactNode
  export function IconWarningOutlineRegular(props: PrimitiveIconProps): ReactNode

  /** Indicators and transient surfaces the seat reports through. */
  export function StateDot(props: {
    state: 'done' | 'warning' | 'ongoing' | 'error' | 'idle'
    size?: number
    className?: string
    appearance?: 'dot' | 'step'
  }): ReactNode

  export function Toast(props: {
    text: string
    icon?: ReactNode
    tone?: 'success'
    anchor?: HTMLElement | null
    holdMs?: number
    actions?: readonly { label: string; prefix?: string; onClick: () => void }[]
    onDone: () => void
  }): ReactNode

  export function Tooltip(props: {
    label: string | (() => string)
    side?: 'right' | 'bottom' | 'top'
    align?: 'center' | 'end'
    delayMs?: number
    focusDelayMs?: number
    gap?: number
    disabled?: boolean
    portal?: boolean
    maxWidth?: number
    openOnClick?: boolean
    children: ReactNode
  }): ReactNode
}
