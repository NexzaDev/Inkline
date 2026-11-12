import type { EditorLanguage } from "./protocol";
import { useEditorFrame, type EditorStatus } from "./use-editor-frame";

export function EditorScreen({ language }: { readonly language: EditorLanguage }) {
  const { frameRef, source, attempt, status, canSave, canReload, canRetry, save, reload, retry } =
    useEditorFrame(language);

  return (
    <main class="editor">
      <iframe
        key={attempt}
        ref={frameRef}
        class="editor-frame"
        data-ready={status.kind !== "connecting"}
        src={source}
        title="Inkline editor"
      />
      <footer class="editor-status">
        <p class="editor-state" aria-live="polite">
          {statusText(status)}
        </p>
        <div class="editor-controls">
          {canRetry ? (
            <button type="button" class="editor-action" onClick={retry}>
              Try again
            </button>
          ) : (
            <>
              <button type="button" class="editor-action" disabled={!canReload} onClick={reload}>
                Reload
              </button>
              <button type="button" class="editor-action" disabled={!canSave} onClick={save}>
                Save
              </button>
            </>
          )}
        </div>
      </footer>
    </main>
  );
}

function statusText(status: EditorStatus): string {
  switch (status.kind) {
    case "connecting":
      return "Starting the editor";
    case "ready":
      return "Ready";
    case "modified":
      return "Unsaved changes";
    case "saved":
      return `Saved · ${formatBytes(status.bytes)}`;
    case "unavailable":
      return "The editor did not start";
  }
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes.toString()} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
