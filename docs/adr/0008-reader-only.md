# 0008 Inkline renders documents, it does not edit them

- Status: accepted
- Date: 2026-11-12
- Deciders: Inkline owner, Inkline maintainers
- Related: `docs/adr/0004-preview-mode.md`, `PROJECT_BRIEF.md` phases 2 to 8

## Context

The brief builds an editor: the owner draws on the canvas, the shell saves the
document, and later phases add files, layers and an authoring skill.

After the first working build the owner used it on the tablet and rejected that
model. Typing into a shape needs a double tap, the keyboard resizes the viewport,
the canvas re-centres, and the shape moves while being edited. Touch editing in a
desktop-first editor is slow enough that the owner decided diagrams will be
produced as documents by code instead, and the app should show them.

That is a change of product, not a change of bug, so it is recorded here instead
of being folded into the previous decisions.

## Decision

**Inkline is a reader for `.graph` documents. It renders a document, and it does
not offer a way to change it.**

The consequences, point by point:

1. **The editor runs in its own read-only mode.** `chrome=0` sets the chromeless
   view, and the constructor derives `editable` from it (`this.editable = null !=
   e ? e : !a`, `js/diagramly/EditorUi.js`): chromeless means not editable. There
   is no toolbar, no menu, no format panel, no text editing, and no autosave.
   Panning, pinch zoom, links and tooltips stay.
2. **draw.io stays vendored and unmodified.** The switch is one query parameter,
   not a patch, so the vendoring guarantee from ADR 0001 holds.
3. **Documents come from files.** The shell opens `.graph` files and renders
   them. Nothing is written back, so autosave, recovery and conflict handling
   leave the plan.
4. **Authoring moves out of the app.** Documents are written by code: the owner
   or an assistant produces the file, the app displays it. The authoring skill in
   phase 7 becomes the primary authoring path instead of an assistant to a
   canvas.
5. **Phase 2 is accepted when a document renders.** The original criterion was
   "a diagram can be created, edited and saved". It is replaced by "a `.graph`
   file can be opened and rendered, offline, and the frame can be panned and
   zoomed". The parts already built and paid for — the bridge, the vendored tree,
   the manifest, the offline posture — keep their value.

## What this removes from the plan

| Planned | Now |
| --- | --- |
| Save and autosave bridge messages | Removed; the viewer never writes |
| Edit mode, layers panel, style panel work | Removed; draw.io's own panels are not shown |
| Autosave and recovery (phase 3) | Removed; there is nothing to recover |
| File intents for "open with" | Kept, and promoted: opening a document from another app is now the main entry point |
| `graph-core` document model | Kept: validation and reading still belong to the app, and the authoring skill needs it |
| Authoring skill (phase 7) | Kept, promoted to the main authoring path |

## What this keeps

Offline operation, no `INTERNET` permission in release builds, the strict CSP,
one frame and one message set, the pinned vendoring with its manifest, and the
rule that no code file carries comments.

## Consequences

- The app gets much simpler: one frame, one `load` message, one file picker.
- A document that cannot be rendered has to say why. Validation of the file is
  therefore part of the reader, not of the writer.
- The owner can no longer fix a document inside the app. Every change goes back
  through the tool that produced the file, which is the trade the owner chose.
- `docs/ARCHITECTURE.md` section 4 describes the edit-mode bridge and is now
  historical for the parts that describe editing; the sections that describe the
  frame, the protocol and the offline posture still apply.
