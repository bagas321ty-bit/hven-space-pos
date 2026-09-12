import { cutoffPeriod, formatDateID, formatIDR, formatPct, inCutoffRange, shiftDateISO, todayISO } from "@/lib/format";
import {
  buildSavingCostLog,
  buildSisihLog,
  displayCat,
  liveFinance,
  priveWeekInfo,
  resolveMoneyIn,
} from "@/lib/sheet-books";
import { DAILY_TARGET, MONTHLY_TARGET, normalizeManagerCash, type DailyBook, type DailySale, type Expense, type Income, type ManagerCashLog, type MoneyInRow, type Order, type Product, type TutupBuku, type WeeklyRow } from "@/lib/types";

export type BukuScopeMode = "cutoff" | "all";

export interface BukuExportInput {
  dailySales: DailySale[];
  dailyBooks: DailyBook[];
  expenses: Expense[];
  incomes: Income[];
  orders: Order[];
  moneyIn: MoneyInRow[];
  managerCash: ManagerCashLog[];
  managerCashCap: number;
  tutupBuku: TutupBuku[];
  weekly: WeeklyRow[];
  products: Product[];
  sisihGajiPerDay: number;
  sisihOpsPerDay: number;
  priveWeeklyCap: number;
  actor: string;
}

export interface BukuScope {
  mode: BukuScopeMode;
  start: string;
  end: string;
  label: string;
}

export function resolveBukuScope(mode: BukuScopeMode, sales: DailySale[]): BukuScope {
  if (mode === "cutoff") {
    const cur = cutoffPeriod();
    return { mode, start: cur.start, end: cur.end, label: `Siklus ${cur.label}` };
  }
  const dates = sales.map((d) => d.date).sort();
  const start = dates[0] ?? "2026-08-12";
  const end = dates[dates.length - 1] ?? todayISO();
  return { mode, start, end, label: `Semua data (${formatDateID(start)} – ${formatDateID(end)})` };
}

function inScope(date: string, scope: BukuScope) {
  return inCutoffRange(date, scope.start, scope.end);
}

export interface BukuKpi {
  label: string;
  value: string;
  hint?: string;
}

export interface BukuSummary {
  scope: BukuScope;
  generatedAt: string;
  kpis: BukuKpi[];
  bullets: string[];
  rumus: string[];
  sheets: { name: string; rows: number; hint: string }[];
}

function filterDate<T extends { date: string }>(rows: T[], scope: BukuScope) {
  return rows.filter((r) => inScope(r.date, scope));
}

export function summarizeBuku(input: BukuExportInput, scope: BukuScope): BukuSummary {
  const sales = filterDate(input.dailySales, scope);
  const expenses = filterDate(input.expenses, scope);
  const incomes = filterDate(input.incomes, scope);
  const books = filterDate(input.dailyBooks, scope);
  const sisih = buildSisihLog(input.dailySales, input.dailyBooks, input.orders, input.sisihGajiPerDay).filter((r) => inScope(r.date, scope));
  const saving = buildSavingCostLog(input.dailySales, input.dailyBooks, input.orders, input.sisihGajiPerDay, input.sisihOpsPerDay).filter((r) =>
    inScope(r.date, scope),
  );
  const f = liveFinance({
    dailySales: input.dailySales,
    expenses: input.expenses,
    incomes: input.incomes,
    dailyBooks: input.dailyBooks,
    orders: input.orders,
  });
  const omzet = sales.reduce((s, d) => s + d.omzet, 0);
  const keluar = expenses.reduce((s, e) => s + e.amount, 0);
  const masuk = incomes.reduce((s, e) => s + e.amount, 0);
  const sisihTot = sisih.reduce(
    (s, r) => ({
      kotor: s.kotor + r.uangKotor,
      gaji: s.gaji + r.sisihGaji,
      laba: s.laba + r.labaBersih,
    }),
    { kotor: 0, gaji: 0, laba: 0 },
  );
  const savingTot = saving.reduce((s, r) => s + r.uangBersih, 0);
  const last = [...sales].reverse().find((d) => d.omzet > 0);
  const week = priveWeekInfo(input.expenses, todayISO(), input.priveWeeklyCap);
  const lastGaji = input.expenses.filter((e) => e.category.toLowerCase() === "gaji").sort((a, b) => b.date.localeCompare(a.date))[0];
  const cadanganGaji = lastGaji ? sisih.filter((r) => r.date > lastGaji.date).reduce((s, r) => s + r.sisihGaji, 0) : sisihTot.gaji;
  const mgr = [...input.managerCash]
    .map((r) => normalizeManagerCash(r, input.managerCashCap))
    .filter((r) => inScope(r.date, scope))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const paid = input.orders.filter((o) => o.status === "paid" && inScope(shiftDateISO(o.createdAt), scope));
  const daysOpen = sisih.length;
  const dailyHit = (last?.omzet ?? 0) >= DAILY_TARGET;
  const mtdPct = MONTHLY_TARGET ? omzet / MONTHLY_TARGET : 0;
  const moneyDates = sales.map((d) => d.date);
  const moneyRows = moneyDates.map((date) => resolveMoneyIn(date, input.orders, input.moneyIn));
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    const k = displayCat(e.category);
    byCat.set(k, (byCat.get(k) ?? 0) + e.amount);
  }

  const kpis: BukuKpi[] = [
    { label: "Omzet periode", value: formatIDR(omzet), hint: `${daysOpen} hari buka` },
    { label: "Target siklus", value: formatIDR(MONTHLY_TARGET), hint: `${formatPct(mtdPct, 1)} tercapai` },
    { label: "Pengeluaran", value: formatIDR(keluar), hint: `${expenses.length} transaksi` },
    { label: "Pemasukan non-kasir", value: formatIDR(masuk) },
    { label: "Uang kotor (COGS)", value: formatIDR(sisihTot.kotor) },
    { label: "Sisih gaji", value: formatIDR(sisihTot.gaji), hint: `${daysOpen} × ${formatIDR(input.sisihGajiPerDay)}` },
    { label: "Laba bersih", value: formatIDR(sisihTot.laba), hint: "Omzet − kotor − sisih gaji" },
    { label: "Uang bersih", value: formatIDR(savingTot), hint: "Setelah sisih operasional" },
    { label: "Kas bebas (akumulasi)", value: formatIDR(f.freeCash), hint: f.liquidity },
    { label: "Kuota prive minggu ini", value: `${formatIDR(week.used)} / ${formatIDR(week.cap)}`, hint: week.label },
  ];

  const bullets: string[] = [
    `${scope.label}: omzet ${formatIDR(omzet)} dari target toko ${formatIDR(MONTHLY_TARGET)} (${formatPct(mtdPct, 1)}). Sisa ${formatIDR(Math.max(0, MONTHLY_TARGET - omzet))}.`,
    last
      ? `Omzet terakhir ${formatIDR(last.omzet)} pada ${formatDateID(last.date)} — ${dailyHit ? "mencapai" : "di bawah"} target harian ${formatIDR(DAILY_TARGET)}.`
      : "Belum ada omzet di rentang ini.",
    `Uang kotor disisihkan ${formatIDR(sisihTot.kotor)} untuk restok. Sisih gaji ${formatIDR(sisihTot.gaji)} adalah cadangan, bukan kas keluar.`,
    `Laba bersih periode ${formatIDR(sisihTot.laba)}. Setelah sisih operasional ${formatIDR(input.sisihOpsPerDay)}/hari, uang bersih ${formatIDR(savingTot)}.`,
    lastGaji
      ? `Gaji terakhir dibayar ${formatDateID(lastGaji.date)}. Cadangan gaji sejak itu ${formatIDR(cadanganGaji)}.`
      : `Belum ada pembayaran gaji di log. Cadangan sisih gaji ${formatIDR(sisihTot.gaji)}.`,
    `Prive akumulasi (semua periode) ${formatIDR(f.prive)}. Kas bebas ${formatIDR(f.freeCash)} — ${f.liquidity === "AMAN DITARIK" ? "masih longgar, sisihkan buffer 10%." : "tunda penarikan sampai stok & gaji tercover."}`,
    week.over
      ? `Kuota prive ${week.label} terlampaui ${formatIDR(week.used - week.cap)}. Tahan prive baru.`
      : `Kuota prive ${week.label} terpakai ${formatIDR(week.used)}, sisa ${formatIDR(week.remain)}.`,
    mgr
      ? `Manager tunai terakhir ${formatDateID(mgr.date)}: dihitung ${formatIDR(mgr.counted)}, dipegang ${formatIDR(mgr.held)} (maks ${formatIDR(input.managerCashCap)}), wajib setor ${formatIDR(mgr.toDeposit)}, sudah setor ${formatIDR(mgr.deposited)}.`
      : "Belum ada catatan tunai manager di rentang ini.",
    `Struk POS di rentang: ${paid.length} tiket berbayar ${formatIDR(paid.reduce((s, o) => s + o.total, 0))}.`,
    f.expByCat[0] ? `Beban terbesar: ${f.expByCat[0].category} ${formatIDR(f.expByCat[0].amount)} (${formatPct(f.expByCat[0].share, 1)} dari semua pengeluaran).` : "Belum ada pengeluaran.",
  ];

  const rumus = [
    "Laba bersih harian = Omzet − Uang kotor (COGS) − Sisih gaji",
    "Uang bersih harian = Laba bersih − Sisih operasional",
    "Sisih gaji & operasional = cadangan, bukan transaksi kas keluar. Gaji aktual tetap di Log Pengeluaran.",
    "Siklus tutup buku HVEN = tanggal 7 s.d. 6 bulan berikutnya (bukan 1–30).",
    `Target toko ${formatIDR(MONTHLY_TARGET)} / siklus · target harian ${formatIDR(DAILY_TARGET)}.`,
    `Manager hanya boleh memegang tunai ${formatIDR(input.managerCashCap)}; sisanya wajib disetor.`,
  ];

  const sheets = [
    { name: "Ringkasan", rows: bullets.length, hint: "Kesimpulan & KPI" },
    { name: "Omzet Harian", rows: sales.length, hint: "Log omzet vs target 2 jt" },
    { name: "Sisih Gaji", rows: sisih.length, hint: "Omzet − kotor − gaji" },
    { name: "Saving Cost", rows: saving.length, hint: "Uang bersih harian" },
    { name: "Pengeluaran", rows: expenses.length, hint: "Kas keluar per transaksi" },
    { name: "Rekap Kategori", rows: byCat.size, hint: "Pengeluaran digabung" },
    { name: "Pemasukan", rows: incomes.length, hint: "Sewa & non-kasir" },
    { name: "Uang Masuk", rows: moneyRows.length, hint: "GoPay / EDC / tunai" },
    { name: "Manager Tunai", rows: input.managerCash.filter((r) => inScope(r.date, scope)).length, hint: "Pegangan 200rb & setor" },
    { name: "Tutup Buku", rows: input.tutupBuku.length, hint: "Siklus 7–6" },
    { name: "Mingguan", rows: input.weekly.length, hint: "Omzet vs beban" },
    { name: "Menu", rows: input.products.length, hint: "Harga, HPP, kuadran" },
    { name: "Struk POS", rows: paid.length, hint: "Tiket berbayar" },
    { name: "Cara Baca", rows: rumus.length, hint: "Definisi angka" },
  ];

  return { scope, generatedAt: new Date().toISOString(), kpis, bullets, rumus, sheets };
}

const GOLD = "C9A87C";
const INK = "1A140C";
const CREAM = "FBF7F1";
const MUTED = "7A7168";
const IDR = '"Rp "#,##0';
const PCT = "0.0%";

function colLetter(n: number) {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

type ExcelJSMod = typeof import("exceljs");
type WB = InstanceType<ExcelJSMod["Workbook"]>;
type WS = ReturnType<WB["addWorksheet"]>;

function paintHeader(ws: WS, cols: number, rowNum = 1) {
  const row = ws.getRow(rowNum);
  row.height = 22;
  row.font = { name: "Calibri", bold: true, color: { argb: `FF${INK}` }, size: 11 };
  row.alignment = { vertical: "middle", wrapText: true };
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${GOLD}` } };
    cell.border = {
      bottom: { style: "thin", color: { argb: `FF${INK}` } },
    };
  }
}

function addTable(
  ws: WS,
  headers: string[],
  rows: (string | number | Date | null)[][],
  money: number[],
  pct: number[] = [],
  totals = true,
) {
  ws.addRow(headers);
  paintHeader(ws, headers.length);
  for (const r of rows) ws.addRow(r);
  const last = 1 + rows.length;
  const moneySet = new Set(money);
  const pctSet = new Set(pct);
  for (let i = 2; i <= last; i++) {
    const row = ws.getRow(i);
    row.alignment = { vertical: "middle" };
    row.font = { name: "Calibri", size: 11, color: { argb: `FF${INK}` } };
    if (i % 2 === 0) {
      for (let c = 1; c <= headers.length; c++) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${CREAM}` } };
      }
    }
    for (const c of moneySet) row.getCell(c).numFmt = IDR;
    for (const c of pctSet) row.getCell(c).numFmt = PCT;
  }
  if (totals && rows.length) {
    const tot = ws.addRow(
      headers.map((_, i) => {
        if (i === 0) return "TOTAL";
        const col = i + 1;
        if (moneySet.has(col)) return { formula: `SUM(${colLetter(col)}2:${colLetter(col)}${last})` };
        return "";
      }),
    );
    tot.font = { name: "Calibri", bold: true, size: 11, color: { argb: `FF${INK}` } };
    tot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${GOLD}` } };
    for (const c of moneySet) tot.getCell(c).numFmt = IDR;
  }
  ws.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, last), column: headers.length },
  };
  headers.forEach((h, i) => {
    const max = Math.max(h.length, ...rows.slice(0, 40).map((r) => String(r[i] ?? "").length));
    ws.getColumn(i + 1).width = Math.min(42, Math.max(12, max + 4));
  });
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function titleBlock(ws: WS, title: string, subtitle: string, actor: string, generatedAt: string) {
  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = "HVEN SPACE · Pembukuan";
  ws.getCell("A1").font = { name: "Calibri", bold: true, size: 12, color: { argb: `FF${GOLD}` } };
  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = title;
  ws.getCell("A2").font = { name: "Calibri", bold: true, size: 20, color: { argb: `FF${INK}` } };
  ws.mergeCells("A3:F3");
  ws.getCell("A3").value = subtitle;
  ws.getCell("A3").font = { name: "Calibri", size: 12, color: { argb: `FF${MUTED}` } };
  ws.mergeCells("A4:F4");
  ws.getCell("A4").value = `Diekspor ${formatDateID(generatedAt.slice(0, 10))} ${generatedAt.slice(11, 16)} WIB · ${actor}`;
  ws.getCell("A4").font = { name: "Calibri", size: 10, color: { argb: `FF${MUTED}` } };
  ws.views = [{ showGridLines: false }];
}

export async function buildBukuWorkbook(input: BukuExportInput, scope: BukuScope): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "HVEN Space POS";
  wb.lastModifiedBy = input.actor;
  wb.created = new Date();
  wb.modified = new Date();
  const summary = summarizeBuku(input, scope);
  const sales = filterDate(input.dailySales, scope).sort((a, b) => a.date.localeCompare(b.date));
  const expenses = filterDate(input.expenses, scope).sort((a, b) => a.date.localeCompare(b.date) || a.category.localeCompare(b.category));
  const incomes = filterDate(input.incomes, scope).sort((a, b) => a.date.localeCompare(b.date));
  const sisih = buildSisihLog(input.dailySales, input.dailyBooks, input.orders, input.sisihGajiPerDay).filter((r) => inScope(r.date, scope));
  const saving = buildSavingCostLog(input.dailySales, input.dailyBooks, input.orders, input.sisihGajiPerDay, input.sisihOpsPerDay).filter((r) =>
    inScope(r.date, scope),
  );
  const paid = input.orders
    .filter((o) => o.status === "paid" && inScope(shiftDateISO(o.createdAt), scope))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const mgr = input.managerCash
    .map((r) => normalizeManagerCash(r, input.managerCashCap))
    .filter((r) => inScope(r.date, scope))
    .sort((a, b) => a.date.localeCompare(b.date));
  const byCat = new Map<string, { amount: number; n: number }>();
  for (const e of expenses) {
    const k = displayCat(e.category);
    const cur = byCat.get(k) ?? { amount: 0, n: 0 };
    cur.amount += e.amount;
    cur.n += 1;
    byCat.set(k, cur);
  }
  const catTotal = expenses.reduce((s, e) => s + e.amount, 0);

  const ring = wb.addWorksheet("Ringkasan", { properties: { tabColor: { argb: `FF${GOLD}` } } });
  titleBlock(ring, "Ringkasan keuangan", summary.scope.label, input.actor, summary.generatedAt);
  ring.getCell("A6").value = "Indikator";
  ring.getCell("B6").value = "Nilai";
  ring.getCell("C6").value = "Catatan";
  paintHeader(ring, 3, 6);
  summary.kpis.forEach((k, i) => {
    const row = ring.addRow([k.label, k.value, k.hint ?? ""]);
    row.font = { name: "Calibri", size: 11, color: { argb: `FF${INK}` } };
    if (i % 2 === 0) {
      for (let c = 1; c <= 3; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${CREAM}` } };
    }
  });
  let r = 7 + summary.kpis.length + 1;
  ring.getCell(`A${r}`).value = "Kesimpulan";
  ring.getCell(`A${r}`).font = { name: "Calibri", bold: true, size: 14, color: { argb: `FF${INK}` } };
  r += 1;
  for (const b of summary.bullets) {
    ring.mergeCells(`A${r}:F${r}`);
    ring.getCell(`A${r}`).value = `• ${b}`;
    ring.getCell(`A${r}`).alignment = { wrapText: true, vertical: "top" };
    ring.getCell(`A${r}`).font = { name: "Calibri", size: 11, color: { argb: `FF${INK}` } };
    ring.getRow(r).height = 32;
    r += 1;
  }
  r += 1;
  ring.getCell(`A${r}`).value = "Rumus & aturan";
  ring.getCell(`A${r}`).font = { name: "Calibri", bold: true, size: 14, color: { argb: `FF${INK}` } };
  r += 1;
  for (const b of summary.rumus) {
    ring.mergeCells(`A${r}:F${r}`);
    ring.getCell(`A${r}`).value = `• ${b}`;
    ring.getCell(`A${r}`).alignment = { wrapText: true };
    ring.getCell(`A${r}`).font = { name: "Calibri", size: 11, color: { argb: `FF${MUTED}` } };
    r += 1;
  }
  ring.getColumn(1).width = 36;
  ring.getColumn(2).width = 28;
  ring.getColumn(3).width = 42;
  ring.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };

  const omzetWs = wb.addWorksheet("Omzet Harian");
  addTable(
    omzetWs,
    ["Tanggal", "Omzet", "Target harian", "Selisih", "Status", "Porsi (struk)"],
    sales.map((d) => {
      const cups = paid
        .filter((o) => shiftDateISO(o.createdAt) === d.date)
        .reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0);
      const gap = d.omzet - DAILY_TARGET;
      return [formatDateID(d.date), d.omzet, DAILY_TARGET, gap, gap >= 0 ? "Tercapai" : "Di bawah target", cups];
    }),
    [2, 3, 4],
  );

  const sisihWs = wb.addWorksheet("Sisih Gaji");
  addTable(
    sisihWs,
    ["Tanggal", "Omzet", "Uang kotor (COGS)", "Sisih gaji", "Laba bersih"],
    sisih.map((d) => [formatDateID(d.date), d.omzet, d.uangKotor, d.sisihGaji, d.labaBersih]),
    [2, 3, 4, 5],
  );

  const savingWs = wb.addWorksheet("Saving Cost");
  addTable(
    savingWs,
    ["Tanggal", "Omzet", "Uang kotor", "Sisih gaji", "Sisih operasional", "Uang bersih"],
    saving.map((d) => [formatDateID(d.date), d.omzet, d.uangKotor, d.sisihGaji, d.sisihOps, d.uangBersih]),
    [2, 3, 4, 5, 6],
  );

  const expWs = wb.addWorksheet("Pengeluaran");
  addTable(
    expWs,
    ["Tanggal", "Kategori", "Keterangan", "Nominal", "Nota", "Metode"],
    expenses.map((e) => [formatDateID(e.date), displayCat(e.category), e.desc, e.amount, e.nota ?? "", e.date >= "2026-09-12" ? (e.pay ?? "") : ""]),
    [4],
  );

  const catWs = wb.addWorksheet("Rekap Kategori");
  addTable(
    catWs,
    ["Kategori", "Jumlah transaksi", "Nominal", "Porsi"],
    [...byCat.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([k, v]) => [k, v.n, v.amount, catTotal ? v.amount / catTotal : 0]),
    [3],
    [4],
  );

  const incWs = wb.addWorksheet("Pemasukan");
  addTable(
    incWs,
    ["Tanggal", "Kategori", "Keterangan", "Nominal", "Status"],
    incomes.map((e) => [formatDateID(e.date), e.category, e.desc, e.amount, e.status]),
    [4],
  );

  const moneyWs = wb.addWorksheet("Uang Masuk");
  addTable(
    moneyWs,
    ["Tanggal", "GoPay / QRIS", "EDC / Debit", "Tunai", "Total pecah", "Omzet buku", "Selisih", "Sumber"],
    sales.map((d) => {
      const m = resolveMoneyIn(d.date, input.orders, input.moneyIn);
      const pecah = m.gopay + m.edc + m.tunai;
      return [formatDateID(d.date), m.gopay, m.edc, m.tunai, pecah, d.omzet, pecah - d.omzet, m.source];
    }),
    [2, 3, 4, 5, 6, 7],
  );

  const mgrWs = wb.addWorksheet("Manager Tunai");
  addTable(
    mgrWs,
    ["Tanggal", "Dihitung", "Dipegang", "Wajib setor", "Sudah setor", "Sisa setor", "Catatan"],
    mgr.map((r) => [formatDateID(r.date), r.counted, r.held, r.toDeposit, r.deposited, Math.max(0, r.toDeposit - r.deposited), r.note]),
    [2, 3, 4, 5, 6],
  );

  const tbWs = wb.addWorksheet("Tutup Buku");
  addTable(
    tbWs,
    ["Periode", "Mulai", "Selesai", "Pendapatan", "COGS", "Pengeluaran", "Laba", "Status", "PIC", "Catatan"],
    input.tutupBuku.map((t) => [t.period, t.startDate, t.endDate, t.income, t.cogs, t.expense, t.profit, t.status, t.pic, t.note]),
    [4, 5, 6, 7],
  );

  const weekWs = wb.addWorksheet("Mingguan");
  addTable(
    weekWs,
    ["Minggu", "Omzet", "Pengeluaran", "COGS", "Laba"],
    input.weekly.map((w) => [w.week, w.income, w.expense, w.cogs, w.profit]),
    [2, 3, 4, 5],
  );

  const menuWs = wb.addWorksheet("Menu");
  addTable(
    menuWs,
    ["Menu", "Kategori", "SKU", "Harga", "HPP", "Margin", "Terjual", "Kuadran", "Rekomendasi"],
    [...input.products]
      .sort((a, b) => b.soldQty - a.soldQty)
      .map((p) => [p.name, p.category, p.sku, p.price, p.cogs, p.margin, p.soldQty, p.quadrant, p.recommendation]),
    [4, 5],
    [6],
    false,
  );

  const strukWs = wb.addWorksheet("Struk POS");
  addTable(
    strukWs,
    ["Nomor", "Tanggal operasional", "Waktu", "Tipe", "Meja", "Tamu", "Kasir", "Bayar", "Subtotal", "Diskon", "Pajak", "Total"],
    paid.map((o) => [
      o.number,
      formatDateID(shiftDateISO(o.createdAt)),
      o.createdAt.slice(11, 16),
      o.type,
      o.table,
      o.customer,
      o.cashier,
      o.payment,
      o.subtotal,
      o.discount,
      o.tax,
      o.total,
    ]),
    [9, 10, 11, 12],
  );

  const cara = wb.addWorksheet("Cara Baca");
  titleBlock(cara, "Cara membaca file ini", "Definisi angka HVEN Space", input.actor, summary.generatedAt);
  const glossary = [
    ["Sheet", "Isi"],
    ["Ringkasan", "Kesimpulan owner: omzet vs target, laba, prive, cadangan gaji, manager tunai."],
    ["Omzet Harian", "Penjualan per hari operasional (07.00–02.00). Target harian Rp 2.000.000."],
    ["Sisih Gaji", "Cadangan gaji Rp/hari + uang kotor (COGS). Bukan kas keluar."],
    ["Saving Cost", "Laba bersih dikurangi sisih operasional. Ini uang yang benar-benar bersih."],
    ["Pengeluaran", "Kas keluar aktual (prive, gaji dibayar, bahan, Oerip, dll)."],
    ["Rekap Kategori", "Pengeluaran digabung per jenis."],
    ["Pemasukan", "Sewa Diantara & pemasukan non-kasir."],
    ["Uang Masuk", "Pecahan GoPay/QRIS, EDC, tunai vs omzet buku."],
    ["Manager Tunai", "Kas dipegang manager, maksimal 200.000, sisanya setor."],
    ["Tutup Buku", "Siklus 7 s.d. 6, bukan bulan kalender."],
    ["Struk POS", "Tiket berbayar. Tidak menimpa log omzet spreadsheet historis."],
    ["Angka", "Format Rupiah. Baris TOTAL memakai rumus SUM, aman dijumlah ulang di Excel."],
  ];
  glossary.forEach((row, i) => {
    const excelRow = cara.addRow(row);
    if (i === 0) {
      paintHeader(cara, 2, excelRow.number);
    } else {
      excelRow.font = { name: "Calibri", size: 11, color: { argb: `FF${INK}` } };
      excelRow.alignment = { wrapText: true, vertical: "top" };
      excelRow.height = 28;
    }
  });
  cara.getColumn(1).width = 22;
  cara.getColumn(2).width = 88;

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

export function exportFileName(scope: BukuScope) {
  const stamp = todayISO();
  const tag = scope.mode === "cutoff" ? `${scope.start}_${scope.end}` : `semua_${stamp}`;
  return `HVEN_Pembukuan_${tag}.xlsx`;
}

export async function downloadBukuExcel(input: BukuExportInput, scope: BukuScope) {
  const buf = await buildBukuWorkbook(input, scope);
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = exportFileName(scope);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  return exportFileName(scope);
}
