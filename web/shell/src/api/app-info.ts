import { invoke } from "@tauri-apps/api/core";

export interface AppInfo {
  name: string;
  version: string;
  graphFormatVersion: number;
  identifier: string;
}

function isAppInfo(value: unknown): value is AppInfo {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.name === "string" &&
    typeof candidate.version === "string" &&
    typeof candidate.graphFormatVersion === "number" &&
    typeof candidate.identifier === "string"
  );
}

export async function readAppInfo(): Promise<AppInfo> {
  const value = await invoke<unknown>("app_info");

  if (!isAppInfo(value)) {
    throw new Error("app_info returned an unexpected payload");
  }

  return value;
}

export function formatVersionLine(info: AppInfo): string {
  return `Version ${info.version} · graph format ${info.graphFormatVersion.toString()}`;
}
