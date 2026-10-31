/**
 * Scoped stylesheet for the Codex-style seat, injected as one `<style>` element
 * tagged with this plugin's module id so the client module system removes it
 * with the plugin.
 *
 * Every color and radius is a `--dsw-*` theme alias; the card fill is the
 * opaque `--dsw-specific-selector` surface, because this design deliberately
 * carries no translucency or backdrop blur.
 */
export const css = `
.dsh-codex-model { position: relative; min-width: 0; }

/* Trigger: the shipped chip geometry, including the composer's compact-mode
   display variables, so row measurement keeps working unchanged. */
.dsh-codex-model .cx-trigger {
  display: flex; align-items: center; gap: 4px; min-width: 0;
  max-width: 220px; max-width: min(360px, 45cqw);
  height: 28px; padding: 0 4px 0 8px; border: none;
  border-radius: var(--dsw-radius-sm); outline: none; background: transparent;
  color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px;
  font-weight: 400; cursor: pointer;
}
.dsh-codex-model .cx-trigger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-codex-model .cx-trigger:focus-visible {
  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
}
.dsh-codex-model .cx-trigger:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.dsh-codex-model .cx-trigger-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The effort caption absorbs all deficit first, so a long model name keeps its letters. */
.dsh-codex-model .cx-trigger-effort {
  flex-shrink: 1000; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; color: var(--dsw-alias-label-caption);
}
.dsh-codex-model .cx-trigger-icon { display: var(--dsh-composer-model-icon-display, none); flex: 0 0 auto; }
.dsh-codex-model .cx-trigger-label,
.dsh-codex-model .cx-trigger-effort { display: var(--dsh-composer-model-text-display, block); }
.dsh-codex-model .cx-chevron { flex: 0 0 auto; color: var(--dsw-alias-label-caption); transition: transform 120ms ease; }
.dsh-codex-model .cx-chevron[data-open] { transform: rotate(180deg); }

/* Card: opaque selector surface portaled to the body. */
.dsh-codex-model.cx-card {
  position: fixed; z-index: 1100; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 2px;
  width: max-content; min-width: min(280px, calc(100vw - 32px)); max-width: min(360px, calc(100vw - 32px));
  max-height: min(440px, calc(100vh - 96px)); padding: 10px;
  border: 0; border-radius: var(--dsw-radius-lg);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-prominent);
  background: var(--dsw-specific-selector);
  color: var(--dsw-alias-label-primary);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
  /* Slider metrics plus the two skin stops. The end margin keeps the outer dots
     off the channel's rounded caps while the pill stops one knob radius short of
     it, so the knob caps the pill at both extremes and the channel shows only a
     thin rim around the colour. */
  --cx-pad: 18px;
  --cx-inset: 5px;
  --cx-thumb-r: 13px;
  --cx-ease: cubic-bezier(0.22, 1, 0.36, 1);
  /* Flat by design: no channel frame at all, and one soft drop under the knob
     so a white circle still separates from the channel it rides. */
  --cx-thumb-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
  /* Highest-effort skin. The DSH palette carries no violet, so this component
     owns the two stops the reference uses for its top tier. */
  --cx-ultra: #9d74f7;
  --cx-ultra-soft: #c4adf9;
}

/* One seat control: the level above, the model under it. The reset control is
   lifted out of flow so both lines centre on the card's axis. */
.dsh-codex-model .cx-seat-row { position: relative; display: flex; justify-content: center; }
.dsh-codex-model .cx-seat {
  display: flex; flex-direction: column; align-items: center;
  min-width: 0; max-width: calc(100% - 40px); padding: 2px 8px 3px;
  border: none; border-radius: var(--dsw-radius-sm);
  background: transparent; cursor: pointer;
}
.dsh-codex-model .cx-seat:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-codex-model .cx-seat:disabled { cursor: default; }
.dsh-codex-model .cx-seat-line { display: flex; align-items: center; justify-content: center; gap: 2px; min-width: 0; max-width: 100%; }
.dsh-codex-model .cx-effort-label {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-state-business-primary); font-size: 15px; line-height: 22px; font-weight: 500;
}
.dsh-codex-model .cx-seat:disabled .cx-effort-label { color: var(--dsw-alias-label-dimmed); }
.dsh-codex-model .cx-effort-chevron { flex: 0 0 auto; color: var(--dsw-alias-state-business-primary); }
.dsh-codex-model .cx-seat:disabled .cx-effort-chevron { color: var(--dsw-alias-label-dimmed); }
.dsh-codex-model .cx-model-name {
  min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 18px; font-weight: 400;
}
.dsh-codex-model .cx-reset {
  position: absolute; right: 0; top: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; border: none;
  border-radius: 50%; corner-shape: round; background: transparent;
  color: var(--dsw-alias-label-secondary); cursor: pointer;
}
.dsh-codex-model .cx-reset:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-codex-model .cx-reset:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }

/* Effort slider: a flat channel carrying a pill whose leading edge follows the
   knob, with one full-height cell per level for the dot and its hit area. The
   stops run edge to edge, so the top tier fills the track. Geometry comes from
   --cx-i/--cx-span on the track and --cx-i-cell on each cell, so a scrub can
   drive both boxes from one position without touching inline styles. */
.dsh-codex-model .cx-slider {
  position: relative; display: flex; align-items: center;
  height: 30px; margin: 6px 0 0;
  border-radius: 999px; corner-shape: round;
  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 72%, transparent);
  touch-action: none; user-select: none; -webkit-user-select: none;
  cursor: grab;
}
.dsh-codex-model .cx-slider[data-dragging] { cursor: grabbing; }
.dsh-codex-model .cx-fill {
  position: absolute; left: var(--cx-inset); top: 50%; z-index: 1;
  height: 24px; transform: translateY(-50%); overflow: hidden;
  /* The pill starts where the stop range starts and its right edge always lands
     on the knob's, so the top tier fills the range. */
  width: calc(var(--cx-pad) + (100% - 2 * var(--cx-pad)) * var(--cx-i, 0) / var(--cx-span, 1) + var(--cx-thumb-r) - var(--cx-inset));
  border-radius: 999px; corner-shape: round;
  background: var(--dsw-alias-state-business-primary);
  transition: width 260ms var(--cx-ease), opacity 150ms ease-out;
}
/* The highest tier fades a violet skin over the pill from the right: the pill
   reads blue at its leading edge and violet at the knob. */
.dsh-codex-model .cx-fill::after {
  content: ""; position: absolute; inset: 0; z-index: 0; border-radius: inherit;
  background: linear-gradient(90deg, transparent 18%, var(--cx-ultra) 82%);
  opacity: 0; transition: opacity 220ms ease;
}
.dsh-codex-model .cx-slider[data-ultra] .cx-fill::after { opacity: 1; }

/* Spark field: light-violet motes drifting right to left inside the pill. */
.dsh-codex-model .cx-sparks {
  position: absolute; inset: 0; z-index: 1; border-radius: inherit;
  opacity: 0; transition: opacity 250ms ease; pointer-events: none;
}
.dsh-codex-model .cx-slider[data-ultra] .cx-sparks { opacity: 1; }
.dsh-codex-model .cx-sparks span {
  position: absolute; left: var(--cx-sx); top: var(--cx-sy);
  width: var(--cx-ss); height: var(--cx-ss); border-radius: 50%; corner-shape: round;
  /* Brighter than the skin stop, with a halo of that tone: the right half of
     the pill is violet, where a plain light-violet speck disappears. */
  background: color-mix(in srgb, var(--cx-ultra-soft) 55%, var(--dsw-static-neutral-00));
  box-shadow: 0 0 4px var(--cx-ultra-soft);
  /* Visible at rest: the drift modulates this, but a client that drops the
     animation (reduced motion is the common one) must still show the field. */
  opacity: 1;
  animation: cx-spark-drift var(--cx-sd) linear var(--cx-sdel) infinite;
}
@keyframes cx-spark-drift {
  0% { transform: translateX(0) scale(.6); opacity: 0; }
  10% { opacity: 1; }
  68% { opacity: .9; }
  100% { transform: translateX(var(--cx-travel, -160px)) scale(1); opacity: 0; }
}
/* The cell is the band that selects a stop; the dot it owns is positioned
   against the track, so both agree with the pill and the knob. */
.dsh-codex-model .cx-cell {
  z-index: 2; flex: 1; height: 100%;
  display: grid; place-items: center; padding: 0; border: none;
  background: transparent; cursor: pointer;
}
.dsh-codex-model .cx-cell:disabled { cursor: default; }
.dsh-codex-model .cx-cell:focus-visible { outline: none; }
.dsh-codex-model .cx-mark {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  left: calc(var(--cx-pad) + (100% - 2 * var(--cx-pad)) * var(--cx-i-cell, 0) / var(--cx-span, 1));
  width: 5px; height: 5px; border-radius: 50%; corner-shape: round;
  background: var(--dsw-alias-label-caption);
  transition: transform 120ms ease, background-color 120ms ease;
}
/* A dot has to read against whatever backs it, so the ones riding the pill
   take the foreground tone the reference's grey cannot hold in light mode. */
.dsh-codex-model .cx-cell[data-filled] .cx-mark { background: var(--dsw-alias-label-primary-foreground); }
.dsh-codex-model .cx-cell:hover:not(:disabled) .cx-mark,
.dsh-codex-model .cx-cell:focus-visible .cx-mark {
  background: var(--dsw-alias-state-business-primary); transform: translate(-50%, -50%) scale(1.7);
}
.dsh-codex-model .cx-cell[data-filled]:hover:not(:disabled) .cx-mark,
.dsh-codex-model .cx-cell[data-filled]:focus-visible .cx-mark {
  background: var(--dsw-alias-label-primary-foreground);
}
.dsh-codex-model .cx-cell:focus-visible .cx-mark {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 8px;
}
.dsh-codex-model .cx-thumb {
  position: absolute; top: 50%; z-index: 3;
  width: 26px; height: 26px; margin-top: -13px;
  left: calc(var(--cx-pad) + (100% - 2 * var(--cx-pad)) * var(--cx-i, 0) / var(--cx-span, 1) - var(--cx-thumb-r));
  border-radius: 50%; corner-shape: round;
  background: var(--dsw-static-neutral-00);
  box-shadow: var(--cx-thumb-shadow);
  /* Decorative: the channel beneath owns the pointer, so the knob can never
     swallow the click meant for the stop it covers. */
  pointer-events: none;
  transition: left 260ms var(--cx-ease), opacity 130ms ease-in, transform 130ms ease-in;
}
/* A scrub keeps both boxes inside the track, so the pill never overruns it. */
.dsh-codex-model .cx-slider[data-dragging] .cx-fill {
  width: calc(clamp(var(--cx-pad), var(--cx-x, 0%), 100% - var(--cx-pad)) + var(--cx-thumb-r) - var(--cx-inset));
  transition: none;
}
.dsh-codex-model .cx-slider[data-dragging] .cx-thumb {
  left: calc(clamp(var(--cx-pad), var(--cx-x, 0%), 100% - var(--cx-pad)) - var(--cx-thumb-r));
  transition: none;
}

.dsh-codex-model .cx-strip {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 6px;
  margin-bottom: 4px; padding: 6px 8px; border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-interactive-bg-hover-danger);
  color: var(--dsw-alias-state-error-primary); font-size: 11px; line-height: 16px;
}
.dsh-codex-model .cx-strip[data-tone='warning'] {
  background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-state-warn-label);
}
.dsh-codex-model .cx-strip[data-tone='status'] {
  background: transparent; color: var(--dsw-alias-label-tertiary); margin-bottom: 0;
}
.dsh-codex-model .cx-retry {
  flex: 0 0 auto; padding: 0; border: none; background: transparent;
  color: inherit; font: inherit; font-weight: 500; cursor: pointer;
}

.dsh-codex-model .cx-title { padding: 2px 8px 6px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.dsh-codex-model .cx-list { display: flex; flex-direction: column; gap: 1px; min-height: 0; overflow-y: auto; }
.dsh-codex-model .cx-group { padding: 8px 8px 4px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.dsh-codex-model .cx-option {
  box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%;
  min-height: 34px; padding: 6px 8px; border: none; border-radius: var(--dsw-radius-md);
  background: transparent; color: var(--dsw-alias-label-primary);
  font-size: 13px; line-height: 18px; font-weight: 400; text-align: left; cursor: pointer;
}
.dsh-codex-model .cx-option:hover:not(:disabled),
.dsh-codex-model .cx-option:focus-visible { background: var(--dsw-alias-interactive-bg-hover); outline: none; }
.dsh-codex-model .cx-option:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.dsh-codex-model .cx-option-copy { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-codex-model .cx-check { display: grid; place-items: center; flex: 0 0 14px; color: var(--dsw-alias-label-primary); }
.dsh-codex-model .cx-check svg { width: 14px; height: 14px; }
.dsh-codex-model .cx-empty { padding: 6px 8px 2px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }

/* Transitions stop when the client asks for reduced motion; the spark drift is
   deliberately exempt, so the highest tier always reads as alive. */
@media (prefers-reduced-motion: reduce) {
  .dsh-codex-model .cx-fill, .dsh-codex-model .cx-mark, .dsh-codex-model .cx-sparks,
  .dsh-codex-model .cx-thumb, .dsh-codex-model .cx-chevron { transition: none; }
}
`;
