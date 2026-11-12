import { describe, expect, it } from "vitest";

import {
  byteLength,
  editorFrameSource,
  INITIAL_DIAGRAM,
  loadAction,
  parseEditorEvent,
  readLanguage,
  saveAction,
} from "./protocol";

describe("parseEditorEvent", () => {
  it("recognises the handshake", () => {
    expect(parseEditorEvent({ event: "init" })).toEqual({ event: "init" });
    expect(parseEditorEvent({ event: "load" })).toEqual({ event: "load" });
  });

  it("carries the document out of a save", () => {
    expect(parseEditorEvent({ event: "save", xml: "<mxfile />" })).toEqual({
      event: "save",
      xml: "<mxfile />",
    });
  });

  it("treats an autosave as a save", () => {
    expect(parseEditorEvent({ event: "autosave", xml: "<mxfile />" })).toEqual({
      event: "autosave",
      xml: "<mxfile />",
    });
  });

  it("rejects a save without a document", () => {
    expect(parseEditorEvent({ event: "save" })).toBeNull();
    expect(parseEditorEvent({ event: "save", xml: 42 })).toBeNull();
  });

  it("ignores messages it does not know", () => {
    expect(parseEditorEvent({ event: "configure" })).toBeNull();
    expect(parseEditorEvent({ event: "exit" })).toBeNull();
    expect(parseEditorEvent("init")).toBeNull();
    expect(parseEditorEvent(null)).toBeNull();
    expect(parseEditorEvent(undefined)).toBeNull();
  });
});

describe("editorFrameSource", () => {
  it("asks for the json embed protocol in the device language", () => {
    const source = editorFrameSource("el");
    const parameters = new URL(source, "http://localhost").searchParams;

    expect(source.startsWith("/editor/index.html?")).toBe(true);
    expect(parameters.get("embed")).toBe("1");
    expect(parameters.get("proto")).toBe("json");
    expect(parameters.get("lang")).toBe("el");
    expect(parameters.get("spin")).toBe("0");
  });

  it("removes the editor's own controls and status text", () => {
    const parameters = new URL(editorFrameSource("en"), "http://localhost").searchParams;

    expect(parameters.get("noSaveBtn")).toBe("1");
    expect(parameters.get("noExitBtn")).toBe("1");
    expect(parameters.get("saveAndExit")).toBe("0");
    expect(parameters.get("modified")).toBe("0");
  });

  it("never asks the editor to run in its own offline mode", () => {
    expect(editorFrameSource("en")).not.toContain("offline");
  });
});

describe("readLanguage", () => {
  it("follows a Greek device and falls back to English", () => {
    expect(readLanguage("el-GR")).toBe("el");
    expect(readLanguage("EL")).toBe("el");
    expect(readLanguage("en-GB")).toBe("en");
    expect(readLanguage("de-DE")).toBe("en");
  });
});

describe("actions", () => {
  it("hands a document back to the editor", () => {
    expect(loadAction(INITIAL_DIAGRAM)).toEqual({
      action: "load",
      xml: INITIAL_DIAGRAM,
    });
  });

  it("asks the editor to run its own save action", () => {
    expect(saveAction()).toEqual({ action: "invokeAction", actionName: "save" });
  });
});

describe("byteLength", () => {
  it("counts bytes rather than characters", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("αβγ")).toBe(6);
  });
});
