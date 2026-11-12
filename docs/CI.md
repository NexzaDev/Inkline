# Continuous integration

`ci.yml` runs on every push, every pull request and on demand. It has three
jobs, each with one job: the core crates, the shell, and the Android debug APK.

## What each job proves

| Job | Proves |
| --- | --- |
| `Rust core` | `cargo fmt` is clean, `graph-core` and `graph-cli` pass clippy with `-D warnings`, their tests pass, and every dependency in the resolved graph has an allowed licence and no known advisory |
| `Shell` | The shell typechecks in strict mode, lints clean, is formatted, passes its unit tests and builds |
| `Android debug APK` | The Rust app crate compiles for `aarch64-linux-android`, the Gradle project assembles an installable debug APK, and the artifact is uploaded |

The `Rust core` job deliberately scopes clippy and the tests to
`-p graph-core -p graph-cli`. The `src-tauri` crate pulls in the whole Tauri
stack, which needs GTK and WebKit development packages on a Linux runner and
takes minutes to compile for a host that this project does not ship. The Android
job compiles it for the architecture that matters, so a broken app crate still
fails the build — it just fails in the job that also produces the APK. If a
desktop build becomes a target, this split changes and the CI gains the system
dependencies.

`cargo-deny` 0.20.2 is installed as a prebuilt binary and run as a plain
command, rather than through the upstream action. The action is a container
whose findings only ever appear in the step log; running the binary here means
the findings reach the annotations like every other failure. The four checks
run as four steps, so a failure names itself in the check list instead of
burying which of licences, advisories, bans or sources objected. They cover the
whole workspace, including the Tauri dependency tree, because none of them needs
compilation.

The bans check rejects wildcard requirements. `cargo-deny` treats a path
dependency without a version as a wildcard, so the workspace dependency on
`graph-core` names its version as well as its path — which is also what Cargo
requires of a path dependency that is ever published.

One advisory is ignored. `proc-macro-error` reaches the graph only through the
GTK crates that `tao` pulls in for a desktop Linux build, which is not a target
of this project, and the advisory publishes no patched release. The ignore is a
single entry in `deny.toml` carrying that reason, so removing it later is one
line.

The Android NDK is the one the runner image already ships, selected by prefix so
Rust and Gradle agree on a single installation, instead of being downloaded by a
third-party action: the download that action produced was missing the `clang`
binary its own driver scripts call, which failed only at link time and looked
like a compiler bug. A verification step runs the NDK's own compiler for the
target chosen by `minSdkVersion` before the build starts, so a broken
installation is reported as a broken installation.

## Pinned actions

Actions are pinned by commit SHA. This table is the mapping to the release tag
each SHA came from; it is the only place the version is written down, because
workflow files carry no comments.

| Action | Tag | SHA |
| --- | --- | --- |
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `actions/setup-java` | v6.2.0 | `77dd5b2ce225ea11469928ac317850245a74ae78` |
| `actions/upload-artifact` | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| `Swatinem/rust-cache` | v2.9.3 | `d1527c8f67ef9af357290475d4af4b0fab8f12e0` |
| `android-actions/setup-android` | v4.0.4 | `be39fa834029ff78f1a44aa3bb0819b8fc2bd8fd` |
| `taiki-e/install-action` | v2.90.3 | `cfdb7ed4ccc7c7dce37759eae89dc5674b469b39` |

The Rust toolchain is installed with `rustup` from the version in
`rust-toolchain.toml` and the same version again in the workflow, so a runner
update cannot silently change the compiler.

## Artifacts

| Artifact | Contents | Use |
| --- | --- | --- |
| `inkline-debug-apk` | `app-universal-debug.apk` built for `aarch64`, kept 14 days | Install on a tablet to check that the app starts |
| `cargo-lock` | The `Cargo.lock` the job resolved, kept 7 days | Committed to the repository once, then kept under version control |

## The lockfile

`Cargo.lock` is required for reproducible builds but is not in the repository
yet, because the environment the project is written in has no Rust toolchain and
cannot download build artifacts from GitHub Actions. Every `Rust core` run
resolves the graph explicitly with `cargo generate-lockfile` and publishes the
result as the `cargo-lock` artifact, unconditionally, so the file is always
available even from a run that failed later.

Committing it is a deliberate one-time step, done from a machine that can
download the artifact, and it is the point at which the workflow switches to
`--locked`. Until that happens each run resolves against whatever crates.io
published that day, which is why the resolution is an explicit step that shows
up in the job rather than a side effect of the first `cargo` command.

## Reading a failure

Step output is not always reachable from a phone, so the jobs that can produce
long, useful output route it through two helpers in `scripts/ci/`. `capture.sh`
runs a command, passes its output through, and on failure re-emits the last
sixty lines as an error annotation, which GitHub shows next to the failing check
without opening the log. `note.sh` publishes text as a notice annotation, which
is how the SDK inventory is reported.

Formatting is checked by running `cargo fmt --all` and then diffing the working
tree, rather than by `--check`. The diff of a failed `--check` is otherwise only
in the log; this way it becomes an annotation that names the exact lines.

The Android SDK packages are installed explicitly, using the versioned names the
SDK repository actually publishes: `platforms;android-37.0`, not
`platforms;android-37`, and `build-tools;37.0.0`. The inventory step prints what
the runner already has and which build tools exist, so a rename in the SDK
repository is visible in the check annotations of the run that breaks.

## Running the same checks locally

```
cargo fmt --all --check
cargo clippy -p graph-core -p graph-cli --all-targets -- -D warnings
cargo test -p graph-core -p graph-cli
cd web/shell && npm ci && npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

The Android job cannot be reproduced without a JDK, the Android SDK and the
NDK; on a machine with those, `npx tauri android build --debug --apk --target aarch64`
is the same command.
