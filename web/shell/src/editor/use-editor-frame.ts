import type { RefObject } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import {
  byteLength,
  editorFrameSource,
  encodeAction,
  exportAction,
  INITIAL_DIAGRAM,
  loadAction,
  parseEditorEvent,
  type EditorAction,
  type EditorLanguage,
} from "./protocol";

const START_TIMEOUT_MS = 20000;

export type EditorStatus =
  | { readonly kind: "connecting" }
  | { readonly kind: "ready" }
  | { readonly kind: "modified" }
  | { readonly kind: "saved"; readonly bytes: number }
  | { readonly kind: "unavailable" };

export interface EditorController {
  readonly frameRef: RefObject<HTMLIFrameElement | null>;
  readonly source: string;
  readonly attempt: number;
  readonly status: EditorStatus;
  readonly canSave: boolean;
  readonly canReload: boolean;
  readonly canRetry: boolean;
  readonly save: () => void;
  readonly reload: () => void;
  readonly retry: () => void;
}

export function useEditorFrame(language: EditorLanguage): EditorController {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = useState<EditorStatus>({ kind: "connecting" });
  const [saved, setSaved] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const send = useCallback((action: EditorAction) => {
    frameRef.current?.contentWindow?.postMessage(encodeAction(action), window.location.origin);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setStatus((current) => (current.kind === "connecting" ? { kind: "unavailable" } : current));
    }, START_TIMEOUT_MS);

    function handleMessage(rawEvent: MessageEvent<unknown>) {
      const frame = frameRef.current;

      if (frame === null) return;
      if (rawEvent.origin !== window.location.origin) return;
      if (rawEvent.source !== frame.contentWindow) return;

      const event = parseEditorEvent(rawEvent.data);

      if (event === null) return;

      switch (event.event) {
        case "init":
          send(loadAction(INITIAL_DIAGRAM));
          return;
        case "load":
          setStatus({ kind: "ready" });
          return;
        case "autosave":
          setStatus({ kind: "modified" });
          return;
        case "save":
        case "export":
          setSaved(event.xml);
          setStatus({ kind: "saved", bytes: byteLength(event.xml) });
          return;
      }
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };
  }, [send, attempt]);

  const save = useCallback(() => {
    send(exportAction());
  }, [send]);

  const retry = useCallback(() => {
    setStatus({ kind: "connecting" });
    setAttempt((current) => current + 1);
  }, []);

  const reload = useCallback(() => {
    if (saved === null) return;
    setStatus({ kind: "ready" });
    send(loadAction(saved));
  }, [saved, send]);

  return {
    frameRef,
    source: editorFrameSource(language),
    attempt,
    status,
    canSave: status.kind === "ready" || status.kind === "modified",
    canReload: saved !== null && status.kind !== "unavailable",
    canRetry: status.kind === "unavailable",
    save,
    reload,
    retry,
  };
}
