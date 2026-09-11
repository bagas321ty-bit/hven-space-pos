import type { Order } from "@/lib/types";

/** 10 menit setelah dapur menekan Selesai. */
export const FEEDBACK_WAIT_MS = 10 * 60 * 1000;

export function hasKitchenItems(order: Order): boolean {
  return order.items.some((i) => i.kitchen);
}

export function isFeedbackLocked(order: Order, now = Date.now()): boolean {
  if (order.status === "void") return false;
  if (order.feedbackStatus === "done" || order.feedbackStatus === "skipped") return false;
  if (order.feedbackStatus === "due") return true;
  if (order.feedbackStatus !== "waiting" || !order.kdsDoneAt) return false;
  const t = Date.parse(order.kdsDoneAt);
  if (Number.isNaN(t)) return false;
  return now - t >= FEEDBACK_WAIT_MS;
}

export function feedbackRemainingMs(order: Order, now = Date.now()): number {
  if (!order.kdsDoneAt || order.kdsStatus !== "done") return 0;
  if (order.feedbackStatus === "done" || order.feedbackStatus === "skipped") return 0;
  const t = Date.parse(order.kdsDoneAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, t + FEEDBACK_WAIT_MS - now);
}

export function formatRemain(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function hasComplaint(order: Order): boolean {
  return Boolean(order.feedback?.note?.trim());
}
