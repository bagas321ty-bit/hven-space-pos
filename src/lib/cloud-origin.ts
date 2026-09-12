const KEY = "hven-cloud-origins-v1";

export type CloudOrigins = { laptop: string; pc: string };

const EMPTY: CloudOrigins = { laptop: "", pc: "" };

export function loadCloudOrigins(): CloudOrigins {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const o = JSON.parse(raw) as Partial<CloudOrigins>;
    return {
      laptop: typeof o.laptop === "string" ? o.laptop : "",
      pc: typeof o.pc === "string" ? o.pc : "",
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveCloudOrigins(next: CloudOrigins) {
  localStorage.setItem(KEY, JSON.stringify({
    laptop: next.laptop.trim(),
    pc: next.pc.trim(),
  }));
}

export function cleanOrigin(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Extra home-cloud bases. Empty = pakai server halaman ini (Vercel atau laptop). */
export function getCloudOrigins(): string[] {
  const o = loadCloudOrigins();
  const out: string[] = [];
  for (const u of [o.laptop, o.pc]) {
    const c = cleanOrigin(u);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}
