import type { RefObject } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import {
  editorFrameSource,
  encodeAction,
  loadAction,
  parseEditorEvent,
  type EditorAction,
  type EditorBounds,
  type EditorLanguage,
} from "./protocol";

const START_TIMEOUT_MS = 20000;

export type EditorStatus =
  | { readonly kind: "empty" }
  | { readonly kind: "connecting" }
  | { readonly kind: "ready"; readonly model: EditorBounds | null }
  | { readonly kind: "failed" };

export interface EditorController {
  readonly frameRef: RefObject<HTMLIFrameElement | null>;
  readonly source: string;
  readonly attempt: number;
  readonly status: EditorStatus;
  readonly canRetry: boolean;
  readonly retry: () => void;
}

export function useEditorFrame(language: EditorLanguage, xml: string | null): EditorController {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<EditorStatus>(
    xml === null ? { kind: "empty" } : { kind: "connecting" },
  );

  const send = useCallback((action: EditorAction) => {
    frameRef.current?.contentWindow?.postMessage(encodeAction(action), window.location.origin);
  }, []);

  useEffect(() => {
    if (xml === null) {
      setStatus({ kind: "empty" });
      return;
    }

    const documentXml = xml;

    setStatus({ kind: "connecting" });

    const timeout = window.setTimeout(() => {
      setStatus((current) => (current.kind === "connecting" ? { kind: "failed" } : current));
    }, START_TIMEOUT_MS);

    function handleMessage(rawEvent: MessageEvent<unknown>) {
      const frame = frameRef.current;

      if (frame === null) return;
      if (rawEvent.source !== frame.contentWindow) return;

      const event = parseEditorEvent(rawEvent.data);

      if (event === null) return;

      if (event.event === "init") {
        send(loadAction(documentXml));
        return;
      }

      setStatus({ kind: "ready", model: event.modelBounds });
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };
  }, [send, xml, attempt]);

  const retry = useCallback(() => {
    setStatus({ kind: "connecting" });
    setAttempt((current) => current + 1);
  }, []);

  return {
    frameRef,
    source: editorFrameSource(language),
    attempt,
    status,
    canRetry: status.kind === "failed" && xml !== null,
    retry,
  };
}
