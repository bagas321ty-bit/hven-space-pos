import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type {
  Addon,
  AdjustLog,
  Attendance,
  AuditLog,
  BukuSession,
  BukuUser,
  CartItem,
  DailyBook,
  DailySale,
  Expense,
  Income,
  Incident,
  Ingredient,
  KdsStatus,
  NotificationItem,
  Order,
  OrderType,
  PaymentMethod,
  Product,
  RecipeLine,
  Role,
  ServiceFeedback,
  ShiftState,
  Staff,
  TutupBuku,
  ViewId,
  WeeklyRow,
  WorkShift,
  ShiftChangeLog,
  MoneyInRow,
  ManagerCashLog,
} from "@/lib/types";
import {
  MANAGER_CASH_CAP,
  PRIVE_WEEKLY_CAP,
  RESTRICTED_VIEWS,
  SERVICE_RATE,
  SISIH_GAJI_PER_DAY,
  SISIH_OPS_PER_DAY,
  TAX_RATE,
  ensureMenuCategories,
  normalizeCategoryName,
  normalizeManagerCash,
} from "@/lib/types";
import { FEEDBACK_WAIT_MS, hasKitchenItems } from "@/lib/feedback";
import {
  ADDONS,
  ADMIN_PIN,
  BUKU_PIN,
  DAILY_BOOKS,
  DAILY_SALES,
  EXPENSES,
  INCOMES,
  INCIDENTS,
  INVENTORY,
  PRODUCTS,
  RECIPES,
  SAMPLE_ATTENDANCE,
  SAMPLE_ORDERS,
  STAFF,
  TUTUP_BUKU,
  WEEKLY,
  WORK_SHIFTS,
} from "@/data/seed";
import { cutoffPeriod, formatIDR, formatTimeID, inCutoffRange, inWeek, nextCutoffPeriod, shiftDateISO, todayISO, uid } from "@/lib/format";
import { normalizeIngredient } from "@/lib/inventory";
import { verifyVenueLogin, normalizeVenueEmail } from "@/lib/venue-auth";
import { ensureBukuUsers, hashPassword, normalizeBukuEmail, SEED_BUKU_USERS, verifyBukuLogin } from "@/lib/buku-auth";
import { detectWorkShift, ensureWorkShifts, inAbsenWindow, inferShiftId, isLateClockIn, isNightCorruptAttempt, LATE_FINE } from "@/lib/work-shift";
import { isPriveCat, mergeSheetBooks, SHEET_SYNC } from "@/lib/sheet-books";
import { slimAttendance } from "@/lib/att-photo-slim";
import type { WaMode } from "@/lib/whatsapp";
import type { CloudPayload } from "@/lib/pos-cloud";
import { expenseKey, settleExpenses } from "@/lib/pos-cloud";
import { nudgeCloud } from "@/lib/cloud-nudge";

const memoryStore: Record<string, string> = {};

/** localStorage throws in some embedded previews (cookie / 3rd-party iframe). */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      const value = globalThis.localStorage?.getItem(name);
      if (value != null) return value;
    } catch {
      /* blocked */
    }
    return memoryStore[name] ?? null;
  },
  setItem: (name, value) => {
    memoryStore[name] = value;
    try {
      globalThis.localStorage?.setItem(name, value);
    } catch {
      /* blocked — keep memory copy */
    }
  },
  removeItem: (name) => {
    delete memoryStore[name];
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      /* blocked */
    }
  },
};

function emptyBook(p: { id: string; start: string; end: string; label: string }, pic = "Admin HVEN"): TutupBuku {
  return {
    period: p.id,
    startDate: p.start,
    endDate: p.end,
    income: 0,
    expense: 0,
    cogs: 0,
    profit: 0,
    status: "Dalam Proses",
    pic,
    note: `Periode berjalan ${p.label}. Jadwal kunci: 7 setelah ${p.end}.`,
  };
}

function ensureTutupBuku(rows: TutupBuku[] | undefined): TutupBuku[] {
  const list = rows?.length ? rows.map((r) => ({ ...r })) : [];
  const cur = cutoffPeriod();
  if (!list.some((r) => r.period === cur.id)) list.push(emptyBook(cur));
  return list;
}

export interface AppState {
  hydrated: boolean;
  view: ViewId;
  pendingView: ViewId | null;
  pinOpen: boolean;
  role: Role;
  currentStaffId: string;
  adminPin: string;
  sidebarCollapsed: boolean;
  search: string;
  category: string;
  availableOnly: boolean;
  products: Product[];
  menuCategories: string[];
  recipes: RecipeLine[];
  addons: Addon[];
  cart: CartItem[];
  orderType: OrderType;
  table: string;
  customer: string;
  discount: number;
  discountLabel: string;
  discountReason: string;
  taxEnabled: boolean;
  serviceEnabled: boolean;
  adjustLogs: AdjustLog[];
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
  lastReceipt: Order | null;
  paymentOpen: boolean;
  receiptOpen: boolean;
  productModal: Product | null;
  productFormOpen: boolean;
  editingProduct: Product | null;
  testPurge: string;
  sessionLoggedIn: boolean;
  sessionEmail: string;
  bukuUsers: BukuUser[];
  bukuSession: BukuSession | null;
  bukuPin: string;
  bukuUnlocked: boolean;
  waOwner: string;
  waKitchen: string;
  waOwnerMode: WaMode;
  waKitchenMode: WaMode;
  sisihGajiPerDay: number;
  sisihOpsPerDay: number;
  priveWeeklyCap: number;
  managerCashCap: number;
  managerCash: ManagerCashLog[];
  workShifts: WorkShift[];
  shiftLogs: ShiftChangeLog[];
  deviceId: string;
  cloudRev: number;
  cloudAt: string;
  cloudStatus: "idle" | "syncing" | "ok" | "error" | "offline";
  cloudError: string;
  cloudApplying: boolean;

  setView: (view: ViewId) => void;
  purgeTestData: () => void;
  loginVenue: (email: string, password: string) => Promise<boolean>;
  logoutVenue: () => void;
  loginBuku: (email: string, password: string) => Promise<boolean>;
  logoutBuku: () => void;
  unlockBuku: (pin: string) => boolean;
  lockBuku: () => void;
  setBukuPin: (pin: string) => string | null;
  createBukuUser: (input: { email: string; name: string; title: string; password: string }) => Promise<string | null>;
  updateBukuUser: (user: BukuUser) => string | null;
  setBukuUserActive: (id: string, active: boolean) => string | null;
  resetBukuPassword: (id: string, password: string) => Promise<string | null>;
  setWaOwner: (v: string) => void;
  setWaKitchen: (v: string) => void;
  setWaOwnerMode: (v: WaMode) => void;
  setWaKitchenMode: (v: WaMode) => void;
  setSisihGajiPerDay: (n: number) => void;
  setSisihOpsPerDay: (n: number) => void;
  setPriveWeeklyCap: (n: number) => void;
  setManagerCashCap: (n: number) => void;
  upsertManagerCash: (row: { date: string; amount: number; note?: string }) => void;
  setorManagerCash: (id: string) => void;
  deleteManagerCash: (id: string) => void;
  confirmPin: (pin: string) => boolean;
  closePin: () => void;
  logoutOwner: () => void;
  switchStaff: (id: string) => void;
  toggleSidebar: () => void;
  setSearch: (q: string) => void;
  setCategory: (c: string) => void;
  addMenuCategory: (name: string) => string | null;
  renameMenuCategory: (from: string, to: string) => string | null;
  removeMenuCategory: (name: string) => string | null;
  setAvailableOnly: (v: boolean) => void;
  setOrderType: (t: OrderType) => void;
  setTable: (t: string) => void;
  setCustomer: (n: string) => void;
  addToCart: (product: Product, addons?: Addon[], note?: string) => void;
  changeQty: (key: string, delta: number) => void;
  removeCart: (key: string) => void;
  clearCart: () => void;
  setDiscount: (amount: number, label: string, reason?: string) => void;
  setTaxEnabled: (v: boolean, reason?: string) => void;
  setServiceEnabled: (v: boolean) => void;
  totals: () => { qty: number; subtotal: number; discount: number; service: number; tax: number; total: number };
  checkout: (method: PaymentMethod, tendered: number) => Order | null;
  parkBill: () => string | null;
  resumeBill: (id: string) => string | null;
  cancelOpenBill: (id: string) => string | null;
  openBillId: string | null;
  voidOrder: (id: string) => void;
  setKds: (id: string, status: KdsStatus) => void;
  setOrderPayment: (id: string, method: PaymentMethod, tendered?: number) => string | null;
  tickFeedbackDue: () => void;
  saveFeedback: (id: string, data: Omit<ServiceFeedback, "actor" | "at">) => void;
  skipFeedback: (id: string) => void;
  addExpense: (e: Omit<Expense, "id">) => string | null;
  deleteExpense: (id: string) => void;
  addIncome: (e: Omit<Income, "id">) => void;
  addIncident: (e: Omit<Incident, "id">) => void;
  upsertProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  setProductRecipes: (productId: string, lines: RecipeLine[]) => void;
  addIngredient: (i: Ingredient) => void;
  setEditingProduct: (p: Product | null) => void;
  clock: (staffId: string, note: string, photo?: string, fullday?: boolean) => string | null;
  extendToFullday: (staffId: string) => string | null;
  setAttendanceValid: (id: string, valid: boolean, reason?: string) => boolean;
  updateWorkShifts: (next: WorkShift[]) => boolean;
  openShift: (cash: number, staffId?: string) => void;
  closeShift: () => void;
  setShiftCashier: (staffId: string) => void;
  addStaff: (s: Staff) => void;
  updateStaff: (s: Staff) => void;
  removeStaff: (id: string) => string | null;
  setAdminPin: (pin: string) => void;
  adjustStock: (id: string, stock: number) => void;
  updateIngredient: (i: Ingredient) => void;
  commitOpname: (rows: { id: string; stock: number }[]) => void;
  notify: (type: string, title: string, message: string, orderId?: string) => void;
  lockPeriod: () => void;
  upsertMoneyIn: (row: MoneyInRow) => void;
  setPaymentOpen: (v: boolean) => void;
  setReceiptOpen: (v: boolean) => void;
  setProductModal: (p: Product | null) => void;
  setProductFormOpen: (v: boolean) => void;
  applyCloud: (payload: CloudPayload, rev: number, at: string) => void;
  setCloudMeta: (patch: Partial<Pick<AppState, "cloudRev" | "cloudAt" | "cloudStatus" | "cloudError" | "cloudApplying" | "deviceId">>) => void;
}

function lineTotal(item: CartItem): number {
  const add = item.addons.reduce((s, a) => s + a.price, 0);
  return (item.price + add) * item.qty;
}

function addedItems(next: CartItem[], prev: CartItem[]): CartItem[] {
  const prevMap = new Map<string, number>();
  for (const i of prev) prevMap.set(i.key, (prevMap.get(i.key) ?? 0) + i.qty);
  const extra: CartItem[] = [];
  for (const i of next) {
    const n = i.qty - (prevMap.get(i.key) ?? 0);
    if (n > 0) extra.push({ ...i, qty: n });
  }
  return extra;
}

function consumeStock(products: Product[], items: CartItem[], sold: boolean): Product[] {
  return products.map((p) => {
    const n = items.filter((c) => c.productId === p.id).reduce((s, c) => s + c.qty, 0);
    if (!n) return p;
    return {
      ...p,
      stock: Math.max(0, p.stock - n),
      soldQty: sold ? p.soldQty + n : p.soldQty,
    };
  });
}

function restoreStock(products: Product[], items: CartItem[]): Product[] {
  return products.map((p) => {
    const n = items.filter((c) => c.productId === p.id).reduce((s, c) => s + c.qty, 0);
    if (!n) return p;
    return { ...p, stock: p.stock + n };
  });
}

function restoreRecipes(inventory: Ingredient[], items: CartItem[], recipes: RecipeLine[]): Ingredient[] {
  const next = inventory.map((i) => ({ ...i }));
  for (const item of items) {
    const lines = recipes.filter((r) => r.productId === item.productId);
    if (lines.length === 0) {
      const cup = next.find((n) => n.id === "inv10");
      if (cup && item.kitchen) cup.stock += item.qty;
      continue;
    }
    for (const line of lines) {
      const ing = next.find((n) => n.id === line.ingredientId);
      if (ing) ing.stock = Number((ing.stock + line.qty * item.qty).toFixed(3));
    }
  }
  return next;
}

function deductRecipes(inventory: Ingredient[], items: CartItem[], recipes: RecipeLine[]): Ingredient[] {
  const next = inventory.map((i) => ({ ...i }));
  for (const item of items) {
    const lines = recipes.filter((r) => r.productId === item.productId);
    if (lines.length === 0) {
      const cup = next.find((n) => n.id === "inv10");
      if (cup && item.kitchen) cup.stock = Math.max(0, cup.stock - item.qty);
      continue;
    }
    for (const line of lines) {
      const ing = next.find((n) => n.id === line.ingredientId);
      if (ing) ing.stock = Math.max(0, Number((ing.stock - line.qty * item.qty).toFixed(3)));
    }
  }
  return next;
}

const TEST_PURGE = "v1";

function withoutTestTickets(state: {
  orders: Order[];
  products: Product[];
  inventory: Ingredient[];
  shift: ShiftState;
}) {
  return {
    orders: SAMPLE_ORDERS.map((seed) => state.orders.find((o) => o.id === seed.id) ?? seed),
    products: state.products.map((prod) => {
      const seed = PRODUCTS.find((s) => s.id === prod.id);
      return seed ? { ...prod, stock: seed.stock, soldQty: seed.soldQty } : prod;
    }),
    inventory: INVENTORY.map((seed) => {
      const live = state.inventory.find((i) => i.id === seed.id);
      return live ? { ...live, stock: seed.stock } : seed;
    }),
    shift: {
      ...state.shift,
      cashSales: 150000,
      nonCashSales: 193950,
    },
    notifications: [
      {
        id: "n1",
        type: "SHIFT" as const,
        title: "Shift pagi dibuka",
        message: "Randy membuka shift dengan modal kas Rp 500.000",
        time: "08:00",
      },
    ],
    adjustLogs: [] as AdjustLog[],
    cart: [] as CartItem[],
    openBillId: null as string | null,
    dailySales: DAILY_SALES.map((d) => ({ ...d })),
    audit: [{ id: "au1", time: "2026-09-09 08:00", actor: "Randy", action: "Buka shift kasir" }],
    lastReceipt: null as Order | null,
    discount: 0,
    discountLabel: "",
    discountReason: "",
    testPurge: TEST_PURGE,
  };
}

export const usePos = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      view: "pos",
      pendingView: null,
      pinOpen: false,
      role: "cashier",
      currentStaffId: "randy",
      adminPin: ADMIN_PIN,
      sidebarCollapsed: false,
      search: "",
      category: "Semua",
      availableOnly: false,
      products: PRODUCTS,
      menuCategories: ensureMenuCategories(undefined, PRODUCTS),
      recipes: RECIPES,
      addons: ADDONS,
      cart: [],
      openBillId: null,
      orderType: "Dine In",
      table: "01",
      customer: "",
      discount: 0,
      discountLabel: "",
      discountReason: "",
      taxEnabled: true,
      serviceEnabled: false,
      adjustLogs: [],
      orders: SAMPLE_ORDERS,
      expenses: EXPENSES,
      incomes: INCOMES,
      incidents: INCIDENTS,
      inventory: INVENTORY,
      staff: STAFF,
      attendance: SAMPLE_ATTENDANCE,
      shift: {
        open: true,
        openedAt: "2026-09-09T08:00:00+07:00",
        openingCash: 500000,
        cashSales: 150000,
        nonCashSales: 193950,
        cashier: "Randy",
      },
      notifications: [
        {
          id: "n1",
          type: "SHIFT",
          title: "Shift pagi dibuka",
          message: "Randy membuka shift dengan modal kas Rp 500.000",
          time: "08:00",
        },
      ],
      audit: [
        { id: "au1", time: "2026-09-09 08:00", actor: "Randy", action: "Buka shift kasir" },
      ],
      tutupBuku: TUTUP_BUKU,
      dailySales: DAILY_SALES,
      dailyBooks: DAILY_BOOKS,
      weekly: WEEKLY,
      moneyIn: [],
      sheetSync: SHEET_SYNC,
      lastReceipt: null,
      paymentOpen: false,
      receiptOpen: false,
      productModal: null,
      productFormOpen: false,
      editingProduct: null,
      testPurge: "",
      sessionLoggedIn: false,
      sessionEmail: "",
      bukuUsers: SEED_BUKU_USERS,
      bukuSession: null,
      bukuPin: BUKU_PIN,
      bukuUnlocked: false,
      waOwner: "",
      waKitchen: "",
      waOwnerMode: "number" as WaMode,
      waKitchenMode: "number" as WaMode,
      sisihGajiPerDay: SISIH_GAJI_PER_DAY,
      sisihOpsPerDay: SISIH_OPS_PER_DAY,
      priveWeeklyCap: PRIVE_WEEKLY_CAP,
      managerCashCap: MANAGER_CASH_CAP,
      managerCash: [],
      workShifts: WORK_SHIFTS,
      shiftLogs: [],
      deviceId: "",
      cloudRev: 0,
      cloudAt: "",
      cloudStatus: "idle",
      cloudError: "",
      cloudApplying: false,

      setView: (view) => {
        const { role } = get();
        if (RESTRICTED_VIEWS.includes(view) && role !== "owner") {
          set({ pendingView: view, pinOpen: true });
          return;
        }
        set({ view, search: view === "pos" ? get().search : get().search });
      },
      purgeTestData: () => {
        const s = get();
        if (s.testPurge === TEST_PURGE) return;
        set(withoutTestTickets(s));
      },
      loginVenue: async (email, password) => {
        const ok = await verifyVenueLogin(email, password);
        if (!ok) return false;
        set({
          sessionLoggedIn: true,
          sessionEmail: normalizeVenueEmail(email),
        });
        return true;
      },
      logoutVenue: () =>
        set({
          sessionLoggedIn: false,
          sessionEmail: "",
          role: "cashier",
          currentStaffId: "randy",
          pinOpen: false,
          pendingView: null,
          view: "pos",
        }),
      loginBuku: async (email, password) => {
        const user = await verifyBukuLogin(ensureBukuUsers(get().bukuUsers), email, password);
        if (!user) return false;
        set({
          bukuUsers: ensureBukuUsers(get().bukuUsers),
          bukuSession: { userId: user.id, email: user.email, name: user.name, role: user.role },
        });
        return true;
      },
      logoutBuku: () => set({ bukuSession: null, bukuUnlocked: false }),
      unlockBuku: (pin) => {
        if (pin !== get().bukuPin) return false;
        set({ bukuUnlocked: true });
        return true;
      },
      lockBuku: () => set({ bukuUnlocked: false }),
      setBukuPin: (pin) => {
        const n = pin.replace(/\D/g, "");
        if (n.length < 6) return "PIN pembukuan 6 digit.";
        if (n === get().adminPin) return "PIN pembukuan harus berbeda dari PIN kasir.";
        set({ bukuPin: n });
        return null;
      },
      createBukuUser: async (input) => {
        const me = get().bukuSession;
        if (!me || me.role !== "superadmin") return "Hanya superadmin yang bisa membuat akun.";
        const email = normalizeBukuEmail(input.email);
        if (!email.includes("@")) return "Email tidak valid.";
        if (input.password.length < 8) return "Kata sandi minimal 8 karakter.";
        if (get().bukuUsers.some((u) => u.email === email)) return "Email sudah terpakai.";
        const user: BukuUser = {
          id: uid("buku"),
          email,
          name: input.name.trim(),
          title: input.title.trim() || "Pembukuan",
          role: "pembukuan",
          passHash: await hashPassword(input.password),
          createdAt: new Date().toISOString(),
          createdBy: me.name,
          active: true,
        };
        if (!user.name) return "Nama wajib diisi.";
        set({
          bukuUsers: [...get().bukuUsers, user],
          audit: [
            { id: uid("au"), time: new Date().toLocaleString("id-ID"), actor: me.name, action: `Buat akun pembukuan ${user.name} (${user.email})` },
            ...get().audit,
          ],
        });
        return null;
      },
      updateBukuUser: (user) => {
        const me = get().bukuSession;
        if (!me || me.role !== "superadmin") return "Hanya superadmin.";
        set({
          bukuUsers: get().bukuUsers.map((u) => (u.id === user.id ? { ...u, name: user.name, title: user.title, email: normalizeBukuEmail(user.email) } : u)),
        });
        return null;
      },
      setBukuUserActive: (id, active) => {
        const me = get().bukuSession;
        if (!me || me.role !== "superadmin") return "Hanya superadmin.";
        const target = get().bukuUsers.find((u) => u.id === id);
        if (!target) return "Akun tidak ada.";
        if (target.role === "superadmin" && !active) return "Superadmin tidak bisa dinonaktifkan.";
        if (target.id === me.userId && !active) return "Tidak bisa menonaktifkan akun yang sedang dipakai.";
        set({
          bukuUsers: get().bukuUsers.map((u) => (u.id === id ? { ...u, active } : u)),
        });
        return null;
      },
      resetBukuPassword: async (id, password) => {
        const me = get().bukuSession;
        if (!me || me.role !== "superadmin") return "Hanya superadmin.";
        if (password.length < 8) return "Kata sandi minimal 8 karakter.";
        const passHash = await hashPassword(password);
        set({
          bukuUsers: get().bukuUsers.map((u) => (u.id === id ? { ...u, passHash } : u)),
        });
        return null;
      },
      setWaOwner: (v) => set({ waOwner: v }),
      setWaKitchen: (v) => set({ waKitchen: v }),
      setWaOwnerMode: (v) => set({ waOwnerMode: v }),
      setWaKitchenMode: (v) => set({ waKitchenMode: v }),
      setSisihGajiPerDay: (n) => set({ sisihGajiPerDay: Math.max(0, Math.round(n)) }),
      setSisihOpsPerDay: (n) => set({ sisihOpsPerDay: Math.max(0, Math.round(n)) }),
      setPriveWeeklyCap: (n) => set({ priveWeeklyCap: Math.max(0, Math.round(n)) }),
      setManagerCashCap: (n) => {
        const cap = Math.max(0, Math.round(n));
        set({
          managerCashCap: cap,
          managerCash: get().managerCash.map((r) => normalizeManagerCash(r, cap)),
        });
      },
      upsertManagerCash: (row) => {
        const cap = get().managerCashCap;
        const next = normalizeManagerCash({ date: row.date, amount: row.amount, note: row.note, id: uid("mgr") }, cap);
        const rest = get().managerCash.filter((r) => r.date !== row.date);
        set({
          managerCash: [...rest, next].sort((a, b) => a.date.localeCompare(b.date)),
        });
      },
      setorManagerCash: (id) => {
        const cap = get().managerCashCap;
        set({
          managerCash: get().managerCash.map((r) => {
            const n = normalizeManagerCash(r, cap);
            if (n.id !== id) return n;
            return { ...n, deposited: n.toDeposit };
          }),
        });
      },
      deleteManagerCash: (id) => set({ managerCash: get().managerCash.filter((r) => r.id !== id) }),
      confirmPin: (pin) => {
        const { adminPin, pendingView, staff } = get();
        const owner = staff.find((s) => s.access === "Full Admin" && s.pin === pin);
        if (pin === adminPin || owner) {
          const next = pendingView;
          set({
            role: "owner",
            currentStaffId: owner?.id ?? "bagas",
            pinOpen: false,
            pendingView: null,
            view: next ?? get().view,
            audit: [
              {
                id: uid("au"),
                time: new Date().toLocaleString("id-ID"),
                actor: owner?.name ?? "Bagas",
                action: "Otorisasi admin",
              },
              ...get().audit,
            ],
          });
          return true;
        }
        return false;
      },
      closePin: () => set({ pinOpen: false, pendingView: null }),
      logoutOwner: () =>
        set({
          role: "cashier",
          currentStaffId: "randy",
          view: "pos",
        }),
      switchStaff: (id) => {
        const s = get().staff.find((x) => x.id === id);
        if (!s) return;
        set({
          currentStaffId: id,
          role: s.access === "Full Admin" ? "owner" : "cashier",
        });
      },
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSearch: (q) => set({ search: q }),
      setCategory: (c) => set({ category: c }),
      addMenuCategory: (name) => {
        const n = normalizeCategoryName(name);
        if (!n) return "Nama kategori wajib diisi.";
        const list = ensureMenuCategories(get().menuCategories, get().products);
        if (list.some((c) => c.toLowerCase() === n.toLowerCase())) return "Kategori sudah ada.";
        set({ menuCategories: [...list, n] });
        return null;
      },
      renameMenuCategory: (from, to) => {
        const n = normalizeCategoryName(to);
        if (!n) return "Nama kategori wajib diisi.";
        const list = ensureMenuCategories(get().menuCategories, get().products);
        const src = list.find((c) => c.toLowerCase() === from.trim().toLowerCase());
        if (!src) return "Kategori tidak ditemukan.";
        if (list.some((c) => c.toLowerCase() === n.toLowerCase() && c.toLowerCase() !== src.toLowerCase())) return "Kategori sudah ada.";
        set({
          menuCategories: list.map((c) => (c === src ? n : c)),
          products: get().products.map((p) => (p.category === src ? { ...p, category: n } : p)),
          category: get().category === src ? n : get().category,
        });
        return null;
      },
      removeMenuCategory: (name) => {
        const n = normalizeCategoryName(name);
        if (!n) return "Nama kategori wajib diisi.";
        const list = ensureMenuCategories(get().menuCategories, get().products);
        const src = list.find((c) => c.toLowerCase() === n.toLowerCase());
        if (!src) return "Kategori tidak ditemukan.";
        if (get().products.some((p) => p.category === src)) return "Masih ada menu di kategori ini. Pindahkan atau hapus menunya dulu.";
        set({
          menuCategories: list.filter((c) => c !== src),
          category: get().category === src ? "Semua" : get().category,
        });
        return null;
      },
      setAvailableOnly: (v) => set({ availableOnly: v }),
      setOrderType: (t) => set({ orderType: t }),
      setTable: (t) => set({ table: t }),
      setCustomer: (n) => set({ customer: n }),
      addToCart: (product, addons = [], note = "") => {
        if (!product.available || product.stock <= 0) return;
        const key = `${product.id}-${addons.map((a) => a.id).join(",")}-${note}`;
        const cart = [...get().cart];
        const existing = cart.find((c) => c.key === key);
        if (existing) existing.qty += 1;
        else
          cart.unshift({
            key,
            productId: product.id,
            name: product.name,
            price: product.price,
            cogs: product.cogs,
            qty: 1,
            addons,
            note,
            kitchen: product.kitchen,
          });
        set({ cart });
      },
      changeQty: (key, delta) => {
        const cart = get()
          .cart.map((c) => (c.key === key ? { ...c, qty: c.qty + delta } : c))
          .filter((c) => c.qty > 0);
        set({ cart });
      },
      removeCart: (key) => set({ cart: get().cart.filter((c) => c.key !== key) }),
      clearCart: () =>
        set({
          cart: [],
          discount: 0,
          discountLabel: "",
          discountReason: "",
          taxEnabled: true,
          serviceEnabled: false,
          openBillId: null,
        }),
      setDiscount: (amount, label, reason = "") =>
        set({ discount: Math.max(0, amount), discountLabel: label, discountReason: reason }),
      setTaxEnabled: (v, reason) => set({ taxEnabled: v, discountReason: v ? get().discountReason : reason || get().discountReason }),
      setServiceEnabled: (v) => set({ serviceEnabled: v }),
      totals: () => {
        const { cart, discount, taxEnabled, serviceEnabled } = get();
        const qty = cart.reduce((s, c) => s + c.qty, 0);
        const subtotal = cart.reduce((s, c) => s + lineTotal(c), 0);
        const d = Math.min(discount, subtotal);
        const taxable = Math.max(0, subtotal - d);
        const service = serviceEnabled ? Math.round(taxable * SERVICE_RATE) : 0;
        const tax = taxEnabled ? Math.round((taxable + service) * TAX_RATE) : 0;
        return { qty, subtotal, discount: d, service, tax, total: taxable + service + tax };
      },
      checkout: (method, tendered) => {
        const {
          cart,
          orderType,
          table,
          customer,
          discount,
          discountLabel,
          discountReason,
          taxEnabled,
          serviceEnabled,
          currentStaffId,
          staff,
          products,
          openBillId,
        } = get();
        if (cart.length === 0) return null;
        const t = get().totals();
        if (method === "Cash" && tendered < t.total) return null;
        const cashier = staff.find((s) => s.id === currentStaffId)?.name ?? "Kasir";
        const existing = openBillId ? get().orders.find((o) => o.id === openBillId && o.status === "open") : undefined;
        const added = addedItems(cart, existing?.items ?? []);
        const stamp = new Date().toISOString();
        const seq = get().orders.length + 17;
        const tag = todayISO().slice(5).replace("-", "");
        const guest = customer || (orderType === "Takeaway" ? "Takeaway" : orderType === "Delivery" ? "Delivery" : "Tamu");
        const order: Order = {
          id: existing?.id ?? uid("ord"),
          number: existing?.number ?? `HV-${tag}-${String(seq).padStart(3, "0")}`,
          createdAt: existing?.createdAt ?? stamp,
          updatedAt: stamp,
          type: orderType,
          table: orderType === "Dine In" ? table || "-" : "-",
          customer: guest,
          items: cart,
          subtotal: t.subtotal,
          discount: t.discount,
          discountLabel,
          discountReason,
          tax: t.tax,
          service: t.service,
          taxExempt: !taxEnabled,
          total: t.total,
          payment: method,
          tendered: method === "Cash" ? tendered : t.total,
          change: method === "Cash" ? tendered - t.total : 0,
          status: "paid",
          cashier,
          kdsStatus: existing?.kdsStatus ?? (cart.some((c) => c.kitchen) ? "new" : "done"),
        };
        const nextProducts = consumeStock(products, added, false).map((p) => {
          const n = cart.filter((c) => c.productId === p.id).reduce((s, c) => s + c.qty, 0);
          return n ? { ...p, soldQty: p.soldQty + n } : p;
        });
        const shift = { ...get().shift };
        if (method === "Cash") shift.cashSales += t.total;
        else shift.nonCashSales += t.total;
        const cups = cart.reduce((s, c) => s + c.qty, 0);
        const dailySales = [...get().dailySales];
        const today = todayISO();
        const row = dailySales.find((d) => d.date === today);
        if (row) row.omzet += t.total;
        else dailySales.push({ date: today, omzet: t.total });

        const logs: AdjustLog[] = [...get().adjustLogs];
        if (t.discount > 0) {
          logs.unshift({
            id: uid("adj"),
            createdAt: stamp,
            kind: "discount",
            action: "apply",
            orderId: order.id,
            orderNumber: order.number,
            amount: t.discount,
            label: discountLabel || "Diskon",
            reason: discountReason || discountLabel || "Diskon kasir",
            actor: cashier,
            historic: false,
          });
        }
        if (!taxEnabled) {
          logs.unshift({
            id: uid("adj"),
            createdAt: stamp,
            kind: "tax",
            action: "exempt",
            orderId: order.id,
            orderNumber: order.number,
            amount: 0,
            rate: 0,
            label: "PB1 dibebaskan",
            reason: discountReason || "Dibebaskan kasir",
            actor: cashier,
            historic: false,
          });
        } else if (t.tax > 0) {
          logs.unshift({
            id: uid("adj"),
            createdAt: stamp,
            kind: "tax",
            action: "apply",
            orderId: order.id,
            orderNumber: order.number,
            amount: t.tax,
            rate: TAX_RATE,
            label: "PB1 10%",
            reason: "Standar F&B",
            actor: cashier,
            historic: false,
          });
        }
        if (t.service > 0) {
          logs.unshift({
            id: uid("adj"),
            createdAt: stamp,
            kind: "service",
            action: "apply",
            orderId: order.id,
            orderNumber: order.number,
            amount: t.service,
            rate: SERVICE_RATE,
            label: "Service 5%",
            reason: "Dine-in",
            actor: cashier,
            historic: false,
          });
        }

        const nextOrders = existing
          ? get().orders.map((o) => (o.id === existing.id ? order : o))
          : [order, ...get().orders];

        set({
          orders: nextOrders,
          products: nextProducts,
          inventory: deductRecipes(get().inventory, added, get().recipes),
          cart: [],
          discount: 0,
          discountLabel: "",
          discountReason: "",
          taxEnabled: true,
          serviceEnabled: false,
          customer: "",
          table: "",
          openBillId: null,
          shift,
          lastReceipt: order,
          paymentOpen: false,
          receiptOpen: true,
          dailySales,
          adjustLogs: logs,
          notifications: [
            {
              id: uid("n"),
              type: "SALE",
              title: `Order ${order.number} lunas`,
              message: `${order.customer} • ${method} • ${cups} item`,
              time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }),
            },
            ...get().notifications,
          ],
        });
        return order;
      },
      parkBill: () => {
        const { cart, orderType, table, customer, currentStaffId, staff, openBillId, taxEnabled, serviceEnabled, discount, discountLabel, discountReason } = get();
        if (cart.length === 0) return "Keranjang kosong.";
        if (orderType === "Dine In" && !table.trim() && !customer.trim()) return "Isi nomor meja atau nama tamu dulu.";
        if (orderType !== "Dine In" && !customer.trim()) return "Isi nama tamu dulu untuk open bill.";
        const tableNo = orderType === "Dine In" ? table.trim() : "";
        const clash = tableNo
          ? get().orders.find((o) => o.status === "open" && o.id !== openBillId && o.table === tableNo)
          : undefined;
        if (clash) return `Meja ${tableNo} sudah ada open bill ${clash.number}. Ketuk meja itu untuk lanjut.`;
        const t = get().totals();
        const cashier = staff.find((s) => s.id === currentStaffId)?.name ?? "Kasir";
        const existing = openBillId ? get().orders.find((o) => o.id === openBillId && o.status === "open") : undefined;
        const added = addedItems(cart, existing?.items ?? []);
        const stamp = new Date().toISOString();
        const seq = get().orders.length + 17;
        const tag = todayISO().slice(5).replace("-", "");
        const guest = customer.trim() || (orderType === "Takeaway" ? "Takeaway" : orderType === "Delivery" ? "Delivery" : "Tamu");
        const kitchenNew = added.some((c) => c.kitchen);
        const order: Order = {
          id: existing?.id ?? uid("ord"),
          number: existing?.number ?? `HV-${tag}-${String(seq).padStart(3, "0")}`,
          createdAt: existing?.createdAt ?? stamp,
          updatedAt: stamp,
          type: orderType,
          table: orderType === "Dine In" ? tableNo || "-" : "-",
          customer: guest,
          items: cart.map((c) => ({ ...c })),
          subtotal: t.subtotal,
          discount: t.discount,
          discountLabel,
          discountReason,
          tax: t.tax,
          service: t.service,
          taxExempt: !taxEnabled,
          total: t.total,
          payment: "Cash",
          tendered: 0,
          change: 0,
          status: "open",
          cashier,
          kdsStatus: kitchenNew ? "new" : existing?.kdsStatus ?? (cart.some((c) => c.kitchen) ? "new" : "done"),
        };
        const nextOrders = existing
          ? get().orders.map((o) => (o.id === existing.id ? order : o))
          : [order, ...get().orders];
        set({
          orders: nextOrders,
          products: consumeStock(get().products, added, false),
          inventory: deductRecipes(get().inventory, added, get().recipes),
          cart: [],
          discount: 0,
          discountLabel: "",
          discountReason: "",
          taxEnabled: true,
          serviceEnabled: false,
          customer: "",
          table: "",
          openBillId: null,
          lastReceipt: order,
          paymentOpen: false,
          receiptOpen: true,
          notifications: [
            {
              id: uid("n"),
              type: "OPEN",
              title: `Open bill ${order.number}`,
              message: `${order.type === "Dine In" && order.table !== "-" ? `Meja ${order.table} · ` : ""}${order.customer} · ${formatIDR(order.total)}`,
              time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }),
            },
            ...get().notifications,
          ],
          audit: [
            {
              id: uid("au"),
              time: new Date().toLocaleString("id-ID"),
              actor: cashier,
              action: `${existing ? "Update" : "Buka"} open bill ${order.number} · ${order.customer}`,
            },
            ...get().audit,
          ],
        });
        return null;
      },
      resumeBill: (id) => {
        const o = get().orders.find((x) => x.id === id && x.status === "open");
        if (!o) return "Open bill tidak ada.";
        if (get().cart.length && get().openBillId !== id) return "Simpan atau kosongkan keranjang dulu.";
        set({
          openBillId: o.id,
          cart: o.items.map((i) => ({ ...i })),
          orderType: o.type,
          table: o.table === "-" ? "" : o.table,
          customer: o.customer,
          discount: o.discount,
          discountLabel: o.discountLabel,
          discountReason: o.discountReason ?? "",
          taxEnabled: !o.taxExempt,
          serviceEnabled: (o.service ?? 0) > 0,
          view: "pos",
          paymentOpen: false,
        });
        return null;
      },
      cancelOpenBill: (id) => {
        const o = get().orders.find((x) => x.id === id && x.status === "open");
        if (!o) return "Open bill tidak ada.";
        const actor = get().staff.find((s) => s.id === get().currentStaffId)?.name ?? "Kasir";
        const restock = o.kdsStatus === "new";
        set({
          orders: get().orders.map((x) => (x.id === id ? { ...x, status: "void", kdsStatus: "done", updatedAt: new Date().toISOString() } : x)),
          products: restock ? restoreStock(get().products, o.items) : get().products,
          inventory: restock ? restoreRecipes(get().inventory, o.items, get().recipes) : get().inventory,
          openBillId: get().openBillId === id ? null : get().openBillId,
          cart: get().openBillId === id ? [] : get().cart,
          audit: [
            { id: uid("au"), time: new Date().toLocaleString("id-ID"), actor, action: `Batal open bill ${o.number}${restock ? " · stok dikembalikan" : ""}` },
            ...get().audit,
          ],
        });
        return null;
      },
      voidOrder: (id) => {
        const target = get().orders.find((o) => o.id === id);
        if (target?.status === "open") {
          get().cancelOpenBill(id);
          return;
        }
        if (get().role !== "owner") {
          set({ pinOpen: true, pendingView: get().view });
          return;
        }
        set({
          orders: get().orders.map((o) => (o.id === id ? { ...o, status: "void", kdsStatus: "done" } : o)),
        });
      },
      setKds: (id, status) => {
        const stamp = new Date().toISOString();
        set({
          orders: get().orders.map((o) => {
            if (o.id !== id) return o;
            const next = { ...o, kdsStatus: status, updatedAt: stamp };
            if (
              status === "done" &&
              o.kdsStatus !== "done" &&
              o.status !== "void" &&
              hasKitchenItems(o) &&
              o.feedbackStatus !== "done" &&
              o.feedbackStatus !== "skipped"
            ) {
              next.kdsDoneAt = stamp;
              next.feedbackStatus = "waiting";
              next.feedbackNotified = false;
            }
            return next;
          }),
        });
      },
      setOrderPayment: (id, method, tendered) => {
        const o = get().orders.find((x) => x.id === id);
        if (!o) return "Order tidak ditemukan.";
        if (o.status !== "paid") return "Hanya struk lunas yang bisa diubah metodenya.";
        if (o.payment === method && (tendered == null || tendered === o.tendered)) return null;
        const actor = get().staff.find((s) => s.id === get().currentStaffId)?.name ?? "Kasir";
        const stamp = new Date().toISOString();
        const nextTendered = method === "Cash" ? Math.max(o.total, tendered ?? o.tendered ?? o.total) : o.total;
        const nextChange = method === "Cash" ? Math.max(0, nextTendered - o.total) : 0;
        const wasCash = o.payment === "Cash";
        const isCash = method === "Cash";
        let shift = get().shift;
        if (wasCash !== isCash && shift.open && shiftDateISO(o.createdAt) === todayISO()) {
          shift = { ...shift };
          if (wasCash) {
            shift.cashSales = Math.max(0, shift.cashSales - o.total);
            shift.nonCashSales += o.total;
          } else {
            shift.nonCashSales = Math.max(0, shift.nonCashSales - o.total);
            shift.cashSales += o.total;
          }
        }
        const orders = get().orders.map((x) =>
          x.id === id
            ? { ...x, payment: method, tendered: nextTendered, change: nextChange, updatedAt: stamp }
            : x,
        );
        const lastReceipt = get().lastReceipt?.id === id ? orders.find((x) => x.id === id) ?? get().lastReceipt : get().lastReceipt;
        set({
          orders,
          shift,
          lastReceipt,
          audit: [
            {
              id: uid("au"),
              time: new Date().toLocaleString("id-ID"),
              actor,
              action: `Ubah bayar ${o.number}: ${o.payment} → ${method}`,
            },
            ...get().audit,
          ],
        });
        return null;
      },
      tickFeedbackDue: () => {
        const now = Date.now();
        const extra: NotificationItem[] = [];
        let changed = false;
        const orders = get().orders.map((o) => {
          if (o.status === "void") return o;
          if (o.feedbackStatus !== "waiting" || !o.kdsDoneAt) return o;
          const t = Date.parse(o.kdsDoneAt);
          if (Number.isNaN(t) || now - t < FEEDBACK_WAIT_MS) return o;
          changed = true;
          if (!o.feedbackNotified) {
            extra.push({
              id: uid("n"),
              type: "FEEDBACK",
              title: "Lakukan Feedback",
              message: `${o.number} · ${o.customer}${o.table !== "-" ? ` · ${o.table}` : ""} — 10 menit setelah dapur selesai.`,
              time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }),
              orderId: o.id,
            });
          }
          return { ...o, feedbackStatus: "due" as const, feedbackNotified: true };
        });
        if (!changed) return;
        set({
          orders,
          notifications: extra.length ? [...extra, ...get().notifications] : get().notifications,
        });
      },
      saveFeedback: (id, data) => {
        const actor = get().staff.find((s) => s.id === get().currentStaffId)?.name ?? "Kasir";
        const stamp = new Date().toISOString();
        set({
          orders: get().orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  feedbackStatus: "done" as const,
                  feedback: { ...data, actor, at: stamp },
                  updatedAt: stamp,
                }
              : o,
          ),
          audit: [
            { id: uid("au"), time: new Date().toLocaleString("id-ID"), actor, action: `Feedback ${get().orders.find((x) => x.id === id)?.number ?? id}${data.note.trim() ? " · komplain" : " · tanpa komplain"}` },
            ...get().audit,
          ],
        });
      },
      skipFeedback: (id) => {
        const actor = get().staff.find((s) => s.id === get().currentStaffId)?.name ?? "Kasir";
        const stamp = new Date().toISOString();
        set({
          orders: get().orders.map((o) =>
            o.id === id ? { ...o, feedbackStatus: "skipped" as const, updatedAt: stamp } : o,
          ),
          audit: [
            { id: uid("au"), time: new Date().toLocaleString("id-ID"), actor, action: `Feedback dilewati ${get().orders.find((x) => x.id === id)?.number ?? id}` },
            ...get().audit,
          ],
        });
      },
      addExpense: (e) => {
        if (isPriveCat(e.category)) {
          const cap = get().priveWeeklyCap;
          const used = get().expenses.filter((x) => isPriveCat(x.category) && inWeek(x.date, e.date)).reduce((s, x) => s + x.amount, 0);
          if (used + e.amount > cap) {
            const remain = Math.max(0, cap - used);
            return `Prive minggu ini dibatasi ${formatIDR(cap)}. Sudah ${formatIDR(used)}, sisa kuota ${formatIDR(remain)}.`;
          }
        }
        const row = { id: uid("exp"), ...e };
        const key = expenseKey(row);
        if (get().expenses.some((x) => expenseKey(x) === key)) {
          return "Pengeluaran yang sama sudah tercatat. Tidak disimpan ulang.";
        }
        set({
          expenses: [row, ...get().expenses],
        });
        nudgeCloud();
        return null;
      },
      deleteExpense: (id) => {
        set({ expenses: get().expenses.filter((e) => e.id !== id) });
        nudgeCloud();
      },
      addIncome: (e) => {
        set({ incomes: [{ id: uid("inc"), ...e }, ...get().incomes] });
        nudgeCloud();
      },
      addIncident: (e) => {
        const row = { id: uid("ins"), ...e };
        set({ incidents: [row, ...get().incidents] });
        if (e.loss > 0) {
          get().notify("INCIDENT", `Insiden ${e.category}`, `${e.staff}: ${e.desc}`);
        }
      },
      upsertProduct: (p) => {
        const list = get().products;
        const i = list.findIndex((x) => x.id === p.id);
        const products = i >= 0 ? list.map((x, idx) => (idx === i ? p : x)) : [p, ...list];
        set({
          products,
          menuCategories: ensureMenuCategories(get().menuCategories, products),
        });
      },
      deleteProduct: (id) =>
        set({
          products: get().products.filter((p) => p.id !== id),
          recipes: get().recipes.filter((r) => r.productId !== id),
        }),
      setProductRecipes: (productId, lines) =>
        set({
          recipes: [...get().recipes.filter((r) => r.productId !== productId), ...lines.filter((l) => l.qty > 0)],
        }),
      addIngredient: (i) => set({ inventory: [normalizeIngredient(i), ...get().inventory] }),
      setEditingProduct: (p) => set({ editingProduct: p }),
      clock: (staffId, note, photo, fullday) => {
        const s = get().staff.find((x) => x.id === staffId);
        if (!s) return "Staf tidak ditemukan";
        const now = new Date().toISOString();
        const date = todayISO();
        const todayRows = get().attendance.filter((a) => a.staffId === staffId && a.date === date && a.valid !== false);
        const open = todayRows.find((a) => !a.clockOut);
        if (open) {
          if (fullday) {
            if (open.shiftId === "fullday") return "Sudah absen fullday.";
            if (open.shiftId !== "pagi") return "Fullday hanya dari tiket shift pagi yang masih terbuka.";
            set({
              attendance: get().attendance.map((a) =>
                a.id === open.id ? { ...a, shiftId: "fullday", note: note || a.note || "Lanjut fullday" } : a,
              ),
              audit: [
                {
                  id: uid("au"),
                  time: new Date().toLocaleString("id-ID"),
                  actor: s.name,
                  action: `${s.name} lanjut fullday (pagi+malam, denda telat tidak dihitung ulang)`,
                },
                ...get().audit,
              ],
            });
            return null;
          }
          set({
            attendance: get().attendance.map((a) =>
              a.id === open.id
                ? { ...a, clockOut: now, status: "Pulang", photoOut: photo || a.photoOut }
                : a,
            ),
          });
          return null;
        }

        if (todayRows.some((a) => a.shiftId === "fullday")) {
          return "Sudah absen fullday hari ini. Satu tiket menutup pagi+malam.";
        }

        const shifts = ensureWorkShifts(get().workShifts);
        const fulldayShift = shifts.find((x) => x.id === "fullday");
        let detected = detectWorkShift(now, shifts);
        if (fullday) {
          if (!fulldayShift || !inAbsenWindow(now, fulldayShift)) {
            return "Fullday absen masuk jam 08.00–15.00 (sama seperti pagi).";
          }
          detected = fulldayShift;
        }
        if (!detected) {
          if (isNightCorruptAttempt(now)) {
            set({
              attendance: [
                {
                  id: uid("att"),
                  staffId,
                  staffName: s.name,
                  date,
                  clockIn: now,
                  status: "Korupsi Waktu",
                  note: note || "Clock-in setelah tengah malam tanpa tiket shift malam",
                  photoIn: photo,
                  valid: false,
                  voidReason: "Korupsi waktu shift malam — absen masuk hanya 15.00–00.00",
                  voidedBy: "Sistem",
                  voidedAt: now,
                  shiftId: "malam",
                },
                ...get().attendance,
              ],
            });
            return "Korupsi waktu: masuk shift malam hanya jam 15.00–00.00. Pulang malam s/d jam 01.00.";
          }
          return "Di luar jam absen masuk. Pagi/fullday 08.00–15.00 · Malam 15.00–00.00.";
        }

        const late = isLateClockIn(now, detected);
        const attId = uid("att");
        const lateIncident = late
          ? {
              id: uid("ins"),
              date,
              staff: staffId,
              category: "Keterlambatan",
              desc: `${s.name} terlambat clock-in shift ${detected.name}. Masuk ${formatTimeID(now)}, wajib ${detected.workStart}.`,
              action: `Pengurangan gaji ${formatIDR(LATE_FINE)}`,
              loss: LATE_FINE,
              status: "Selesai",
              attendanceId: attId,
            }
          : null;
        set({
          attendance: [
            {
              id: attId,
              staffId,
              staffName: s.name,
              date,
              clockIn: now,
              status: late ? "Terlambat" : "Tepat Waktu",
              note: fullday ? note || "Fullday" : note,
              photoIn: photo,
              valid: true,
              shiftId: detected.id,
            },
            ...get().attendance,
          ],
          incidents: lateIncident ? [lateIncident, ...get().incidents] : get().incidents,
          notifications: lateIncident
            ? [
                {
                  id: uid("n"),
                  type: "INCIDENT",
                  title: `Telat · ${s.name}`,
                  message: `Shift ${detected.name} · sanksi potong gaji ${formatIDR(LATE_FINE)}`,
                  time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }),
                },
                ...get().notifications,
              ]
            : get().notifications,
        });
        return null;
      },
      extendToFullday: (staffId) => {
        const s = get().staff.find((x) => x.id === staffId);
        if (!s) return "Staf tidak ditemukan";
        const date = todayISO();
        const open = get().attendance.find(
          (a) => a.staffId === staffId && a.date === date && !a.clockOut && a.valid !== false,
        );
        if (!open) return "Tidak ada tiket pagi yang terbuka.";
        if (open.shiftId === "fullday") return "Sudah fullday.";
        if (open.shiftId !== "pagi") return "Hanya tiket pagi yang bisa dilanjut fullday.";
        set({
          attendance: get().attendance.map((a) =>
            a.id === open.id ? { ...a, shiftId: "fullday", note: open.note || "Lanjut fullday" } : a,
          ),
          audit: [
            {
              id: uid("au"),
              time: new Date().toLocaleString("id-ID"),
              actor: s.name,
              action: `${s.name} lanjut fullday — telat jam 17 tidak dihitung ulang`,
            },
            ...get().audit,
          ],
        });
        return null;
      },
      setAttendanceValid: (id, valid, reason) => {
        if (get().role !== "owner") {
          set({ pinOpen: true, pendingView: "attendance" });
          return false;
        }
        const row = get().attendance.find((a) => a.id === id);
        if (!row) return false;
        const actor = get().staff.find((s) => s.id === get().currentStaffId)?.name ?? "Owner";
        set({
          attendance: get().attendance.map((a) =>
            a.id === id
              ? {
                  ...a,
                  valid,
                  voidReason: valid ? undefined : (reason || "Dibatalkan owner"),
                  voidedBy: valid ? undefined : actor,
                  voidedAt: valid ? undefined : new Date().toISOString(),
                }
              : a,
          ),
          incidents: get().incidents.map((inc) =>
            inc.attendanceId === id
              ? { ...inc, status: valid ? "Selesai" : "Dibatalkan" }
              : inc,
          ),
          audit: [
            {
              id: uid("au"),
              time: new Date().toLocaleString("id-ID"),
              actor,
              action: valid
                ? `Pulihkan absen ${row.staffName} ${row.date}`
                : `Batalkan absen ${row.staffName} ${row.date}${reason ? ` · ${reason}` : ""}`,
            },
            ...get().audit,
          ],
        });
        return true;
      },
      updateWorkShifts: (next) => {
        if (get().role !== "owner") {
          set({ pinOpen: true, pendingView: "attendance" });
          return false;
        }
        const prev = get().workShifts;
        const actor = get().staff.find((s) => s.id === get().currentStaffId)?.name ?? "Owner";
        const summary = next
          .map((s) => {
            const old = prev.find((p) => p.id === s.id);
            if (!old) return `${s.name} baru`;
            const bits = [];
            if (old.absenFrom !== s.absenFrom || old.absenTo !== s.absenTo) bits.push(`absen ${s.absenFrom}–${s.absenTo}`);
            if (old.workStart !== s.workStart || old.workEnd !== s.workEnd) bits.push(`kerja ${s.workStart}–${s.workEnd}`);
            return bits.length ? `${s.name}: ${bits.join(", ")}` : null;
          })
          .filter(Boolean)
          .join(" · ");
        set({
          workShifts: next,
          shiftLogs: summary
            ? [
                {
                  id: uid("sh"),
                  createdAt: new Date().toISOString(),
                  actor,
                  summary,
                },
                ...get().shiftLogs,
              ]
            : get().shiftLogs,
          audit: summary
            ? [
                { id: uid("au"), time: new Date().toLocaleString("id-ID"), actor, action: `Ubah jam shift · ${summary}` },
                ...get().audit,
              ]
            : get().audit,
        });
        return true;
      },
      openShift: (cash, staffId) => {
        const s = get().staff.find((x) => x.id === (staffId || get().currentStaffId)) ?? get().staff[0];
        const name = s?.name ?? "Kasir";
        set({
          currentStaffId: s?.id ?? get().currentStaffId,
          shift: {
            open: true,
            openedAt: new Date().toISOString(),
            openingCash: cash,
            cashSales: 0,
            nonCashSales: 0,
            cashier: name,
          },
          audit: [{ id: uid("au"), time: new Date().toLocaleString("id-ID"), actor: name, action: `Buka shift kasir · modal ${formatIDR(cash)}` }, ...get().audit],
        });
      },
      closeShift: () =>
        set({
          shift: { ...get().shift, open: false },
          audit: [{ id: uid("au"), time: new Date().toLocaleString("id-ID"), actor: get().shift.cashier, action: "Tutup shift kasir" }, ...get().audit],
        }),
      setShiftCashier: (staffId) => {
        const s = get().staff.find((x) => x.id === staffId);
        if (!s) return;
        const prev = get().shift.cashier;
        set({
          currentStaffId: s.id,
          shift: { ...get().shift, cashier: s.name },
          audit: [
            { id: uid("au"), time: new Date().toLocaleString("id-ID"), actor: s.name, action: `Ganti kasir shift ${prev} → ${s.name}` },
            ...get().audit,
          ],
        });
      },
      addStaff: (s) => set({ staff: [...get().staff, s] }),
      updateStaff: (s) =>
        set({
          staff: get().staff.map((x) => (x.id === s.id ? s : x)),
          shift: get().shift.cashier && get().currentStaffId === s.id ? { ...get().shift, cashier: s.name } : get().shift,
        }),
      removeStaff: (id) => {
        const list = get().staff;
        const target = list.find((s) => s.id === id);
        if (!target) return "Akun tidak ada.";
        if (target.id === "bagas") return "Akun owner tidak bisa dihapus.";
        const admins = list.filter((s) => s.access === "Full Admin" && s.active && s.id !== id);
        if (target.access === "Full Admin" && admins.length === 0) return "Tidak bisa hapus admin terakhir.";
        if (get().currentStaffId === id) return "Tidak bisa hapus kasir yang sedang login.";
        set({
          staff: list.filter((s) => s.id !== id),
          audit: [{ id: uid("au"), time: new Date().toLocaleString("id-ID"), actor: get().shift.cashier, action: `Hapus akun ${target.name}` }, ...get().audit],
        });
        return null;
      },
      setAdminPin: (pin) => set({ adminPin: pin }),
      adjustStock: (id, stock) =>
        set({
          inventory: get().inventory.map((i) => (i.id === id ? { ...i, stock } : i)),
        }),
      updateIngredient: (ing) =>
        set({
          inventory: get().inventory.map((i) => (i.id === ing.id ? normalizeIngredient(ing) : i)),
        }),
      commitOpname: (rows) => {
        const actor = get().staff.find((s) => s.id === get().currentStaffId)?.name ?? "Owner";
        const map = new Map(rows.map((r) => [r.id, r.stock]));
        const notes: string[] = [];
        const inventory = get().inventory.map((i) => {
          if (!map.has(i.id)) return i;
          const stock = map.get(i.id)!;
          if (stock === i.stock) return i;
          notes.push(`${i.name} ${i.stock}→${stock}`);
          return { ...i, stock };
        });
        if (!notes.length) return;
        set({
          inventory,
          audit: [{ id: uid("au"), time: new Date().toLocaleString("id-ID"), actor, action: `Stok opname · ${notes.join(", ")}` }, ...get().audit],
        });
      },
      notify: (type, title, message, orderId) =>
        set({
          notifications: [
            {
              id: uid("n"),
              type,
              title,
              message,
              time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }),
              orderId,
            },
            ...get().notifications,
          ],
        }),
      lockPeriod: () => {
        const books = ensureTutupBuku(get().tutupBuku);
        const open = books
          .filter((t) => t.status === "Dalam Proses")
          .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
        if (!open) return;
        const inRange = (d: string) => inCutoffRange(d, open.startDate, open.endDate);
        const omzet = get().dailySales.filter((d) => inRange(d.date)).reduce((s, d) => s + d.omzet, 0);
        const sewa = get().incomes.filter((d) => inRange(d.date)).reduce((s, d) => s + d.amount, 0);
        const expense = get().expenses.filter((d) => inRange(d.date)).reduce((s, d) => s + d.amount, 0);
        const cogsBooks = get().dailyBooks.filter((d) => inRange(d.date)).reduce((s, d) => s + d.cogs, 0);
        const cogs = cogsBooks || Math.round(omzet * 0.275);
        const income = omzet + sewa;
        const actor = get().bukuSession?.name ?? get().staff.find((s) => s.id === get().currentStaffId)?.name ?? "Owner";
        const next = nextCutoffPeriod(open.endDate);
        const closed: TutupBuku = {
          ...open,
          income,
          expense,
          cogs,
          profit: income - cogs - expense,
          status: "Selesai",
          pic: actor,
          note: `Dikunci ${new Date().toLocaleString("id-ID")} · omzet ${formatIDR(omzet)} + sewa ${formatIDR(sewa)}`,
        };
        let nextBooks = books.map((t) => (t.period === open.period ? closed : t));
        if (!nextBooks.some((t) => t.period === next.id)) nextBooks = [...nextBooks, emptyBook(next, actor)];
        set({
          tutupBuku: nextBooks,
          audit: [
            {
              id: uid("au"),
              time: new Date().toLocaleString("id-ID"),
              actor,
              action: `Tutup buku ${open.period} · ${open.startDate}–${open.endDate}`,
            },
            ...get().audit,
          ],
        });
      },
      upsertMoneyIn: (row) => {
        const rest = get().moneyIn.filter((r) => r.date !== row.date);
        set({ moneyIn: [...rest, row].sort((a, b) => a.date.localeCompare(b.date)) });
      },
      setPaymentOpen: (v) => set({ paymentOpen: v }),
      setReceiptOpen: (v) => set({ receiptOpen: v }),
      setProductModal: (p) => set({ productModal: p }),
      setProductFormOpen: (v) => set({ productFormOpen: v, editingProduct: v ? get().editingProduct : null }),
      applyCloud: (payload, rev, at) => {
        const cap =
          typeof payload.managerCashCap === "number" && payload.managerCashCap >= 0
            ? payload.managerCashCap
            : get().managerCashCap;
        set({
          cloudApplying: true,
          products: payload.products,
          menuCategories: ensureMenuCategories(payload.menuCategories, payload.products),
          orders: payload.orders,
          expenses: settleExpenses(payload.expenses ?? []),
          incomes: payload.incomes,
          incidents: payload.incidents,
          inventory: payload.inventory.map(normalizeIngredient),
          staff: payload.staff,
          attendance: payload.attendance,
          shift: payload.shift,
          notifications: payload.notifications,
          audit: payload.audit,
          tutupBuku: ensureTutupBuku(payload.tutupBuku),
          dailySales: payload.dailySales,
          dailyBooks: payload.dailyBooks,
          weekly: payload.weekly,
          moneyIn: payload.moneyIn ?? [],
          sheetSync: payload.sheetSync || get().sheetSync,
          adminPin: payload.adminPin || get().adminPin,
          adjustLogs: payload.adjustLogs ?? [],
          taxEnabled: payload.taxEnabled,
          serviceEnabled: payload.serviceEnabled,
          recipes: payload.recipes?.length ? payload.recipes : get().recipes,
          testPurge: payload.testPurge || get().testPurge,
          bukuUsers: ensureBukuUsers(payload.bukuUsers),
          bukuPin: payload.bukuPin || get().bukuPin,
          waOwner: payload.waOwner ?? get().waOwner,
          waKitchen: payload.waKitchen ?? get().waKitchen,
          waOwnerMode: payload.waOwnerMode ?? get().waOwnerMode,
          waKitchenMode: payload.waKitchenMode ?? get().waKitchenMode,
          sisihGajiPerDay: payload.sisihGajiPerDay ?? get().sisihGajiPerDay,
          sisihOpsPerDay: payload.sisihOpsPerDay ?? get().sisihOpsPerDay,
          priveWeeklyCap: payload.priveWeeklyCap ?? get().priveWeeklyCap,
          managerCashCap: cap,
          managerCash: (payload.managerCash ?? []).map((r) => normalizeManagerCash(r, cap)),
          workShifts: ensureWorkShifts(payload.workShifts),
          shiftLogs: payload.shiftLogs ?? [],
          cloudRev: rev,
          cloudAt: at,
          cloudStatus: "ok",
          cloudError: "",
        });
        queueMicrotask(() => usePos.setState({ cloudApplying: false }));
      },
      setCloudMeta: (patch) => set(patch),
    }),
    {
      name: "hven-pos-v3",
      skipHydration: true,
      storage: createJSONStorage(() => safeStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        const merged = {
          ...current,
          ...p,
          taxEnabled: p.taxEnabled ?? true,
          serviceEnabled: p.serviceEnabled ?? false,
          discountReason: p.discountReason ?? "",
          recipes: p.recipes && p.recipes.length ? p.recipes : RECIPES,
          editingProduct: null,
          sessionLoggedIn: p.sessionLoggedIn === true,
          sessionEmail: p.sessionEmail ?? "",
          bukuUsers: ensureBukuUsers(p.bukuUsers),
          bukuSession: p.bukuSession ?? null,
          bukuPin: typeof p.bukuPin === "string" && /^\d{6,}$/.test(p.bukuPin) ? p.bukuPin : BUKU_PIN,
          bukuUnlocked: false,
          waOwner: p.waOwner ?? "",
          waKitchen: p.waKitchen ?? "",
          waOwnerMode: (p.waOwnerMode === "group" ? "group" : "number") as WaMode,
          waKitchenMode: (p.waKitchenMode === "group" ? "group" : "number") as WaMode,
          sisihGajiPerDay: typeof p.sisihGajiPerDay === "number" && p.sisihGajiPerDay >= 0 ? p.sisihGajiPerDay : SISIH_GAJI_PER_DAY,
          sisihOpsPerDay: typeof p.sisihOpsPerDay === "number" && p.sisihOpsPerDay >= 0 ? p.sisihOpsPerDay : SISIH_OPS_PER_DAY,
          priveWeeklyCap: typeof p.priveWeeklyCap === "number" && p.priveWeeklyCap >= 0 ? p.priveWeeklyCap : PRIVE_WEEKLY_CAP,
          managerCashCap: typeof p.managerCashCap === "number" && p.managerCashCap >= 0 ? p.managerCashCap : MANAGER_CASH_CAP,
          managerCash: Array.isArray(p.managerCash)
            ? p.managerCash.map((r) =>
                normalizeManagerCash(r, typeof p.managerCashCap === "number" && p.managerCashCap >= 0 ? p.managerCashCap : MANAGER_CASH_CAP),
              )
            : [],
          workShifts: ensureWorkShifts(p.workShifts && p.workShifts.length ? p.workShifts : WORK_SHIFTS),
          shiftLogs: p.shiftLogs ?? [],
          attendance: (p.attendance ?? current.attendance).map((a) => ({
            ...a,
            valid: a.valid !== false,
            shiftId: a.shiftId ?? inferShiftId(a.clockIn, ensureWorkShifts(p.workShifts && p.workShifts.length ? p.workShifts : WORK_SHIFTS)),
          })),
          inventory: (p.inventory ?? current.inventory).map(normalizeIngredient),
          tutupBuku: ensureTutupBuku(p.tutupBuku ?? current.tutupBuku),
          moneyIn: p.moneyIn ?? [],
          menuCategories: ensureMenuCategories(p.menuCategories, p.products ?? current.products),
          sheetSync: p.sheetSync ?? "",
          openBillId: p.openBillId ?? null,
          deviceId: typeof p.deviceId === "string" && p.deviceId ? p.deviceId : "",
          cloudRev: typeof p.cloudRev === "number" ? p.cloudRev : 0,
          cloudAt: typeof p.cloudAt === "string" ? p.cloudAt : "",
          cloudStatus: "idle" as const,
          cloudError: "",
          cloudApplying: false,
        };
        const synced = mergeSheetBooks(p, merged);
        if (p.testPurge === TEST_PURGE) {
          return { ...synced, adjustLogs: p.adjustLogs ?? [] };
        }
        return {
          ...synced,
          ...withoutTestTickets({
            orders: p.orders ?? current.orders,
            products: synced.products,
            inventory: (p.inventory ?? current.inventory).map(normalizeIngredient),
            shift: p.shift ?? current.shift,
          }),
          sheetSync: SHEET_SYNC,
          expenses: synced.expenses,
          incomes: synced.incomes,
          dailySales: synced.dailySales,
          dailyBooks: synced.dailyBooks,
          weekly: synced.weekly,
          moneyIn: synced.moneyIn ?? [],
        };
      },
      partialize: (s) => ({
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
        cart: s.cart,
        openBillId: s.openBillId,
        role: s.role,
        currentStaffId: s.currentStaffId,
        adjustLogs: s.adjustLogs,
        taxEnabled: s.taxEnabled,
        serviceEnabled: s.serviceEnabled,
        discountReason: s.discountReason,
        discount: s.discount,
        discountLabel: s.discountLabel,
        recipes: s.recipes,
        testPurge: s.testPurge,
        sessionLoggedIn: s.sessionLoggedIn,
        sessionEmail: s.sessionEmail,
        bukuUsers: s.bukuUsers,
        bukuSession: s.bukuSession,
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
        workShifts: s.workShifts,
        shiftLogs: s.shiftLogs,
        deviceId: s.deviceId,
        cloudRev: s.cloudRev,
        cloudAt: s.cloudAt,
      }),
    },
  ),
);

export function currentStaff() {
  const { staff, currentStaffId } = usePos.getState();
  return staff.find((s) => s.id === currentStaffId);
}
