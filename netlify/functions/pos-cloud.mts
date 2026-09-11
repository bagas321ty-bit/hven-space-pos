import { getStore } from "@netlify/blobs";
import {
  parseCloudDoc,
  pullCloud,
  pushCloud,
  getAttPhoto,
  putAttPhoto,
} from "../../src/lib/pos-cloud-ops";
import type { CloudPayload } from "../../src/lib/pos-cloud";

const KEY = "snapshot";

function blobStorage() {
  const blobs = getStore({ name: "hven-pos", consistency: "strong" });
  return {
    read: async () => parseCloudDoc(await blobs.get(KEY, { type: "json" })),
    write: async (doc: { rev: number; updatedAt: string; device: string; payload: CloudPayload }) => {
      await blobs.setJSON(KEY, doc);
    },
  };
}

function photoStorage() {
  const blobs = getStore({ name: "hven-pos", consistency: "strong" });
  return {
    get: async (id: string) => {
      const raw = await blobs.get(`photo:${id}`, { type: "text" });
      return typeof raw === "string" && raw ? raw : null;
    },
    put: async (id: string, data: string) => {
      await blobs.set(`photo:${id}`, data);
    },
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ ok: false, error: "Gunakan POST." }, 405);
  let body: {
    op?: string;
    token?: string;
    baseRev?: number;
    device?: string;
    payload?: CloudPayload;
    id?: string;
    data?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "JSON tidak valid." }, 400);
  }
  const token = typeof body.token === "string" ? body.token : "";
  try {
    if (body.op === "pull") return json(await pullCloud(token, blobStorage()));
    if (body.op === "push") {
      return json(
        await pushCloud(
          {
            token,
            baseRev: Number(body.baseRev) || 0,
            device: typeof body.device === "string" ? body.device : "",
            payload: body.payload as CloudPayload,
          },
          blobStorage(),
        ),
      );
    }
    if (body.op === "photo-get") {
      return json(await getAttPhoto(token, typeof body.id === "string" ? body.id : "", photoStorage()));
    }
    if (body.op === "photo-put") {
      return json(
        await putAttPhoto(
          token,
          typeof body.id === "string" ? body.id : "",
          typeof body.data === "string" ? body.data : "",
          photoStorage(),
        ),
      );
    }
    return json({ ok: false, error: "Operasi tidak dikenal." }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloud Netlify gagal.";
    return json({ ok: false, error: message }, 500);
  }
};
