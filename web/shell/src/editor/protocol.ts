const EDITOR_PAGE = "/editor/index.html";

const FIT_BORDER = 24;
const FIT_MAX_SCALE = 1;

export type EditorLanguage = "en" | "el";

export interface EditorInit {
  readonly event: "init";
}

export interface EditorBounds {
  readonly width: number;
  readonly height: number;
}

export interface EditorLoaded {
  readonly event: "load";
  readonly modelBounds: EditorBounds | null;
  readonly scale: number | null;
}

export type EditorEvent = EditorInit | EditorLoaded;

export interface LoadAction {
  readonly action: "load";
  readonly xml: string;
  readonly fit: true;
  readonly border: number;
  readonly maxFitScale: number;
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
    return {
      event: "load",
      modelBounds: readBounds(message.modelBounds),
      scale: readNumber(message.scale),
    };
  }

  return null;
}

function readMessage(payload: unknown): Record<string, unknown> | null {
  if (typeof payload === "string") {
    try {
      const parsed: unknown = JSON.parse(payload);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isRecord(payload) ? payload : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readBounds(value: unknown): EditorBounds | null {
  if (!isRecord(value)) {
    return null;
  }

  const width = readNumber(value.width);
  const height = readNumber(value.height);

  if (width === null || height === null || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function encodeAction(action: EditorAction): string {
  return JSON.stringify(action);
}

export function loadAction(xml: string): LoadAction {
  return {
    action: "load",
    xml,
    fit: true,
    border: FIT_BORDER,
    maxFitScale: FIT_MAX_SCALE,
  };
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
