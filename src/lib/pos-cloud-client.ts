import { getPosPhoto, pullPosCloud, pushPosCloud, putPosPhoto } from "@/lib/pos-cloud-api";
import type { CloudPayload } from "@/lib/pos-cloud";
import type { PhotoGetResult, PhotoPutResult, PullCloudResult, PushCloudResult } from "@/lib/pos-cloud-ops";

type PullBody = { op: "pull"; token: string };
type PushBody = { op: "push"; token: string; baseRev: number; device: string; payload: CloudPayload };
type PhotoGetBody = { op: "photo-get"; token: string; id: string };
type PhotoPutBody = { op: "photo-put"; token: string; id: string; data: string };

async function postApi<T>(body: PullBody | PushBody | PhotoGetBody | PhotoPutBody): Promise<T | null> {
  try {
    const res = await fetch("/api/pos-cloud", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return null;
    const data = (await res.json()) as T;
    return data;
  } catch {
    return null;
  }
}

export async function pullCloudClient(token: string): Promise<PullCloudResult> {
  const viaApi = await postApi<PullCloudResult>({ op: "pull", token });
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
  const viaApi = await postApi<PushCloudResult>({ op: "push", ...input });
  if (viaApi && typeof viaApi === "object" && "ok" in viaApi) return viaApi;
  try {
    return await pushPosCloud({ data: input });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal hubungi cloud." };
  }
}

export async function getPhotoClient(input: { token: string; id: string }): Promise<PhotoGetResult> {
  const viaApi = await postApi<PhotoGetResult>({ op: "photo-get", ...input });
  if (viaApi && typeof viaApi === "object" && "ok" in viaApi) return viaApi;
  try {
    return await getPosPhoto({ data: input });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal ambil foto." };
  }
}

export async function putPhotoClient(input: { token: string; id: string; data: string }): Promise<PhotoPutResult> {
  const viaApi = await postApi<PhotoPutResult>({ op: "photo-put", ...input });
  if (viaApi && typeof viaApi === "object" && "ok" in viaApi) return viaApi;
  try {
    return await putPosPhoto({ data: input });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal unggah foto." };
  }
}
