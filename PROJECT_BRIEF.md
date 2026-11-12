# Inkline: Project Brief

You are about to build **Inkline**, a professional graph and diagram editor for Android phones and tablets. The core is written in Rust. The editing engine is the open-source draw.io editor, embedded and wrapped in a native shell. Read this whole file before you touch anything. It is long on purpose.

---

## 0. Owner context

- The owner's GitHub username is **NexzaDev**. The repository is **NexzaDev/Inkline**, and its main branch is named **`dev`**. Use `dev` as the integration branch everywhere: workflow triggers, release configuration, documentation and badges.
- The owner works from an Android tablet, mostly through the GitHub web UI and Termux. Any step that needs the owner to act (creating secrets, uploading a keystore, installing an APK) must be written as short, numbered, copy-paste-friendly instructions with no desktop assumptions.
- The owner writes in Greek. Talk to the owner in Greek. Write all code, identifiers, commit messages and repository documentation in English.
- The owner wants this to look and behave like a product made by a senior team, not like generated output.

---

## 1. Mission

Build an Android app, with phone and tablet layouts, that gives the user everything the draw.io editor gives, in a touch-first native shell:

1. Full editing: shapes, images, rich text (bold, italic, size, color, lists, links), fill and stroke colors, gradients, shadows, containers and swimlanes, layers, multiple pages, and connectors that glue to cards so that everything stays connected when things move.
2. A **preview mode** (read-only, clean, pan and zoom, tap a card to see its information) and an **edit mode** (full editor).
3. A custom file format, **`.graph`**, that the user can save, share, download, and open in the app by tapping the file in any file manager, browser download, or chat app.
4. Code-level control: a code view for the underlying XML with live preview, plus import from other formats.
5. A custom launcher icon, custom in-app icons, a settings screen, and an animated loading screen.
6. A companion **AI authoring skill** so that coding agents and chat assistants can generate valid `.graph` files with connected cards, colors and every supported feature.
7. A GitHub Actions pipeline that builds and releases the APK.

Quality bar: production grade. No placeholder screens, no stubbed features, no dead code, no fake data presented as real.

---

## 2. Working agreement (read this twice)

You are trusted with this project. The scope is large, and that is fine, because it is built in phases and every phase has a clear finish line. You do not need to be perfect on the first try. You need to be honest, careful and steady.

- **Take the time to read first.** Reading the draw.io source properly is the most valuable thing you will do in the first hour. Nobody is rushing you.
- **Ambiguity is normal.** When something is unclear, choose the most reasonable option, write a short decision record in `docs/adr/`, and keep going. Ask the owner only when a wrong choice would be expensive to undo, and ask at most five questions at a time.
- **When you are stuck,** stop and write down what you know, what you do not know, and two hypotheses. Test the cheapest one first. Being stuck is information, not failure.
- **Mistakes are cheap if found early.** Run the build and the tests after every meaningful change. A failing test you found yourself is a good day.
- **Honest reporting beats impressive reporting.** If you could not verify something, say "not verified" and say why. If the environment cannot build Android, say so and rely on CI. Never claim a feature works because the code looks right.
- **Small, reviewable commits.** One logical change per commit, imperative mood, conventional commit prefixes (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `ci:`, `build:`).
- **Protect the owner's time.** Do not ask for things you can find out yourself. Do not narrate every step. Report at phase boundaries.

---

## 3. Roles you hold

Switch roles deliberately and say which one you are in when it matters for a decision.

| Role | Responsibility |
| --- | --- |
| Staff Rust engineer | Core library design, error handling, parsing, testing, API boundaries, dependency hygiene |
| Android platform engineer | Tauri mobile target, Kotlin plugin code, intent filters, Storage Access Framework, lifecycle, back navigation, signing |
| Web integration engineer | draw.io embed protocol, bridge between shell and editor, offline guarantees, performance in WebView |
| Product designer | Shell UI, tablet and phone layouts, icon, loading animation, motion, using the unslop skill |
| Technical writer | README, architecture docs, format specification, release instructions for the owner |
| QA and release engineer | Test strategy, CI, reproducible builds, versioning, signed releases |
| Security reviewer | Untrusted file handling, permissions, CSP, XML parsing safety, supply chain |

---

## 4. Non-negotiable standards

1. **No comments in code files.** Not `//`, not `///`, not `//!`, not `/* */`, not `#`, not `<!-- -->`, not TODO or FIXME markers. This applies to Rust, Kotlin, TypeScript, JavaScript, CSS, HTML, YAML, TOML and shell. Express intent with precise names, small functions and clear module boundaries. All explanation lives in Markdown files under `docs/` and in the README. Markdown files are the only place for prose.
2. **No AI slop, in code or in design.** No gratuitous abstractions, no copy-pasted boilerplate that does nothing, no unused dependencies, no "utils" dumping grounds, no emoji in UI or logs, no purple gradients, glows or glossy blobs, no marketing copy in the app.
3. **Rust discipline.** Edition 2021 or newer, `#![forbid(unsafe_code)]` in every crate that does not need FFI, `cargo fmt` clean, `cargo clippy --all-targets --all-features -- -D warnings` clean, typed errors with `thiserror`, no `unwrap` or `expect` outside tests, no panics on user input.
4. **TypeScript discipline.** `strict` mode with `noUncheckedIndexedAccess`, ESLint and Prettier configured and enforced in CI, no `any`.
5. **Kotlin discipline.** `ktlint` or `detekt` enforced in CI, no deprecated Android APIs where a supported replacement exists.
6. **Tests are part of the feature.** Core logic has unit tests. File parsing has property or fuzz-style tests. The format has golden-file tests. Android intent handling has instrumented or documented manual test steps.
7. **Offline first, privacy first.** The release APK must not declare the `INTERNET` permission. Verify with a test that blocks all network requests in the WebView and confirms the editor still loads and works.
8. **Reproducible.** A fresh clone plus documented prerequisites must build the same artifact in CI. Pin the draw.io version, pin toolchain versions, commit lockfiles.
9. **Accessibility.** Touch targets of at least 48dp, TalkBack labels on all shell controls, contrast ratios that meet WCAG AA, respect system font scale and reduced-motion settings.
10. **Documentation is a deliverable.** If a maintainer cannot understand a module from `docs/` and its names alone, the module is not finished.

---

## 5. Source material

### 5.1 draw.io (the editing engine)

- Main repository: https://github.com/jgraph/drawio
- The web application lives in `src/main/webapp/` in that repository. Entry point: `index.html`. Core editor code is under `js/`. Shape libraries are under `stencils/` and `shapes/`. Language files are under `resources/`. Icons and themes are under `images/` and `styles/`.
- The repository is too large to attach to this task. Clone it yourself:
  `git clone --depth 1 https://github.com/jgraph/drawio`
  Then pin the exact tag or commit you vendor and record it in `docs/adr/0001-vendor-drawio.md`.
- Study these before designing anything:
  - the embed mode and its JSON message protocol (documentation: https://www.drawio.com/doc/faq/embed-mode, implementation: search the source for `EmbedFile`, `proto=json`, `App.prototype.handleMessage`, and the `init`, `load`, `save`, `export`, `autosave`, `configure` events)
  - the viewer implementation (`GraphViewer`, lightbox mode) for the preview mode
  - the plugin mechanism (`Draw.loadPlugin`) for customizations that must not fork core files
  - the configuration mechanism (the `configure` message and `Editor.configure`) for custom libraries, colors, fonts and defaults
  - the touch and compact UI code paths (search for `mxClient.IS_TOUCH`, `ui=` themes, `Editor.isDarkMode`)
  - how the official desktop wrapper handles files and offline mode: https://github.com/jgraph/drawio-desktop
- If a zip of the draw.io repository is attached to your task, use it instead of cloning, and still record the version.

### 5.2 Other references

- Tauri 2: https://v2.tauri.app/ (mobile development and the guide to writing mobile plugins with Kotlin: https://v2.tauri.app/develop/plugins/develop-mobile/)
- JSON Canvas specification (for import and export): https://jsoncanvas.org/spec/1.0/
- Android file handling: intent filters, `ContentResolver`, Storage Access Framework, persistable URI permissions

### 5.3 The unslop design skill

The skill that governs all shell UI design is hosted in the owner's repository. Read every file before designing a screen.

- https://raw.githubusercontent.com/NexzaDev/Inkline/dev/skills/unslop/SKILL.md
- https://raw.githubusercontent.com/NexzaDev/Inkline/dev/skills/unslop/references/signs.md
- https://raw.githubusercontent.com/NexzaDev/Inkline/dev/skills/unslop/references/tokens.md
- https://raw.githubusercontent.com/NexzaDev/Inkline/dev/skills/unslop/references/visuals.md
- https://raw.githubusercontent.com/NexzaDev/Inkline/dev/skills/unslop/references/effects.md
- https://raw.githubusercontent.com/NexzaDev/Inkline/dev/skills/unslop/references/refs.md
- https://raw.githubusercontent.com/NexzaDev/Inkline/dev/skills/unslop/LICENSE

Notes on using it:

- The skill is written for auditing existing screens. Inkline has no screens yet, so skip the audit step and apply its **direction**, **spacing**, **color**, **icons**, **copy**, **type**, **layout**, **details**, **visuals** and **motion** passes while designing, then run its slop checklist (`signs.md`) against every finished screen.
- Ignore the story video, snapshot script and image-generation parts. Some images referenced by `refs.md` are not present. That is expected.
- The skill is licensed CC BY 4.0. Keep the author credit (Damir Sokolovsky, @heydamir) and a link to https://github.com/heydamir/unslop in `THIRD_PARTY_LICENSES.md` and in the About screen.
- Apply it to the shell UI only. Do not restyle the draw.io editor internals beyond theming through supported configuration.

---

## 6. Architecture (defaults; deviate only with a written ADR)

```
Android WebView host (Tauri 2)
├── Shell UI (TypeScript, Vite)          home, files, preview, settings, code view, loading
├── Editor frame (draw.io, vendored)     offline, embed mode, JSON protocol
│     └── inkline plugin (JavaScript)    touch tuning, tap-info, theming, custom libraries
├── Bridge (TypeScript)                  typed message layer between shell and editor frame
└── Rust core
      ├── graph-core                     .graph parsing, validation, serialization, conversion
      ├── tauri commands                 file operations, settings, recents, import, export
      └── mobile plugin (Kotlin + Rust)  open-with intents, Storage Access Framework, share
```

Decisions:

1. **Do not fork draw.io.** Vendor it unmodified in `web/editor/vendor/drawio/`, created by a script (`scripts/vendor-drawio.sh`) that clones the pinned version and removes what the app does not need (server code, Java sources, tests, cloud-storage integrations, analytics). Every customization goes through the embed protocol, the configuration message, the plugin mechanism, or CSS. A patch file is allowed only if there is no other way, and it must be documented and applied by the script.
2. **Rust owns the truth about files.** The core parses, validates, normalizes and writes `.graph` content. The web layer never decides whether a file is valid.
3. **graph-core is pure Rust** with no dependency on Tauri, so it compiles for desktop and powers the command-line tool used by the AI skill.
4. **Shell framework:** TypeScript with Vite and either Solid or Preact. Pick one, justify it in an ADR, and keep the shell small. No UI component library that dictates the look.
5. **Strict content security policy** on the shell. The editor frame is loaded from the app's own assets only. No remote scripts, fonts or images anywhere.
6. **Targets:** Android 8.0 (API 26) and up, `arm64-v8a` primary, `armeabi-v7a` and `x86_64` supported. Phone and tablet layouts, portrait and landscape, split-screen and foldables must work without layout breakage.
7. **Application ID:** `dev.nexza.inkline`.

---

## 7. Repository layout

```
Inkline/
├── PROJECT_BRIEF.md
├── README.md
├── LICENSE
├── NOTICE
├── THIRD_PARTY_LICENSES.md
├── Cargo.toml
├── rust-toolchain.toml
├── deny.toml
├── crates/
│   ├── graph-core/
│   └── graph-cli/                 binary name: graphctl
├── src-tauri/
├── plugins/
│   └── tauri-plugin-file-intents/ Rust crate with android/ Kotlin sources
├── web/
│   ├── shell/
│   └── editor/
│       ├── vendor/drawio/
│       ├── plugin/
│       └── bridge/
├── skills/
│   ├── unslop/                    provided by the owner, do not edit
│   └── graph-authoring/           you write this
├── design/
│   ├── icon/                      source SVGs and generation script
│   └── motion/                    loading animation source
├── scripts/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── GRAPH_FORMAT.md
│   ├── ANDROID.md
│   ├── RELEASING.md
│   ├── DESIGN.md
│   └── adr/
└── .github/workflows/
```

---

## 8. The `.graph` format

Goals: lossless with draw.io, trivially writable by humans and AI, diff-friendly in git, safe to open from untrusted sources.

Default design (document the final version in `docs/GRAPH_FORMAT.md`, and justify any change in an ADR):

- A `.graph` file is a **UTF-8 XML document** whose root is the draw.io `<mxfile>` element, with `<diagram>` children holding uncompressed `<mxGraphModel>` content. This keeps a file openable in any draw.io-compatible tool after renaming, and keeps every draw.io feature available.
- Inkline adds a format version marker on the root element. The Rust core adds and preserves it on every write, because the editor will not preserve unknown attributes by itself.
- Images are embedded inside the file as data URIs so one file is one portable artifact. The core enforces size limits per image and per file.
- Rich cards use HTML labels. Card metadata (tooltips, links, custom properties) uses the standard `<object>` wrapper with attributes so that it survives round trips.
- MIME type: `application/vnd.nexza.inkline+xml`.
- Reject on open: any `DOCTYPE`, external entities, files above the configured size limit, malformed structure, duplicate cell ids, edges whose `source` or `target` point to a missing cell. Report a precise, human-readable reason in the UI.
- Normalization on save: stable attribute order, two-space indentation, deterministic ids preserved, so version-control diffs stay small.

`graph-core` must expose, with tests for each:

- `parse`, `validate`, `serialize`, `normalize`
- `from_drawio`, `to_drawio`
- `from_json_canvas`, `to_json_canvas` (Obsidian canvas interoperability: nodes become cards, edges become connectors, colors map to the nearest palette entry)
- `from_mermaid_flowchart` is optional in the core. If Mermaid import is done in the web layer instead, document why.
- `ValidationReport` with severity, cell id and message for every finding

`graph-cli` (`graphctl`) exposes `validate`, `format`, `convert`, and `inspect`. It prints machine-readable JSON with `--json`. It exists so the AI skill can validate its own output.

---

## 9. Features

### 9.1 Editor (edit mode)

- All draw.io capabilities available in the embedded editor stay available. Do not remove capabilities. You may reorganize presentation for touch.
- Touch tuning: large hit areas for connection points and handles, two-finger pan and pinch zoom, long-press context menus, no hover-only features, an on-screen toolbar that adapts to phone and tablet, stylus support with palm rejection where the WebView allows.
- Connectors: glue to cards, waypoints, curved, orthogonal and straight styles, arrowheads, line colors, dashed and dotted styles, labels on lines. Moving a card keeps connected lines attached.
- Cards: fill, stroke, gradient, shadow, rounded corners, opacity, rich text, images as card or as background, containers, swimlanes, collapsible groups.
- Custom shape libraries and custom icons: ship an Inkline library with a curated set (network, security, flow, architecture, bot and service icons), loaded through configuration, plus the ability to import user libraries from a file.
- Undo and redo, multiple pages, layers, search, grid and snapping, rulers where useful.
- Autosave to private app storage, and crash recovery that offers the last autosave on next launch.

### 9.2 Preview mode (read-only)

- Clean canvas with pan and zoom, no editing chrome, a single tap on the toolbar switches to edit mode.
- **Tap a card to open an information sheet**: a bottom sheet on phones, a side panel on tablets. It shows the card's title, tooltip text, custom properties (from its `<object>` attributes) and links. Links to other pages of the same file navigate within the file. External links ask for confirmation and open in the system browser.
- Fit-to-screen, page switcher, and layer visibility toggles.
- Verify in the draw.io source whether the viewer, the lightbox mode or a read-only embed configuration gives the best fidelity, and record the choice in an ADR.

### 9.3 Code view and import

- **Code view:** a built-in editor for the `.graph` XML with syntax highlighting, error markers from `graph-core` validation, and a live preview that updates as the user edits. A bad edit never destroys the open document: invalid text is held in the editor until it validates.
- **Import:** `.graph`, `.drawio`, `.xml`, JSON Canvas (`.canvas`), Mermaid text, CSV in the draw.io CSV-to-diagram format, and pasted XML. Mermaid, if supported, is bundled locally. Every import shows a preview and a summary before it is committed.
- **Export:** `.graph`, `.drawio`, SVG, PNG, PDF, JSON Canvas, and a "share as image". Exports go through the system share sheet and the Storage Access Framework.

### 9.4 Files and navigation

- Home screen with recent files (thumbnail, title, modified time), a create button with templates, and an open button.
- Tapping a `.graph` file anywhere on the device opens it in Inkline. Details in section 10.
- Rename, duplicate, delete, share, and "save a copy".
- Back button and gesture navigation behave correctly in every state, including from the editor with unsaved changes.

### 9.5 Settings

Theme (system, white light, OLED dark) and accent color (red, blue, purple), default open mode (preview or edit), grid defaults, autosave interval, default export scale, language (English and Greek at launch, structure ready for more, using the draw.io language files for the editor), stylus behavior, haptics, reduced motion override, clear recents, storage usage, and an About screen with licenses.

### 9.6 Quality of life

Keep the screen awake while editing, restore the viewport and selection on reopen, handle process death gracefully, handle low memory by saving first.

---

## 10. Android integration

The standard Tauri template does not handle file-open intents by itself. Build a proper mobile plugin (`plugins/tauri-plugin-file-intents`) with Kotlin and Rust parts.

Requirements:

1. **Intent filters** in the generated Android manifest (managed by a script or Tauri configuration so regeneration does not lose them) for `ACTION_VIEW` and `ACTION_SEND` with `content://` and `file://` schemes. Android cannot reliably associate custom extensions, so register several filters: the custom MIME type, `application/octet-stream`, `text/xml`, `application/xml`, and a `pathPattern` filter for names ending in `.graph` with a wildcard MIME type. Document, in `docs/ANDROID.md`, which file managers and browsers were verified and which behave differently.
2. **Content URIs.** Read and write through `ContentResolver`. Take persistable URI permissions when offered. Write safely: write to a temporary file in app storage, verify it, then copy to the destination, so an interrupted write cannot corrupt the user's file.
3. **Cold start and warm start.** Opening a file while the app is closed, in the background, and in the foreground must all route the file to the correct screen. Handle `onNewIntent`.
4. **Share target:** receive `.graph`, `.drawio` and image files shared to the app.
5. **Open and save pickers** through the Storage Access Framework, with a default folder in app-accessible storage.
6. **Permissions:** request nothing that is not needed. No `INTERNET`, no broad storage permissions.
7. **Back handling, edge-to-edge display, display cutouts, keyboard insets and system bars** handled correctly.
8. **WebView:** document the minimum Android System WebView version, detect an outdated WebView at startup, and show a clear message with instructions instead of a blank screen.

---

## 11. Shell design

Use the unslop skill for direction and craft. The brief:

- **Character:** precise, quiet, tool-like. The product is a drawing instrument for technical people, so the interface behaves like good drafting equipment: restrained neutrals, one accent color, exact spacing, and richness reserved for the user's own diagrams.
- **Theme:** two base themes. **OLED dark** uses a true black (`#000000`) app background with near-black raised surfaces, so pixels are off on OLED screens. **White** is a clean white light theme. The user also picks one accent from **red, blue or purple** in Settings, and exactly one accent is active at a time. Accents are flat solid colors with tuned light and dark variants that meet WCAG AA contrast. No gradients, glows or glass effects on any accent, including purple. Define the tokens once and use them everywhere, and make the diagram canvas follow the same base theme.
- **Type and spacing:** a single type scale, an 4dp spacing grid, consistent radii. Tablet layouts use a persistent side navigation and a two-pane files view. Phone layouts use bottom navigation and sheets.
- **Icons:** one coherent custom icon set in a single stroke weight, drawn as SVG sources under `design/`, built into a sprite. No mixed icon families.
- **Copy:** short, specific, sentence case, no exclamation marks, no emoji.
- **Empty states, error states and loading states** are designed, not defaults.

### 11.1 Launcher icon

Design a custom adaptive icon: foreground, background, and a monochrome layer for themed icons. Direction: a pen nib finishing a line that connects two nodes, reduced to a mark that reads at 48dp. Keep the source in `design/icon/` as SVG and generate every density with a script (the Tauri icon generator is acceptable). Also supply a Play-style 512px version and a monochrome notification-sized glyph.

### 11.2 Loading animation

Show an animated loading screen from the earliest possible moment until the editor reports ready.

- **Concept:** a pen draws a line. The nib travels along a smooth curve, leaving a stroke behind it. The curve links two small rounded cards, and when the line closes the connection the cards settle with a short, subtle motion, then the loop restarts gently. If you find a stronger idea that fits the product, document it in `docs/DESIGN.md` and use it.
- **Implementation:** SVG with stroke-dashoffset for the trail and path-following motion for the nib, driven by CSS or the Web Animations API. Animate compositor-friendly properties only. Target 60fps on mid-range hardware.
- **Handoff:** use the Android 12+ system splash with the static icon, then hand off to the animated screen without a visible jump. Provide a fallback for older versions.
- **Behavior:** the screen never blocks on a fixed timer. It disappears as soon as the editor sends its ready event. If the editor is not ready after a reasonable timeout, show an error state with a retry action and a diagnostics copy button.
- **Accessibility:** honor reduced-motion by showing a calm static or minimal fade version.

---

## 12. The AI authoring skill

Create `skills/graph-authoring/` in the same layout as the unslop skill (`SKILL.md` with frontmatter, `references/`, `scripts/`, optional `agents/openai.yaml`) so it installs in Claude Code, Codex and Google Antigravity the same way.

Purpose: let an AI generate a correct, good-looking `.graph` file from a description, with every card connected as intended.

Contents:

- `SKILL.md`: when to use the skill, the working method (plan the structure, choose a layout, write cells, connect, color, validate, fix), the rules that prevent broken output (every id unique, every edge has `source` and `target` that exist, every cell has a valid `parent`, geometry always present, grid-aligned coordinates, no overlapping cards, readable label sizes), and a final checklist.
- `references/graph-format.md`: the file structure with complete minimal examples.
- `references/styles.md`: the style keys that matter (fill, stroke, rounded, gradient, shadow, font properties, edge style, arrows, dashed, waypoints, containers, swimlanes, images, labels, HTML labels, links, tooltips, custom properties), each with a working snippet.
- `references/palette.md`: the Inkline palette with named roles (neutral, accent, success, warning, danger, info) for white and OLED dark diagrams, including the red, blue and purple accent variants, and rules for using color to carry meaning rather than decoration.
- `references/layouts.md`: spacing rules and proven patterns for flowcharts, architecture diagrams, network maps, scan or analysis pipelines, mind maps, timelines and swimlanes, with coordinate recipes.
- `examples/*.graph`: at least six complete, validated examples, including an image-bearing card and a card with tooltip, link and custom properties.
- `scripts/validate.sh`: wraps `graphctl validate --json`. Release CI publishes `graphctl` binaries for Linux, macOS and Windows so the skill can fetch them.

The skill must state that the AI should run validation and fix every reported error before presenting a file.

---

## 13. Continuous integration and release

Write workflows with no comments, pinned action versions (by commit SHA where practical), least-privilege permissions and caching.

`ci.yml` on every push and pull request:

1. Rust: `fmt --check`, `clippy -D warnings`, `test --workspace`, `cargo deny check`
2. Web: install with lockfile, typecheck, lint, unit tests, build
3. Format: golden-file tests for `.graph`
4. Android: set up JDK 17, Android SDK and NDK, Rust Android targets, build a debug APK, upload it as an artifact
5. Offline test: the network-blocked editor load test

`release.yml` on tags matching `v*`:

1. Build signed release APKs (per-ABI and universal) and an AAB
2. Compute SHA-256 checksums
3. Build `graphctl` for Linux, macOS and Windows
4. Create a GitHub Release with generated notes and all artifacts

Signing uses repository secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Write `docs/RELEASING.md` with step-by-step instructions the owner can follow from an Android tablet: generating a keystore in Termux with `keytool`, converting it to base64, adding the secrets in the GitHub web UI, and tagging a release from the web UI. Include what happens if the owner has no keystore yet (an unsigned debug build for testing).

Set an APK size budget (arm64 under 60 MB) and make CI report the size on every build.

---

## 14. Testing and verification

- `graph-core`: unit tests, golden files, and fuzz or property tests for the parser and validator, including hostile inputs (huge files, deep nesting, entity tricks, invalid UTF-8, missing references).
- Bridge: protocol tests against a mock editor frame.
- Editor: a smoke test that loads the vendored editor, loads a `.graph`, edits it programmatically, saves, and compares output.
- Android: a manual test matrix in `docs/ANDROID.md` (cold open, warm open, share target, rotation, split-screen, process death, low memory, outdated WebView) and instrumented tests where feasible.
- Before reporting any phase complete, state exactly which commands you ran and their results.

---

## 15. Phases

Complete the phases in order. Each ends with a short report to the owner in Greek: what was done, what was verified, what was not, what comes next. Do not start the next phase before the current one meets its acceptance criteria.

**Phase 0: Reconnaissance.** Read this file, the unslop skill, and the draw.io source. Produce `docs/ARCHITECTURE.md` and the first ADRs. Report what you learned about the embed protocol, the viewer, the plugin mechanism and the build state of `src/main/webapp` (confirm whether minified bundles are committed or must be built). List open questions.
*Accept:* architecture and ADRs written; the plan names the exact draw.io version.

**Phase 1: Skeleton and pipeline.** Workspace, Tauri 2 project with Android target, lint and format configs, CI building a debug APK that launches to a placeholder shell.
*Accept:* CI green; the APK installs and starts.

**Phase 2: Embedded editor.** Vendoring script, offline editor in the WebView, bridge with typed messages, load and save round trip, no network access.
*Accept:* a diagram can be created, edited and saved; the offline test passes.

**Phase 3: `.graph` and files.** `graph-core`, `graphctl`, golden tests, file commands, SAF integration, autosave and recovery, the file-intents plugin with all intent paths.
*Accept:* tapping a `.graph` file in a file manager opens it correctly in cold and warm start; hostile-file tests pass.

**Phase 4: Modes and info.** Preview mode, edit mode, the information sheet on card tap, page and layer controls.
*Accept:* tapping any card in preview shows its information; switching modes preserves position and zoom.

**Phase 5: Shell and identity.** Home, files, settings, icon set, launcher icon, loading animation, phone and tablet layouts, light and dark themes, Greek and English.
*Accept:* every screen passes the unslop checklist; the loading animation hands off cleanly from the system splash.

**Phase 6: Code view, import, export.** Code view with live preview, all import and export paths, JSON Canvas conversion, custom libraries.
*Accept:* round trip tests for every format; imports show a preview before committing.

**Phase 7: AI authoring skill and documentation.** Complete `skills/graph-authoring/`, finish all docs, write the README with install and usage instructions.
*Accept:* an AI following only the skill produces a `.graph` that passes `graphctl validate` and opens in the app, tested with at least three different prompts and the results recorded.

**Phase 8: Hardening and release.** Performance pass, accessibility pass, security review, size budget, release workflow, first signed release candidate.
*Accept:* CI green on a tag; release artifacts attached; `docs/RELEASING.md` verified end to end.

---

## 16. Licensing

- The draw.io editor is Apache License 2.0. Keep its license and NOTICE text, record the vendored version and any applied patches, and do not present Inkline as an official draw.io or diagrams.net product. Do not use the draw.io or diagrams.net names or logos as the app's own branding.
- Do not copy code from the VS Code draw.io extension (`hediet/vscode-drawio`). It is GPL-3.0 and would impose its license on this project.
- Inkline's own code is licensed under Apache License 2.0 unless the owner says otherwise.
- Every dependency must be license-checked with `cargo deny` and an equivalent web check. List all third-party licenses in `THIRD_PARTY_LICENSES.md`.
- The unslop skill is CC BY 4.0. Keep attribution as described in section 5.3.

---

## 17. Your first response

Before writing code, reply in Greek with:

1. Confirmation that you read this file and the unslop files, and that you have the draw.io source.
2. A one-paragraph summary of how you will integrate draw.io, including anything in the source that contradicts the assumptions in this document.
3. The draw.io version you will pin.
4. Up to five questions for the owner, only if they are blocking.
5. The first three concrete steps you will take.

Then start Phase 0.

---

## 18. Definition of done

The project is done when a person can install the APK on a phone or tablet, open the app, see the animated loading screen, create a diagram with images, colored cards and connected lines, switch between preview and edit modes, tap a card in preview to read its information, save a `.graph` file, send it to someone, and have that person open it by tapping it. An AI that has only read `skills/graph-authoring/` can produce a valid, attractive `.graph` file. CI builds and releases everything. The code contains no comments, no dead code, no unexplained dependencies, and nothing that looks generated.
