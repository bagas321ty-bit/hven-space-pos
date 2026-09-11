import type { Attendance } from "@/lib/types";

/** Snapshot/localStorage only keeps a tiny JPEG/SVG. Anything bigger is offloaded. */
export const CLOUD_PHOTO_MAX = 10_000;

export function photoKey(attendanceId: string, kind: "in" | "out"): string {
  return `${attendanceId}-${kind}`;
}

export function isSvgPhoto(s?: string): boolean {
  return Boolean(s && s.startsWith("data:image/svg"));
}

export function isHeavyPhoto(s?: string): boolean {
  if (!s || isSvgPhoto(s)) return false;
  return s.startsWith("data:") && s.length > CLOUD_PHOTO_MAX;
}

export function slimPhoto(s?: string): string | undefined {
  if (!s) return s;
  if (isHeavyPhoto(s)) return undefined;
  return s;
}

export function slimAttendance(rows: Attendance[]): Attendance[] {
  return rows.map((a) => ({
    ...a,
    photoIn: slimPhoto(a.photoIn),
    photoOut: slimPhoto(a.photoOut),
  }));
}
