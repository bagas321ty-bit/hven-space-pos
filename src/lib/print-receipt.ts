import { formatIDR, formatTimeID } from "@/lib/format";
import type { Order } from "@/lib/types";

const BLE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

export function receiptText(order: Order): string {
  const w = 32;
  const row = (l: string, r = "") => {
    const left = l.slice(0, w - r.length);
    return left + " ".repeat(Math.max(1, w - left.length - r.length)) + r;
  };
  const lines: string[] = [
    center("HVEN SPACE", w),
    center("Cafe & Experience Hub", w),
    center(order.number, w),
    center(formatTimeID(order.createdAt), w),
    order.status === "open" ? center("OPEN BILL - BELUM LUNAS", w) : "",
    "-".repeat(w),
    `${order.type}${order.table !== "-" ? `  Meja ${order.table}` : ""}`,
    order.customer && order.customer !== "-" ? order.customer : "",
    "-".repeat(w),
  ];
  for (const it of order.items) {
    const add = it.addons.reduce((s, a) => s + a.price, 0);
    lines.push(row(`${it.qty}x ${it.name}`, formatIDR((it.price + add) * it.qty)));
  }
  lines.push("-".repeat(w));
  lines.push(row("Subtotal", formatIDR(order.subtotal)));
  if (order.discount > 0) lines.push(row(`Diskon ${order.discountLabel}`, `-${formatIDR(order.discount)}`));
  if ((order.service ?? 0) > 0) lines.push(row("Service 5%", formatIDR(order.service ?? 0)));
  if (order.taxExempt) lines.push(row("PB1 dibebaskan", "Rp 0"));
  else if (order.tax > 0) lines.push(row("PB1 10%", formatIDR(order.tax)));
  lines.push(row("TOTAL", formatIDR(order.total)));
  if (order.status === "open") lines.push(row("Status", "Belum lunas"));
  else lines.push(row(order.payment, formatIDR(order.tendered)));
  if (order.change > 0) lines.push(row("Kembali", formatIDR(order.change)));
  lines.push("-".repeat(w));
  lines.push(center(`Kasir ${order.cashier}`, w));
  lines.push(center("Terima kasih", w));
  lines.push("", "", "", "");
  return lines.filter((l) => l !== undefined).join("\n");
}

function center(s: string, w: number) {
  const t = s.slice(0, w);
  const pad = Math.max(0, Math.floor((w - t.length) / 2));
  return " ".repeat(pad) + t;
}

function toEscPos(text: string): Uint8Array {
  const encoder = new TextEncoder();
  const body = encoder.encode(text);
  const init = new Uint8Array([0x1b, 0x40, 0x1b, 0x61, 0x01]);
  const cut = new Uint8Array([0x0a, 0x0a, 0x1d, 0x56, 0x00]);
  const out = new Uint8Array(init.length + body.length + cut.length);
  out.set(init, 0);
  out.set(body, init.length);
  out.set(cut, init.length + body.length);
  return out;
}

export function printSystem(): void {
  window.print();
}

export function printRawBT(text: string): boolean {
  const encoded = encodeURIComponent(text);
  const android = /Android/i.test(navigator.userAgent);
  if (!android && !/Chrome/i.test(navigator.userAgent)) return false;
  const url = `intent:${encoded}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end`;
  const fallback = `rawbt:${encoded}`;
  try {
    window.location.href = android ? url : fallback;
    return true;
  } catch {
    try {
      window.open(fallback, "_blank");
      return true;
    } catch {
      return false;
    }
  }
}

type BleChar = {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue: (d: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (d: BufferSource) => Promise<void>;
};

export async function printBluetooth(order: Order): Promise<"rawbt" | "ble"> {
  const text = receiptText(order);
  if (/Android/i.test(navigator.userAgent)) {
    if (printRawBT(text)) return "rawbt";
  }
  const bt = (navigator as Navigator & { bluetooth?: { requestDevice: (o: unknown) => Promise<BluetoothDeviceLike> } }).bluetooth;
  if (!bt) throw new Error("Tablet ini tidak mendukung Web Bluetooth. Instal RawBT, pairing printer di Bluetooth, lalu cetak lagi.");
  const device = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_SERVICES,
  });
  const server = await device.gatt?.connect();
  if (!server) throw new Error("Gagal sambung ke printer.");
  const services = await server.getPrimaryServices();
  let char: BleChar | null = null;
  for (const svc of services) {
    const chars = await svc.getCharacteristics();
    char = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write) ?? null;
    if (char) break;
  }
  if (!char) {
    server.disconnect();
    throw new Error("Printer tidak menerima data. Pakai RawBT untuk printer Bluetooth klasik.");
  }
  const bytes = toEscPos(text);
  const chunk = 20;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.slice(i, i + chunk);
    if (char.properties.writeWithoutResponse && char.writeValueWithoutResponse) await char.writeValueWithoutResponse(slice);
    else await char.writeValue(slice);
  }
  return "ble";
}

type BluetoothDeviceLike = {
  gatt?: {
    connect: () => Promise<{
      getPrimaryServices: () => Promise<
        Array<{ getCharacteristics: () => Promise<BleChar[]> }>
      >;
      disconnect: () => void;
    }>;
  };
};
