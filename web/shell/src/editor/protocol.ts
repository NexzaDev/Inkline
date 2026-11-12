const EDITOR_PAGE = "/editor/index.html";

export const INITIAL_DIAGRAM =
  '<mxfile><diagram id="inkline-initial" name="Page-1">' +
  '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" ' +
  'arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">' +
  '<root><mxCell id="0" /><mxCell id="1" parent="0" /></root></mxGraphModel></diagram></mxfile>';

export type EditorLanguage = "en" | "el";

export interface EditorInit {
  readonly event: "init";
}

export interface EditorLoaded {
  readonly event: "load";
}

export interface EditorSaved {
  readonly event: "save" | "autosave";
  readonly xml: string;
}

export interface EditorExported {
  readonly event: "export";
  readonly xml: string;
}

export type EditorEvent = EditorInit | EditorLoaded | EditorSaved | EditorExported;

export interface LoadAction {
  readonly action: "load";
  readonly xml: string;
  readonly autosave: 1;
}

export interface ExportAction {
  readonly action: "export";
  readonly format: "xml";
}

export type EditorAction = LoadAction | ExportAction;

export function parseEditorEvent(payload: unknown): EditorEvent | null {
  const message = readMessage(payload);

  if (message === null) {
    return null;
  }

  const name = message.event;

  if (name === "init") {
    return { event: "init" };
  }

  if (name === "load") {
    return { event: "load" };
  }

  if (name === "save" || name === "autosave" || name === "export") {
    const xml = message.xml;
    return typeof xml === "string" ? { event: name, xml } : null;
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
  return { action: "load", xml, autosave: 1 };
}

export function exportAction(): ExportAction {
  return { action: "export", format: "xml" };
}

export function readLanguage(tag: string): EditorLanguage {
  return tag.toLowerCase().startsWith("el") ? "el" : "en";
}

export function editorFrameSource(language: EditorLanguage): string {
  const parameters = new URLSearchParams({
    embed: "1",
    proto: "json",
    spin: "0",
    libraries: "1",
    noSaveBtn: "1",
    saveAndExit: "0",
    noExitBtn: "1",
    modified: "0",
    lang: language,
  });

  return `${EDITOR_PAGE}?${parameters.toString()}`;
}

export function byteLength(xml: string): number {
  return new TextEncoder().encode(xml).length;
}
