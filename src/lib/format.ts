export function formatIDR(value: number | undefined | null): string {
  const n = Number(value || 0);
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function formatIDRCompact(value: number): string {
  const n = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (n >= 1_000_000_000) return `${sign}Rp ${(n / 1_000_000_000).toFixed(1)} Miliar`;
  if (n >= 1_000_000) return `${sign}Rp ${(n / 1_000_000).toFixed(1)} Jt`;
  if (n >= 1_000) return `${sign}Rp ${(n / 1_000).toFixed(0)} Rb`;
  return formatIDR(value);
}

export function formatPct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function calendarDateJakarta(iso?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(iso ? new Date(iso) : new Date());
}

function addYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Shift HVEN: 07.00 sampai 02.00 keesokan harinya. Jam 00–01.59 masih hari operasional kemarin. */
export const SERVICE_OPEN_HOUR = 7;
export const SERVICE_CLOSE_HOUR = 2;

export function shiftDateISO(iso?: string): string {
  const src = iso ?? new Date().toISOString();
  const hour = hourJakarta(src);
  const cal = calendarDateJakarta(src);
  return hour < SERVICE_CLOSE_HOUR ? addYmd(cal, -1) : cal;
}

export function todayISO(): string {
  return shiftDateISO();
}

export function formatDateID(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTimeID(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

export function dateKeyJakarta(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function hourJakarta(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}

export function minuteJakarta(iso?: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    minute: "numeric",
  }).formatToParts(iso ? new Date(iso) : new Date());
  return Number(parts.find((p) => p.type === "minute")?.value ?? 0);
}

export function minutesJakarta(iso?: string): number {
  const src = iso ?? new Date().toISOString();
  return hourJakarta(src) * 60 + minuteJakarta(src);
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function cutoffPeriod(date = new Date()): { id: string; start: string; end: string; label: string } {
  const ymd = calendarDateJakarta(date.toISOString());
  const [y, m, d] = ymd.split("-").map(Number);
  const startYear = d >= 7 ? y : m === 1 ? y - 1 : y;
  const startMonth = d >= 7 ? m : m === 1 ? 12 : m - 1;
  const endMonth = startMonth === 12 ? 1 : startMonth + 1;
  const endYear = startMonth === 12 ? startYear + 1 : startYear;
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${startYear}-${pad(startMonth)}-07`;
  const end = `${endYear}-${pad(endMonth)}-06`;
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return {
    id: `${startYear}-${pad(startMonth)}`,
    start,
    end,
    label: `7 ${months[startMonth - 1]} – 6 ${months[endMonth - 1]} ${endYear}`,
  };
}

export function nextCutoffPeriod(endDate: string): { id: string; start: string; end: string; label: string } {
  return cutoffPeriod(new Date(`${addYmd(endDate, 1)}T12:00:00+07:00`));
}

export function inCutoffRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/** Senin–Minggu (kalender Jakarta, ISO-like Monday start). */
export function weekMonday(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function weekSunday(ymd: string): string {
  return addYmd(weekMonday(ymd), 6);
}

export function inWeek(date: string, anyDay: string): boolean {
  return date >= weekMonday(anyDay) && date <= weekSunday(anyDay);
}

export function weekLabel(ymd: string): string {
  return `${formatDateID(weekMonday(ymd))} – ${formatDateID(weekSunday(ymd))}`;
}
