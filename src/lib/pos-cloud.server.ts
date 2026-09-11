import { getSql } from "@/lib/db";
import {
  parseCloudDoc,
  pullCloud as pullWith,
  pushCloud as pushWith,
  getAttPhoto as getPhotoWith,
  putAttPhoto as putPhotoWith,
  type CloudStorage,
  type PhotoStorage,
} from "@/lib/pos-cloud-ops";
import type { CloudDoc, CloudPayload } from "@/lib/pos-cloud";
import type { PhotoGetResult, PhotoPutResult, PullCloudResult, PushCloudResult } from "@/lib/pos-cloud-ops";

const ROW_ID = "hven-space";
const BLOB_KEY = "snapshot";

type BlobStore = {
  get: (key: string, opts?: { type?: string }) => Promise<unknown>;
  setJSON: (key: string, value: unknown) => Promise<unknown>;
  set: (key: string, value: string) => Promise<unknown>;
};

async function blobsStore(): Promise<BlobStore | null> {
  try {
    const mod = await import("@netlify/blobs");
    return mod.getStore({ name: "hven-pos", consistency: "strong" }) as unknown as BlobStore;
  } catch {
    return null;
  }
}

async function readFromSql(): Promise<CloudDoc | null> {
  const sql = await getSql();
  const rows = await sql<{ rev: number; updated_at: string; device: string; payload: string }>`
    select rev, updated_at, device, payload from pos_cloud where id = ${ROW_ID} limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  try {
    return parseCloudDoc({
      rev: row.rev,
      updatedAt: row.updated_at,
      device: row.device,
      payload: JSON.parse(row.payload),
    });
  } catch {
    return null;
  }
}

async function writeToSql(doc: CloudDoc): Promise<void> {
  const sql = await getSql();
  const payload = JSON.stringify(doc.payload);
  await sql`
    insert into pos_cloud (id, rev, updated_at, device, payload)
    values (${ROW_ID}, ${doc.rev}, ${doc.updatedAt}, ${doc.device}, ${payload})
    on conflict (id) do update set
      rev = excluded.rev,
      updated_at = excluded.updated_at,
      device = excluded.device,
      payload = excluded.payload
  `;
}

const sqlStorage: CloudStorage = {
  read: readFromSql,
  write: writeToSql,
};

async function resolveStorage(): Promise<CloudStorage> {
  const blobs = await blobsStore();
  if (blobs) {
    return {
      read: async () => parseCloudDoc(await blobs.get(BLOB_KEY, { type: "json" })),
      write: async (doc) => {
        await blobs.setJSON(BLOB_KEY, doc);
      },
    };
  }
  return sqlStorage;
}

const sqlPhotos: PhotoStorage = {
  get: async (id) => {
    const sql = await getSql();
    const rows = await sql<{ data: string }>`select data from pos_photos where id = ${id} limit 1`;
    return rows[0]?.data ?? null;
  },
  put: async (id, data) => {
    const sql = await getSql();
    await sql`
      insert into pos_photos (id, data, updated_at)
      values (${id}, ${data}, now())
      on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at
    `;
  },
};

async function resolvePhotos(): Promise<PhotoStorage> {
  const blobs = await blobsStore();
  if (blobs) {
    return {
      get: async (id) => {
        const raw = await blobs.get(`photo:${id}`, { type: "text" });
        return typeof raw === "string" && raw ? raw : null;
      },
      put: async (id, data) => {
        await blobs.set(`photo:${id}`, data);
      },
    };
  }
  return sqlPhotos;
}

function useNetlifyProxy(): boolean {
  const v = process.env.VERCEL;
  return v === "1" || v === "true";
}

async function proxyNetlify(body: Record<string, unknown>) {
  const url = process.env.POS_CLOUD_UPSTREAM || "https://hven-space-pos.netlify.app/api/pos-cloud";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("json")) {
    return { ok: false, error: `Cloud ${res.status} dari host lama.` };
  }
  return res.json();
}

export async function pullCloud(token: string): Promise<PullCloudResult> {
  try {
    if (useNetlifyProxy()) return (await proxyNetlify({ op: "pull", token })) as PullCloudResult;
    return await pullWith(token, await resolveStorage());
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menarik data cloud." };
  }
}

export async function pushCloud(input: {
  token: string;
  baseRev: number;
  device: string;
  payload: CloudPayload;
}): Promise<PushCloudResult> {
  try {
    if (useNetlifyProxy()) {
      return (await proxyNetlify({
        op: "push",
        token: input.token,
        baseRev: input.baseRev,
        device: input.device,
        payload: input.payload,
      })) as PushCloudResult;
    }
    return await pushWith(input, await resolveStorage());
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyimpan ke cloud." };
  }
}

export async function getCloudPhoto(token: string, id: string): Promise<PhotoGetResult> {
  try {
    if (useNetlifyProxy()) return (await proxyNetlify({ op: "photo-get", token, id })) as PhotoGetResult;
    return await getPhotoWith(token, id, await resolvePhotos());
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal ambil foto." };
  }
}

export async function putCloudPhoto(token: string, id: string, data: string): Promise<PhotoPutResult> {
  try {
    if (useNetlifyProxy()) return (await proxyNetlify({ op: "photo-put", token, id, data })) as PhotoPutResult;
    return await putPhotoWith(token, id, data, await resolvePhotos());
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal simpan foto." };
  }
}
