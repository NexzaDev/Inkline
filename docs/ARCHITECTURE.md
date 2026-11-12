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

Phase status: this is a Phase 0 document. It records design, not implementation.
Nothing here has been built or run on a device yet, except where the
verification section says otherwise.

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
5. **Touch first, one hand and two.** The editor keeps all of its capabilities,
   but its presentation is tuned for fingers: large hit areas, no hover-only
   affordances, an on-screen toolbar, and pan and pinch zoom everywhere.

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
│  home · files · preview chrome · settings · code view · loading       │
│  bridge (typed message layer, one module, no globals)                │
├──────────────────────────────────────────────────────────────────────┤
│ Editor frame — separate document, same origin, app assets only        │
│  web/editor/vendor/drawio/index.html?embed=1&proto=json...            │
│  web/editor/plugin/inkline-plugin.js  (loaded through ?p=)            │
│  web/editor/styles/inkline-editor.css (injected as config.customCss)  │
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

### 4.1 Frame URL

```
web/editor/vendor/drawio/index.html
  ?embed=1
  &proto=json
  &spin=0
  &libraries=1
  &noSaveBtn=1
  &saveAndExit=0
  &noExitBtn=1
  &modified=0
  &p=../../plugin/inkline-plugin.js
  &lang=en|el
```

- `embed=1&proto=json` selects the JSON message protocol
  (`js/diagramly/EditorUi.js:31566`, `installMessageHandler`).
- `spin=0` suppresses the editor's own spinner. Inkline draws its own loading
  screen and only reveals the frame on the `load` event.
- `noSaveBtn=1&saveAndExit=0&noExitBtn=1` removes the editor's own action
  buttons so that one set of controls (the shell's) exists. The save action is
  still callable; see 4.6.
- `modified=0` stops the editor from writing status text into its own bar.
- `p=` loads the Inkline plugin from the app's assets. Loading a plugin from
  `?p=` requires `window.ALLOW_CUSTOM_PLUGINS = true`, which is set in
  `PreConfig.js`, and the plugin URL must be same-origin
  (`js/diagramly/App.js:1800`, `js/diagramly/Init.js:79`).
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
  │ create iframe (hidden)                    │
  │──────────────────────────────────────────▶│ app.min.js boots
  │                                           │ PreConfig.js: DRAWIO_CONFIG
  │                                           │ plugin registers inkline actions
  │◀──────────── {event:'init'} ──────────────│
  │                                           │
  │──── {action:'load', xml, autosave:1, ────▶│ setFileData, fit/viewbox, diff base
  │      zoomEvents:true, title, dark,        │
  │      viewbox|fit, viewport}               │
  │◀──── {event:'load', xml, bounds, ─────────│ loading screen hands off
  │       modelBounds, scale, pageVisible,    │
  │       currentPage, page, containerSize}   │
  │                                           │
  │◀──── {event:'autosave', xml, ...} ────────│ on every model change
  │◀──── {event:'zoom', scale, ...} ──────────│ on zoom changes
  │                                           │
  │──── {action:'invokeAction', ─────────────▶│ runs the named editor action
  │      actionName:'save'}                   │
  │◀──── {event:'save', xml, ...} ────────────│ shell writes through Rust
  │                                           │
  │──── {action:'fit'} / {action:'viewbox'} ─▶│ viewport commands
  │──── {action:'invokeAction', ──────────────▶│ inklinePreviewEnter / Exit
  │      actionName:'inklinePreviewEnter'}     │
```

`configure=1` is not used. The editor's configuration arrives through
`window.DRAWIO_CONFIG`, set in `PreConfig.js`, so the frame does not have to
wait for a `configure` round trip before `init`
(`js/diagramly/App.js:1621`, `js/diagramly/App.js:1686`). If a configuration has
to change at runtime, Inkline reloads the frame with a new `PreConfig` payload
rather than mutating a live editor.

### 4.3 Actions the shell may send

| Action | Purpose | Source |
| --- | --- | --- |
| `load` | Provide the document and view options | `js/diagramly/EditorUi.js:32447` |
| `invokeAction` | Run any editor action by name, no arguments | `js/diagramly/EditorUi.js:31937` |
| `fit` | Fit the diagram to the viewport | `js/diagramly/EditorUi.js:31963` |
| `viewbox` | Show an exact model region | `js/diagramly/EditorUi.js:31977` |
| `snapshot` | Raster snapshot for thumbnails | `js/diagramly/EditorUi.js:32024` |
| `export` | SVG or PNG through the export pipeline | `js/diagramly/EditorUi.js:32030` |
| `resetEditor` | Stop editing, clear selection and menus | `js/diagramly/EditorUi.js:31947` |
| `merge` | Merge XML into the open document | `js/diagramly/EditorUi.js:32876` |
| `patch`, `getDiff`, `resetDiff` | Diff-based sync, if ever needed | `js/diagramly/EditorUi.js:32914` |

`load` options Inkline uses: `autosave: 1`, `zoomEvents: true`,
`title`, `dark`, `fit` or `viewbox`, `viewport`, `border`, `noSaveBtn: 1`,
`saveAndExit: 0`, and `modified: '0'`. Diff sync is left off: one editor frame
at a time edits a document, so patches buy nothing and add a second
serialisation format to reason about.

### 4.4 Events the frame sends

`init`, `load`, `autosave`, `save`, `exit`, `zoom`, `export`, `openLink`,
`resize`, `configure`, plus dialog events Inkline does not use (`draft`,
`template`, `textContent`, `prompt`, `shortcut`).

The state envelope carried by most of them is built by
`createLoadMessage` (`js/diagramly/EditorUi.js:30719`) and contains `bounds`,
`modelBounds`, `scale`, `translate`, `pageVisible`, `currentPage`, `page` and
`containerSize`. `containerSize` is what the shell uses to decide whether the
editor's panels fit; `modelBounds` is what it uses for thumbnails.

The embedded Save button is gone (`noSaveBtn=1`), but the save action itself is
overridden in embed mode to post `{event:'save', xml, exit?}`
(`js/diagramly/Menus.js:3327`). The shell triggers it with
`invokeAction: 'save'`, so Ctrl+S inside the editor and the shell's own Save
control take exactly the same path.

`{event:'openLink'}` is produced when a link is clicked, and Inkline sets
`suppressNewWindows: true` so the frame never opens a window itself: links are
the shell's responsibility (confirm, then `ACTION_VIEW`).

### 4.5 Configuration

`Editor.configure` (`js/diagramly/Editor.js:3112`) accepts a large key set.
Inkline sets, at minimum:

| Key | Value | Reason |
| --- | --- | --- |
| `compressXml` | `false` | Saves emit uncompressed `<mxGraphModel>`, which the `.graph` format requires (`js/diagramly/Editor.js:3334`) |
| `defaultFonts`, `enableLocalFonts` | system font families only | No remote font fetch; the default font list points at Google Fonts |
| `customLibraries`, `defaultLibraries`, `appendCustomLibraries` | Inkline shape library | Custom icons without touching core files |
| `customCss` | Inkline palette, radii, control sizes | Theming through supported configuration |
| `resources` | Greek strings the editor should use for Inkline-specific labels | Localisation without editing resource files |
| `defaultGridSize`, `defaultPageVisible`, `defaultGridEnabled` | from Inkline settings | Document defaults match the app |
| `noResizers`, `preserveViewState` | `true` | Full-bleed frame; view attributes survive a round trip |
| `suppressNewWindows` | `true` | Links route to the shell |
| `zoomWheel`, `enableCssDarkMode` | per theme | Wheel zoom and CSS dark mode follow the Inkline theme |

Dark mode is applied with `{action:'load', dark:true}` at load and through the
`ui=dark` / `dark=1` parameters, and tuned with `defaultDarkPageBackgroundColor`
and `defaultDarkGridColor` so the canvas matches the OLED theme.

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
  viewports. Inkline does not use it: the shell owns the chrome, and the frame
  runs with `noSaveBtn`, so the theme's toolbar work is redundant.

The plugin's job is therefore not to reimplement gestures but to widen what is
hard to hit: handle sizes, label edit thresholds, long-press menus, and the
on-screen palette.

## 5. Modes

One editor frame, one document, two modes, toggled by plugin actions over
`invokeAction`. `docs/adr/0004-preview-mode.md` records why the viewer bundle is
not used.

- **Edit mode.** The frame is fully enabled. Shell toolbar drives actions
  (`invokeAction`), the properties panels come from the editor itself.
- **Preview mode.** The plugin sets `graph.setCellsLocked(true)`,
  `setCellsMovable(false)`, `setCellsResizable(false)`, `setCellsEditable(false)`,
  `setCellsBendable(false)`, `setCellsDisconnectable(false)`, `setConnectable(false)`,
  `setDropEnabled(false)`, then adds a body class that hides the editor's panels
  and handles. Panning and pinch zoom keep working because they do not consult
  the graph's enabled state. A tap on a cell is reported to the shell as
  `{event:'inklineCellTap', cells: [...]}` from the plugin, with the cell's
  `<object>` attributes, label, tooltip and links already extracted.

Because the mode is a state of the same frame, switching modes preserves scroll
position, zoom and page, which is an acceptance criterion in the brief.

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

- The core parses, validates, normalises and writes. The shell only formats and
  presents a `ValidationReport`.
- Saves are written by Rust to a temporary file in app storage, verified by
  re-parsing, then copied to the destination through `ContentResolver`
  (`docs/ANDROID.md` describes the atomic path).
- Autosave uses `{event:'autosave'}` payloads. The shell debounces them, stores
  them under app-private storage together with the document id, and offers them
  as crash recovery on the next launch. The editor's own autosave machinery is
  not used, because the file is the shell's responsibility.
- The `.graph` invariant is enforced on every write: root `<mxfile>` with an
  Inkline format version attribute, uncompressed `<mxGraphModel>` children, two
  space indentation, stable attribute order.

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

These are recorded rather than guessed. None of them blocks Phase 1.

1. **Keystore.** Release signing needs the four secrets from the brief. Phase 1
   ships an unsigned debug APK from CI; the signed path waits for the owner.
2. **Rust toolchain in this sandbox.** `static.rust-lang.org` and
   `sh.rustup.rs` are unreachable here, so `cargo` cannot be installed. Whether
   a toolchain can be fetched from a GitHub release asset instead is unverified.
   Until it is, Rust work is verified in CI only.
3. **Clipboard behaviour in the WebView.** draw.io uses a hidden `contentEditable`
   element for native clipboard handling, with `useInternalClipboard` as the
   fallback. Which one behaves on Android System WebView, and whether the
   system clipboard is reachable at all, has to be tested on a device.
4. **Stylus and palm rejection.** WebView exposes pointer events; whether
   `pointerType` survives on the owner's device, and whether palm rejection is
   worth code at all, is a device question.
5. **`templates/` (5.6 MB).** Kept for now so the editor's template dialog works.
   If the shell's own template flow replaces it, dropping the directory saves
   more than a tenth of the vendor payload. Decided in Phase 5.

## 11. References

Pinned tag, path relative to `src/main/webapp`:

| Topic | Location |
| --- | --- |
| Bootstrap and bundle loading | `js/bootstrap.js:359`, `js/bootstrap.js:408` |
| Embed message handler | `js/diagramly/EditorUi.js:31566` |
| Load action | `js/diagramly/EditorUi.js:32447` |
| Autosave event | `js/diagramly/EditorUi.js:33091` |
| Init event | `js/diagramly/EditorUi.js:33274` |
| Open link event | `js/diagramly/EditorUi.js:33286` |
| State envelope | `js/diagramly/EditorUi.js:30719` |
| Embed save override | `js/diagramly/Menus.js:3327` |
| Configure handshake | `js/diagramly/App.js:1621` |
| Plugin loading | `js/diagramly/App.js:1800`, `js/diagramly/Init.js:79` |
| Editor configuration | `js/diagramly/Editor.js:3112` |
| Compression default | `js/diagramly/Editor.js:3334` |
| Remote export default | `js/diagramly/Init.js:34` |
| Touch detection | `mxgraph/src/mxClient.js:187`, `js/grapheditor/Graph.js:1785` |
| Greek language file | `resources/dia_el.txt` |
