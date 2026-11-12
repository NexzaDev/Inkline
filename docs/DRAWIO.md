# The vendored editor

Inkline does not fork draw.io. It ships draw.io's own web application, unmodified
except for two deployment hook files, under `web/editor/vendor/drawio/`.

## What is pinned

| Field | Value |
| --- | --- |
| Repository | `https://github.com/jgraph/drawio` |
| Tag | `v32.6.10` |
| Commit | `c72c9a98b7a6ce392556ed04c05e0ff19f43f5c3` |
| Released | 2026-11-04 |
| Source path | `src/main/webapp` |
| Vendored files | 2674 |
| Vendored size | 55 MB |

The tag and the commit are both pinned. A tag can be moved; a commit cannot, so
the script clones the tag and then refuses to continue unless the commit it
checked out is the one written in the script.

## What is kept

`index.html`, `favicon.ico`, `export-fonts.css`, `shortcuts.svg`, `styles/`,
`stencils/`, `shapes/`, `img/`, `images/`, `templates/`, `math4/`, the English
and Greek interface strings in `resources/`, the minified bundles
(`app.min.js`, `extensions.min.js`, `stencils.min.js`, `shapes-14-6-5.min.js`,
`orgchart.min.js`), the loader (`bootstrap.js`, `main.js`), the client-side
export helpers, and the lazily loaded format and layout modules under `js/`:
`plantuml`, `mermaid`, `elk`, `gliffy`, `orgchart`, `libavoid-js`, `jszip`.

## What is dropped

Server-side resources (`WEB-INF/`, `META-INF/`, `connect/`), the integrations
that only exist to talk to hosted services (`integrate.min.js`, `viewer.min.js`,
`viewer-static.min.js`, `onedrive3.html`, `teams.html`, `js/onedrive/`,
`js/simplepeer/`, `js/vsd/`), the service worker, every unminified editor source
(`js/grapheditor/`, `js/diagramly/`, `js/cryptojs/`, `js/deflate/`, `js/spin/`,
`js/sanitizer/`, `js/freehand/`, `js/rough/`, `mxgraph/`), and every interface
language except English and Greek.

The script scans each shipped bundle for `js/...js` paths. If a bundle names a
file that exists upstream but is not copied, the run fails and names the file and
the bundle that loads it. The skip list in the script is the record of the
references that are dropped on purpose, so a new upstream dependency cannot slip
through silently.

## The two hook files

`js/PreConfig.js` and `js/PostConfig.js` are draw.io's own deployment hooks.
They are loaded only when the page does not run on a `*.draw.io` or
`*.diagrams.net` host, which is exactly Inkline's case, and draw.io's own desktop
build uses them the same way. Keeping the changes inside these two files means
every other vendored file is byte-identical to the tag.

`web/editor/hooks/PreConfig.js` sets the public build flag, nulls the export,
viewer, lightbox and base URLs so nothing looks for a server, keeps the local
math typesetting path, allows plugins, and sets `sync=manual` so the editor never
opens a connection to a storage backend behind Inkline's back.

`web/editor/hooks/PostConfig.js` keeps upstream's nulling of the icon search and
icon service endpoints.

The script writes the difference between upstream and these files to
`web/editor/vendor/drawio/INKLINE-HOOKS.patch`, which ships with the tree. That
patch is the record of modification required when Apache-2.0 code is changed, and
it is also why the two files carry no header of their own: the project's rule is
that code files hold no comments, so attribution lives here, in the patch, in
`VERSION`, in `COMMIT` and in the vendored `LICENSE`.

## The manifest

`web/editor/vendor/manifest.json` holds the SHA-256 of every vendored file. The
check mode recomputes them and fails on a changed, missing or extra file, so a
hand edit of the vendored tree cannot go unnoticed. The check needs no network
and runs in CI.

## Updating draw.io

1. Read the upstream change log for the versions between the pinned one and the
   new one.
2. Change `DRAWIO_VERSION` and `DRAWIO_COMMIT` in `scripts/vendor-drawio.sh` and
   in `docs/adr/0001-vendor-drawio.md`.
3. Run `scripts/vendor-drawio.sh`. A missing file in the new release, or a new
   lazy dependency, fails the run and names itself.
4. Run the editor smoke test and the offline test, then commit the tree, the
   manifest and the patch together with the version bump.

## Licensing

draw.io is Apache-2.0. The vendored `LICENSE` ships with the tree and with the
app, the version and commit are in `VERSION` and `COMMIT`, the modifications are
in `INKLINE-HOOKS.patch`, and Inkline never presents itself as draw.io or
diagrams.net: the launcher, the title and the about screen are Inkline's.
