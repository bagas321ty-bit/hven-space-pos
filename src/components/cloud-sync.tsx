import { useEffect, useState } from "react";
import { Cloud, CloudOff, LoaderCircle, RefreshCw } from "lucide-react";
import { pullCloudClient, pushCloudClient } from "@/lib/pos-cloud-client";
import {
  extractPayload,
  mergePayloads,
  payloadFingerprint,
  type CloudPayload,
} from "@/lib/pos-cloud";
import { usePos } from "@/lib/store";
import { offloadAttendanceList, flushPendingPhotos } from "@/lib/att-photo";
import { flushMenuPhotos, hydrateMenuPhotos } from "@/lib/menu-photo-sync";
import { onCloudNudge } from "@/lib/cloud-nudge";
import { VENUE_PASS_SHA256 } from "@/lib/venue-auth";
import { cn } from "@/lib/utils";

function newDeviceId() {
  try {
    return `hven-${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `hven-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function currentPayload(): CloudPayload {
  return extractPayload(usePos.getState());
}

let busy = false;
let queued: "boot" | "poll" | "manual" | "local" | null = null;
let lastFingerprint = "";
let skipPushUntil = 0;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function pushNow(payload: CloudPayload) {
  const s = usePos.getState();
  const res = await pushCloudClient({
    token: VENUE_PASS_SHA256,
    baseRev: s.cloudRev,
    device: s.deviceId,
    payload,
  });
  if (res.ok) {
    lastFingerprint = payloadFingerprint(res.payload ?? payload);
    if (res.payload) {
      s.applyCloud(res.payload, res.rev, res.updatedAt);
    } else {
      s.setCloudMeta({ cloudRev: res.rev, cloudAt: res.updatedAt, cloudStatus: "ok", cloudError: "" });
    }
    return true;
  }
  if (res.conflict && res.payload) {
    const merged = mergePayloads(payload, res.payload);
    s.applyCloud(merged, res.rev ?? s.cloudRev, res.updatedAt ?? s.cloudAt);
    skipPushUntil = Date.now() + 1500;
    lastFingerprint = payloadFingerprint(merged);
    const retry = await pushCloudClient({
      token: VENUE_PASS_SHA256,
      baseRev: usePos.getState().cloudRev,
      device: usePos.getState().deviceId,
      payload: merged,
    });
    if (retry.ok) {
      lastFingerprint = payloadFingerprint(merged);
      usePos.getState().setCloudMeta({
        cloudRev: retry.rev,
        cloudAt: retry.updatedAt,
        cloudStatus: "ok",
        cloudError: "",
      });
      return true;
    }
    usePos.getState().setCloudMeta({ cloudStatus: "error", cloudError: retry.error });
    return false;
  }
  s.setCloudMeta({ cloudStatus: "error", cloudError: res.error });
  return false;
}

export async function runCloudSync(reason: "boot" | "poll" | "manual" | "local"): Promise<void> {
  if (busy) {
    queued = reason;
    return;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    usePos.getState().setCloudMeta({ cloudStatus: "offline", cloudError: "Tidak ada internet." });
    return;
  }
  busy = true;
  usePos.getState().setCloudMeta({ cloudStatus: "syncing", cloudError: "" });
  try {
    const s0 = usePos.getState();
    if (!s0.deviceId) s0.setCloudMeta({ deviceId: newDeviceId() });

    const pulled = await pullCloudClient(VENUE_PASS_SHA256);
    if (!pulled.ok) {
      usePos.getState().setCloudMeta({ cloudStatus: "error", cloudError: pulled.error });
      return;
    }

    const local = currentPayload();
    if (pulled.empty) {
      const ok = await pushNow(local);
      if (ok) skipPushUntil = Date.now() + 2000;
      return;
    }

    const merged = mergePayloads(local, pulled.payload);
    const mergedFp = payloadFingerprint(merged);
    const remoteFp = payloadFingerprint(pulled.payload);
    const localFp = payloadFingerprint(local);

    if (mergedFp !== localFp) {
      usePos.getState().applyCloud(merged, pulled.rev, pulled.updatedAt);
      const afterOff = await offloadAttendanceList(usePos.getState().attendance);
      if (afterOff.changed) usePos.setState({ attendance: afterOff.rows });
      skipPushUntil = Date.now() + 1500;
    } else {
      usePos.getState().setCloudMeta({
        cloudRev: Math.max(usePos.getState().cloudRev, pulled.rev),
        cloudAt: pulled.updatedAt,
        cloudStatus: "ok",
        cloudError: "",
      });
    }

    lastFingerprint = payloadFingerprint(currentPayload());
    const after = currentPayload();
    const afterFp = payloadFingerprint(after);
    if (afterFp !== remoteFp || usePos.getState().cloudRev !== pulled.rev) {
      await pushNow(after);
      skipPushUntil = Date.now() + 1500;
    } else if (reason === "manual") {
      usePos.getState().setCloudMeta({ cloudStatus: "ok", cloudError: "" });
    }
  } catch (err) {
    usePos.getState().setCloudMeta({
      cloudStatus: "error",
      cloudError: err instanceof Error ? err.message : "Gagal sinkron.",
    });
  } finally {
    busy = false;
    const next = queued;
    queued = null;
    if (next) void runCloudSync(next);
    void (async () => {
      try {
        const off = await offloadAttendanceList(usePos.getState().attendance);
        if (off.changed) usePos.setState({ attendance: off.rows });
        await flushPendingPhotos();
        await flushMenuPhotos(usePos.getState().products);
        const menu = await hydrateMenuPhotos(usePos.getState().products);
        if (menu.changed) usePos.setState({ products: menu.rows });
      } catch {
        /* foto tidak boleh menahan sinkron order/menu */
      }
    })();
  }
}

function schedulePush() {
  if (usePos.getState().cloudApplying) return;
  const fp = payloadFingerprint(currentPayload());
  if (fp === lastFingerprint) return;
  if (pushTimer) clearTimeout(pushTimer);
  const wait = Math.max(400, skipPushUntil - Date.now());
  pushTimer = setTimeout(() => {
    void runCloudSync("local");
  }, wait);
}

const CANONICAL_HOST = "hven-space-pos-bagas321ty-1278.vercel.app";

async function migrateLegacyHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (h === CANONICAL_HOST || h === "localhost" || h === "127.0.0.1") return false;
  if (!/\.netlify\.app$|\.netlify\.com$/i.test(h)) return false;
  await runCloudSync("boot");
  window.location.replace(`https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}`);
  return true;
}

export function CloudSync() {
  useEffect(() => {
    let stopped = false;
    const boot = () => {
      if (stopped) return;
      if (!usePos.getState().hydrated) {
        setTimeout(boot, 80);
        return;
      }
      lastFingerprint = payloadFingerprint(currentPayload());
      void (async () => {
        const moved = await migrateLegacyHost();
        if (!stopped && !moved) void runCloudSync("boot");
      })();
    };
    boot();

    const unsub = usePos.subscribe((s, prev) => {
      if (!s.hydrated || s.cloudApplying) return;
      if (s === prev) return;
      schedulePush();
    });
    onCloudNudge(() => {
      void runCloudSync("local");
    });

    const ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("hven-live") : null;
    const unsubLive = usePos.subscribe((s, prev) => {
      if (!ch || s.cloudApplying) return;
      if (s.orders === prev.orders) return;
      try {
        ch.postMessage({
          kind: "orders",
          orders: s.orders,
          device: s.deviceId,
        });
      } catch {
        /* ignore */
      }
    });
    const onLive = (ev: MessageEvent) => {
      const data = ev.data as { kind?: string; orders?: CloudPayload["orders"] };
      if (data?.kind !== "orders" || !Array.isArray(data.orders)) return;
      const local = currentPayload();
      const merged = mergePayloads(local, { ...local, orders: data.orders });
      if (payloadFingerprint(merged) === payloadFingerprint(local)) return;
      usePos.getState().applyCloud(merged, usePos.getState().cloudRev, usePos.getState().cloudAt);
    };
    ch?.addEventListener("message", onLive);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "hven-pos-v3" || !e.newValue) return;
      void runCloudSync("poll");
    };
    window.addEventListener("storage", onStorage);

    const poll = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void runCloudSync("poll");
    }, 3000);

    const onVis = () => {
      if (document.visibilityState === "visible") void runCloudSync("poll");
      else void runCloudSync("local");
    };
    const onOnline = () => void runCloudSync("poll");
    const onHide = () => {
      void runCloudSync("local");
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onHide);

    return () => {
      stopped = true;
      unsub();
      unsubLive();
      ch?.removeEventListener("message", onLive);
      ch?.close();
      window.removeEventListener("storage", onStorage);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onHide);
      if (pushTimer) clearTimeout(pushTimer);
    };
  }, []);
  return null;
}

export function CloudSyncBadge({ compact = false }: { compact?: boolean }) {
  const status = usePos((s) => s.cloudStatus);
  const error = usePos((s) => s.cloudError);
  const at = usePos((s) => s.cloudAt);
  const [now, setNow] = useState(() => Date.now());
  const [checkedAt, setCheckedAt] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (status === "ok") setCheckedAt(Date.now());
  }, [status, at]);

  const clock = checkedAt || (at ? Date.parse(at) : 0);
  const timeLabel = clock
    ? new Date(clock).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : "";

  const label =
    status === "syncing"
      ? "Menyimpan…"
      : status === "ok"
        ? compact
          ? timeLabel || "OK"
          : timeLabel
            ? `Tersinkron · ${timeLabel}`
            : "Tersinkron"
        : status === "offline"
          ? "Offline"
          : status === "error"
            ? compact
              ? "Gagal"
              : error
                ? `Gagal · ${error.slice(0, 28)}`
                : "Gagal"
            : "Sinkron";

  const tone =
    status === "ok"
      ? "text-success border-success/30 bg-success/10"
      : status === "error" || status === "offline"
        ? "text-destructive border-destructive/30 bg-destructive/10"
        : "text-muted-foreground border-border bg-card";

  const Icon = status === "syncing" ? LoaderCircle : status === "offline" || status === "error" ? CloudOff : Cloud;
  const title =
    error ||
    (clock
      ? `Dicek ${new Date(clock).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
      : "Sinkron tablet & laptop");

  return (
    <button
      type="button"
      onClick={() => void runCloudSync("manual")}
      title={title}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium",
        tone,
      )}
    >
      <Icon className={cn("size-3.5", status === "syncing" && "animate-spin")} />
      {!compact && <span>{label}</span>}
      {status === "ok" && !compact && now - clock < 120000 && clock > 0 && (
        <RefreshCw className="size-3 opacity-50" />
      )}
    </button>
  );
}
