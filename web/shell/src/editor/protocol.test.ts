import { describe, expect, it } from "vitest";

import {
  editorFrameSource,
  encodeAction,
  loadAction,
  parseEditorEvent,
  readLanguage,
} from "./protocol";

describe("parseEditorEvent", () => {
  it("recognises the handshake", () => {
    expect(parseEditorEvent({ event: "init" })).toEqual({ event: "init" });
    expect(parseEditorEvent({ event: "load" })).toEqual({
      event: "load",
      modelBounds: null,
      scale: null,
    });
  });

  it("reads the json strings the editor actually sends", () => {
    expect(parseEditorEvent('{"event":"init"}')).toEqual({ event: "init" });
    expect(parseEditorEvent('{"event":"load","xml":"<mxfile />"}')).toEqual({
      event: "load",
      modelBounds: null,
      scale: null,
    });
  });

  it("takes the size of what it drew, which is the only proof it drew anything", () => {
    const message = JSON.stringify({
      event: "load",
      scale: 1,
      modelBounds: { x: 100, y: 140, width: 760, height: 160 },
      containerSize: { width: 1000, height: 700 },
    });

    expect(parseEditorEvent(message)).toEqual({
      event: "load",
      modelBounds: { width: 760, height: 160 },
      scale: 1,
    });
  });

  it("refuses bounds that are not a size", () => {
    const empty = { event: "load", modelBounds: { width: 0, height: 0 }, scale: "1" };

    expect(parseEditorEvent(empty)).toEqual({ event: "load", modelBounds: null, scale: null });
  });

  it("survives a string that is not a message", () => {
    expect(parseEditorEvent("ready")).toBeNull();
    expect(parseEditorEvent("")).toBeNull();
    expect(parseEditorEvent("{")).toBeNull();
  });

  it("ignores messages a reader has no use for", () => {
    expect(parseEditorEvent({ event: "autosave", xml: "<mxfile />" })).toBeNull();
    expect(parseEditorEvent({ event: "save", xml: "<mxfile />" })).toBeNull();
    expect(parseEditorEvent({ event: "configure" })).toBeNull();
    expect(parseEditorEvent(null)).toBeNull();
    expect(parseEditorEvent(undefined)).toBeNull();
  });
});

describe("editorFrameSource", () => {
  it("asks for a chromeless frame, which is the editor's read-only mode", () => {
    const parameters = new URL(editorFrameSource("el"), "http://localhost").searchParams;

    expect(parameters.get("chrome")).toBe("0");
    expect(parameters.get("embed")).toBe("1");
    expect(parameters.get("proto")).toBe("json");
    expect(parameters.get("lang")).toBe("el");
    expect(parameters.get("spin")).toBe("0");
  });

  it("draws on a fixed dark surface instead of a moving page", () => {
    const parameters = new URL(editorFrameSource("en"), "http://localhost").searchParams;

    expect(parameters.get("dark")).toBe("1");
    expect(parameters.get("pv")).toBe("0");
    expect(parameters.get("grid")).toBe("0");
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
  it("hands a document to the frame and asks it to fit", () => {
    expect(loadAction("<mxfile />")).toEqual({
      action: "load",
      xml: "<mxfile />",
      fit: true,
      border: 24,
      maxFitScale: 1,
    });
  });

  it("sends json strings, which is what the editor parses", () => {
    expect(JSON.parse(encodeAction(loadAction("<mxfile />")))).toMatchObject({
      action: "load",
      xml: "<mxfile />",
      fit: true,
    });
  });
});
