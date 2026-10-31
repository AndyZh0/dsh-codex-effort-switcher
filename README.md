---
description: "Codex-style model and reasoning-effort selector for the DSH composer."
kind: "package-bundle"
---

# dsh-codex-effort-switcher

English | [中文](README.zh.md)

## Summary

Replaces the composer's model picker with a Codex-style card: the effort label, an opaque segmented effort slider, and the provider-grouped model list. Install the packed archive into a profile and restart; removing the package restores the shipped picker with no residue. The `/model` command, the settings Models page, and the Host selection path stay as shipped, so a switch made in either place is what the other shows next. The card is a second occupant of the composer's single-occupant model slot at `priority: -1`, reading the same per-session `modelDirectories` service, and it provides the `codexModelTiers` client service for plugins that append a tier.

## Table of Contents

- [Install](#install)
- [Use](#use)
- [How it composes with DSH](#how-it-composes-with-dsh)
- [Third-party tiers](#third-party-tiers)
- [Development](#development)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="install"></a>
## Install

Build the package inside this directory; development dependencies and artifacts remain here. Use a Node.js version supported by DSH.

```powershell
npm install --ignore-scripts --workspaces=false
npm run build
npm pack
dsh plugin --profile desktop add "D:/Projects/deepseek-harness/plugins/codex-effort-switcher/dsh-codex-effort-switcher-0.2.1.tgz"
```

Alternatively install the absolute `.tgz` path from DSH's plugin manager. Install into the profile you use, and use Desktop's own plugin manager for Desktop: the CLI refuses a profile the application manages. Restart the app afterwards, because a profile without live patch reloading composes the new bundle at boot. This plugin does not install itself into any profile.

<a id="use"></a>
## Use

Click the model chip at the right of the composer. The card opens on the effort face: the current level (blue, with a chevron) above the model name, over one dot per advertised level. Both lines are a single button, and clicking anywhere on it opens the model list. The flat channel carries a solid pill whose edge tracks the knob; the outer stops keep clear of its rounded ends, and the top tier fills exactly that range. Click a dot, or scrub the track horizontally; the circular arrow restores the model's default level. At the model's highest level the pill turns from blue to violet and light-violet motes drift across it from right to left. The 选择模型 face lists each provider group, with a check on the current model. Selecting a model keeps the current level on the same route and takes the target route's default level otherwise.

The panel stays open while you change anything in it — a level, the model, or the default — so several levels can be compared without reopening it. An outside click dismisses it; Escape leaves the 选择模型 face for the effort face first, then dismisses the panel.

The trigger shows the model name and the level and keeps its shipped accessible name; the composer's compact mode still collapses it to the model glyph. `Esc` leaves a drilled face before closing the card; arrow keys move focus; a rejected selection reports through the app toast, and a catalog that fails to load offers Retry inside the card.

<a id="how-it-composes-with-dsh"></a>
## How it composes with DSH

The composer model seat is a single-occupant slot. This plugin registers a second occupant at `priority: -1`, which shadows the shipped picker without unloading it, and reads the same per-session `modelDirectories` service — so a switch made in either this card or `/model` is what the other shows next, and the Host still receives one `session.selectModel` call. Removing the plugin restores the shipped picker with no residue.

Provider headings appear only when more than one provider has models; a single-provider catalog renders a flat list. The card is opaque by design: it uses the theme's selector surface rather than the translucent menu material. There is no search field; the list scrolls.

Uninstalling removes the bundle layer and the card; saved model selections and the session log are untouched.

<a id="third-party-tiers"></a>
## Third-party tiers

The browser half provides the `codexModelTiers` client service (`SeatTierRegistry`). A client plugin can add an effort tier above the model's own levels by injecting the service and registering a `SeatTier` with `id`, `label`, `description`, `available(model)`, `effort(model)`, `active(sessionId)`, and `apply(sessionId, selection, model, select)`. The card appends registered tiers after the shipped efforts; `apply` receives the standard `select` function, so the Host still sees exactly one `session.selectModel`. The top tier gets the violet `data-ultra` skin. Without a contributor the registry is empty and the card is unchanged; removing a contributor removes its tier without touching selections or the session log.

A tier contributor is an ordinary client plugin: it injects the service, registers its tier, and may ship its own Host half for whatever the tier means beyond the effort. The dependency runs one way — the contributor depends on this package, never the reverse.

<a id="development"></a>
## Development

```powershell
npm run typecheck
npm test
node tests/browser-smoke.mjs
```

The first two commands run independently; the switcher test also covers a contributed tier. The browser smoke packs the plugin, installs it into a throwaway `DSH_HOME` profile through `apps/cli/lib/bin.js`, points a fixture provider at a local model endpoint, boots `dsh web` from the DSH checkout, and drives Microsoft Edge through the real card — asserting the faces, the slider, viewport fitting, the routed model, and the routed reasoning-effort wire value. It needs `pnpm run build` in the DSH checkout and writes ignored evidence under `.runtime/`. Published packages exclude tests and development dependencies.

The browser half requires no DSH module beyond the platform seed words it renders through (`react`, `react-dom`, `@deepseek-ai/dsh-client-ui-primitives`). It provides the `codexModelTiers` registry that tier contributors inject. The Host entry is an empty marker so the bundle row exists for the client scan.

<a id="model-experience"></a>
## Model Experience

None: this layer adds no model-facing surface. It changes how the composer's model seat renders and how one selection reaches the Host; the `/model` command, the settings Models page, and the single `session.selectModel` call are untouched.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- The model slot is single-occupant, so two plugins shadowing it at the same priority throw.
- The card is opaque by design and carries no search field.
- Provider headings appear only when more than one provider has models.
- A contributed tier renders above the shipped efforts, and two tiers sharing an `id` throw.
- Desktop installs go through the desktop application's own plugin manager; the CLI refuses a profile the application manages.
- The bundle is composed at boot, so a profile without live patch reloading needs an application restart.
