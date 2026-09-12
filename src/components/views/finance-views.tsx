import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cutoffPeriod, formatDateID, formatIDR, formatIDRCompact, formatPct, inCutoffRange, todayISO } from "@/lib/format";
import { isIngredientLow, stockLabel } from "@/lib/inventory";
import {
  buildSavingCostLog,
  buildSisihLog,
  displayCat,
  EXPENSE_CATEGORIES,
  isGajiCat,
  isOeripCat,
  isOpsCat,
  isPriveCat,
  liveFinance,
  priveWeekInfo,
  resolveMoneyIn,
} from "@/lib/sheet-books";
import { usePos } from "@/lib/store";
import {
  DAILY_TARGET,
  MANAGER_CASH_CAP,
  MONTHLY_TARGET,
  PRIVE_WEEKLY_CAP,
  SISIH_GAJI_PER_DAY,
  SISIH_OPS_PER_DAY,
  splitManagerCash,
  normalizeManagerCash,
  type MoneyInRow,
  type Quadrant,
} from "@/lib/types";

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-xl tabular-nums ${tone ?? "text-foreground"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <li className="flex justify-between gap-3 border-b border-border/60 py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className={`shrink-0 font-mono tabular-nums ${tone ?? ""}`}>{v}</span>
    </li>
  );
}

function RatioCard({ title, value, bench, status, note }: { title: string; value: number; bench: string; status: string; note: string }) {
  const ok = status.toLowerCase().includes("aman") || status.toLowerCase().includes("ideal") || status.toLowerCase().includes("sehat");
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="font-mono text-2xl tabular-nums">{formatPct(value)}</p>
      <p className="text-xs text-muted-foreground">Benchmark {bench}</p>
      <Badge tone={ok ? "success" : "warning"} className="mt-2">
        {status}
      </Badge>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export function TargetView() {
  const products = usePos((s) => s.products);
  const dailySales = usePos((s) => s.dailySales);
  const expenses = usePos((s) => s.expenses);
  const incomes = usePos((s) => s.incomes);
  const dailyBooks = usePos((s) => s.dailyBooks);
  const orders = usePos((s) => s.orders);
  const f = liveFinance({ dailySales, expenses, incomes, dailyBooks, orders });
  const cur = cutoffPeriod();
  const mtdDays = dailySales.filter((d) => inCutoffRange(d.date, cur.start, cur.end)).sort((a, b) => a.date.localeCompare(b.date));
  const dailyHit = f.lastOmzet >= DAILY_TARGET;
  const stars = products.filter((p) => p.quadrant === "Star").sort((a, b) => b.margin - a.margin);
  const horses = products.filter((p) => p.quadrant === "Workhorse").sort((a, b) => b.soldQty - a.soldQty);
  const puzzles = products.filter((p) => p.quadrant === "Puzzle");
  const dogs = products.filter((p) => p.quadrant === "Dog").sort((a, b) => a.soldQty - b.soldQty);
  const chart = mtdDays.map((d) => ({ name: formatDateID(d.date).replace(/ 2026/, ""), Omzet: d.omzet, Target: DAILY_TARGET }));
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div>
        <h2 className="font-display text-xl font-medium">Dashboard Manager</h2>
        <p className="text-sm text-muted-foreground">Target toko Rp 60 juta · siklus {f.cutoffLabel} · angka dari spreadsheet pembukuan</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Target bulanan" value={formatIDR(MONTHLY_TARGET)} hint="Siklus cut-off 7–6" tone="text-primary" />
        <Kpi label="Realisasi omzet MTD" value={formatIDR(f.mtdOmzet)} hint={f.cutoffLabel} tone="text-success" />
        <Kpi label="% capaian target" value={formatPct(f.pct, 2)} hint={`${formatIDR(f.remain)} sisa`} />
        <Kpi label="Sisa target" value={formatIDR(f.remain)} hint="Kekurangan omzet toko" />
        <Kpi label="Total porsi / cup" value={`${f.mtdCups}`} hint="Volume penjualan MTD" />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, f.pct * 100)}%` }} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Target harian" value={formatIDR(DAILY_TARGET)} hint="Rp 60 jt / 30 hari" />
        <Kpi
          label="Omzet harian terakhir"
          value={formatIDR(f.lastOmzet)}
          hint={formatDateID(f.lastDate)}
          tone={dailyHit ? "text-success" : "text-destructive"}
        />
        <Kpi label="% harian" value={formatPct(f.lastOmzet / DAILY_TARGET, 1)} hint="Realisasi vs Rp 2 jt" />
        <Kpi
          label="Gap harian"
          value={formatIDR(f.lastOmzet - DAILY_TARGET)}
          tone={dailyHit ? "text-success" : "text-destructive"}
        />
        <Kpi
          label="Status harian"
          value={dailyHit ? "Tercapai" : "Di bawah target"}
          hint={dailyHit ? "Pertahankan upselling" : "Dorong menu Star"}
          tone={dailyHit ? "text-success" : "text-warning"}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Star" value={`${stars.length} menu`} hint="Margin tinggi · laris" tone="text-success" />
        <Kpi label="Puzzle" value={`${puzzles.length} menu`} hint="Margin tinggi · sepi" />
        <Kpi label="Workhorse" value={`${horses.length} menu`} hint="Margin tipis · laris" tone="text-warning" />
        <Kpi label="Dog" value={`${dogs.length} menu`} hint="Margin rendah · sepi" tone="text-destructive" />
      </div>
      <div className="h-64 rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-medium">Omzet harian periode berjalan</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={chart}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}jt`} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatIDR(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
            <Bar dataKey="Omzet" fill="var(--color-primary)" radius={4} />
            <Bar dataKey="Target" fill="var(--color-border)" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-1 text-sm font-medium">Misi upselling kasir (Star)</h3>
          <p className="mb-3 text-xs text-muted-foreground">Wajib ditawarkan sebagai rekomendasi utama.</p>
          <ul className="space-y-2">
            {stars.map((p) => (
              <li key={p.id} className="flex justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span>{p.name}</span>
                <span className="font-mono text-success">{formatPct(p.margin)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-1 text-sm font-medium">Pantauan takaran (Workhorse)</h3>
          <p className="mb-3 text-xs text-muted-foreground">Laris tapi margin tipis — jaga gramasi.</p>
          <ul className="space-y-2">
            {horses.map((p) => (
              <li key={p.id} className="flex justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span>{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.soldQty} porsi · {formatPct(p.margin)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Puzzle — dorong promo / bundling</h3>
          <ul className="space-y-2 text-sm">
            {puzzles.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{p.soldQty} · {formatPct(p.margin)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Dog — evaluasi / slow-moving</h3>
          <ul className="space-y-2 text-sm">
            {dogs.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.name}</span>
                <span className="font-mono text-xs text-destructive">{p.soldQty} porsi</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function DashboardView() {
  const weekly = usePos((s) => s.weekly);
  const dailySales = usePos((s) => s.dailySales);
  const dailyBooks = usePos((s) => s.dailyBooks);
  const expenses = usePos((s) => s.expenses);
  const incomes = usePos((s) => s.incomes);
  const orders = usePos((s) => s.orders);
  const incidents = usePos((s) => s.incidents);
  const attendance = usePos((s) => s.attendance);
  const inventory = usePos((s) => s.inventory);
  const products = usePos((s) => s.products);
  const tutupBuku = usePos((s) => s.tutupBuku);
  const staff = usePos((s) => s.staff);
  const f = liveFinance({ dailySales, expenses, incomes, dailyBooks, orders });
  const paid = orders.filter((o) => o.status === "paid");
  const omzetStruk = paid.reduce((s, o) => s + o.total, 0);
  const lowStock = inventory.filter(isIngredientLow);
  const activeInc = incidents.filter((i) => i.status !== "Dibatalkan");
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const weekData = weekly.map((w) => ({
    name: w.week.replace("2026-", ""),
    Omzet: w.income,
    Pengeluaran: w.expense,
    COGS: w.cogs,
  }));
  const days = [...dailySales]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10)
    .map((d) => ({
      name: formatDateID(d.date).replace(/ 2026/, ""),
      Omzet: d.omzet,
      Keluar: expenses.filter((x) => x.date === d.date).reduce((s, x) => s + x.amount, 0),
    }));
  const notes = [
    `Kas bebas ${formatIDR(f.freeCash)} — ${f.liquidity === "AMAN DITARIK" ? "penarikan prive masih longgar, sisihkan buffer 10%." : "tunda prive sampai stok & gaji tercover."}`,
    `Omzet terakhir ${formatIDR(f.lastOmzet)} (${formatDateID(f.lastDate)}) dari target harian ${formatIDR(DAILY_TARGET)}.`,
    `Akumulasi omzet spreadsheet ${formatIDR(f.totalOmzet)} + sewa ${formatIDR(f.sewa)} · laba operasional ${formatIDR(f.labaOps)} · prive ${formatIDR(f.prive)}.`,
    `Struk POS ${formatIDR(omzetStruk)} (${paid.length} tiket 8–9 Sep + transaksi baru) tidak menimpa log harian spreadsheet.`,
  ];

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div>
        <h2 className="font-display text-xl font-medium">Dashboard Keuangan</h2>
        <p className="text-sm text-muted-foreground">Omzet, laba, prive, rasio, dan kas bebas — sama seperti tab Dashboard spreadsheet.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total omzet" value={formatIDRCompact(f.totalOmzet)} hint="Akumulasi penjualan kafe" />
        <Kpi label="Laba bersih operasional" value={formatIDRCompact(f.labaOps)} hint="Sebelum prive" tone="text-success" />
        <Kpi label="Prive sudah diambil" value={formatIDRCompact(f.prive)} hint="Penarikan pribadi" />
        <Kpi
          label="Kuota prive aman"
          value={formatIDRCompact(f.freeCash)}
          hint={f.liquidity}
          tone={f.freeCash >= 0 ? "text-success" : "text-destructive"}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <RatioCard title="COGS ratio (bahan baku)" value={f.cogsRatio} bench="28–35%" status="Aman (efisien)" note="HPP terkendali di bawah batas 35%" />
        <RatioCard title="Labor / gaji ratio" value={f.laborRatio} bench="15–20%" status="Ideal (produktif)" note="Beban gaji proporsional terhadap omzet" />
        <RatioCard title="Net profit margin" value={f.npm} bench="20–35%" status="Sangat sehat" note="Ruang aman untuk prive pemilik" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Owner drawing — cadangan wajib</h3>
          <ul className="space-y-1 text-sm">
            <Row k="Kas masuk omzet kafe" v={formatIDR(f.totalOmzet)} />
            <Row k="Cadangan belanja bahan baku" v={formatIDR(f.bahan)} />
            <Row k="Cadangan gaji berikutnya" v={formatIDR(f.gaji)} />
            <Row k="Prive sudah ditarik" v={formatIDR(f.prive)} />
            <Row k="Sisa kas bebas" v={formatIDR(f.freeCash)} tone={f.freeCash >= 0 ? "text-success" : "text-destructive"} />
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium">Kesimpulan finance</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {notes.map((n) => (
              <li key={n} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {n}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium">Omzet vs pengeluaran harian</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={days}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}jt`} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatIDR(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Bar dataKey="Omzet" fill="var(--color-primary)" radius={4} />
              <Bar dataKey="Keluar" fill="var(--color-destructive)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-64 rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium">Omzet vs beban mingguan</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={weekData}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}jt`} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatIDR(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Bar dataKey="Omzet" fill="var(--color-primary)" radius={4} />
              <Bar dataKey="Pengeluaran" fill="var(--color-destructive)" radius={4} />
              <Bar dataKey="COGS" fill="var(--color-muted-foreground)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Absensi valid" value={`${attendance.filter((a) => a.valid !== false).length}`} />
        <Kpi label="Insiden aktif" value={`${activeInc.length}`} hint={`Kerugian ${formatIDR(activeInc.reduce((s, i) => s + i.loss, 0))}`} />
        <Kpi label="Stok kritis" value={`${lowStock.length}`} tone={lowStock.length ? "text-destructive" : "text-success"} />
        <Kpi label="Menu Star" value={`${products.filter((p) => p.quadrant === "Star").length}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Insiden terbaru</h3>
          {activeInc.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada insiden aktif.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activeInc.slice(0, 5).map((i) => (
                <li key={i.id} className="flex justify-between gap-3 border-b border-border/60 py-1">
                  <span>
                    <span className="font-medium">{nameOf(i.staff)}</span>
                    <span className="text-muted-foreground"> · {i.category}</span>
                  </span>
                  <span className="font-mono text-xs text-destructive">{i.loss ? formatIDR(i.loss) : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Kas keluar terbaru</h3>
          <ul className="space-y-2 text-sm">
            {[...expenses]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 6)
              .map((x) => (
                <li key={x.id} className="flex justify-between gap-3 border-b border-border/60 py-1">
                  <span>
                    {x.desc}
                    <span className="block text-xs text-muted-foreground">
                      {formatDateID(x.date)} · {displayCat(x.category)}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-destructive">{formatIDR(x.amount)}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>
      {lowStock.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Bahan di bawah minimum</h3>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((i) => (
              <Badge key={i.id} tone="danger">
                {i.name} · {stockLabel(i)}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {tutupBuku.some((t) => t.status !== "Selesai") && (
        <p className="text-xs text-muted-foreground">{tutupBuku.filter((t) => t.status !== "Selesai").length} periode tutup buku masih terbuka.</p>
      )}
    </div>
  );
}

export function ExpensesView() {
  const expenses = usePos((s) => s.expenses);
  const addExpense = usePos((s) => s.addExpense);
  const deleteExpense = usePos((s) => s.deleteExpense);
  const priveWeeklyCap = usePos((s) => s.priveWeeklyCap);
  const cur = cutoffPeriod();
  const [form, setForm] = useState({ date: todayISO(), category: "Bahan Baku", desc: "", amount: 0, nota: "" });
  const [cat, setCat] = useState<"all" | string>("all");
  const [scope, setScope] = useState<"current" | "arsip" | "all">("all");
  const [err, setErr] = useState("");
  const week = priveWeekInfo(expenses, form.date, priveWeeklyCap);
  const rows = useMemo(() => {
    return expenses.filter((e) => {
      if (cat !== "all" && displayCat(e.category) !== cat && e.category !== cat) return false;
      if (scope === "current") return inCutoffRange(e.date, cur.start, cur.end);
      if (scope === "arsip") return !inCutoffRange(e.date, cur.start, cur.end);
      return true;
    });
  }, [expenses, cat, scope, cur.start, cur.end]);
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((e) => m.set(displayCat(e.category), (m.get(displayCat(e.category)) ?? 0) + e.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const oeripTotal = expenses.filter((e) => isOeripCat(e.category) || e.desc.toLowerCase().includes("oerip")).reduce((s, e) => s + e.amount, 0);
  const setCatAndName = (category: string, desc?: string) => {
    setErr("");
    setForm((f) => ({ ...f, category, desc: desc ?? (isOeripCat(category) ? "Membantu Oerip Indonesia" : f.desc) }));
  };
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-medium">Log Pengeluaran</h2>
          <p className="text-sm text-muted-foreground">Termasuk arsip + prive. Prive dibatasi per minggu. Bahan baku terpisah dari beban operasional tutup buku.</p>
        </div>
        <p className="font-mono text-sm text-destructive">
          {rows.length} transaksi · {formatIDR(total)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Semua periode"],
            ["current", `Berjalan ${cur.label}`],
            ["arsip", "Arsip"],
          ] as const
        ).map(([id, label]) => (
          <Button key={id} size="sm" variant={scope === id ? "default" : "secondary"} onClick={() => setScope(id)}>
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={cat === "all" ? "default" : "secondary"} onClick={() => setCat("all")}>
          Semua kategori
        </Button>
        {byCat.map(([c, n]) => (
          <Button key={c} size="sm" variant={cat === c ? "default" : "secondary"} onClick={() => setCat(c)}>
            {c} {formatIDRCompact(n)}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <form
          className="space-y-2 rounded-xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.desc || form.amount <= 0) return;
            const msg = addExpense(form);
            if (msg) {
              setErr(msg);
              return;
            }
            setErr("");
            toast.success("Pengeluaran tersimpan. Jangan tutup halaman sampai badge Tersinkron.");
            setForm({ ...form, desc: isOeripCat(form.category) ? "Membantu Oerip Indonesia" : "", amount: 0, nota: "" });
          }}
        >
          <Input type="date" value={form.date} onChange={(e) => { setErr(""); setForm({ ...form, date: e.target.value }); }} />
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.category}
            onChange={(e) => setCatAndName(e.target.value)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {displayCat(c)}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={isOeripCat(form.category) ? "default" : "secondary"}
              className="h-11"
              onClick={() => setCatAndName("Membantu Oerip Indonesia", "Membantu Oerip Indonesia")}
            >
              Membantu Oerip Indonesia
            </Button>
          </div>
          <Input required placeholder="Keterangan" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
          <Input type="number" required placeholder="Nominal" value={form.amount || ""} onChange={(e) => { setErr(""); setForm({ ...form, amount: Number(e.target.value) }); }} />
          <Input placeholder="No. nota (opsional)" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
          {isPriveCat(form.category) ? (
            <p className={`text-xs ${week.over || form.amount > week.remain ? "text-destructive" : "text-muted-foreground"}`}>
              Kuota prive {week.label}: {formatIDR(week.used)} / {formatIDR(week.cap)}. Sisa {formatIDR(week.remain)}.
            </p>
          ) : null}
          {err ? <p className="text-xs text-destructive">{err}</p> : null}
          <Button type="submit" className="w-full h-11">
            Simpan pengeluaran
          </Button>
        </form>
        <div className="lg:col-span-2 max-h-[560px] overflow-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                {["Tanggal", "Kategori", "Keterangan", "Nota", "Nominal", ""].map((h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{formatDateID(e.date)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={isPriveCat(e.category) ? "warning" : isOeripCat(e.category) ? "primary" : "muted"}>{displayCat(e.category)}</Badge>
                  </td>
                  <td className="px-3 py-2">{e.desc}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.nota || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-destructive tabular-nums">{formatIDR(e.amount)}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="ghost" className="text-destructive h-11" onClick={() => deleteExpense(e.id)}>
                      Hapus
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {oeripTotal > 0 ? (
        <p className="text-sm text-muted-foreground">
          Akumulasi Membantu Oerip Indonesia: <span className="font-mono text-foreground">{formatIDR(oeripTotal)}</span>
        </p>
      ) : null}
    </div>
  );
}

export function IncomeView() {
  const incomes = usePos((s) => s.incomes);
  const addIncome = usePos((s) => s.addIncome);
  const [form, setForm] = useState({ date: todayISO(), category: "Sewa Tempat", desc: "", amount: 0, status: "Masuk" });
  const total = incomes.reduce((s, i) => s + i.amount, 0);
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-medium">Log Pemasukan</h2>
          <p className="text-sm text-muted-foreground">Sewa gedung / event. Omzet kasir ada di Buku Kasir, bukan di sini.</p>
        </div>
        <p className="font-mono text-success">{formatIDR(total)}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <form
          className="space-y-2 rounded-xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            addIncome(form);
            setForm({ ...form, desc: "", amount: 0 });
          }}
        >
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {["Sewa Tempat", "Kerjasama Event", "Lain-lain"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Input required placeholder="Klien / keterangan" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
          <Input type="number" required value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          <Button type="submit" className="w-full">
            Catat pemasukan
          </Button>
        </form>
        <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                {["Tanggal", "Kategori", "Keterangan", "Nominal", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incomes.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{formatDateID(i.date)}</td>
                  <td className="px-3 py-2">{i.category}</td>
                  <td className="px-3 py-2">{i.desc}</td>
                  <td className="px-3 py-2 font-mono text-success tabular-nums">{formatIDR(i.amount)}</td>
                  <td className="px-3 py-2">
                    <Badge tone="success">{i.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CashFlowView() {
  const dailySales = usePos((s) => s.dailySales);
  const expenses = usePos((s) => s.expenses);
  const incomes = usePos((s) => s.incomes);
  const dailyBooks = usePos((s) => s.dailyBooks);
  const orders = usePos((s) => s.orders);
  const priveWeeklyCap = usePos((s) => s.priveWeeklyCap);
  const f = liveFinance({ dailySales, expenses, incomes, dailyBooks, orders });
  const week = priveWeekInfo(expenses, todayISO(), priveWeeklyCap);
  const [cat, setCat] = useState(f.expByCat[0]?.category ?? "Prive");
  const rows = expenses.filter((e) => displayCat(e.category) === cat).sort((a, b) => b.date.localeCompare(a.date));
  const catTotal = rows.reduce((s, e) => s + e.amount, 0);
  const conclusions =
    f.freeCash >= 0
      ? [
          `Laba operasional ${formatIDR(f.labaOps)} masih di atas prive ${formatIDR(f.prive)}. Sisa kuota ${formatIDR(f.freeCash)}.`,
          "Kinerja dapur & bar sehat (COGS 28,2% dan gaji 13,4% di zona ideal).",
          "Sisihkan buffer kas 10% sebelum penarikan prive berikutnya. Review kuota setiap tutup buku tanggal 7.",
        ]
      : [
          `Prive ${formatIDR(f.prive)} melebihi laba operasional ${formatIDR(f.labaOps)}.`,
          "Tunda penarikan tambahan sampai kas bebas surplus.",
          "Prioritaskan cadangan stok bahan baku dan payroll.",
        ];
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div>
        <h2 className="font-display text-xl font-medium">Ringkasan Arus Kas & Prive</h2>
        <p className="text-sm text-muted-foreground">Porsi beban per kategori + rincian transaksi, mengikuti spreadsheet.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total omzet" value={formatIDRCompact(f.totalOmzet)} />
        <Kpi label="Laba operasional" value={formatIDRCompact(f.labaOps)} tone="text-success" />
        <Kpi label="Realisasi prive" value={formatIDRCompact(f.prive)} />
        <Kpi label="Kas bebas" value={formatIDRCompact(f.freeCash)} tone={f.freeCash >= 0 ? "text-success" : "text-destructive"} hint={f.liquidity} />
      </div>
      <div className={`rounded-xl border p-4 ${week.over ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"}`}>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Kuota prive minggu ini · {week.label}</p>
        <p className={`mt-1 font-mono text-xl tabular-nums ${week.over ? "text-destructive" : "text-foreground"}`}>
          {formatIDR(week.used)} / {formatIDR(week.cap)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {week.over ? `Melebihi kuota ${formatIDR(week.used - week.cap)}. Tahan penarikan.` : `Sisa ${formatIDR(week.remain)}. Prive baru ditolak jika melewati kuota.`}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Pengeluaran per kategori</h3>
          <ul className="space-y-1 text-sm">
            {f.expByCat.map((c) => (
              <li key={c.category}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left ${cat === c.category ? "bg-primary/15 text-primary" : "hover:bg-muted"}`}
                  onClick={() => setCat(c.category)}
                >
                  <span>{c.category}</span>
                  <span className="font-mono text-xs tabular-nums">
                    {formatIDR(c.amount)} · {formatPct(c.share, 1)}
                  </span>
                </button>
              </li>
            ))}
            <Row k="Total akumulasi" v={formatIDR(f.expenseTotal)} />
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-1 text-sm font-medium">Rincian {cat}</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            {rows.length} transaksi · {formatIDR(catTotal)}
          </p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1">Tanggal</th>
                  <th>Keterangan</th>
                  <th className="text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-t border-border/60">
                    <td className="py-1.5 font-mono text-xs">{formatDateID(e.date)}</td>
                    <td>{e.desc}</td>
                    <td className="text-right font-mono text-xs tabular-nums">{formatIDR(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-medium">Kesimpulan & rekomendasi prive</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {conclusions.map((n) => (
            <li key={n} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              {n}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function MoneyInView() {
  const orders = usePos((s) => s.orders);
  const dailySales = usePos((s) => s.dailySales);
  const overrides = usePos((s) => s.moneyIn);
  const upsert = usePos((s) => s.upsertMoneyIn);
  const start = dailySales[0]?.date ?? "2026-08-12";
  const dates: string[] = [];
  for (let d = start; d <= addDays(todayISO(), 12); d = addDays(d, 1)) dates.push(d);
  const rows = dates.map((date) => {
    const split = resolveMoneyIn(date, orders, overrides);
    const book = dailySales.find((x) => x.date === date)?.omzet ?? 0;
    const pecah = split.gopay + split.edc + split.tunai;
    return { ...split, book, pecah };
  });
  const tot = rows.reduce(
    (s, r) => ({ gopay: s.gopay + r.gopay, edc: s.edc + r.edc, tunai: s.tunai + r.tunai, book: s.book + r.book }),
    { gopay: 0, edc: 0, tunai: 0, book: 0 },
  );
  const save = (date: string, patch: Partial<MoneyInRow>) => {
    const cur = resolveMoneyIn(date, orders, overrides);
    upsert({ ...cur, ...patch, date, source: "manual" });
  };
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div>
        <h2 className="font-display text-xl font-medium">Report Uang Masuk</h2>
        <p className="text-sm text-muted-foreground">
          Kolom spreadsheet: QRIS Gopay · QRIS EDC · Tunai. Struk POS terisi otomatis (QRIS→Gopay, Debit/Transfer→EDC, Cash→Tunai). Hari tanpa struk diisi manual.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="QRIS Gopay" value={formatIDRCompact(tot.gopay)} />
        <Kpi label="QRIS EDC" value={formatIDRCompact(tot.edc)} />
        <Kpi label="Tunai" value={formatIDRCompact(tot.tunai)} />
        <Kpi label="Omzet buku" value={formatIDRCompact(tot.book)} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              {["Tanggal", "QRIS Gopay", "QRIS EDC", "Tunai", "Total pecahan", "Omzet buku", "Sumber"].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-t border-border">
                <td className="px-3 py-1.5 font-mono text-xs">{formatDateID(r.date)}</td>
                {(["gopay", "edc", "tunai"] as const).map((k) => (
                  <td key={k} className="px-2 py-1">
                    <Input
                      type="number"
                      className="h-9 font-mono text-xs"
                      value={r[k] || ""}
                      onChange={(e) => save(r.date, { [k]: Number(e.target.value) || 0 })}
                    />
                  </td>
                ))}
                <td className="px-3 py-1.5 font-mono text-xs tabular-nums">{formatIDR(r.pecah)}</td>
                <td className="px-3 py-1.5 font-mono text-xs tabular-nums">{r.book ? formatIDR(r.book) : "—"}</td>
                <td className="px-3 py-1.5">
                  <Badge tone={r.source === "pos" ? "success" : r.source === "mixed" ? "warning" : "muted"}>
                    {r.source === "pos" ? "POS" : r.source === "mixed" ? "POS+manual" : "Manual"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TutupBukuView() {
  const rows = usePos((s) => s.tutupBuku);
  const daily = usePos((s) => s.dailyBooks);
  const dailySales = usePos((s) => s.dailySales);
  const expenses = usePos((s) => s.expenses);
  const incomes = usePos((s) => s.incomes);
  const lockPeriod = usePos((s) => s.lockPeriod);
  const cur = cutoffPeriod();
  const open = rows.find((r) => r.status === "Dalam Proses" && r.period === cur.id) ?? rows.find((r) => r.status === "Dalam Proses");
  const liveOmzet = open ? dailySales.filter((d) => inCutoffRange(d.date, open.startDate, open.endDate)).reduce((s, d) => s + d.omzet, 0) : 0;
  const liveOut = open ? expenses.filter((d) => inCutoffRange(d.date, open.startDate, open.endDate)).reduce((s, d) => s + d.amount, 0) : 0;
  const liveIn = open ? incomes.filter((d) => inCutoffRange(d.date, open.startDate, open.endDate)).reduce((s, d) => s + d.amount, 0) : 0;
  const exportCsv = () => {
    const csv = ["Periode,Mulai,Selesai,Pendapatan,Pengeluaran,COGS,Laba,Status"]
      .concat(rows.map((r) => [r.period, r.startDate, r.endDate, r.income, r.expense, r.cogs, r.profit, r.status].join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "HVEN_Tutup_Buku.csv";
    a.click();
  };
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-medium">Laporan & Log Tutup Buku</h2>
          <p className="text-sm text-muted-foreground">
            Siklus 7–6, bukan bulan kalender. Periode ini {cur.label}. Tanggal 7 periode lama dikunci, data historis tidak dihapus.
          </p>
          {open && (
            <p className="mt-1 text-xs text-muted-foreground">
              Berjalan {open.startDate} → {open.endDate} · omzet {formatIDR(liveOmzet)} · sewa {formatIDR(liveIn)} · keluar {formatIDR(liveOut)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            Ekspor CSV
          </Button>
          <Button onClick={lockPeriod}>Kunci periode</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              {["Periode", "Rentang", "Pendapatan", "COGS", "Pengeluaran", "Laba", "Status", "PIC"].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period} className="border-t border-border">
                <td className="px-3 py-2 font-mono">{r.period}</td>
                <td className="px-3 py-2 text-xs">
                  {r.startDate} → {r.endDate}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.income)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.cogs)}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-destructive">{formatIDR(r.expense)}</td>
                <td className={`px-3 py-2 font-mono tabular-nums ${r.profit >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatIDR(r.profit)}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={r.status === "Selesai" ? "success" : "warning"}>{r.status}</Badge>
                </td>
                <td className="px-3 py-2">{r.pic}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="max-h-72 overflow-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              {["Tanggal", "Pendapatan", "COGS", "Pengeluaran", "Laba"].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{formatDateID(d.date)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(d.income)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(d.cogs)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(d.expense)}</td>
                <td className={`px-3 py-2 font-mono tabular-nums ${d.profit >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatIDR(d.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MenuEngView() {
  const products = usePos((s) => s.products);
  const [filter, setFilter] = useState<"ALL" | Quadrant>("ALL");
  const rows = products.filter((p) => filter === "ALL" || p.quadrant === filter);
  const counts = {
    Star: products.filter((p) => p.quadrant === "Star").length,
    Workhorse: products.filter((p) => p.quadrant === "Workhorse").length,
    Puzzle: products.filter((p) => p.quadrant === "Puzzle").length,
    Dog: products.filter((p) => p.quadrant === "Dog").length,
  };
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-medium">Analisis Menu Engineering</h2>
          <p className="text-sm text-muted-foreground">Matriks Kasavana & Smith dari spreadsheet + penjualan kasir setelah 10 Sep.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["ALL", "Star", "Workhorse", "Puzzle", "Dog"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "secondary"} onClick={() => setFilter(f)}>
              {f === "ALL" ? "Semua" : `${f} (${counts[f as Quadrant]})`}
            </Button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              {["Menu", "Harga", "COGS", "Margin", "Qty", "Kuadran", "Rekomendasi"].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(p.price)}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">{formatIDR(p.cogs)}</td>
                <td className="px-3 py-2 font-mono text-success tabular-nums">{formatPct(p.margin)}</td>
                <td className="px-3 py-2 font-mono">{p.soldQty}</td>
                <td className="px-3 py-2">
                  <Badge
                    tone={
                      p.quadrant === "Star" ? "primary" : p.quadrant === "Workhorse" ? "warning" : p.quadrant === "Puzzle" ? "muted" : "danger"
                    }
                  >
                    {p.quadrant}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{p.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SisihGajiView() {
  const dailySales = usePos((s) => s.dailySales);
  const dailyBooks = usePos((s) => s.dailyBooks);
  const orders = usePos((s) => s.orders);
  const expenses = usePos((s) => s.expenses);
  const sisihGajiPerDay = usePos((s) => s.sisihGajiPerDay);
  const setSisihGajiPerDay = usePos((s) => s.setSisihGajiPerDay);
  const [draft, setDraft] = useState(String(sisihGajiPerDay));
  const [tab, setTab] = useState<"cutoff" | "all">("cutoff");
  const cur = cutoffPeriod();
  const rows = useMemo(
    () => buildSisihLog(dailySales, dailyBooks, orders, sisihGajiPerDay),
    [dailySales, dailyBooks, orders, sisihGajiPerDay],
  );
  const shown = tab === "cutoff" ? rows.filter((r) => inCutoffRange(r.date, cur.start, cur.end)) : rows;
  const tot = shown.reduce(
    (s, r) => ({
      omzet: s.omzet + r.omzet,
      uangKotor: s.uangKotor + r.uangKotor,
      sisihGaji: s.sisihGaji + r.sisihGaji,
      labaBersih: s.labaBersih + r.labaBersih,
    }),
    { omzet: 0, uangKotor: 0, sisihGaji: 0, labaBersih: 0 },
  );
  const day10 = rows.find((r) => r.date === "2026-09-10");
  const lastGaji = expenses.filter((e) => e.category.toLowerCase() === "gaji").sort((a, b) => b.date.localeCompare(a.date))[0];
  const sincePay = lastGaji ? rows.filter((r) => r.date > lastGaji.date) : shown;
  const cadangan = sincePay.reduce((s, r) => s + r.sisihGaji, 0);
  const saveGaji = () => {
    const n = Number(draft.replace(/\D/g, ""));
    if (!n) return;
    setSisihGajiPerDay(n);
  };
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">Log sisih gaji & uang kotor</h2>
          <p className="text-sm text-muted-foreground">
            Tiap hari buka: sisih gaji {formatIDR(sisihGajiPerDay)} + uang kotor (COGS). Laba bersih = omzet − kotor − gaji. Bukan kas keluar — gaji aktual tetap di Log Pengeluaran.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={tab === "cutoff" ? "default" : "secondary"} onClick={() => setTab("cutoff")}>
            Siklus {cur.label}
          </Button>
          <Button size="sm" variant={tab === "all" ? "default" : "secondary"} onClick={() => setTab("all")}>
            Semua hari
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          Sisih gaji per hari
          <Input
            className="h-11 w-40 font-mono"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveGaji}
          />
        </label>
        <Button className="h-11" variant="secondary" onClick={saveGaji}>
          Simpan
        </Button>
        <Button
          className="h-11"
          variant="outline"
          onClick={() => {
            setDraft(String(SISIH_GAJI_PER_DAY));
            setSisihGajiPerDay(SISIH_GAJI_PER_DAY);
          }}
        >
          Reset 280rb
        </Button>
      </div>
      {day10 && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Update 10 Sep 2026 · 50 porsi</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            <Kpi label="Omzet" value={formatIDR(day10.omzet)} />
            <Kpi label="Uang kotor (COGS)" value={formatIDR(day10.uangKotor)} hint="Sisih restok bahan" />
            <Kpi label="Sisih gaji" value={formatIDR(day10.sisihGaji)} hint="Cadangan harian" />
            <Kpi
              label="Laba bersih"
              value={formatIDR(day10.labaBersih)}
              hint="Omzet − kotor − gaji"
              tone={day10.labaBersih >= 0 ? "text-success" : "text-destructive"}
            />
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Omzet periode" value={formatIDRCompact(tot.omzet)} hint={`${shown.length} hari buka`} />
        <Kpi label="Sisih uang kotor" value={formatIDRCompact(tot.uangKotor)} hint="HPP / restok" />
        <Kpi label="Sisih gaji" value={formatIDRCompact(tot.sisihGaji)} hint={`${shown.length} × ${formatIDR(sisihGajiPerDay)}`} />
        <Kpi
          label="Laba bersih periode"
          value={formatIDRCompact(tot.labaBersih)}
          tone={tot.labaBersih >= 0 ? "text-success" : "text-destructive"}
        />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-medium">Cadangan gaji berjalan</p>
        <p className="mt-1 text-muted-foreground">
          {lastGaji
            ? `Gaji terakhir dibayar ${formatDateID(lastGaji.date)} ${formatIDR(expenses.filter((e) => e.category.toLowerCase() === "gaji" && e.date === lastGaji.date).reduce((s, e) => s + e.amount, 0))}. Sejak itu terkumpul ${formatIDR(cadangan)} (${sincePay.length} hari × ${formatIDR(sisihGajiPerDay)}).`
            : `Belum ada pembayaran gaji di log. Akumulasi sisih ${formatIDR(tot.sisihGaji)}.`}
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {["Tanggal", "Omzet", "Uang kotor", "Sisih gaji", "Laba bersih"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...shown].reverse().map((r) => (
              <tr key={r.date} className={`border-t border-border ${r.date === "2026-09-10" ? "bg-primary/10" : ""}`}>
                <td className="px-3 py-2 font-mono text-xs">
                  {formatDateID(r.date)}
                  {r.date === "2026-09-10" ? <span className="ml-2 text-primary">· update</span> : null}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.omzet)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.uangKotor)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.sisihGaji)}</td>
                <td className={`px-3 py-2 font-mono tabular-nums ${r.labaBersih >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatIDR(r.labaBersih)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border bg-muted/60 font-medium">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(tot.omzet)}</td>
              <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(tot.uangKotor)}</td>
              <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(tot.sisihGaji)}</td>
              <td className={`px-3 py-2 font-mono tabular-nums ${tot.labaBersih >= 0 ? "text-success" : "text-destructive"}`}>
                {formatIDR(tot.labaBersih)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SavingCostView() {
  const dailySales = usePos((s) => s.dailySales);
  const dailyBooks = usePos((s) => s.dailyBooks);
  const orders = usePos((s) => s.orders);
  const expenses = usePos((s) => s.expenses);
  const sisihGajiPerDay = usePos((s) => s.sisihGajiPerDay);
  const sisihOpsPerDay = usePos((s) => s.sisihOpsPerDay);
  const setSisihOpsPerDay = usePos((s) => s.setSisihOpsPerDay);
  const priveWeeklyCap = usePos((s) => s.priveWeeklyCap);
  const setPriveWeeklyCap = usePos((s) => s.setPriveWeeklyCap);
  const managerCashCap = usePos((s) => s.managerCashCap);
  const setManagerCashCap = usePos((s) => s.setManagerCashCap);
  const managerCash = usePos((s) => s.managerCash);
  const upsertManagerCash = usePos((s) => s.upsertManagerCash);
  const setorManagerCash = usePos((s) => s.setorManagerCash);
  const deleteManagerCash = usePos((s) => s.deleteManagerCash);
  const [opsDraft, setOpsDraft] = useState(String(sisihOpsPerDay));
  const [capDraft, setCapDraft] = useState(String(priveWeeklyCap));
  const [holdDraft, setHoldDraft] = useState(String(managerCashCap));
  const [tab, setTab] = useState<"cutoff" | "all">("cutoff");
  const [mgr, setMgr] = useState({ date: todayISO(), amount: "", note: "" });
  const cur = cutoffPeriod();
  const rows = useMemo(
    () => buildSavingCostLog(dailySales, dailyBooks, orders, sisihGajiPerDay, sisihOpsPerDay),
    [dailySales, dailyBooks, orders, sisihGajiPerDay, sisihOpsPerDay],
  );
  const shown = tab === "cutoff" ? rows.filter((r) => inCutoffRange(r.date, cur.start, cur.end)) : rows;
  const tot = shown.reduce(
    (s, r) => ({
      omzet: s.omzet + r.omzet,
      uangKotor: s.uangKotor + r.uangKotor,
      sisihGaji: s.sisihGaji + r.sisihGaji,
      sisihOps: s.sisihOps + r.sisihOps,
      uangBersih: s.uangBersih + r.uangBersih,
    }),
    { omzet: 0, uangKotor: 0, sisihGaji: 0, sisihOps: 0, uangBersih: 0 },
  );
  const periodExp = tab === "cutoff" ? expenses.filter((e) => inCutoffRange(e.date, cur.start, cur.end)) : expenses;
  const gajiPaid = periodExp.filter((e) => isGajiCat(e.category)).reduce((s, e) => s + e.amount, 0);
  const opsPaid = periodExp.filter((e) => isOpsCat(e.category)).reduce((s, e) => s + e.amount, 0);
  const oeripPaid = expenses.filter((e) => isOeripCat(e.category) || e.desc.toLowerCase().includes("oerip")).reduce((s, e) => s + e.amount, 0);
  const lastGaji = expenses.filter((e) => isGajiCat(e.category)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const sisaGaji = lastGaji ? rows.filter((r) => r.date > lastGaji.date).reduce((s, r) => s + r.sisihGaji, 0) : tot.sisihGaji;
  const sisaOps = tot.sisihOps - opsPaid;
  const week = priveWeekInfo(expenses, todayISO(), priveWeeklyCap);
  const logs = useMemo(
    () => managerCash.map((r) => normalizeManagerCash(r, managerCashCap)),
    [managerCash, managerCashCap],
  );
  const latestMgr = [...logs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const pendingSetor = logs.reduce((s, r) => s + Math.max(0, r.toDeposit - r.deposited), 0);
  const preview = splitManagerCash(Number(mgr.amount.replace(/\D/g, "") || 0), managerCashCap);
  const saveSettings = () => {
    const ops = Number(opsDraft.replace(/\D/g, ""));
    const cap = Number(capDraft.replace(/\D/g, ""));
    const hold = Number(holdDraft.replace(/\D/g, ""));
    if (ops) setSisihOpsPerDay(ops);
    if (cap) setPriveWeeklyCap(cap);
    if (hold) setManagerCashCap(hold);
  };
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">Log saving cost</h2>
          <p className="text-sm text-muted-foreground">
            Uang bersih = omzet − kotor − sisih gaji − sisih operasional. Sisa gaji = cadangan setelah gaji dibayar. Bukan kas keluar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={tab === "cutoff" ? "default" : "secondary"} onClick={() => setTab("cutoff")}>
            Siklus {cur.label}
          </Button>
          <Button size="sm" variant={tab === "all" ? "default" : "secondary"} onClick={() => setTab("all")}>
            Semua hari
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          Sisih operasional / hari
          <Input className="h-11 w-40 font-mono" inputMode="numeric" value={opsDraft} onChange={(e) => setOpsDraft(e.target.value)} onBlur={saveSettings} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Kuota prive / minggu
          <Input className="h-11 w-40 font-mono" inputMode="numeric" value={capDraft} onChange={(e) => setCapDraft(e.target.value)} onBlur={saveSettings} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Tunai max manager
          <Input className="h-11 w-40 font-mono" inputMode="numeric" value={holdDraft} onChange={(e) => setHoldDraft(e.target.value)} onBlur={saveSettings} />
        </label>
        <Button className="h-11" variant="secondary" onClick={saveSettings}>
          Simpan
        </Button>
        <Button
          className="h-11"
          variant="outline"
          onClick={() => {
            setOpsDraft(String(SISIH_OPS_PER_DAY));
            setCapDraft(String(PRIVE_WEEKLY_CAP));
            setHoldDraft(String(MANAGER_CASH_CAP));
            setSisihOpsPerDay(SISIH_OPS_PER_DAY);
            setPriveWeeklyCap(PRIVE_WEEKLY_CAP);
            setManagerCashCap(MANAGER_CASH_CAP);
          }}
        >
          Reset default
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Uang bersih"
          value={formatIDRCompact(tot.uangBersih)}
          hint={`${shown.length} hari buka`}
          tone={tot.uangBersih >= 0 ? "text-success" : "text-destructive"}
        />
        <Kpi
          label="Sisa sisih gaji"
          value={formatIDRCompact(sisaGaji)}
          hint={lastGaji ? `Setelah gaji ${formatDateID(lastGaji.date)}` : "Belum ada pembayaran gaji"}
          tone={sisaGaji >= 0 ? "text-success" : "text-destructive"}
        />
        <Kpi
          label="Cadangan operasional"
          value={formatIDRCompact(sisaOps)}
          hint={`${formatIDR(tot.sisihOps)} sisih − ${formatIDR(opsPaid)} realisasi`}
          tone={sisaOps >= 0 ? "text-success" : "text-warning"}
        />
        <Kpi
          label="Uang dipegang manager"
          value={latestMgr ? formatIDRCompact(latestMgr.held) : "Belum dicatat"}
          hint={latestMgr ? `Max ${formatIDR(managerCashCap)}` : `Batas ${formatIDR(managerCashCap)}`}
          tone={latestMgr && latestMgr.toDeposit > latestMgr.deposited ? "text-warning" : "text-success"}
        />
        <Kpi
          label="Wajib setor"
          value={formatIDRCompact(pendingSetor)}
          hint={pendingSetor > 0 ? `Kelebihan di atas ${formatIDR(managerCashCap)}` : "Semua sudah disetor"}
          tone={pendingSetor > 0 ? "text-destructive" : "text-success"}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-medium">Alokasi periode</p>
          <ul className="mt-2 space-y-1">
            <Row k="Omzet" v={formatIDR(tot.omzet)} />
            <Row k="Uang kotor (COGS)" v={formatIDR(tot.uangKotor)} />
            <Row k={`Sisih gaji (${shown.length} × ${formatIDR(sisihGajiPerDay)})`} v={formatIDR(tot.sisihGaji)} />
            <Row k={`Sisih operasional (${shown.length} × ${formatIDR(sisihOpsPerDay)})`} v={formatIDR(tot.sisihOps)} />
            <Row k="Uang bersih" v={formatIDR(tot.uangBersih)} tone={tot.uangBersih >= 0 ? "text-success" : "text-destructive"} />
            <Row k="Gaji sudah dibayar" v={formatIDR(gajiPaid)} />
          </ul>
        </div>
        <div className={`rounded-xl border p-4 text-sm ${week.over ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"}`}>
          <p className="font-medium">Syarat prive per minggu</p>
          <p className="mt-1 text-xs text-muted-foreground">{week.label} · Senin–Minggu</p>
          <p className={`mt-2 font-mono text-xl tabular-nums ${week.over ? "text-destructive" : ""}`}>
            {formatIDR(week.used)} / {formatIDR(week.cap)}
          </p>
          <p className="mt-1 text-muted-foreground">
            {week.over ? `Melebihi ${formatIDR(week.used - week.cap)}. Penarikan baru ditolak.` : `Sisa kuota ${formatIDR(week.remain)}.`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-medium">Membantu Oerip Indonesia</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{formatIDR(oeripPaid)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nama sudah ada di Log Pengeluaran. Catat nominal di sana — tidak otomatis terisi.
          </p>
        </div>
      </div>
      <div className={`rounded-xl border p-4 ${pendingSetor > 0 ? "border-destructive/40 bg-destructive/10" : "border-primary/40 bg-primary/10"}`}>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Aturan kas tunai manager</p>
        <p className="mt-1 font-display text-lg">Manager hanya boleh memegang tunai {formatIDR(managerCashCap)}. Sisanya disetorkan.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Hitung tunai fisik → sistem membagi: boleh pegang {formatIDR(managerCashCap)}, kelebihan wajib setor ke owner/brankas.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <form
          className="space-y-2 rounded-xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const amount = Number(mgr.amount.replace(/\D/g, ""));
            if (!mgr.date || amount < 0) return;
            upsertManagerCash({ date: mgr.date, amount, note: mgr.note });
            setMgr({ date: mgr.date, amount: "", note: "" });
          }}
        >
          <p className="font-medium">Hitung tunai manager</p>
          <p className="text-xs text-muted-foreground">Isi total tunai yang dihitung. Bukan yang boleh dipegang — kelebihan otomatis jadi wajib setor.</p>
          <Input type="date" className="h-11" value={mgr.date} onChange={(e) => setMgr({ ...mgr, date: e.target.value })} />
          <Input className="h-11 font-mono" inputMode="numeric" placeholder="Tunai dihitung" value={mgr.amount} onChange={(e) => setMgr({ ...mgr, amount: e.target.value })} required />
          <Input className="h-11" placeholder="Catatan (opsional)" value={mgr.note} onChange={(e) => setMgr({ ...mgr, note: e.target.value })} />
          {preview.counted > 0 ? (
            <p className={`text-xs ${preview.toDeposit > 0 ? "text-warning" : "text-success"}`}>
              Boleh pegang {formatIDR(preview.held)} · wajib setor {formatIDR(preview.toDeposit)}
            </p>
          ) : null}
          <Button type="submit" className="h-11 w-full">
            Catat tunai
          </Button>
        </form>
        <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-border">
          {logs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Belum ada hitungan. Isi tunai fisik — kalau lebih dari {formatIDR(managerCashCap)}, sisanya wajib disetor.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Tanggal", "Dihitung", "Boleh pegang", "Wajib setor", "Sudah setor", "Status", ""].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...logs].reverse().map((r) => {
                  const due = Math.max(0, r.toDeposit - r.deposited);
                  const ok = due === 0;
                  return (
                    <tr key={r.id} className={`border-t border-border ${!ok ? "bg-destructive/10" : ""}`}>
                      <td className="px-3 py-2 font-mono text-xs">{formatDateID(r.date)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.counted)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.held)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.toDeposit)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.deposited)}</td>
                      <td className="px-3 py-2">
                        <Badge tone={ok ? "success" : "danger"}>{ok ? (r.toDeposit > 0 ? "Sudah setor" : "Aman") : "Wajib setor"}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {!ok ? (
                            <Button size="sm" className="h-11" onClick={() => setorManagerCash(r.id)}>
                              Setorkan sisa
                            </Button>
                          ) : null}
                          <Button size="sm" variant="ghost" className="h-11 text-destructive" onClick={() => deleteManagerCash(r.id)}>
                            Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {["Tanggal", "Omzet", "Uang kotor", "Sisih gaji", "Sisih ops", "Uang bersih"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...shown].reverse().map((r) => (
              <tr key={r.date} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{formatDateID(r.date)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.omzet)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.uangKotor)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.sisihGaji)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(r.sisihOps)}</td>
                <td className={`px-3 py-2 font-mono tabular-nums ${r.uangBersih >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatIDR(r.uangBersih)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border bg-muted/60 font-medium">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(tot.omzet)}</td>
              <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(tot.uangKotor)}</td>
              <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(tot.sisihGaji)}</td>
              <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(tot.sisihOps)}</td>
              <td className={`px-3 py-2 font-mono tabular-nums ${tot.uangBersih >= 0 ? "text-success" : "text-destructive"}`}>
                {formatIDR(tot.uangBersih)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
