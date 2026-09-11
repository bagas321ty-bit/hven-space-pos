import { useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cutoffPeriod } from "@/lib/format";
import { downloadBukuExcel, resolveBukuScope, summarizeBuku, type BukuExportInput, type BukuScopeMode } from "@/lib/buku-export";
import { usePos } from "@/lib/store";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function BukuExportView() {
  const dailySales = usePos((s) => s.dailySales);
  const dailyBooks = usePos((s) => s.dailyBooks);
  const expenses = usePos((s) => s.expenses);
  const incomes = usePos((s) => s.incomes);
  const orders = usePos((s) => s.orders);
  const moneyIn = usePos((s) => s.moneyIn);
  const managerCash = usePos((s) => s.managerCash);
  const managerCashCap = usePos((s) => s.managerCashCap);
  const tutupBuku = usePos((s) => s.tutupBuku);
  const weekly = usePos((s) => s.weekly);
  const products = usePos((s) => s.products);
  const sisihGajiPerDay = usePos((s) => s.sisihGajiPerDay);
  const sisihOpsPerDay = usePos((s) => s.sisihOpsPerDay);
  const priveWeeklyCap = usePos((s) => s.priveWeeklyCap);
  const actor = usePos((s) => s.bukuSession?.name ?? "Owner");
  const [mode, setMode] = useState<BukuScopeMode>("cutoff");
  const [busy, setBusy] = useState(false);
  const cur = cutoffPeriod();

  const input: BukuExportInput = useMemo(
    () => ({
      dailySales,
      dailyBooks,
      expenses,
      incomes,
      orders,
      moneyIn,
      managerCash,
      managerCashCap,
      tutupBuku,
      weekly,
      products,
      sisihGajiPerDay,
      sisihOpsPerDay,
      priveWeeklyCap,
      actor,
    }),
    [
      dailySales,
      dailyBooks,
      expenses,
      incomes,
      orders,
      moneyIn,
      managerCash,
      managerCashCap,
      tutupBuku,
      weekly,
      products,
      sisihGajiPerDay,
      sisihOpsPerDay,
      priveWeeklyCap,
      actor,
    ],
  );

  const scope = useMemo(() => resolveBukuScope(mode, dailySales), [mode, dailySales]);
  const summary = useMemo(() => summarizeBuku(input, scope), [input, scope]);

  const exportXlsx = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const name = await downloadBukuExcel(input, scope);
      toast.success(`Excel tersimpan: ${name}`);
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuat Excel. Coba refresh lalu unduh lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">Ringkasan & ekspor Excel</h2>
          <p className="text-sm text-muted-foreground">
            Satu file .xlsx: kesimpulan, omzet, sisih, pengeluaran, uang masuk, tutup buku, menu, dan struk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" variant={mode === "cutoff" ? "default" : "secondary"} onClick={() => setMode("cutoff")}>
            Siklus {cur.label}
          </Button>
          <Button size="lg" variant={mode === "all" ? "default" : "secondary"} onClick={() => setMode("all")}>
            Semua data
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <FileSpreadsheet className="size-5" />
          </span>
          <div>
            <p className="font-medium">{scope.label}</p>
            <p className="text-xs text-muted-foreground">{summary.sheets.reduce((s, x) => s + x.rows, 0)} baris di {summary.sheets.length} sheet</p>
          </div>
        </div>
        <Button className="h-12 px-6" onClick={exportXlsx} disabled={busy}>
          <Download className="size-4" />
          {busy ? "Menyusun Excel…" : "Unduh Excel lengkap"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summary.kpis.slice(0, 10).map((k) => (
          <Kpi key={k.label} label={k.label} value={k.value} hint={k.hint} />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-medium">Kesimpulan</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {summary.bullets.map((n) => (
            <li key={n} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium">Isi file Excel</h3>
          <ul className="divide-y divide-border text-sm">
            {summary.sheets.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </span>
                <Badge tone="muted">{s.rows} baris</Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium">Rumus yang dipakai</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {summary.rumus.map((n) => (
              <li key={n} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            File memakai format Rupiah dan baris TOTAL berumum SUM. Bisa dibuka di Excel, Google Sheets, atau WPS.
          </p>
        </div>
      </div>
    </div>
  );
}
