import { describe, expect, it } from "vitest";

import { formatVersionLine, type AppInfo } from "./app-info";

const info: AppInfo = {
  name: "Inkline",
  version: "0.1.0",
  graphFormatVersion: 1,
  identifier: "dev.nexza.inkline",
};

describe("formatVersionLine", () => {
  it("names the app version and the graph format version", () => {
    expect(formatVersionLine(info)).toBe("Version 0.1.0 · graph format 1");
  });

  it("keeps multi-digit format versions readable", () => {
    expect(formatVersionLine({ ...info, graphFormatVersion: 12 })).toBe(
      "Version 0.1.0 · graph format 12",
    );
  });
});
