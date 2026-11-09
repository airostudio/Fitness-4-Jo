// User data export (privacy / portability). Returns plain JSON containing only the user's own records.
export const EXPORT_VERSION = 1;
export interface ExportInput { appVersion: string; data: Record<string, unknown>; now: string; }
export function buildExport(i: ExportInput) {
  return {
    format: "jostrong-export", version: EXPORT_VERSION, appVersion: i.appVersion, exportedAt: i.now,
    note: "This file contains your personal health and training information. Keep it somewhere private.",
    data: i.data,
  };
}
