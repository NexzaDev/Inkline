# Architecture decision records

One record per decision that is expensive to reverse, in the order it was taken.
A record is never edited to say something different; it is superseded by a new
record that names the old one.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-vendor-drawio.md) | Vendor draw.io `v32.6.10` unmodified, with two deployment hook files | accepted |
| [0002](0002-shell-framework.md) | Preact and Vite for the shell, no component library | accepted |
| [0003](0003-editor-customization-boundary.md) | Customise through configuration, plugin and hooks; no source forks | accepted |
| [0004](0004-preview-mode.md) | Preview mode is a locked-down editor frame, not the viewer bundle | accepted |
| [0005](0005-offline-network-posture.md) | No network capability, remote defaults switched off at the source | accepted |
| [0006](0006-verification-environment.md) | What is verified in the sandbox and what is verified only in CI | accepted |
| [0007](0007-android-project-scaffold.md) | The generated Android project is committed and normalised, `INTERNET` only in debug | accepted |
| [0008](0008-reader-only.md) | Inkline renders `.graph` documents and does not edit them; authoring is code | accepted |

Template for a new record:

```
# NNNN Short title

- Status: proposed | accepted | superseded by NNNN
- Date: YYYY-MM-DD
- Deciders: who
- Related: links

## Context
## Decision
## Consequences
```
