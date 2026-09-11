import { formatIDR, formatTimeID } from "@/lib/format";
import type { Order } from "@/lib/types";

export type WaMode = "number" | "group";

export function toWaPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  let n = digits;
  if (n.startsWith("0")) n = `62${n.slice(1)}`;
  else if (n.startsWith("8")) n = `62${n}`;
  if (!n.startsWith("62") || n.length < 11 || n.length > 15) return null;
  return n;
}

export function openWhatsApp(phone: string, text: string): boolean {
  const n = toWaPhone(phone);
  if (!n || typeof window === "undefined") return false;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  return true;
}

/** Opens WhatsApp so the cashier can pick a group (or any chat). Groups have no phone number. */
export async function openWhatsAppGroup(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const encoded = encodeURIComponent(text);
  const android = /Android/i.test(navigator.userAgent);
  if (android) {
    const intent = `intent://send?text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=https://wa.me/?text=${encoded};end`;
    window.location.href = intent;
    return true;
  }
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "HVEN Space", text });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return true;
    }
  }
  window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
  return true;
}

export async function sendWhatsApp(target: { mode: WaMode; phone?: string }, text: string): Promise<boolean> {
  if (target.mode === "group") return openWhatsAppGroup(text);
  return openWhatsApp(target.phone ?? "", text);
}

export function receiptWaText(order: Order): string {
  const items = order.items.map((i) => `• ${i.qty}× ${i.name}`).join("\n");
  return [
    "HVEN Space",
    order.number,
    formatTimeID(order.createdAt),
    `${order.type}${order.table !== "-" ? ` · meja ${order.table}` : ""}`,
    items,
    `Total ${formatIDR(order.total)}`,
    order.status === "open" ? "OPEN BILL · belum lunas" : order.payment,
    "Terima kasih.",
  ].join("\n");
}

export function alertWaText(title: string, message: string): string {
  return `HVEN Space\n${title}\n${message}`;
}
