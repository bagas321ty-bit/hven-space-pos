import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateID, formatIDR, formatTimeID } from "@/lib/format";
import { usePos } from "@/lib/store";
import type { AdjustLog } from "@/lib/types";

type Filter = "all" | "discount" | "tax" | "service";

export function AdjustLogView() {
  const logs = usePos((s) => s.adjustLogs);
  const orders = usePos((s) => s.orders);
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(
    () => logs.filter((l) => (filter === "all" ? true : l.kind === filter)),
    [logs, filter],
  );

  const liveOrders = orders.filter((o) => o.status === "paid" && !o.createdAt.startsWith("2026-09-08") && !o.createdAt.startsWith("2026-09-09"));
  const fromLogs = {
    discount: logs.filter((l) => l.kind === "discount" && !l.historic).reduce((s, l) => s + l.amount, 0),
    tax: logs.filter((l) => l.kind === "tax" && l.action === "apply" && !l.historic).reduce((s, l) => s + l.amount, 0),
    service: logs.filter((l) => l.kind === "service" && !l.historic).reduce((s, l) => s + l.amount, 0),
    exempt: logs.filter((l) => l.kind === "tax" && l.action === "exempt").length,
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div>
        <h2 className="font-display text-xl font-medium">Log Diskon & Pajak</h2>
        <p className="text-sm text-muted-foreground">
          Standar F&B: diskon dan PB1 dicatat per struk baru. Data 8–9 Sep dari spreadsheet dikunci historis — tidak dihitung mundur.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Diskon diberikan" value={formatIDR(fromLogs.discount)} hint="Bill baru saja" />
        <Kpi label="PB1 tertagih" value={formatIDR(fromLogs.tax)} hint="10% setelah diskon" />
        <Kpi label="Service charge" value={formatIDR(fromLogs.service)} hint="Opsional 5%" />
        <Kpi label="PB1 dibebaskan" value={String(fromLogs.exempt)} hint="Struk exempt" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Aturan kasir</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Harga menu tetap seperti spreadsheet (belum termasuk pajak).</li>
          <li>PB1 10% default menyala di bill baru. Matikan bila paket/event/exempt.</li>
          <li>Service 5% opsional (umum dine-in restoran, default off untuk kafe).</li>
          <li>Diskon wajib alasan (promo, member, staf). Masuk log saat Charge.</li>
          <li>{liveOrders.length} struk baru di luar arsip 8–9 Sep.</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Semua"],
            ["discount", "Diskon"],
            ["tax", "Pajak"],
            ["service", "Service"],
          ] as const
        ).map(([id, label]) => (
          <Button key={id} size="sm" variant={filter === id ? "default" : "secondary"} onClick={() => setFilter(id)}>
            {label}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              {["Waktu", "Struk", "Jenis", "Keterangan", "Alasan", "Nominal", "Kasir"].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  Belum ada penyesuaian. Pakai Diskon / PB1 di keranjang kasir, lalu Charge.
                </td>
              </tr>
            )}
            {rows.map((l) => (
              <LogRow key={l.id} log={l} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogRow({ log }: { log: AdjustLog }) {
  const tone = log.kind === "discount" ? "warning" : log.action === "exempt" ? "muted" : "success";
  const kindLabel = log.kind === "discount" ? "Diskon" : log.kind === "service" ? "Service" : "Pajak";
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
        {formatDateID(log.createdAt.slice(0, 10))} {formatTimeID(log.createdAt)}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{log.orderNumber}</td>
      <td className="px-3 py-2">
        <Badge tone={tone}>{kindLabel}</Badge>
      </td>
      <td className="px-3 py-2">{log.label}</td>
      <td className="px-3 py-2 text-muted-foreground">{log.reason}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {log.kind === "discount" ? `-${formatIDR(log.amount)}` : formatIDR(log.amount)}
      </td>
      <td className="px-3 py-2">{log.actor}</td>
    </tr>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
