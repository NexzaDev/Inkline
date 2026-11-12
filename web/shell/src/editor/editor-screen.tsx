import { useRef, useState } from "preact/hooks";

import { readGraphDocument, type GraphDocument } from "./document";
import type { EditorBounds, EditorLanguage } from "./protocol";
import { useEditorFrame, type EditorStatus } from "./use-editor-frame";

export function EditorScreen({ language }: { readonly language: EditorLanguage }) {
  const [document, setDocument] = useState<GraphDocument | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const { frameRef, source, attempt, status, canRetry, retry } = useEditorFrame(
    language,
    document === null ? null : document.xml,
  );

  async function open(file: File | undefined) {
    if (file === undefined) return;

    try {
      setDocument(await readGraphDocument(file));
      setRejection(null);
    } catch (error) {
      setRejection(error instanceof Error ? error.message : "the file could not be read");
    }
  }

  return (
    <main class="editor">
      {document === null ? null : (
        <iframe
          key={attempt}
          ref={frameRef}
          class="editor-frame"
          data-ready={status.kind === "ready"}
          src={source}
          title={document.name}
        />
      )}
      <footer class="editor-status">
        <p class="editor-state" aria-live="polite">
          {rejection ?? statusText(status, document)}
        </p>
        <div class="editor-controls">
          {canRetry ? (
            <button type="button" class="editor-action" onClick={retry}>
              Try again
            </button>
          ) : null}
          <button type="button" class="editor-action" onClick={() => pickerRef.current?.click()}>
            Open
          </button>
        </div>
      </footer>
      <input
        ref={pickerRef}
        class="editor-picker"
        type="file"
        accept="*/*"
        onChange={(event) => {
          void open(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </main>
  );
}

function describeDocument(document: GraphDocument, model: EditorBounds | null): string {
  return model === null
    ? document.name
    : `${document.name} · ${Math.round(model.width).toString()} × ${Math.round(model.height).toString()}`;
}

function statusText(status: EditorStatus, document: GraphDocument | null): string {
  switch (status.kind) {
    case "empty":
      return "No document open";
    case "connecting":
      return "Opening the document";
    case "ready":
      return document === null ? "Ready" : describeDocument(document, status.model);
    case "failed":
      return "The document did not render";
  }
}
