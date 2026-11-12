# 0003 Where editor customisation is allowed

- Status: accepted
- Date: 2026-11-12
- Deciders: Inkline maintainers
- Related: `docs/ARCHITECTURE.md` sections 4 and 9, `docs/adr/0001-vendor-drawio.md`

## Context

The brief forbids forking draw.io and lists the allowed channels: the embed
protocol, the configuration message, the plugin mechanism, and CSS. It also
allows a documented patch "only if there is no other way", applied by the
vendoring script.

Inkline needs to do more with the editor than the protocol exposes out of the
box: touch tuning, tap-to-inspect in preview mode, an Inkline shape library, a
theme that matches the shell, Greek labels for a handful of editor actions, and
suppression of remote services.

## Decision

Customisation happens in this order, and a later channel is used only when the
earlier one cannot express the change:

1. **URL parameters and the load message.** Visibility of buttons, language,
   theme, initial view, autosave, zoom events.
2. **Configuration** given as `window.DRAWIO_CONFIG` in `PreConfig.js`.
   `customCss`, `resources`, `defaultColors`, `defaultFonts`,
   `enableLocalFonts`, `customLibraries`, `appendCustomLibraries`, `compressXml`,
   `preserveViewState`, `suppressNewWindows`, `noResizers`, `zoomWheel`,
   `enableCssDarkMode`. This channel covers theming, palette, fonts, libraries
   and localisation strings.
3. **The plugin** at `web/editor/plugin/inkline-plugin.js`, loaded with `?p=`,
   registering its actions through `Draw.loadPlugin`. It adds the touch tuning,
   the preview-mode actions, the cell-tap reporting, and any behaviour that needs
   access to `EditorUi`, `mxGraph` or the model. It never monkey-patches core
   prototypes beyond what a documented configuration key would do.
4. **The hook files** `PreConfig.js` and `PostConfig.js`, which are the only
   vendored files Inkline edits. They carry the globals that must exist before
   `app.min.js` runs and that no configuration key exposes: `DRAWIO_CONFIG`
   itself, `ALLOW_CUSTOM_PLUGINS`, `PLUGINS_BASE_PATH`, the nulled service URLs.
5. **A patch file**, applied by the vendoring script and recorded in the vendor
   directory. Currently empty.

Shell-to-frame communication stays inside the documented protocol. Where the
protocol has no message for something, the plugin registers an editor action and
the shell calls it with `{action:'invokeAction'}`; this keeps one typed bridge on
the shell side instead of two.

## Consequences

- The list of things that can break on a draw.io update is short: the hook file
  contents, the plugin API surface it uses, the action names it invokes, and the
  protocol messages. The editor smoke test in CI exercises all four.
- Anything that would require touching `js/grapheditor` or `js/diagramly` is
  treated as a design error and first attempted through the plugin.
- If a patch ever becomes necessary, it is generated as a git-format diff
  against the pinned tag, applied by `scripts/vendor-drawio.sh`, listed in
  `docs/adr/0001-vendor-drawio.md`, and covered by a regression test.
- The plugin is the only place that knows drawio internals. The shell bridge
  knows only the protocol, so the shell stays testable against a mock frame.
