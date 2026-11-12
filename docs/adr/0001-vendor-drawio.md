# 0001 Vendoring draw.io

- Status: accepted
- Date: 2026-11-12
- Deciders: Inkline maintainers
- Related: `docs/ARCHITECTURE.md` sections 3, 4 and 9

## Context

Inkline embeds the draw.io editor instead of writing a diagram engine. The
editor must work offline, must not be forked, and must stay updateable by
changing one pinned version and re-running one script.

The project brief fixes most of this: vendor under
`web/editor/vendor/drawio/`, produce the tree with `scripts/vendor-drawio.sh`,
keep the licence and NOTICE, and allow patches only when nothing else works.

The repository is large, so the checklist below has to be mechanical rather than
manual, or a later update will silently drop a file the editor loads lazily.

## Decision

**Pin tag `v32.6.10`, commit `c72c9a98b7a6ce392556ed04c05e0ff19f43f5c3`,
released 2026-11-04.** Vendor `src/main/webapp` from that commit, unmodified
except for the two deployment hook files described below.

The vendoring script, in Phase 2, will:

1. `git clone --depth 1 --branch v32.6.10 https://github.com/jgraph/drawio` into
   a temporary directory, and verify the commit hash above before copying
   anything.
2. Copy an explicit allowlist of paths into `web/editor/vendor/drawio/`.
3. Write `VERSION`, `COMMIT`, `LICENSE` and `NOTICE` copies plus a manifest of
   every vendored file with its SHA-256, so drift is detectable.
4. Fail if any file the production loaders reference is missing. The reference
   set is extracted from `app.min.js`, `bootstrap.js`, `stencils.min.js`,
   `shapes-14-6-5.min.js` and `extensions.min.js` by scanning for
   `js/**/*.js` literals, which is how the lazy dependencies in section
   "Allowlist" below were discovered.

### Allowlist

Kept, because the production editor loads them:

- `index.html`, `favicon.ico`, `styles/`
- `js/bootstrap.js`, `js/main.js`, `js/PreConfig.js`, `js/PostConfig.js`
- `js/app.min.js` (11 MB, contains mxGraph, the app and the editor)
- `js/extensions.min.js` (4.5 MB, lazily loaded for Visio, GraphML, Gliffy,
  ELK layout and Mermaid)
- `js/stencils.min.js`, `js/shapes-14-6-5.min.js`, `shapes/`
- `js/plantuml/`, `js/mermaid/`, `js/elk/`, `js/gliffy/`, `js/orgchart*`,
  `js/libavoid-js/`, `js/jszip/`
- `img/`, `images/` (toolbar and dialog artwork; 18.5 MB of SVG and PNG)
- `resources/dia.txt`, `resources/dia_el.txt`
- `math4/` (math typesetting)
- `templates/` (template gallery; see open question 5 in ARCHITECTURE.md)

Dropped: `WEB-INF/`, `META-INF/`, `connect/`, `integrate.min.js`,
`viewer.min.js`, `viewer-static.min.js`, `embed-static.min.js`, the Java and
server sources outside `webapp`, `service-worker.js`, `workbox-*.js`,
`teams.html`, `open.html`, `clear.html`, `export3.html`, `onedrive3.html`,
`vsdxImporter.html`, `js/onedrive/`, `js/simplepeer/`, `js/jquery/`,
`js/vsd/`, `js/vsdxImporter.js`, all unminified editor sources
(`js/grapheditor/`, `js/diagramly/`, `js/cryptojs/`, `js/deflate/`, `js/spin/`,
`js/sanitizer/`, `js/freehand/`, `js/rough/`), `mxgraph/`, and every language
file except English and Greek.

Measured candidate tree: **51 MB raw, 21 MB gzipped**. The arm64 APK budget is
60 MB, and assets are compressed in the APK.

### The two hook files

`js/PreConfig.js` and `js/PostConfig.js` are drawio's own deployment hooks: they
exist to be edited per deployment, are loaded exactly for hosts that are not
`*.draw.io` or `*.diagrams.net` (`js/bootstrap.js:408`), and drawio-desktop uses
them the same way. Inkline changes only these two files:

- `PreConfig.js`: sets `DRAWIO_CONFIG`, `ALLOW_CUSTOM_PLUGINS = true`,
  `PLUGINS_BASE_PATH`, nulls `EXPORT_URL`, `DRAWIO_VIEWER_URL`,
  `ICONSEARCH_PATH`, `ICON_SERVICE_PATH`, `NOTIFICATIONS_URL`, and disables the
  service worker. Without these, the editor would try to reach
  `convert.diagrams.net`, `viewer.diagrams.net` and the icon search service.
- `PostConfig.js`: keeps the upstream nulling of `ICONSEARCH_PATH` and
  `ICON_SERVICE_PATH`, and adds nothing else today.

The script writes both files from templates it owns and keeps a diff against
upstream in `web/editor/vendor/drawio/INKLINE-HOOKS.patch`, so an update shows
exactly what the project changed.

### Rejected alternatives

- **Building the bundles from source.** Unnecessary: the bundles are committed
  and identical to what upstream ships. Building would add a JDK, Ant and a
  Closure Compiler step to CI for no behavioural gain, and would make the
  vendored tree unverifiable against the tag.
- **Using `js/viewer.min.js` for preview mode.** Rejected in ADR 0004.
- **Keeping unminified sources for debuggability.** 40 MB of dead weight in the
  APK. If a source-level investigation is needed, the pinned clone has it.
- **A `?dev=1`-style build in the app.** Dev mode loads hundreds of individual
  files and is not representative of production behaviour.

## Consequences

- Updating draw.io is: bump the tag and commit in the script and in this ADR,
  run the script, run the editor smoke test, run the offline test, commit.
- Any file that the editor loads lazily but the allowlist misses fails only when
  a user opens the specific dialog. The reference-scan step and the smoke tests
  are the guards against that.
- The vendor tree is 51 MB of the repository. It is committed because the build
  must be reproducible without network access during CI, and because a checked
  out tree is what reviewers can compare against the tag. CI still re-runs the
  script in check mode and fails on any difference.
- Apache 2.0 obligations: `LICENSE`, `NOTICE`, the pinned version and the record
  of modified files ship with the app, and Inkline never presents itself as
  draw.io or diagrams.net.
