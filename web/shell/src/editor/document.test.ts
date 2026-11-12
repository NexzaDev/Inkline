import { describe, expect, it } from "vitest";

import { looksLikeGraphDocument, readGraphDocument } from "./document";

const file = (name: string, body: string): File =>
  new File([body], name, { type: "application/xml" });

describe("looksLikeGraphDocument", () => {
  it("accepts the two roots the editor writes", () => {
    expect(looksLikeGraphDocument("<mxfile><diagram /></mxfile>")).toBe(true);
    expect(looksLikeGraphDocument("<mxGraphModel><root /></mxGraphModel>")).toBe(true);
  });

  it("accepts a document behind an xml declaration and leading space", () => {
    expect(looksLikeGraphDocument('<?xml version="1.0" encoding="UTF-8"?>\n<mxfile />')).toBe(true);
  });

  it("rejects anything else", () => {
    expect(looksLikeGraphDocument("")).toBe(false);
    expect(looksLikeGraphDocument("not xml at all")).toBe(false);
    expect(looksLikeGraphDocument("<html><body /></html>")).toBe(false);
    expect(looksLikeGraphDocument("<drawio><mxfile /></drawio>")).toBe(false);
  });
});

describe("readGraphDocument", () => {
  it("keeps the file name and the text", async () => {
    const document = await readGraphDocument(file("plan.graph", "<mxfile><diagram /></mxfile>"));

    expect(document.name).toBe("plan.graph");
    expect(document.xml).toBe("<mxfile><diagram /></mxfile>");
  });

  it("refuses a file that is not a graph, naming it", async () => {
    await expect(readGraphDocument(file("notes.txt", "hello"))).rejects.toThrow(
      "notes.txt is not a graph document",
    );
  });
});
