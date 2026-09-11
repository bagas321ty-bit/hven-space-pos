import sheetRaw from "@/data/sheet-sync.json";
import { cutoffPeriod, inCutoffRange, inWeek, shiftDateISO, weekLabel, weekMonday, weekSunday } from "@/lib/format";
import type {
  DailyBook,
  DailySale,
  Expense,
  Income,
  MoneyInRow,
  Order,
  PaymentMethod,
  Product,
  Quadrant,
  WeeklyRow,
} from "@/lib/types";
import { SISIH_GAJI_PER_DAY, SISIH_OPS_PER_DAY } from "@/lib/types";

export const SHEET_SYNC = "sheet-2026-09-11-sisih2";
export const SHEET_OMZET_THROUGH = "2026-09-10";
export const SHEET_EXPENSE_THROUGH = "2026-09-11";

type SheetExpense = { date: string; category: string; desc: string; amount: number; nota?: string };
type SheetIncome = { date: string; category: string; desc: string; amount: number; status: string };
type SheetMenu = {
  name: string;
  price: number;
  cogs: number;
  margin: number;
  soldQty: number;
  quadrant: string;
  recommendation: string;
};

type SheetFile = {
  expensesAll: SheetExpense[];
  incomes: SheetIncome[];
  dailyBooks: DailyBook[];
  dailySales: DailySale[];
  weekly: WeeklyRow[];
  menus: SheetMenu[];
  prive: { date: string; desc: string; amount: number }[];
  executive: {
    targetMonthly: number;
    mtdOmzet: number;
    mtdCups: number;
    dailyTarget: number;
    lastOmzet: number;
    lastDate: string;
    totalOmzet: number;
    labaOps: number;
    prive: number;
    freeCash: number;
    cogsRatio: number;
    laborRatio: number;
    npm: number;
    cogsReserve: number;
    gajiReserve: number;
  };
};

const sheet = sheetRaw as SheetFile;

export const EXPENSE_CATEGORIES = [
  "Bahan Baku",
  "Gaji",
  "Operasional",
  "Operasional Sistem",
  "Pemasaran",
  "prive",
  "sub con",
  "Membantu Oerip Indonesia",
  "Lain-lain",
] as const;

export function isPriveCat(category: string): boolean {
  return category.trim().toLowerCase() === "prive";
}

export function isBahanCat(category: string): boolean {
  return category.trim().toLowerCase() === "bahan baku";
}

export function isGajiCat(category: string): boolean {
  return category.trim().toLowerCase() === "gaji";
}

export function isOpsCat(category: string): boolean {
  const key = category.trim().toLowerCase();
  return key === "operasional" || key === "operasional sistem";
}

export function isOeripCat(category: string): boolean {
  return category.trim().toLowerCase().includes("oerip");
}

export function displayCat(category: string): string {
  const key = category.trim().toLowerCase();
  if (key === "prive") return "Prive";
  if (key === "sub con") return "Sub Con";
  if (key.includes("oerip")) return "Membantu Oerip Indonesia";
  return category;
}

function withIds<T>(rows: T[], prefix: string): (T & { id: string })[] {
  return rows.map((row, i) => ({ ...row, id: `${prefix}-${String(i + 1).padStart(3, "0")}` }));
}

function buildExpenses(): Expense[] {
  const rows: Expense[] = withIds(
    sheet.expensesAll.map((e) => ({
      date: e.date,
      category: e.category,
      desc: e.desc,
      amount: e.amount,
      nota: e.nota || "",
    })),
    "sx-e",
  );
  const priveSum = rows.filter((e) => isPriveCat(e.category)).reduce((s, e) => s + e.amount, 0);
  const target = sheet.executive.prive;
  if (target - priveSum === 100000) {
    rows.push({
      id: "sx-e-prive-0824b",
      date: "2026-08-24",
      category: "prive",
      desc: "prive",
      amount: 100000,
      nota: "",
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export const SHEET_EXPENSES: Expense[] = buildExpenses();

export const SHEET_INCOMES: Income[] = withIds(
  sheet.incomes.map((i) => ({
    date: i.date,
    category: i.category,
    desc: i.desc,
    amount: i.amount,
    status: i.status || "Masuk",
  })),
  "sx-i",
);

export const SHEET_DAILY_SALES: DailySale[] = sheet.dailySales.map((d) => ({ ...d }));

const SHEET_COGS_EXTRA: Record<string, number> = {
  "2026-09-08": 665052,
  "2026-09-09": 301764,
  "2026-09-10": 415313,
};

function booksFromLedger(sales: DailySale[], expenses: Expense[], known: DailyBook[]): DailyBook[] {
  const knownMap = new Map(known.map((d) => [d.date, d]));
  const expByDay = new Map<string, number>();
  for (const e of expenses) {
    if (isBahanCat(e.category)) continue;
    expByDay.set(e.date, (expByDay.get(e.date) ?? 0) + e.amount);
  }
  const dates = new Set([...sales.map((d) => d.date), ...known.map((d) => d.date)]);
  return [...dates]
    .sort()
    .map((date) => {
      if (knownMap.has(date) && date <= "2026-09-07") return knownMap.get(date)!;
      const income = sales.find((d) => d.date === date)?.omzet ?? knownMap.get(date)?.income ?? 0;
      const cogs = SHEET_COGS_EXTRA[date] ?? knownMap.get(date)?.cogs ?? Math.round(income * sheet.executive.cogsRatio);
      const expense = expByDay.get(date) ?? 0;
      return { date, income, cogs, expense, profit: income - cogs - expense };
    });
}

export const SHEET_DAILY_BOOKS: DailyBook[] = booksFromLedger(SHEET_DAILY_SALES, SHEET_EXPENSES, sheet.dailyBooks);

export const SHEET_WEEKLY: WeeklyRow[] = [
  { week: "2026-W33", income: 17662000, expense: 4104800, cogs: 5209186, profit: 8348014 },
  { week: "2026-W34", income: 13569000, expense: 5698500, cogs: 2711608, profit: 5158892 },
  { week: "2026-W35", income: 8689000, expense: 10684000, cogs: 2592797, profit: -4587797 },
  { week: "2026-W36", income: 8275000, expense: 1176000, cogs: 2715637, profit: 4383363 },
  { week: "2026-W37", income: 6936500, expense: 5650000, cogs: 2309340, profit: -1022840 },
];

export const EXECUTIVE = {
  targetMonthly: 60_000_000,
  mtdOmzet: 6_936_500,
  mtdCups: 530,
  dailyTarget: 2_000_000,
  lastOmzet: 1_334_000,
  lastDate: "2026-09-10",
  totalOmzet: 55_131_500,
  labaOps: 12_279_632,
  netProfit: 12_279_632,
  prive: 9_688_100,
  priveTaken: 9_688_100,
  freeCash: 2_591_532,
  cogsRatio: 0.2818455511,
  laborRatio: 0.1343152281,
  npm: 0.2227335008,
  netMargin: 0.2227335008,
  cogsReserve: 16_562_572,
  stockReserve: 16_562_572,
  gajiReserve: 7_405_000,
  payrollReserve: 7_405_000,
};

const menuByName = new Map(
  sheet.menus.filter((m) => m.name !== "Total / Rata-rata").map((m) => [m.name.toLowerCase(), m]),
);

export function overlayProducts(products: Product[], orders: Order[] = []): Product[] {
  return products.map((p) => {
    const m = menuByName.get(p.name.toLowerCase());
    if (!m) return p;
    const extra = orders
      .filter((o) => o.status === "paid" && shiftDateISO(o.createdAt) > SHEET_OMZET_THROUGH)
      .flatMap((o) => o.items)
      .filter((i) => i.productId === p.id)
      .reduce((s, i) => s + i.qty, 0);
    const quadrant = (m.quadrant || p.quadrant) as Quadrant;
    return {
      ...p,
      price: m.price || p.price,
      cogs: Math.round(m.cogs || p.cogs),
      margin: m.margin || p.margin,
      soldQty: (m.soldQty || 0) + extra,
      quadrant: quadrant || p.quadrant,
      recommendation: m.recommendation || p.recommendation,
    };
  });
}

function extraAfter<T extends { date: string }>(live: T[] | undefined, seed: T[], through: string, drop?: (row: T) => boolean): T[] {
  return (live ?? []).filter((row) => row.date > through && !seed.some((s) => s.date === row.date && JSON.stringify(s) === JSON.stringify({ ...row, id: (s as T & { id?: string }).id })) && !drop?.(row));
}

export function mergeSheetBooks<T extends {
  sheetSync?: string;
  expenses: Expense[];
  incomes: Income[];
  dailySales: DailySale[];
  dailyBooks: DailyBook[];
  weekly: WeeklyRow[];
  products: Product[];
  orders: Order[];
  moneyIn?: MoneyInRow[];
}>(persisted: Partial<T>, current: T): T {
  if (persisted.sheetSync === SHEET_SYNC) {
    return {
      ...current,
      sheetSync: SHEET_SYNC,
      moneyIn: persisted.moneyIn ?? current.moneyIn ?? [],
    };
  }
  const extraSales = extraAfter(persisted.dailySales, SHEET_DAILY_SALES, SHEET_OMZET_THROUGH);
  const extraExp = (persisted.expenses ?? []).filter((e) => e.date > SHEET_EXPENSE_THROUGH);
  const extraInc = (persisted.incomes ?? []).filter((i) => {
    if (i.category === "Penjualan Kasir") return false;
    if (i.date <= "2026-08-20" && SHEET_INCOMES.some((s) => s.date === i.date && s.amount === i.amount)) return false;
    return i.date > "2026-08-20";
  });
  const dailySales = [...SHEET_DAILY_SALES];
  for (const row of extraSales) {
    const i = dailySales.findIndex((d) => d.date === row.date);
    if (i >= 0) dailySales[i] = { date: row.date, omzet: Math.max(dailySales[i].omzet, row.omzet) };
    else dailySales.push(row);
  }
  dailySales.sort((a, b) => a.date.localeCompare(b.date));
  const expenses = [...SHEET_EXPENSES, ...extraExp];
  const incomes = [...SHEET_INCOMES, ...extraInc];
  const dailyBooks = booksFromLedger(dailySales, expenses, SHEET_DAILY_BOOKS);
  return {
    ...current,
    sheetSync: SHEET_SYNC,
    expenses,
    incomes,
    dailySales,
    dailyBooks,
    weekly: SHEET_WEEKLY.map((w) => ({ ...w })),
    products: overlayProducts(persisted.products ?? current.products, persisted.orders ?? current.orders),
    moneyIn: persisted.moneyIn ?? [],
  };
}

export function payToSheet(method: PaymentMethod): keyof Pick<MoneyInRow, "gopay" | "edc" | "tunai"> {
  if (method === "Cash") return "tunai";
  if (method === "QRIS") return "gopay";
  return "edc";
}

export function moneyInFromPos(orders: Order[], date: string): Pick<MoneyInRow, "gopay" | "edc" | "tunai"> {
  const paid = orders.filter((o) => o.status === "paid" && shiftDateISO(o.createdAt) === date);
  const row = { gopay: 0, edc: 0, tunai: 0 };
  for (const o of paid) row[payToSheet(o.payment)] += o.total;
  return row;
}

export function resolveMoneyIn(
  date: string,
  orders: Order[],
  overrides: MoneyInRow[],
): MoneyInRow {
  const pos = moneyInFromPos(orders, date);
  const posTotal = pos.gopay + pos.edc + pos.tunai;
  const over = overrides.find((r) => r.date === date);
  if (over) {
    return { ...over, source: posTotal > 0 ? "mixed" : "manual" };
  }
  if (posTotal > 0) return { date, ...pos, source: "pos" };
  return { date, gopay: 0, edc: 0, tunai: 0, source: "manual" };
}

export type LiveFinance = {
  totalOmzet: number;
  mtdOmzet: number;
  mtdCups: number;
  lastOmzet: number;
  lastDate: string;
  sewa: number;
  expenseTotal: number;
  prive: number;
  bahan: number;
  gaji: number;
  cogs: number;
  labaOps: number;
  freeCash: number;
  cogsRatio: number;
  laborRatio: number;
  npm: number;
  remain: number;
  pct: number;
  liquidity: "AMAN DITARIK" | "TUNDA PENARIKAN";
  expByCat: { category: string; amount: number; share: number }[];
  cutoffLabel: string;
};

export function liveFinance(input: {
  dailySales: DailySale[];
  expenses: Expense[];
  incomes: Income[];
  dailyBooks: DailyBook[];
  orders: Order[];
}): LiveFinance {
  const e = EXECUTIVE;
  const extraOmzet = input.dailySales.filter((d) => d.date > SHEET_OMZET_THROUGH).reduce((s, d) => s + d.omzet, 0);
  const extraExp = input.expenses.filter((x) => x.date > SHEET_EXPENSE_THROUGH).reduce((s, x) => s + x.amount, 0);
  const extraPrive = input.expenses.filter((x) => x.date > SHEET_EXPENSE_THROUGH && isPriveCat(x.category)).reduce((s, x) => s + x.amount, 0);
  const extraSewa = input.incomes.filter((x) => x.date > "2026-08-20" && !SHEET_INCOMES.some((s) => s.date === x.date && s.amount === x.amount)).reduce((s, x) => s + x.amount, 0);
  const extraCogsBooks = input.dailyBooks.filter((d) => d.date > SHEET_OMZET_THROUGH).reduce((s, d) => s + d.cogs, 0);
  const extraCogs = extraCogsBooks || Math.round(extraOmzet * e.cogsRatio);
  const totalOmzet = e.totalOmzet + extraOmzet;
  const prive = e.prive + extraPrive;
  const labaOps = e.labaOps + extraOmzet + extraSewa - extraCogs - (extraExp - extraPrive);
  const freeCash = labaOps - prive;
  const cur = cutoffPeriod();
  const mtdOmzet = input.dailySales.filter((d) => inCutoffRange(d.date, cur.start, cur.end)).reduce((s, d) => s + d.omzet, 0);
  const extraCups = input.orders
    .filter((o) => o.status === "paid" && shiftDateISO(o.createdAt) > SHEET_OMZET_THROUGH && inCutoffRange(shiftDateISO(o.createdAt), cur.start, cur.end))
    .reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0);
  const sorted = [...input.dailySales].sort((a, b) => a.date.localeCompare(b.date));
  const last = [...sorted].reverse().find((d) => d.omzet > 0) ?? sorted[sorted.length - 1];
  const byCat = new Map<string, number>();
  for (const x of input.expenses) {
    const key = displayCat(x.category);
    byCat.set(key, (byCat.get(key) ?? 0) + x.amount);
  }
  const expenseTotal = input.expenses.reduce((s, x) => s + x.amount, 0);
  const expByCat = [...byCat.entries()]
    .map(([category, amount]) => ({ category, amount, share: expenseTotal ? amount / expenseTotal : 0 }))
    .sort((a, b) => b.amount - a.amount);
  return {
    totalOmzet,
    mtdOmzet,
    mtdCups: e.mtdCups + extraCups,
    lastOmzet: last?.omzet ?? 0,
    lastDate: last?.date ?? e.lastDate,
    sewa: input.incomes.reduce((s, x) => s + x.amount, 0),
    expenseTotal,
    prive,
    bahan: input.expenses.filter((x) => isBahanCat(x.category)).reduce((s, x) => s + x.amount, 0),
    gaji: input.expenses.filter((x) => x.category.toLowerCase() === "gaji").reduce((s, x) => s + x.amount, 0),
    cogs: input.dailyBooks.reduce((s, d) => s + d.cogs, 0) || Math.round(totalOmzet * e.cogsRatio),
    labaOps,
    freeCash,
    cogsRatio: e.cogsRatio,
    laborRatio: e.laborRatio,
    npm: e.npm,
    remain: Math.max(0, e.targetMonthly - mtdOmzet),
    pct: e.targetMonthly ? mtdOmzet / e.targetMonthly : 0,
    liquidity: freeCash >= 0 ? "AMAN DITARIK" : "TUNDA PENARIKAN",
    expByCat,
    cutoffLabel: cur.label,
  };
}

export type SisihRow = {
  date: string;
  omzet: number;
  uangKotor: number;
  sisihGaji: number;
  labaBersih: number;
};

export function buildSisihLog(
  sales: DailySale[],
  books: DailyBook[],
  orders: Order[],
  gajiPerDay = SISIH_GAJI_PER_DAY,
): SisihRow[] {
  const bookMap = new Map(books.map((b) => [b.date, b]));
  const omzetMap = new Map(sales.map((s) => [s.date, s.omzet]));
  for (const [date, omzet] of omzetMap) {
    if (date <= SHEET_OMZET_THROUGH) continue;
    const book = bookMap.get(date);
    if (book && book.cogs > 0) continue;
    const fromOrders = orders
      .filter((o) => o.status === "paid" && shiftDateISO(o.createdAt) === date)
      .reduce((s, o) => s + o.items.reduce((n, i) => n + i.cogs * i.qty, 0), 0);
    bookMap.set(date, {
      date,
      income: omzet,
      cogs: fromOrders || Math.round(omzet * EXECUTIVE.cogsRatio),
      expense: book?.expense ?? 0,
      profit: 0,
    });
  }
  const dates = new Set([...omzetMap.keys(), ...bookMap.keys()]);
  return [...dates]
    .sort()
    .map((date) => {
      const omzet = omzetMap.get(date) ?? bookMap.get(date)?.income ?? 0;
      const fromBook = bookMap.get(date)?.cogs;
      const uangKotor = fromBook && fromBook > 0 ? fromBook : omzet ? Math.round(omzet * EXECUTIVE.cogsRatio) : 0;
      const sisihGaji = omzet > 0 ? gajiPerDay : 0;
      return { date, omzet, uangKotor, sisihGaji, labaBersih: omzet - uangKotor - sisihGaji };
    })
    .filter((r) => r.omzet > 0);
}

export type SavingRow = {
  date: string;
  omzet: number;
  uangKotor: number;
  sisihGaji: number;
  sisihOps: number;
  uangBersih: number;
};

export function buildSavingCostLog(
  sales: DailySale[],
  books: DailyBook[],
  orders: Order[],
  gajiPerDay = SISIH_GAJI_PER_DAY,
  opsPerDay = SISIH_OPS_PER_DAY,
): SavingRow[] {
  return buildSisihLog(sales, books, orders, gajiPerDay).map((r) => {
    const sisihOps = r.omzet > 0 ? opsPerDay : 0;
    return {
      date: r.date,
      omzet: r.omzet,
      uangKotor: r.uangKotor,
      sisihGaji: r.sisihGaji,
      sisihOps,
      uangBersih: r.omzet - r.uangKotor - r.sisihGaji - sisihOps,
    };
  });
}

export function priveUsedInWeek(expenses: Expense[], anyDate: string): number {
  return expenses.filter((e) => isPriveCat(e.category) && inWeek(e.date, anyDate)).reduce((s, e) => s + e.amount, 0);
}

export function priveWeekInfo(expenses: Expense[], anyDate: string, cap: number) {
  const used = priveUsedInWeek(expenses, anyDate);
  const remain = Math.max(0, cap - used);
  return {
    start: weekMonday(anyDate),
    end: weekSunday(anyDate),
    label: weekLabel(anyDate),
    used,
    cap,
    remain,
    over: used > cap,
  };
}
