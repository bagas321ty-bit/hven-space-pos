import { createServerFn } from "@tanstack/react-start";
import type { CloudPayload } from "@/lib/pos-cloud";

export const pullPosCloud = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => {
    if (!d || typeof d.token !== "string") throw new Error("token required");
    return { token: d.token };
  })
  .handler(async ({ data }) => {
    const { pullCloud } = await import("@/lib/pos-cloud.server");
    return pullCloud(data.token);
  });

export const pushPosCloud = createServerFn({ method: "POST" })
  .validator((d: { token: string; baseRev: number; device: string; payload: CloudPayload }) => {
    if (!d || typeof d.token !== "string") throw new Error("token required");
    return {
      token: d.token,
      baseRev: Number(d.baseRev) || 0,
      device: typeof d.device === "string" ? d.device : "",
      payload: d.payload,
    };
  })
  .handler(async ({ data }) => {
    const { pushCloud } = await import("@/lib/pos-cloud.server");
    return pushCloud(data);
  });

export const getPosPhoto = createServerFn({ method: "POST" })
  .validator((d: { token: string; id: string }) => {
    if (!d || typeof d.token !== "string" || typeof d.id !== "string") throw new Error("foto required");
    return { token: d.token, id: d.id };
  })
  .handler(async ({ data }) => {
    const { getCloudPhoto } = await import("@/lib/pos-cloud.server");
    return getCloudPhoto(data.token, data.id);
  });

export const putPosPhoto = createServerFn({ method: "POST" })
  .validator((d: { token: string; id: string; data: string }) => {
    if (!d || typeof d.token !== "string" || typeof d.id !== "string" || typeof d.data !== "string") {
      throw new Error("foto required");
    }
    return { token: d.token, id: d.id, data: d.data };
  })
  .handler(async ({ data }) => {
    const { putCloudPhoto } = await import("@/lib/pos-cloud.server");
    return putCloudPhoto(data.token, data.id, data.data);
  });
