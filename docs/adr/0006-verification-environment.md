# 0006 Verification environment

- Status: accepted
- Date: 2026-11-12
- Deciders: Inkline maintainers
- Related: `docs/ARCHITECTURE.md` section 8

## Context

The work is written in a sandbox that is not a development machine for this
stack. What it has and does not have decides which phases can be reported as
verified and which can only be reported as written.

Measured in the sandbox on 2026-11-12:

| Tool | State |
| --- | --- |
| Node.js | 22.22.3, working |
| npm | 10.9.8, reachable registry |
| git | 2.39.5, reachable github.com |
| Python | 3.11.2 |
| Rust toolchain | absent; `static.rust-lang.org` and `sh.rustup.rs` unreachable |
| JDK | absent; `dl.google.com` and Debian mirrors unreachable |
| Android SDK / NDK | absent |
| Headless browser | absent; no binary is installed and the hosts that serve browser builds are outside the allowlist |

Reachable hosts are limited to `github.com`, `codeload.github.com`,
`api.github.com`, `registry.npmjs.org`, `pypi.org` and `files.pythonhosted.org`.
Web page reading works for documentation; package and toolchain downloads from
other hosts do not.

## Decision

**Verification is split by capability, and reports say which side of the split
each claim came from.**

- Written and checked in the sandbox: Rust source (by reading, formatting
  conventions and review), TypeScript and CSS, Markdown, workflow files,
  shell scripts, vendoring logic, and every document.
- Executed in the sandbox: TypeScript typecheck and ESLint, Prettier, Node-based
  unit tests and golden-file comparisons for pure functions, static analysis of
  the vendored tree, and `graphctl` behaviour where it is exercised by the CI
  matrix.
- Executed only in CI: `cargo fmt`, `cargo clippy`, `cargo test`, `cargo deny`,
  the debug APK build, the editor smoke test in a headless browser, and the
  network-blocked test.
- Reported as unverified until a device run: anything about intents, storage
  access, back gestures, WebView version behaviour, stylus input and clipboard.

Because the editor smoke test needs a browser, it lives in CI from the start.
Because the Rust core is the project's truth about files, its tests are written
with the code and are never left to a later phase for convenience.

The owner is told, at every phase boundary, exactly which commands were run, in
which environment, and what their output was. A phase is not called green on the
strength of code that merely looks right.

## Consequences

- Phases 1 to 3 depend on CI for their acceptance criteria. The first CI run is
  therefore part of Phase 1's deliverable, not a formality at the end.
- Local iteration is fast for the shell and for documentation and slow for
  everything that needs a compiler. Design decisions that would need a local
  experiment are instead verified by reading the pinned source, which is why
  Phase 0 spent its time there.
- If a Rust toolchain becomes available through a permitted host, this ADR is
  amended rather than ignored: the sandbox then runs `cargo test` locally as
  well, and reports distinguish the two.
