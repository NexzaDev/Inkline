# 0004 Preview mode

- Status: accepted
- Date: 2026-11-12
- Deciders: Inkline maintainers
- Related: `docs/ARCHITECTURE.md` sections 4 and 5

## Context

Preview mode is a read-only view of the same document: clean canvas, pan and
zoom, page switcher, layer visibility, and a tap on a card opens an information
sheet that shows its title, tooltip, custom properties and links. Switching to
edit mode, and back, must preserve position and zoom.

The brief asks us to verify in the source whether the viewer, lightbox mode or a
read-only embed configuration gives the best fidelity.

Three candidates exist in the pinned source.

**A. Read-only embed.** The same `js/app.min.js` document as edit mode, with the
graph locked down at runtime and the chrome hidden with CSS.

**B. The viewer.** `js/viewer.min.js` plus `GraphViewer`, either through
`DRAWIO_VIEWER_URL` or as its own page. It is a purpose-built read-only
renderer; `GraphViewer` builds the graph, supports pages, tooltips, links and
the lightbox, and exposes `viewer.graph`.

**C. Lightbox mode.** `?lightbox=1` inside `app.min.js`: the full app in a
read-only presentation with a nav toolbar, resize handles and its own chrome.

## Decision

**A, the read-only embed, is used for preview mode.**

Reasons, in order of weight:

1. **Viewport continuity is an acceptance criterion.** A mode switch in A is a
   state change inside one document: scale, translate and page are untouched.
   With B, the shell would have to serialise the viewport from one renderer and
   restore it in another, and the two renderers do not use identical fit and
   translation maths.
2. **Fidelity.** Both modes render through the same code path, so fonts,
   gradients, shadows, HTML labels, containers, swimlanes and connector routing
   cannot differ between preview and edit. B has its own initialisation path and
   does not carry every editor-only rendering flag.
3. **One document, one document model.** The information sheet needs cell
   properties, tooltips and links. In A the plugin reads them from the live
   `mxGraph` model it already owns. In B it is also possible (`viewer.graph`),
   but the read-only document would live in a different frame with a different
   message protocol that is not the documented embed protocol.
4. **Size and startup.** A reuses the bundle that is already vendored. B adds
   `viewer.min.js` (3.3 MB) and `viewer-static.min.js` (4.8 MB) to the APK for a
   second renderer.
5. **No second protocol to test.** The bridge, its tests and the smoke test
   cover one frame and one message set.

C is rejected outright: it brings a nav toolbar, resize handles and windows that
fight a touch shell, and it is a presentation for popups over a host page, not
for a native full-screen surface.

Read-only enforcement in A, applied by the plugin:

- `graph.setCellsLocked(true)`, `setCellsMovable(false)`,
  `setCellsResizable(false)`, `setCellsEditable(false)`, `setCellsBendable(false)`,
  `setCellsDisconnectable(false)`, `setConnectable(false)`, `setDropEnabled(false)`,
  `setSplitEnabled(false)`, `setTooltips(true)`.
- A body class that hides the format panel, sidebar, toolbar, handles and
  tab bar.
- `panningHandler` and pinch zoom stay active; neither consults the graph's
  editing flags.
- A tap is resolved by the plugin to a cell id and reported to the shell with the
  cell's extracted metadata. Selection in preview only marks the tapped cell.

## Consequences

- The lock is enforced by the plugin, not by the absence of code. Any future
  editor build that adds a write path which ignores `setCellsLocked` would be a
  regression in preview. The editor smoke test asserts that a preview-mode
  sequence of taps, drags and long presses leaves the model XML unchanged.
- Preview can still show the "modified" state if the model is touched by
  something unexpected; the shell treats preview as non-saving and discards
  those changes on mode switch by reloading the XML it already has.
- The viewer bundles are not vendored, which keeps 8 MB out of the APK.
- If read-only enforcement ever proves leaky in a draw.io update, B remains a
  documented fallback with a known cost: viewport handoff, a second renderer and
  a second protocol.
