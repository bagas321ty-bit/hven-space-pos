import { VENUE_PASS_SHA256 } from "./venue-auth";
import { mergePayloads, type CloudDoc, type CloudPayload } from "./pos-cloud";

export interface CloudStorage {
  read: () => Promise<CloudDoc | null>;
  write: (doc: CloudDoc) => Promise<void>;
}

export function isCloudPayload(v: unknown): v is CloudPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as CloudPayload;
  return Array.isArray(o.products) && Array.isArray(o.orders);
}

export function parseCloudDoc(raw: unknown): CloudDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<CloudDoc> & { payload?: unknown };
  if (!isCloudPayload(d.payload)) return null;
  return {
    rev: Number(d.rev) || 0,
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : new Date().toISOString(),
    device: typeof d.device === "string" ? d.device : "",
    payload: d.payload,
  };
}

function assertToken(token: string) {
  return token === VENUE_PASS_SHA256;
}

export function isPhotoId(id: string): boolean {
  return /^[a-zA-Z0-9._-]{3,80}-(in|out)$/.test(id);
}

export function isPhotoData(data: string): boolean {
  if (typeof data !== "string") return false;
  if (data.length < 32 || data.length > 400_000) return false;
  return data.startsWith("data:image/jpeg") || data.startsWith("data:image/png") || data.startsWith("data:image/webp");
}

export interface PhotoStorage {
  get: (id: string) => Promise<string | null>;
  put: (id: string, data: string) => Promise<void>;
}

export type PhotoGetResult = { ok: true; data: string } | { ok: true; empty: true } | { ok: false; error: string };
export type PhotoPutResult = { ok: true } | { ok: false; error: string };

export async function getAttPhoto(token: string, id: string, storage: PhotoStorage): Promise<PhotoGetResult> {
  if (!assertToken(token)) return { ok: false, error: "Akses sinkron ditolak." };
  if (!isPhotoId(id)) return { ok: false, error: "ID foto tidak valid." };
  try {
    const data = await storage.get(id);
    if (!data) return { ok: true, empty: true };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal ambil foto." };
  }
}

export async function putAttPhoto(
  token: string,
  id: string,
  data: string,
  storage: PhotoStorage,
): Promise<PhotoPutResult> {
  if (!assertToken(token)) return { ok: false, error: "Akses sinkron ditolak." };
  if (!isPhotoId(id)) return { ok: false, error: "ID foto tidak valid." };
  if (!isPhotoData(data)) return { ok: false, error: "Foto terlalu besar atau format salah." };
  try {
    await storage.put(id, data);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal simpan foto." };
  }
}

export type PullCloudResult =
  | { ok: true; empty: true }
  | { ok: true; empty: false; rev: number; updatedAt: string; payload: CloudPayload }
  | { ok: false; error: string };

export type PushCloudResult =
  | { ok: true; rev: number; updatedAt: string; payload?: CloudPayload }
  | {
      ok: false;
      error: string;
      conflict?: true;
      rev?: number;
      updatedAt?: string;
      payload?: CloudPayload;
    };

export async function pullCloud(token: string, storage: CloudStorage): Promise<PullCloudResult> {
  if (!assertToken(token)) return { ok: false, error: "Akses sinkron ditolak." };
  try {
    const doc = await storage.read();
    if (!doc) return { ok: true, empty: true };
    return { ok: true, empty: false, rev: doc.rev, updatedAt: doc.updatedAt, payload: doc.payload };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menarik data cloud." };
  }
}

export async function pushCloud(
  input: { token: string; baseRev: number; device: string; payload: CloudPayload },
  storage: CloudStorage,
): Promise<PushCloudResult> {
  if (!assertToken(input.token)) return { ok: false, error: "Akses sinkron ditolak." };
  if (!isCloudPayload(input.payload)) return { ok: false, error: "Paket data tidak valid." };
  try {
    let outgoing = input.payload;
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await storage.read();
      outgoing = current ? mergePayloads(input.payload, current.payload) : input.payload;
      const next: CloudDoc = {
        rev: (current?.rev ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        device: input.device || "unknown",
        payload: outgoing,
      };
      await storage.write(next);
      const check = await storage.read();
      if (!check || check.rev === next.rev) {
        return { ok: true, rev: next.rev, updatedAt: next.updatedAt, payload: outgoing };
      }
    }
    return { ok: true, rev: 0, updatedAt: new Date().toISOString(), payload: outgoing };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyimpan ke cloud." };
  }
}
