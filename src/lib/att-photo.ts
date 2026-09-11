import type { Attendance } from "@/lib/types";
import {
  isHeavyPhoto,
  isSvgPhoto,
  photoKey,
} from "@/lib/att-photo-slim";
import { getPhotoClient, putPhotoClient } from "@/lib/pos-cloud-client";
import { VENUE_PASS_SHA256 } from "@/lib/venue-auth";

export { photoKey, isHeavyPhoto, isSvgPhoto, slimPhoto, slimAttendance, CLOUD_PHOTO_MAX } from "@/lib/att-photo-slim";

const FULL_MAX_W = 280;
const THUMB_MAX_W = 112;
const IDB_NAME = "hven-att-photos";
const IDB_STORE = "proofs";

export function rasterElement(
  src: HTMLImageElement | HTMLVideoElement,
  maxW: number,
  quality: number,
): string {
  const c = document.createElement("canvas");
  const sw = "videoWidth" in src ? src.videoWidth || src.clientWidth : src.naturalWidth;
  const sh = "videoHeight" in src ? src.videoHeight || src.clientHeight : src.naturalHeight;
  const w = Math.min(maxW, sw || maxW);
  const h = Math.round(((sh || w) / (sw || w)) * w);
  c.width = w;
  c.height = h || w;
  c.getContext("2d")?.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("gambar rusak"));
    img.src = src;
  });
}

async function rasterDataUrl(src: string, maxW: number, quality: number): Promise<string> {
  const img = await loadImage(src);
  return rasterElement(img, maxW, quality);
}

export async function toAttendanceProof(src: string): Promise<{ thumb: string; full: string }> {
  if (!src.startsWith("data:") || isSvgPhoto(src)) return { thumb: src, full: src };
  const full = await rasterDataUrl(src, FULL_MAX_W, 0.5);
  let thumb = await rasterDataUrl(src, THUMB_MAX_W, 0.42);
  if (thumb.length > 9000) thumb = await rasterDataUrl(src, 88, 0.34);
  return { thumb, full };
}

type ProofRow = { id: string; data: string; pending: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB foto gagal"));
  });
}

async function idbPut(row: ProofRow): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Gagal simpan foto lokal"));
  });
  db.close();
}

async function idbGet(id: string): Promise<ProofRow | null> {
  const db = await openDb();
  const row = await new Promise<ProofRow | null>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve((req.result as ProofRow | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("Gagal baca foto lokal"));
  });
  db.close();
  return row;
}

async function idbPending(): Promise<ProofRow[]> {
  const db = await openDb();
  const rows = await new Promise<ProofRow[]>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(((req.result as ProofRow[]) ?? []).filter((r) => r.pending));
    req.onerror = () => reject(req.error ?? new Error("Gagal daftar foto"));
  });
  db.close();
  return rows;
}

export async function putAttendanceProof(id: string, data: string): Promise<void> {
  if (!data || isSvgPhoto(data)) return;
  await idbPut({ id, data, pending: 1 });
  await flushPendingPhotos();
}

export async function flushPendingPhotos(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  let pending: ProofRow[] = [];
  try {
    pending = await idbPending();
  } catch {
    return;
  }
  for (const row of pending) {
    const res = await putPhotoClient({ token: VENUE_PASS_SHA256, id: row.id, data: row.data });
    if (res.ok) await idbPut({ ...row, pending: 0 });
  }
}

export async function resolveProof(id: string, fallback: string): Promise<string> {
  try {
    const local = await idbGet(id);
    if (local?.data) return local.data;
  } catch {
    /* ignore */
  }
  const remote = await getPhotoClient({ token: VENUE_PASS_SHA256, id });
  if (remote.ok && "data" in remote && remote.data) {
    try {
      await idbPut({ id, data: remote.data, pending: 0 });
    } catch {
      /* ignore */
    }
    return remote.data;
  }
  return fallback;
}

export async function offloadAttendanceList(
  rows: Attendance[],
): Promise<{ rows: Attendance[]; changed: boolean }> {
  if (typeof window === "undefined") return { rows, changed: false };
  let changed = false;
  const next: Attendance[] = [];
  for (const a of rows) {
    let row = a;
    for (const kind of ["in", "out"] as const) {
      const field = kind === "in" ? "photoIn" : "photoOut";
      const raw = row[field];
      if (!isHeavyPhoto(raw)) continue;
      try {
        const proof = await toAttendanceProof(raw!);
        await putAttendanceProof(photoKey(a.id, kind), proof.full);
        row = { ...row, [field]: proof.thumb };
        changed = true;
      } catch {
        row = { ...row, [field]: undefined };
        changed = true;
      }
    }
    next.push(row);
  }
  return { rows: next, changed };
}
