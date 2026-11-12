# 0002 Shell framework

- Status: accepted
- Date: 2026-11-12
- Deciders: Inkline maintainers
- Related: `docs/ARCHITECTURE.md` section 2

## Context

The shell is the part of Inkline that is not draw.io: home, files, preview
chrome, settings, code view, loading screen and the bridge. It is a small
interface with a few screens, a lot of state that belongs in Rust, and a strict
visual system defined in `skills/unslop` and `docs/DESIGN.md`.

Requirements that constrain the choice:

- TypeScript in `strict` mode with `noUncheckedIndexedAccess`.
- No component library that dictates the look. The design tokens and the
  components are ours.
- Small bundle, fast first paint on mid-range Android, no runtime that needs a
  compiler plugin to work.
- Must run offline from app assets inside a Tauri 2 WebView, next to a second
  document that hosts draw.io.

## Decision

**Preact 10 with Vite 7, TypeScript 5, `preact/compat` not used, no router
library, no CSS framework.**

- JSX handled by Vite's esbuild transform, so the toolchain has no Babel plugin
  and no compiler daemon. Type checking is separate (`tsc --noEmit`), which keeps
  the editor and the type checker independent.
- Preact's hooks are enough for this interface. The screens are lists, sheets,
  a settings form and a canvas host; there is no state graph that would justify
  a store, and the shell keeps shared state in a single typed module with
  signals-free, explicit subscriptions.
- Routing is a switch over a typed `Screen` union, stored in one module. Deep
  links from intents set the initial screen; the Android back handler pops the
  same stack. A router library would add a second source of truth for
  navigation, which is exactly what breaks process-death restore.
- Styling is plain CSS with custom properties generated from one token file, so
  the same tokens can be serialised into the editor frame's `customCss`.

Rejected alternatives:

- **Solid.** Also a good fit, and its fine-grained reactivity would suit a
  canvas host. Rejected because it needs a compiler plugin, and because the
  shell has no workload where fine-grained updates beat Preact's virtual DOM by a
  margin worth the extra build surface.
- **Svelte 5.** Compiler and runes add a second mental model next to the Rust
  and TypeScript ones, and its scoped styles fight a global token file.
- **React.** Larger runtime and a stronger pull towards component libraries,
  neither of which this project wants.
- **No framework at all.** The code view, sheets and settings form would become
  hand-rolled DOM diffing, which is more code to own than Preact's 4 KB.

## Consequences

- `web/shell` contains `src/main.tsx`, `src/bridge`, `src/screens`,
  `src/components`, `src/state`, `src/styles` and nothing generic. No `utils`
  module exists by design.
- Bundle budget for the shell is 60 KB gzipped, checked in CI.
- The design tokens are a single TypeScript file that emits CSS variables; the
  editor frame receives the same values as JSON in `PreConfig.js`, so the shell
  and the canvas cannot drift.
- Accessibility primitives (focus rings, 48dp targets, reduced motion) are CSS
  in the token layer, not library behaviour, so they apply to every screen
  including the ones we have not designed yet.
