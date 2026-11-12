# 0005 Offline and network posture

- Status: accepted
- Date: 2026-11-12
- Deciders: Inkline maintainers
- Related: `docs/ARCHITECTURE.md` sections 1, 7 and 9

## Context

The release APK must not declare `INTERNET`, and CI must prove that the editor
still loads and works when every network request is blocked. draw.io is a web
application that assumes it can reach its own services: remote export, icon
search, notifications, AI generation, real-time collaboration, Google Drive and
friends, and a default font list that points at Google Fonts.

Blocking the permission is necessary but not sufficient. A blocked request that
happens on a code path the user can reach produces a hanging spinner or a
console error where a feature should be.

## Decision

**No network capability in the release build, and every remote default is
switched off at the source rather than left to fail.**

1. **Manifest.** No `INTERNET`, no `ACCESS_NETWORK_STATE`, no broad storage
   permissions. The Android plugin passes content through `ContentResolver`
   URIs, which needs no permission.
2. **WebView request policy.** The Tauri WebView layer answers every request that
   is not an app asset with a synthetic failure, and logs it in debug builds.
   This is the safety net, not the primary control.
3. **Remote defaults disabled in `PreConfig.js`:** `EXPORT_URL = null` (PDF
   export then uses the platform print path instead of
   `convert.diagrams.net`), `DRAWIO_VIEWER_URL = null`, `ICONSEARCH_PATH = null`,
   `ICON_SERVICE_PATH = null`, `NOTIFICATIONS_URL = null`, service worker
   disabled, `REALTIME_URL` never contacted because real-time is not enabled in
   embed mode.
4. **Remote defaults disabled in `DRAWIO_CONFIG`:** `defaultFonts` and
   `customFonts` restricted to font families present on Android,
   `enableLocalFonts: true`, no `mermaid` or AI URL, no `enableCustomGitLabUrl`.
   `libraries` limited to vendored libraries so the sidebar cannot request a
   remote library descriptor.
5. **Unreachable features removed from the UI, not left to fail.** The plugin
   removes the menu entries for Google Drive, OneDrive, GitHub, GitLab, Trello,
   Dropbox and AI generation. Users do not see a button that cannot work.
6. **Collaboration is off by default and not exposed.** `fast-sync` and
   `embedRT` stay unset.

## Verification

CI runs three checks on the vendored editor, all headless:

1. **Load test.** With every request outside the app asset scheme blocked, the
   frame reaches `init`, accepts a `load`, and reports a `load` response with
   non-zero bounds.
2. **Edit and save test.** Insert a vertex, an edge and a label through
   `invokeAction` and a scripted model change, then `save`, and compare the
   returned XML against the expected document with the ids normalised.
3. **No-request test.** After the two tests, the request log is asserted empty.
   Any component that tries to reach the network fails the build with the URL in
   the message, which is what makes this a real guarantee rather than a promise.

Manual confirmation on a device: enable airplane mode, open the app, create a
diagram, save, export to PNG and share. This is part of the Android test matrix
in `docs/ANDROID.md`.

## Consequences

- Remote export of PDF is not available; PDF goes through Android's print
  service, which is also how the app can produce a PDF without network.
- Google Fonts are not available in the editor. The font list is the set Android
  ships plus any local fonts the user's device provides. Documents authored on
  the desktop with a Google font will render with the metric-compatible
  substitute that `mxGraph` picks, and the font name is preserved in the file.
- The icon search service is gone; Inkline ships its own icon library, and the
  sidebar's search only searches local libraries.
- Any future feature that needs the network (sync, sharing links, AI) requires a
  separate build flavour and a new ADR. It will not be added behind a hidden flag
  in the offline build.
