import { useEffect, useState } from "preact/hooks";

import { formatVersionLine, readAppInfo, type AppInfo } from "./api/app-info";

type StartupState =
  | { status: "starting" }
  | { status: "ready"; info: AppInfo }
  | { status: "failed"; reason: string };

export function App() {
  const [state, setState] = useState<StartupState>({ status: "starting" });

  useEffect(() => {
    let cancelled = false;

    readAppInfo().then(
      (info) => {
        if (!cancelled) setState({ status: "ready", info });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({ status: "failed", reason: describe(error) });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main class="shell">
      <header class="masthead">
        <h1 class="wordmark">Inkline</h1>
        <p class="version">{versionText(state)}</p>
      </header>

      <section class="empty" aria-live="polite">
        <p class="empty-title">{headline(state)}</p>
        <p class="empty-body">{body(state)}</p>
      </section>
    </main>
  );
}

function versionText(state: StartupState): string {
  switch (state.status) {
    case "starting":
      return "Starting";
    case "ready":
      return formatVersionLine(state.info);
    case "failed":
      return "Unavailable";
  }
}

function headline(state: StartupState): string {
  switch (state.status) {
    case "starting":
      return "Preparing the workspace";
    case "ready":
      return "No documents yet";
    case "failed":
      return "The app could not start";
  }
}

function body(state: StartupState): string {
  switch (state.status) {
    case "starting":
      return "Reading build information.";
    case "ready":
      return "Documents you open appear here.";
    case "failed":
      return state.reason;
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown startup error.";
}
