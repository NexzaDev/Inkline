# Inkline architecture

Inkline is an Android graph and diagram editor built from three parts that stay
strictly separated:

- a native Android shell (Tauri 2, Kotlin plugin code, Rust core),
- a small shell interface written in TypeScript,
- an unmodified copy of the draw.io editor, driven over its documented message
  protocol.

This document describes the system as it will be built, the contract with the
vendored editor, and the facts about that editor which the design depends on.
Every claim about draw.io below was read in the pinned source at
`jgraph/drawio` tag `v32.6.10` (commit `c72c9a98b7a6ce392556ed04c05e0ff19f43f5c3`);
file and line references point into `src/main/webapp` of that tag.

Phase status: this is a living document. It records design and the parts that
have been built, and it changes when the product does. ADR 0008 changed the
product once already; sections 4, 5 and 6 describe the reader that exists, not
the editor that was planned.

## 1. Constraints that shape every decision

1. **The release APK has no `INTERNET` permission.** The diagram editor must
   work with no network at all. Anything the editor would fetch remotely is
   either shipped locally or disabled.
2. **draw.io is vendored, not forked.** The editor files are copied byte for
   byte from the pinned tag by a script. Every customisation goes through the
   embed protocol, the configuration message, the plugin mechanism, CSS, or the
   `PreConfig.js` / `PostConfig.js` deployment hook files.
3. **Rust owns the truth about files.** Validity, normalisation and
   serialisation of `.graph` are decided in `graph-core`. The web layer may
   present a validation report; it may not decide that a document is valid.
4. **Untrusted input.** A `.graph` file can arrive from a chat app, a browser
   download or a file manager. Parsing must be bounded, must reject DTDs and
   entities, and must never panic.
5. **Touch first, one hand and two.** Reading is a gesture: one finger pans,
   two fingers pinch, and the two never conflict. There is no hover, no right
   click and no keyboard, so anything that depends on them does not exist.

## 2. Layer map

```
┌──────────────────────────────────────────────────────────────────────┐
│ Android (API 26+)                                                    │
│  Activity · edge-to-edge · back gesture · system splash               │
│  tauri-plugin-file-intents (Kotlin)                                  │
│    ACTION_VIEW / ACTION_SEND · content:// · onNewIntent · SAF         │
├──────────────────────────────────────────────────────────────────────┤
│ Tauri 2 runtime                                                      │
│  Rust commands (files, recents, settings, import, export)            │
│  graph-core (pure Rust, also compiled into graphctl)                 │
├──────────────────────────────────────────────────────────────────────┤
│ Shell UI — TypeScript + Vite + Preact, served from app assets         │
│  reader screen · open dialog · status bar · loading                   │
│  bridge (typed message layer, one module, no globals)                │
├──────────────────────────────────────────────────────────────────────┤
│ Editor frame — separate document, same origin, app assets only        │
│  web/editor/vendor/drawio/index.html?embed=1&proto=json&chrome=0...   │
│  web/editor/hooks/{PreConfig,PostConfig}.js (editor deployment hooks)  │
└──────────────────────────────────────────────────────────────────────┘
```

The shell and the editor frame are two documents. They talk only through
`postMessage` with the JSON protocol described in section 4. The shell never
reaches into the frame's DOM, and the frame never reads shell state.

## 3. Why an iframe at all

The draw.io application is designed to be embedded in an iframe with
`embed=1`. Its own documentation says embed mode is supported on
`embed.diagrams.net`, and self-hosting is therefore technically outside the
documented support matrix. We accept that: the alternative is forking editor
internals, which the project forbids. The consequence is a duty to re-verify the
integration against each pinned version, which the vendoring script and the
editor smoke test in CI enforce.

## 4. The editor integration contract

ADR 0008 changed the product: Inkline renders documents and does not edit them.
The frame below is the reader configuration. Where a mechanism the vendored
editor still supports is described, it is described as the editor's own
behaviour, not as something Inkline sends.

### 4.1 Frame URL

```
web/editor/vendor/drawio/index.html
  ?embed=1
  &proto=json
  &spin=0
  &chrome=0
  &dark=1
  &pv=0
  &grid=0
  &lang=en|el
```

- `chrome=0` is the reader. The editor derives its own editability from the same
  flag (`this.editable = null != e ? e : !a` in `js/diagramly/EditorUi.js`), so a
  chromeless frame cannot be edited: no toolbar, no menus, no format panel, no
  text editing, no autosave. Panning, pinch zoom, links and tooltips remain.

- `embed=1&proto=json` selects the JSON message protocol
  (`js/diagramly/EditorUi.js:31566`, `installMessageHandler`).
- `spin=0` suppresses the editor's own spinner. Inkline draws its own loading
  screen and only reveals the frame on the `load` event.
- `noSaveBtn=1&saveAndExit=0&noExitBtn=1` and `modified=0` belonged to the edit
  build, where the shell owned the controls. A chromeless frame has no buttons
  and no status bar, so they are no longer passed.
- `dark=1` selects the editor's own dark palette, so the chrome matches the
  shell instead of flashing a light application inside a black one.
- `pv=0` removes the page sheet and `grid=0` removes the grid. Both are drawn
  inside the surface that pans and zooms, so they are exactly the things that
  used to slide under the finger and drift away from the pinch point. What
  remains is `.geDiagramContainer`'s own CSS background, which never moves:
  the canvas is one fixed dark surface, and only the shapes drawn on it move
  and scale. Pinch zoom uses `zoomAt` (`js/PanningHandler`, `mxPanningHandler`),
  which anchors the scale at the gesture point rather than at the view centre.
- `p=` will load the Inkline plugin from the app's assets; it is absent until
  the plugin exists. Loading a plugin from `?p=` requires
  `window.ALLOW_CUSTOM_PLUGINS = true`, which is set in `PreConfig.js`, and the
  plugin URL must be same-origin (`js/diagramly/App.js:1800`,
  `js/diagramly/Init.js:79`).
- **`offline=1` must not be set.** It disables plugin loading entirely
  (`js/diagramly/App.js:1156`). Offline behaviour is enforced by the absence of
  the `INTERNET` permission and by a WebView request policy, not by that flag.

`js/PreConfig.js` is loaded for exactly this situation: any host that is not
`*.draw.io` or `*.diagrams.net` gets `PreConfig.js` before `app.min.js` and
`PostConfig.js` after it (`js/bootstrap.js:359`, `js/bootstrap.js:408`). That is
drawio's own deployment hook, used the same way by drawio-desktop. Inkline's
`PreConfig.js` sets `DRAWIO_CONFIG`, `ALLOW_CUSTOM_PLUGINS`,
`PLUGINS_BASE_PATH`, `DRAWIO_VIEWER_URL = null`, `ICONSEARCH_PATH = null`,
`ICON_SERVICE_PATH = null`, `EXPORT_URL = null` and disables the service worker.
This is the only vendored file whose content differs from upstream, and the
difference is recorded in `docs/adr/0001-vendor-drawio.md`.

### 4.2 Lifecycle

```
shell                                   editor frame
  │ create iframe when a document is open    │
  │──────────────────────────────────────────▶│ app.min.js boots
  │                                           │ PreConfig.js: DRAWIO_CONFIG
  │◀──────────── {event:'init'} ──────────────│
  │                                           │
  │──── {action:'load', xml} ────────────────▶│ setFileData, chromeless view
  │◀──────────── {event:'load'} ──────────────│ loading screen hands off
  │                                           │
  │        no further traffic                 │ pan and pinch zoom are local
```

That is the whole protocol. The frame is created only when a document is
open, so a launch with no document never pays for it. If `load` does not arrive
within twenty seconds the shell shows a failure state with a retry, rather than
an empty canvas the owner cannot diagnose.

`configure=1` is not used. The editor's configuration arrives through
`window.DRAWIO_CONFIG`, set in `PreConfig.js`, so the frame does not have to
wait for a `configure` round trip before `init`
(`js/diagramly/App.js:1621`, `js/diagramly/App.js:1686`). If a configuration has
to change at runtime, Inkline reloads the frame with a new `PreConfig` payload
rather than mutating a live editor.

### 4.3 Actions the shell may send

| Action | Purpose              | Source                           |
| ------ | -------------------- | -------------------------------- |
| `load` | Provide the document | `js/diagramly/EditorUi.js:32447` |

`load` carries `xml` and nothing else. The reader does not send `fit`,
`viewbox`, `snapshot`, `export`, `invokeAction`, `resetEditor`, `merge` or the
diff actions. The editor's remaining actions exist only in editable mode, and
the shell has no surface for them: a reader with buttons is an editor with its
most important button missing.

The frame is left to fit the diagram itself, as it does on `load`. The owner's
gesture is pan and pinch; anything the shell decided about the viewport would be
undone by the first pinch anyway.

### 4.4 Events the frame sends

`init` and `load` are the only events the shell reads. `autosave`, `save`,
`exit`, `export`, `zoom`, `resize`, `configure` and the dialog events are still
emitted by the vendored editor in principle, but a chromeless frame produces
`init` and `load` and then nothing, and the shell parses the rest to `null` and
ignores them. This is deliberate: the reader has no state to reconcile, so an
unknown message is not a bug.

Every message travels as a JSON string, not as an object: the editor posts
`JSON.stringify(...)` and parses `event.data` back with `JSON.parse`
(`js/diagramly/EditorUi.js:31566`, `installMessageHandler`), and the shell does
the same in both directions. A bridge that posts objects is ignored without an
error, and the frame then looks loaded but never answers.

There is no save path. Not `{action:'export'}`, not `{event:'autosave'}`, not
`invokeAction:'save'`. The document on disk is the only copy, and the app does
not write it. ADR 0008 records why.

### 4.5 Configuration

`window.DRAWIO_CONFIG` is `null` in `PreConfig.js` and the shell never sends
`configure`. Everything Inkline decides about the frame is a URL parameter, so
the frame is fully configured before its first script runs and there is no
handshake that can hang.

`PreConfig.js` sets what a local, offline copy needs: `DRAWIO_PUBLIC_BUILD`,
`EXPORT_URL` and every remote URL to `null`, local math assets, custom plugins
allowed from `plugin/`, and `sync=manual` so the editor never tries to reach a
storage backend. `Editor.configure` (`js/diagramly/Editor.js:3112`) is
documented here only as the escape hatch: a key that cannot be expressed as a
URL parameter goes into `PreConfig.js`, in one place, and is then a shell
concern rather than a vendor edit.

Dark mode is `dark=1`: the editor's own dark palette, which is what the
vendored CSS already provides. The shell's `--editor-chrome` token matches it so
the status bar and the canvas read as one surface.

### 4.6 Touch behaviour found in the source

- `mxClient.IS_TOUCH` is `'ontouchstart' in document.documentElement`
  (`mxgraph/src/mxClient.js:187`); `Graph.touchStyle` also treats
  `navigator.maxTouchPoints > 0` as touch (`js/grapheditor/Graph.js:1785`).
- Pinch zoom and two-finger pan are built into `mxPanningHandler`
  (`pinchEnabled`, gesture listeners), so no custom gesture code is needed.
- Hover icons use a larger tolerance on touch
  (`HoverIcons.prototype.tolerance`, `js/grapheditor/Graph.js:23714`).
- Splitter hit areas widen on touch (`EditorUi.prototype.splitSize`,
  `js/grapheditor/EditorUi.js:1302`).
- A compact theme (`ui=min`, `js/diagramly/Minimal.js:18`) exists for narrow
  viewports. Inkline does not use it: a chromeless frame has no chrome to
  compact.

Pinch zoom anchors at the gesture point because `mxPanningHandler` calls
`zoomAt` there. That is the behaviour the owner asked for, and it is the reason
no zoom handling exists in the shell: the editor already does it correctly, and
a second implementation on top of it would fight the first.

## 5. Modes

There is one mode. The frame is chromeless (`chrome=0`), which is the editor's
own read-only configuration, and there is no edit mode to switch to. ADR 0008
records why: the owner authors documents as files, and an in-app editor that
cannot be typed into is worse than none.

Consequences that are load-bearing elsewhere in this document:

- No panel, no toolbar, no format panel, no text editing, no autosave.
- Pan, pinch zoom, links and tooltips stay, because they belong to the panning
  handler rather than to the editing UI.
- The shell's only controls are `Open` and, on failure, `Try again`.

## 6. Data flow

```
file manager / share sheet
        │ content:// URI
        ▼
tauri-plugin-file-intents (Kotlin)  ──bytes──▶  Rust command
                                                   │
                                          graph-core parse + validate
                                                   │
                        ┌──────────────────────────┴─────────────────┐
                        ▼                                            ▼
                 validation errors                             document model
                 (report to shell)                                    │
                                                                      ▼
                                                        shell → editor frame (load)
```

- The core parses and validates. The shell only formats and presents a
  `ValidationReport`. Nothing in this path writes to the file.
- Reading is the whole path. A `.graph` file the shell cannot parse is refused
  before the frame is created, so a malformed document never produces an empty
  canvas with no explanation.
- `docs/GRAPH_FORMAT.md` will define what the shell accepts on read: root
  `<mxfile>` (optional XML declaration), at least one page, and the attributes
  the editor requires to render.

## 7. Security model

- No `INTERNET` permission in the release manifest. The editor frame, the shell
  assets and the fonts are all local files.
- A shell CSP with `default-src 'self'`, no remote hosts, `object-src 'none'`,
  `base-uri 'none'`. The frame is local content; its own CSP is applied from the
  shell when the frame is served, not edited into vendor files.
- The WebView request policy denies anything that is not an app asset, and CI
  has a test that blocks every request and proves the editor still loads and
  edits.
- XML parsing in Rust rejects `DOCTYPE`, entities, external references, deep
  nesting, duplicate cell ids and dangling edges; it is bounded by size limits
  per file and per embedded image.
- Intents accept `content://` only. Files are read into memory under a size
  cap; URIs are never trusted to be local paths.
- The plugin is plain script inside the frame with no network access; it never
  evaluates strings from the document.

Risk register entries that matter for this design:

1. The editor renders HTML labels. drawio ships its own sanitiser for label
   content and keeps it in `app.min.js`; the vendored build must not remove it.
   The core also rejects `<script>` inside labels as a second line of defence.
2. Visio and Gliffy imports load lazily from `js/extensions.min.js` and
   `js/vsd*`. Visio import is not required by the brief and is not vendored;
   the editor degrades with its own "service unavailable" message, which the
   shell intercepts and replaces with a clear explanation.

## 8. Build and verification

CI is the source of truth for anything that needs a compiler or an SDK. The
development sandbox used to write this document has Node 22 and git, and no Rust
toolchain, no JDK and no Android SDK, and it cannot reach the hosts that serve
them. `docs/adr/0006-verification-environment.md` records that limitation and
what it implies for how phases are reported.

- Local, on every change: TypeScript typecheck, ESLint, Prettier, unit tests,
  and golden-file tests for the parts that do not need Rust.
- CI on every push: `cargo fmt --check`, `cargo clippy -D warnings`,
  `cargo test --workspace`, `cargo deny check`, web typecheck/lint/test/build,
  `.graph` golden tests, a debug APK build with the Android SDK and NDK, and the
  network-blocked editor smoke test.
- Release on tag: signed per-ABI APKs, a universal APK, an AAB, checksums and
  `graphctl` binaries for three platforms.

## 9. Vendored draw.io, measured

Pinned: tag `v32.6.10`, commit `c72c9a98b7a6ce392556ed04c05e0ff19f43f5c3`,
released 2026-11-04. `src/main/webapp` in that tag is 115 MB.

**The minified bundles are committed.** `index.html` loads `js/bootstrap.js`,
which loads `js/app.min.js` (11 MB) for any host and then, for a non-Electron
host, `js/PostConfig.js` (`js/bootstrap.js:359`). Nothing has to be built to run
the editor. The unminified sources (`js/grapheditor`, `js/diagramly`,
`mxgraph/`) are in the repository for `?dev=1` and for maintainers' Ant build in
`etc/build/build.xml`; the app does not load them at runtime.

Lazily loaded at runtime from the same origin, discovered by scanning the
bundles for script references: `js/extensions.min.js` (Visio, GraphML, Gliffy,
ELK, Mermaid), `js/plantuml/drawio-plantuml.min.js`, `js/mermaid/*`,
`js/elk/*`, `js/gliffy/*`, `js/orgchart*`, `js/libavoid-js`, `js/jszip`,
`js/shapes-14-6-5.min.js`, `js/stencils.min.js`, and the `shapes/` directory.
A vendoring script that dropped these would break features silently at the
moment a user opens the corresponding dialog, so they stay.

A candidate vendor tree with the sources, server code, tests, cloud clients,
service worker, analytics, `integrate.min.js`, `viewer*.min.js` and the unused
language files removed measures **51 MB raw and 21 MB gzipped**, with
`app.min.js`, `extensions.min.js` and `stencils.min.js` the three largest
entries. The arm64 budget in the brief is 60 MB, so the editor leaves roughly
35 MB for the runtime, the core, the shell and the icon set. The exact allowlist
lives in `scripts/vendor-drawio.sh` from Phase 2 and in
`docs/adr/0001-vendor-drawio.md`.

## 10. Open questions

These are recorded rather than guessed. None of them blocks a reader.

1. **Keystore.** Release signing needs the four secrets from the brief. Until
   the owner has one, CI ships an unsigned debug APK and Android shows its own
   debugging notice.
2. **Rust toolchain in this sandbox.** `static.rust-lang.org` and
   `sh.rustup.rs` are unreachable here, so `cargo` cannot be installed. Whether
   a toolchain can be fetched from a GitHub release asset instead is unverified.
   Until it is, Rust work is verified in CI only.
3. **What `chrome=0` does to a document that uses web fonts.** A document with
   an `extFonts` list cannot fetch it, so the reader renders the fallback face.
   Whether that is acceptable or whether the authoring side must embed the
   fonts is a format question for `docs/GRAPH_FORMAT.md`.
4. **`templates/` (5.6 MB).** The reader never opens the template dialog, so
   this directory is dead payload. Removing it needs a check that `index.html`
   does not reference it in the chromeless path, and a re-run of the vendoring
   manifest.
5. **Stylus and palm rejection.** WebView exposes pointer events; whether
   `pointerType` survives on the owner's device is a device question. Panning
   with a palm resting on the screen is the case to test.

## 11. References

Pinned tag, path relative to `src/main/webapp`:

| Topic                               | Location                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| Bootstrap and bundle loading        | `js/bootstrap.js:359`, `js/bootstrap.js:408`                                 |
| Embed message handler               | `js/diagramly/EditorUi.js:31566`                                             |
| Load action                         | `js/diagramly/EditorUi.js:32447`                                             |
| Init event                          | `js/diagramly/EditorUi.js:33274`                                             |
| Chromeless and editable             | `js/diagramly/EditorUi.js` constructor, `this.editable = null != e ? e : !a` |
| Autosave event (unused)             | `js/diagramly/EditorUi.js:33091`                                             |
| Open link event (unused)            | `js/diagramly/EditorUi.js:33286`                                             |
| State envelope (unused)             | `js/diagramly/EditorUi.js:30719`                                             |
| Editor configuration (escape hatch) | `js/diagramly/Editor.js:3112`                                                |
| Plugin loading (not used)           | `js/diagramly/App.js:1800`, `js/diagramly/Init.js:79`                        |
| Touch detection                     | `mxgraph/src/mxClient.js:187`, `js/grapheditor/Graph.js:1785`                |
| Greek language file                 | `resources/dia_el.txt`                                                       |
