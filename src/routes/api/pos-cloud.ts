import { createFileRoute } from "@tanstack/react-router";
import type { CloudPayload } from "@/lib/pos-cloud";

export const Route = createFileRoute("/api/pos-cloud")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { pullCloud, pushCloud, getCloudPhoto, putCloudPhoto } = await import("@/lib/pos-cloud.server");
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
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ ok: false, error: "JSON tidak valid." }, { status: 400 });
        }
        const token = typeof body.token === "string" ? body.token : "";
        if (body.op === "pull") return Response.json(await pullCloud(token));
        if (body.op === "push") {
          return Response.json(
            await pushCloud({
              token,
              baseRev: Number(body.baseRev) || 0,
              device: typeof body.device === "string" ? body.device : "",
              payload: body.payload as CloudPayload,
            }),
          );
        }
        if (body.op === "photo-get") {
          return Response.json(await getCloudPhoto(token, typeof body.id === "string" ? body.id : ""));
        }
        if (body.op === "photo-put") {
          return Response.json(
            await putCloudPhoto(token, typeof body.id === "string" ? body.id : "", typeof body.data === "string" ? body.data : ""),
          );
        }
        return Response.json({ ok: false, error: "Operasi tidak dikenal." }, { status: 400 });
      },
    },
  },
});
