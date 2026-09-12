import { getPosPhoto, pullPosCloud, pushPosCloud, putPosPhoto } from "@/lib/pos-cloud-api";
import { getCloudOrigins } from "@/lib/cloud-origin";
import type { CloudPayload } from "@/lib/pos-cloud";
import type { PhotoGetResult, PhotoPutResult, PullCloudResult, PushCloudResult } from "@/lib/pos-cloud-ops";

type PullBody = { op: "pull"; token: string };
type PushBody = { op: "push"; token: string; baseRev: number; device: string; payload: CloudPayload };
type PhotoGetBody = { op: "photo-get"; token: string; id: string };
type PhotoPutBody = { op: "photo-put"; token: string; id: string; data: string };
type Body = PullBody | PushBody | PhotoGetBody | PhotoPutBody;

function endpoints(): string[] {
  const extra = getCloudOrigins().map((o) => `${o}/api/pos-cloud`);
  if (extra.length) return extra;
  return ["/api/pos-cloud"];
}

async function postOne<T>(url: string, body: Body): Promise<T | null> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 45_000) : null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: ctrl?.signal,
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function postApi<T extends { ok?: boolean }>(body: Body, mode: "first" | "all"): Promise<T | null> {
  const urls = endpoints();
  if (mode === "first") {
    for (const url of urls) {
      const data = await postOne<T>(url, body);
      if (data && typeof data === "object" && "ok" in data) return data;
    }
    return null;
  }
  let last: T | null = null;
  for (const url of urls) {
    const data = await postOne<T>(url, body);
    if (data && typeof data === "object" && "ok" in data) last = data;
  }
  return last;
}

export async function pullCloudClient(token: string): Promise<PullCloudResult> {
  const viaApi = await postApi<PullCloudResult>({ op: "pull", token }, "first");
  if (viaApi && typeof viaApi === "object" && "ok" in viaApi) return viaApi;
  try {
    return await pullPosCloud({ data: { token } });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal hubungi cloud." };
  }
}

export async function pushCloudClient(input: {
  token: string;
  baseRev: number;
  device: string;
  payload: CloudPayload;
}): Promise<PushCloudResult> {
  const viaApi = await postApi<PushCloudResult>({ op: "push", ...input }, "all");
  if (viaApi && typeof viaApi === "object" && "ok" in viaApi) return viaApi;
  try {
    return await pushPosCloud({ data: input });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal kirim cloud." };
  }
}

export async function getPhotoClient(input: { token: string; id: string }): Promise<PhotoGetResult> {
  const viaApi = await postApi<PhotoGetResult>({ op: "photo-get", ...input }, "first");
  if (viaApi && typeof viaApi === "object" && "ok" in viaApi) return viaApi;
  try {
    return await getPosPhoto({ data: input });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal ambil foto." };
  }
}

export async function putPhotoClient(input: { token: string; id: string; data: string }): Promise<PhotoPutResult> {
  const viaApi = await postApi<PhotoPutResult>({ op: "photo-put", ...input }, "all");
  if (viaApi && typeof viaApi === "object" && "ok" in viaApi) return viaApi;
  try {
    return await putPosPhoto({ data: input });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal unggah foto." };
  }
}
