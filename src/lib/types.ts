export type ViewId =
  | "pos"
  | "orders"
  | "omzet"
  | "adjust"
  | "attendance"
  | "kitchen"
  | "sewa"
  | "products"
  | "inventory"
  | "shift"
  | "incidents"
  | "staff"
  | "target"
  | "dashboard"
  | "expenses"
  | "income"
  | "tutupbuku"
  | "engineering"
  | "cloudhub";

export type Role = "cashier" | "owner";
export type BukuRole = "superadmin" | "pembukuan";
export type OrderType = "Dine In" | "Takeaway" | "Delivery";
export type PaymentMethod = "Cash" | "QRIS" | "Debit" | "Transfer";
export const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "QRIS", "Debit", "Transfer"];
export type OrderStatus = "pending" | "open" | "paid" | "void";
export type KdsStatus = "new" | "cooking" | "ready" | "done";
export type FeedbackStatus = "none" | "waiting" | "due" | "done" | "skipped";
export type Quadrant = "Star" | "Workhorse" | "Puzzle" | "Dog";

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  cogs: number;
  margin: number;
  stock: number;
  available: boolean;
  icon: string;
  soldQty: number;
  quadrant: Quadrant;
  recommendation: string;
  kitchen: boolean;
  image?: string;
  blurb?: string;
  updatedAt?: string;
}

export const DEFAULT_MENU_CATEGORIES = ["Coffee", "Tea", "Mocktail", "Food", "Water"] as const;

export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function ensureMenuCategories(saved: string[] | undefined, products: { category: string }[] = []): string[] {
  const out: string[] = [];
  const add = (raw: string) => {
    const n = normalizeCategoryName(raw);
    if (!n) return;
    if (out.some((c) => c.toLowerCase() === n.toLowerCase())) return;
    out.push(n);
  };
  if (saved && saved.length) {
    for (const c of saved) add(c);
  } else {
    for (const c of DEFAULT_MENU_CATEGORIES) add(c);
  }
  for (const p of products) add(p.category);
  return out;
}

export interface Addon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  key: string;
  productId: string;
  name: string;
  price: number;
  cogs: number;
  qty: number;
  addons: Addon[];
  note: string;
  kitchen: boolean;
}

export interface ServiceFeedback {
  note: string;
  actor: string;
  at: string;
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  updatedAt?: string;
  type: OrderType;
  table: string;
  customer: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountLabel: string;
  tax: number;
  service?: number;
  taxExempt?: boolean;
  discountReason?: string;
  total: number;
  payment: PaymentMethod;
  tendered: number;
  change: number;
  status: OrderStatus;
  cashier: string;
  kdsStatus: KdsStatus;
  kdsDoneAt?: string;
  feedbackStatus?: FeedbackStatus;
  feedback?: ServiceFeedback;
  feedbackNotified?: boolean;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  desc: string;
  amount: number;
  nota?: string;
  /** Dari 12 Sep 2026. Transaksi lama boleh kosong. */
  pay?: "Tunai" | "Non Tunai";
}

export interface Income {
  id: string;
  date: string;
  category: string;
  desc: string;
  amount: number;
  status: string;
}

export interface Incident {
  id: string;
  date: string;
  staff: string;
  category: string;
  desc: string;
  action: string;
  loss: number;
  status: string;
  attendanceId?: string;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  pin: string;
  access: "Kasir Only" | "Full Admin";
  active: boolean;
}

export interface BukuUser {
  id: string;
  email: string;
  name: string;
  title: string;
  role: BukuRole;
  passHash: string;
  createdAt: string;
  createdBy: string;
  active: boolean;
}

export interface BukuSession {
  userId: string;
  email: string;
  name: string;
  role: BukuRole;
}

export interface Attendance {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  status: "Tepat Waktu" | "Terlambat" | "Pulang" | "Korupsi Waktu";
  note: string;
  photoIn?: string;
  photoOut?: string;
  valid?: boolean;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  shiftId?: string;
}

export interface WorkShift {
  id: string;
  name: string;
  workStart: string;
  workEnd: string;
  absenFrom: string;
  absenTo: string;
}

export interface ShiftChangeLog {
  id: string;
  createdAt: string;
  actor: string;
  summary: string;
}

export type FillLevel = "full" | "half" | "quarter" | "empty";
export type OpnameKind = "pcs" | "level";

export interface Ingredient {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  unit: string;
  cost: number;
  opname?: OpnameKind;
  fullQty?: number;
  alertAt?: FillLevel;
}

export interface RecipeLine {
  productId: string;
  ingredientId: string;
  qty: number;
}

export interface ShiftState {
  open: boolean;
  openedAt: string;
  openingCash: number;
  cashSales: number;
  nonCashSales: number;
  cashier: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  time: string;
  orderId?: string;
}

export interface AuditLog {
  id: string;
  time: string;
  actor: string;
  action: string;
}

export interface TutupBuku {
  period: string;
  startDate: string;
  endDate: string;
  income: number;
  expense: number;
  cogs: number;
  profit: number;
  status: "Selesai" | "Dalam Proses";
  pic: string;
  note: string;
}

export interface DailySale {
  date: string;
  omzet: number;
}

export interface DailyBook {
  date: string;
  income: number;
  cogs: number;
  expense: number;
  profit: number;
}

export interface WeeklyRow {
  week: string;
  income: number;
  expense: number;
  cogs: number;
  profit: number;
}

export interface MoneyInRow {
  date: string;
  gopay: number;
  edc: number;
  tunai: number;
  note?: string;
  source: "pos" | "manual" | "mixed";
}

export const RESTRICTED_VIEWS: ViewId[] = [
  "target",
  "dashboard",
  "expenses",
  "income",
  "tutupbuku",
  "engineering",
  "staff",
  "incidents",
  "cloudhub",
];

export interface AdjustLog {
  id: string;
  createdAt: string;
  kind: "discount" | "tax" | "service";
  action: "apply" | "clear" | "exempt";
  orderId: string;
  orderNumber: string;
  amount: number;
  rate?: number;
  label: string;
  reason: string;
  actor: string;
  historic: boolean;
}

export const TAX_RATE = 0.1;
export const SERVICE_RATE = 0.05;
export const MONTHLY_TARGET = 60_000_000;
export const DAILY_TARGET = 2_000_000;
export const SISIH_GAJI_PER_DAY = 280_000;
export const SISIH_OPS_PER_DAY = 200_000;
export const PRIVE_WEEKLY_CAP = 1_500_000;
export const MANAGER_CASH_CAP = 200_000;

export interface MoneyBooks {
  rekening: number;
  cash: number;
  sisihGajiBank: number;
}

export const SEED_MONEY: MoneyBooks = { rekening: 921_000, cash: 720_000, sisihGajiBank: 1_400_000 };

export interface LedgerEntry {
  id: string;
  at: string;
  kind: "setor" | "setor-gopay" | "expense-cash" | "expense-bank" | "expense-sisih" | "sale-cash" | "void-cash" | "sisih-gaji" | "adjust";
  amount: number;
  note: string;
  actor: string;
}

export const SISIH_ACCRUAL_START = "2026-09-13";

function nextYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

export function accrueSisih(ledger: LedgerEntry[] | undefined, today: string, perDay = SISIH_GAJI_PER_DAY): LedgerEntry[] {
  const rows = [...(ledger ?? [])];
  const have = new Set(rows.filter((r) => r.kind === "sisih-gaji").map((r) => r.id));
  if (today < SISIH_ACCRUAL_START) return rows;
  for (let d = SISIH_ACCRUAL_START; d <= today; d = nextYmd(d)) {
    const id = `led-sisih-${d}`;
    if (have.has(id)) continue;
    rows.push({
      id,
      at: `${d}T17:00:00+07:00`,
      kind: "sisih-gaji",
      amount: perDay,
      note: `Sisih gaji ${d}`,
      actor: "Sistem",
    });
  }
  return rows;
}

export function replayMoney(ledger: LedgerEntry[] | undefined, seed: MoneyBooks = SEED_MONEY): MoneyBooks {
  let rekening = seed.rekening;
  let cash = seed.cash;
  let sisihGajiBank = seed.sisihGajiBank;
  const rows = [...(ledger ?? [])].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (const r of rows) {
    const n = Math.round(Number(r.amount) || 0);
    if (r.kind === "setor") {
      cash -= Math.abs(n);
      rekening += Math.abs(n);
    } else if (r.kind === "setor-gopay") {
      rekening += Math.abs(n);
    } else if (r.kind === "expense-cash") {
      cash += n;
    } else if (r.kind === "expense-bank") {
      rekening += n;
    } else if (r.kind === "expense-sisih") {
      sisihGajiBank += n;
    } else if (r.kind === "sisih-gaji") {
      sisihGajiBank += Math.abs(n);
    } else if (r.kind === "sale-cash") {
      cash += Math.abs(n);
    } else if (r.kind === "void-cash") {
      cash -= Math.abs(n);
    }
  }
  return {
    rekening: Math.max(0, Math.round(rekening)),
    cash: Math.max(0, Math.round(cash)),
    sisihGajiBank: Math.max(0, Math.round(sisihGajiBank)),
  };
}

export interface ManagerCashLog {
  id: string;
  date: string;
  counted: number;
  held: number;
  toDeposit: number;
  deposited: number;
  note: string;
}

export function splitManagerCash(counted: number, cap = MANAGER_CASH_CAP) {
  const n = Math.max(0, Math.round(counted || 0));
  const held = Math.min(n, cap);
  return { counted: n, held, toDeposit: n - held };
}

export function normalizeManagerCash(
  row: Partial<ManagerCashLog> & { id?: string; date: string; amount?: number },
  cap = MANAGER_CASH_CAP,
): ManagerCashLog {
  const split = splitManagerCash(row.counted ?? row.amount ?? 0, cap);
  return {
    id: row.id || "",
    date: row.date,
    ...split,
    deposited: Math.min(split.toDeposit, Math.max(0, Math.round(row.deposited ?? 0))),
    note: row.note ?? "",
  };
}

export const DISCOUNT_PRESETS = [
  { id: "p5", label: "Promo 5%", pct: 5, reason: "Promo harian" },
  { id: "p10", label: "Member 10%", pct: 10, reason: "Member" },
  { id: "p15", label: "Event 15%", pct: 15, reason: "Event / sewa gedung" },
  { id: "staff", label: "Staff 20%", pct: 20, reason: "Konsumsi staf" },
] as const;
