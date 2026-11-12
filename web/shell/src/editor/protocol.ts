const EDITOR_PAGE = "/editor/index.html";

export type EditorLanguage = "en" | "el";

export interface EditorInit {
  readonly event: "init";
}

export interface EditorLoaded {
  readonly event: "load";
}

export type EditorEvent = EditorInit | EditorLoaded;

export interface LoadAction {
  readonly action: "load";
  readonly xml: string;
}

export type EditorAction = LoadAction;

export function parseEditorEvent(payload: unknown): EditorEvent | null {
  const message = readMessage(payload);

  if (message === null) {
    return null;
  }

  if (message.event === "init") {
    return { event: "init" };
  }

  if (message.event === "load") {
    return { event: "load" };
  }

  return null;
}

function readMessage(payload: unknown): Record<string, unknown> | null {
  if (typeof payload === "string") {
    try {
      const parsed: unknown = JSON.parse(payload);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : null;
}

export function encodeAction(action: EditorAction): string {
  return JSON.stringify(action);
}

export function loadAction(xml: string): LoadAction {
  return { action: "load", xml };
}

export function readLanguage(tag: string): EditorLanguage {
  return tag.toLowerCase().startsWith("el") ? "el" : "en";
}

export function editorFrameSource(language: EditorLanguage): string {
  const parameters = new URLSearchParams({
    embed: "1",
    proto: "json",
    spin: "0",
    chrome: "0",
    dark: "1",
    pv: "0",
    grid: "0",
    lang: language,
  });

  return `${EDITOR_PAGE}?${parameters.toString()}`;
}
