import type {
  AdjustLog,
  Attendance,
  AuditLog,
  BukuUser,
  DailyBook,
  DailySale,
  Expense,
  Income,
  Incident,
  Ingredient,
  ManagerCashLog,
  MoneyInRow,
  NotificationItem,
  Order,
  Product,
  RecipeLine,
  ShiftState,
  Staff,
  TutupBuku,
  WeeklyRow,
  WorkShift,
  ShiftChangeLog,
  CartItem,
  MoneyBooks,
  LedgerEntry,
} from "@/lib/types";
import type { WaMode } from "@/lib/whatsapp";
import { SAMPLE_ORDERS, PRODUCTS } from "@/data/seed";
import { slimAttendance } from "@/lib/att-photo-slim";

export const POS_CLOUD_TOKEN_KEY = "hven-sync-v1";

export interface CloudPayload {
  products: Product[];
  menuCategories: string[];
  orders: Order[];
  expenses: Expense[];
  incomes: Income[];
  incidents: Incident[];
  inventory: Ingredient[];
  staff: Staff[];
  attendance: Attendance[];
  shift: ShiftState;
  notifications: NotificationItem[];
  audit: AuditLog[];
  tutupBuku: TutupBuku[];
  dailySales: DailySale[];
  dailyBooks: DailyBook[];
  weekly: WeeklyRow[];
  moneyIn: MoneyInRow[];
  sheetSync: string;
  adminPin: string;
  adjustLogs: AdjustLog[];
  taxEnabled: boolean;
  serviceEnabled: boolean;
  recipes: RecipeLine[];
  testPurge: string;
  bukuUsers: BukuUser[];
  bukuPin: string;
  waOwner: string;
  waKitchen: string;
  waOwnerMode: WaMode;
  waKitchenMode: WaMode;
  sisihGajiPerDay: number;
  sisihOpsPerDay: number;
  priveWeeklyCap: number;
  managerCashCap: number;
  managerCash: ManagerCashLog[];
  moneyBooks?: MoneyBooks;
  ledger?: LedgerEntry[];
  workShifts: WorkShift[];
  shiftLogs: ShiftChangeLog[];
  cart: CartItem[];
  cartEpoch: number;
}

export interface CloudDoc {
  rev: number;
  updatedAt: string;
  device: string;
  payload: CloudPayload;
}

export function isCloudPayload(v: unknown): v is CloudPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as CloudPayload;
  return Array.isArray(o.products) && Array.isArray(o.orders);
}

export function liveScore(p: CloudPayload): number {
  const extraOrders = p.orders.filter((o) => !SAMPLE_ORDERS.some((s) => s.id === o.id)).length;
  return (
    extraOrders * 40 +
    p.orders.length +
    p.expenses.length +
    p.attendance.length +
    p.managerCash.length +
    p.moneyIn.length +
    (p.menuCategories?.length ?? 0)
  );
}

function byId<T extends { id: string }>(rows: T[] | undefined): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows ?? []) {
    if (r && typeof r.id === "string") m.set(r.id, r);
  }
  return m;
}

function unionById<T extends { id: string }>(local: T[] | undefined, remote: T[] | undefined, pick: (a: T, b: T) => T): T[] {
  const a = byId(local);
  const b = byId(remote);
  const ids = new Set([...a.keys(), ...b.keys()]);
  const out: T[] = [];
  for (const id of ids) {
    const l = a.get(id);
    const r = b.get(id);
    if (l && r) out.push(pick(l, r));
    else out.push((l ?? r)!);
  }
  return out;
}

function unionByKey<T>(local: T[] | undefined, remote: T[] | undefined, key: (x: T) => string, pick: (a: T, b: T) => T): T[] {
  const a = new Map<string, T>();
  const b = new Map<string, T>();
  for (const r of local ?? []) a.set(key(r), r);
  for (const r of remote ?? []) b.set(key(r), r);
  const ids = new Set([...a.keys(), ...b.keys()]);
  const out: T[] = [];
  for (const id of ids) {
    const l = a.get(id);
    const r = b.get(id);
    if (l && r) out.push(pick(l, r));
    else out.push((l ?? r)!);
  }
  return out;
}

const KDS: Record<string, number> = { new: 0, cooking: 1, ready: 2, done: 3 };
const FB: Record<string, number> = { none: 0, waiting: 1, due: 2, skipped: 3, done: 4 };

function mergeOrderMeta(winner: Order, other: Order): Order {
  const wr = FB[winner.feedbackStatus ?? "none"] ?? 0;
  const or = FB[other.feedbackStatus ?? "none"] ?? 0;
  const feedback = or > wr ? other.feedback ?? winner.feedback : winner.feedback ?? other.feedback;
  const feedbackStatus = or > wr ? other.feedbackStatus : winner.feedbackStatus ?? other.feedbackStatus;
  return {
    ...winner,
    kdsDoneAt: winner.kdsDoneAt || other.kdsDoneAt,
    feedback,
    feedbackStatus,
    feedbackNotified: Boolean(winner.feedbackNotified || other.feedbackNotified),
    payment: (winner.updatedAt ?? "") >= (other.updatedAt ?? "") ? winner.payment : other.payment,
    tendered: (winner.updatedAt ?? "") >= (other.updatedAt ?? "") ? winner.tendered : other.tendered,
    change: (winner.updatedAt ?? "") >= (other.updatedAt ?? "") ? winner.change : other.change,
  };
}

function pickOrder(a: Order, b: Order): Order {
  if (a.status === "void") return mergeOrderMeta(a, b);
  if (b.status === "void") return mergeOrderMeta(b, a);
  const rank: Record<string, number> = { pending: 0, open: 1, paid: 2, void: 3 };
  const ar = rank[a.status] ?? 0;
  const br = rank[b.status] ?? 0;
  if (ar !== br) return mergeOrderMeta(ar > br ? a : b, ar > br ? b : a);
  const ak = KDS[a.kdsStatus] ?? 0;
  const bk = KDS[b.kdsStatus] ?? 0;
  if (ak !== bk) return mergeOrderMeta(ak > bk ? a : b, ak > bk ? b : a);
  const at = a.updatedAt ?? a.createdAt ?? "";
  const bt = b.updatedAt ?? b.createdAt ?? "";
  return mergeOrderMeta(bt > at ? b : a, bt > at ? a : b);
}

function pickProduct(a: Product, b: Product): Product {
  const seed = PRODUCTS.find((p) => p.id === a.id);
  const sold = Math.max(a.soldQty ?? 0, b.soldQty ?? 0);
  const stock = Math.min(a.stock ?? 0, b.stock ?? 0);
  const changed = (p: Product) =>
    !seed || p.price !== seed.price || p.name !== seed.name || p.category !== seed.category || p.available !== seed.available;
  const aCh = changed(a);
  const bCh = changed(b);
  const named = aCh && !bCh ? a : bCh && !aCh ? b : (a.soldQty ?? 0) >= (b.soldQty ?? 0) ? a : b;
  return { ...named, stock, soldQty: sold, available: named.available, image: a.image || b.image || named.image, blurb: a.blurb || b.blurb || named.blurb };
}

function pickAttendance(a: Attendance, b: Attendance): Attendance {
  const clockOut = a.clockOut || b.clockOut;
  const photoIn = a.photoIn || b.photoIn;
  const photoOut = a.photoOut || b.photoOut;
  const valid = a.valid === false || b.valid === false ? false : a.valid ?? b.valid;
  const later = (b.clockOut ? b : a.clockOut ? a : b);
  return { ...later, clockOut, photoIn, photoOut, valid };
}

function pickShift(a: ShiftState, b: ShiftState): ShiftState {
  if (a.open && !b.open) return a;
  if (b.open && !a.open) return b;
  const ao = a.openedAt ?? "";
  const bo = b.openedAt ?? "";
  return bo > ao ? b : a;
}

function unionCats(a: string[] | undefined, b: string[] | undefined): string[] {
  const out: string[] = [];
  for (const raw of [...(a ?? []), ...(b ?? [])]) {
    const n = raw.trim();
    if (!n) continue;
    if (out.some((c) => c.toLowerCase() === n.toLowerCase())) continue;
    out.push(n);
  }
  return out;
}

function pickScalar<T>(local: T, remote: T, preferLocal: boolean): T {
  return preferLocal ? local : remote;
}

function pickBooks(local?: MoneyBooks, remote?: MoneyBooks, preferLocal = true): MoneyBooks {
  const fallback: MoneyBooks = { rekening: 921_000, cash: 720_000, sisihGajiBank: 1_400_000 };
  const a = local && typeof local.rekening === "number" ? local : fallback;
  const b = remote && typeof remote.rekening === "number" ? remote : fallback;
  return preferLocal ? a : b;
}

export function expenseKey(e: Expense): string {
  return [
    e.date,
    (e.category ?? "").trim().toLowerCase(),
    (e.desc ?? "").trim().toLowerCase(),
    String(e.amount ?? 0),
    (e.nota ?? "").trim().toLowerCase(),
    (e.pay ?? "").trim().toLowerCase(),
  ].join("|");
}

function dedupeExpenses(rows: Expense[]): Expense[] {
  const m = new Map<string, Expense>();
  for (const e of rows) {
    if (!e) continue;
    const k = expenseKey(e);
    const prev = m.get(k);
    if (!prev) {
      m.set(k, e);
      continue;
    }
    const prefer = (e.id.startsWith("exp") && !prev.id.startsWith("exp")) || e.id > prev.id;
    m.set(k, prefer ? e : prev);
  }
  return [...m.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
}

export function settleExpenses(rows: Expense[]): Expense[] {
  return dedupeExpenses(rows);
}

export function mergePayloads(local: CloudPayload, remote: CloudPayload): CloudPayload {
  const ls = liveScore(local);
  const rs = liveScore(remote);
  const preferLocal = ls >= rs;

  return {
    products: unionById(local.products, remote.products, pickProduct),
    menuCategories: unionCats(local.menuCategories, remote.menuCategories),
    orders: unionById(local.orders, remote.orders, pickOrder).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    expenses: dedupeExpenses(unionById(local.expenses, remote.expenses, (a, b) => (preferLocal ? a : b))),
    incomes: unionById(local.incomes, remote.incomes, (a, b) => (preferLocal ? a : b)),
    incidents: unionById(local.incidents, remote.incidents, (a, b) => (preferLocal ? a : b)),
    inventory: unionById(local.inventory, remote.inventory, (a, b) => ({
      ...a,
      ...b,
      stock: Math.min(a.stock, b.stock),
      name: preferLocal ? a.name : b.name,
    })),
    staff: unionById(local.staff, remote.staff, (a, b) => (preferLocal ? a : b)),
    attendance: unionById(local.attendance, remote.attendance, pickAttendance),
    shift: pickShift(local.shift, remote.shift),
    notifications: unionById(local.notifications, remote.notifications, (a, b) => a).slice(0, 80),
    audit: unionById(local.audit, remote.audit, (a, b) => a).slice(0, 200),
    tutupBuku: unionByKey(local.tutupBuku, remote.tutupBuku, (x) => x.period, (a, b) =>
      a.status === "Selesai" ? a : b.status === "Selesai" ? b : preferLocal ? a : b,
    ),
    dailySales: unionByKey(local.dailySales, remote.dailySales, (x) => x.date, (a, b) =>
      (a.omzet ?? 0) >= (b.omzet ?? 0) ? a : b,
    ),
    dailyBooks: unionByKey(local.dailyBooks, remote.dailyBooks, (x) => x.date, (a, b) =>
      (a.income ?? 0) >= (b.income ?? 0) ? a : b,
    ),
    weekly: unionByKey(local.weekly, remote.weekly, (x) => x.week, (a, b) =>
      preferLocal ? a : b,
    ),
    moneyIn: unionByKey(local.moneyIn, remote.moneyIn, (x) => x.date, (a, b) => (preferLocal ? a : b)),
    sheetSync: local.sheetSync || remote.sheetSync,
    adminPin: pickScalar(local.adminPin, remote.adminPin, preferLocal),
    adjustLogs: unionById(local.adjustLogs, remote.adjustLogs, (a, b) => a).slice(0, 200),
    taxEnabled: pickScalar(local.taxEnabled, remote.taxEnabled, preferLocal),
    serviceEnabled: pickScalar(local.serviceEnabled, remote.serviceEnabled, preferLocal),
    recipes: unionByKey(local.recipes, remote.recipes, (x) => `${x.productId}:${x.ingredientId}`, (a, b) =>
      preferLocal ? a : b,
    ),
    testPurge: local.testPurge || remote.testPurge,
    bukuUsers: unionById(local.bukuUsers, remote.bukuUsers, (a, b) => (preferLocal ? a : b)),
    bukuPin: pickScalar(local.bukuPin, remote.bukuPin, preferLocal),
    waOwner: pickScalar(local.waOwner, remote.waOwner, preferLocal),
    waKitchen: pickScalar(local.waKitchen, remote.waKitchen, preferLocal),
    waOwnerMode: pickScalar(local.waOwnerMode, remote.waOwnerMode, preferLocal),
    waKitchenMode: pickScalar(local.waKitchenMode, remote.waKitchenMode, preferLocal),
    sisihGajiPerDay: pickScalar(local.sisihGajiPerDay, remote.sisihGajiPerDay, preferLocal),
    sisihOpsPerDay: pickScalar(local.sisihOpsPerDay, remote.sisihOpsPerDay, preferLocal),
    priveWeeklyCap: pickScalar(local.priveWeeklyCap, remote.priveWeeklyCap, preferLocal),
    managerCashCap: pickScalar(local.managerCashCap, remote.managerCashCap, preferLocal),
    managerCash: unionById(local.managerCash, remote.managerCash, (a, b) =>
      (a.deposited ?? 0) >= (b.deposited ?? 0) ? a : b,
    ),
    moneyBooks: pickBooks(local.moneyBooks, remote.moneyBooks, preferLocal),
    ledger: unionById(local.ledger, remote.ledger, (a, b) => a).slice(0, 400),
    workShifts: unionById(local.workShifts, remote.workShifts, (a, b) => (preferLocal ? a : b)),
    shiftLogs: unionById(local.shiftLogs, remote.shiftLogs, (a, b) => a).slice(0, 200),
    ...mergeCartFields(local, remote),
  };
}

function mergeCartFields(local: CloudPayload, remote: CloudPayload): { cart: CartItem[]; cartEpoch: number } {
  const le = typeof local.cartEpoch === "number" ? local.cartEpoch : 0;
  const re = typeof remote.cartEpoch === "number" ? remote.cartEpoch : 0;
  if (le !== re) {
    return le > re
      ? { cart: local.cart ?? [], cartEpoch: le }
      : { cart: remote.cart ?? [], cartEpoch: re };
  }
  return {
    cart: unionByKey(local.cart, remote.cart, (x) => x.key, (a, b) => (a.qty >= b.qty ? a : b)),
    cartEpoch: le,
  };
}

export function extractPayload(s: CloudPayload): CloudPayload {
  return {
    products: s.products,
    menuCategories: s.menuCategories,
    orders: s.orders,
    expenses: s.expenses,
    incomes: s.incomes,
    incidents: s.incidents,
    inventory: s.inventory,
    staff: s.staff,
    attendance: slimAttendance(s.attendance),
    shift: s.shift,
    notifications: s.notifications,
    audit: s.audit,
    tutupBuku: s.tutupBuku,
    dailySales: s.dailySales,
    dailyBooks: s.dailyBooks,
    weekly: s.weekly,
    moneyIn: s.moneyIn,
    sheetSync: s.sheetSync,
    adminPin: s.adminPin,
    adjustLogs: s.adjustLogs,
    taxEnabled: s.taxEnabled,
    serviceEnabled: s.serviceEnabled,
    recipes: s.recipes,
    testPurge: s.testPurge,
    bukuUsers: s.bukuUsers,
    bukuPin: s.bukuPin,
    waOwner: s.waOwner,
    waKitchen: s.waKitchen,
    waOwnerMode: s.waOwnerMode,
    waKitchenMode: s.waKitchenMode,
    sisihGajiPerDay: s.sisihGajiPerDay,
    sisihOpsPerDay: s.sisihOpsPerDay,
    priveWeeklyCap: s.priveWeeklyCap,
    managerCashCap: s.managerCashCap,
    managerCash: s.managerCash,
    moneyBooks: s.moneyBooks ?? { rekening: 921000, cash: 720000, sisihGajiBank: 1400000 },
    ledger: s.ledger ?? [],
    workShifts: s.workShifts,
    shiftLogs: s.shiftLogs,
    cart: s.cart ?? [],
    cartEpoch: s.cartEpoch ?? 0,
  };
}

export function payloadFingerprint(p: CloudPayload): string {
  const exp = p.expenses.map((e) => `${e.id}:${e.date}:${e.amount}:${e.pay ?? ""}`).join(",");
  const inc = p.incomes.map((e) => `${e.id}:${e.date}:${e.amount}`).join(",");
  const cash = p.managerCash.map((e) => `${e.id}:${e.deposited ?? 0}`).join(",");
  return [
    p.orders.map((o) => `${o.id}:${o.status}:${o.kdsStatus}:${o.updatedAt ?? ""}`).join(","),
    p.products.map((x) => `${x.id}:${x.price}:${x.image?.length ?? 0}`).join(","),
    exp,
    inc,
    cash,
    `${p.moneyBooks?.rekening ?? 0}:${p.moneyBooks?.cash ?? 0}:${p.moneyBooks?.sisihGajiBank ?? 0}`,
    (p.ledger ?? []).map((l) => l.id).join(","),
    p.attendance.length,
    p.menuCategories.join(","),
    p.shift.open ? "1" : "0",
    p.shift.cashSales,
    p.inventory.map((i) => `${i.id}:${i.stock}`).join("|"),
    p.bukuPin,
    p.adminPin,
    p.sheetSync,
    p.moneyIn.length,
    p.recipes.length,
    p.cartEpoch ?? 0,
    (p.cart ?? []).map((i) => `${i.key}:${i.qty}`).join(","),
  ].join("/");
}
