import { normalizeIngredient } from "@/lib/inventory";
import {
  EXECUTIVE as SHEET_EXECUTIVE,
  overlayProducts,
  SHEET_DAILY_BOOKS,
  SHEET_DAILY_SALES,
  SHEET_EXPENSES,
  SHEET_INCOMES,
  SHEET_WEEKLY,
} from "@/lib/sheet-books";
import type {
  Addon,
  Attendance,
  Ingredient,
  Order,
  Product,
  RecipeLine,
  Staff,
  TutupBuku,
  WorkShift,
} from "@/lib/types";
import rawJson from "./seed.json";

type SeedFile = {
  products: Product[];
  orders: Order[];
  expenses: { id: string; date: string; category: string; desc: string; amount: number }[];
  incomes: { id: string; date: string; category: string; desc: string; amount: number; status: string }[];
  incidents: {
    id: string;
    date: string;
    staff: string;
    category: string;
    desc: string;
    action: string;
    loss: number;
    status: string;
  }[];
  dailySales: { date: string; omzet: number }[];
  dailyBooks: { date: string; income: number; cogs: number; expense: number; profit: number }[];
  weekly: { week: string; income: number; expense: number; cogs: number; profit: number }[];
};

const raw = rawJson as SeedFile;

export const PRODUCTS = overlayProducts(raw.products);
export const EXPENSES = SHEET_EXPENSES;
export const INCOMES = SHEET_INCOMES;
export const INCIDENTS = raw.incidents;
export const DAILY_SALES = SHEET_DAILY_SALES;
export const DAILY_BOOKS = SHEET_DAILY_BOOKS;
export const WEEKLY = SHEET_WEEKLY;
export { SHEET_EXECUTIVE as EXECUTIVE };

export const STAFF: Staff[] = [
  { id: "randy", name: "Randy", role: "Barista / Floor", pin: "1234", access: "Kasir Only", active: true },
  { id: "anto", name: "Anto", role: "Cashier", pin: "1234", access: "Kasir Only", active: true },
  { id: "gala", name: "Gala", role: "Kitchen Head", pin: "1234", access: "Kasir Only", active: true },
  { id: "kukuh", name: "Kukuh", role: "Floor & Support", pin: "1234", access: "Kasir Only", active: true },
  { id: "adi", name: "Adi", role: "Operations", pin: "1234", access: "Kasir Only", active: true },
  { id: "bagas", name: "Bagas", role: "Owner", pin: "7788", access: "Full Admin", active: true },
];

export const ADMIN_PIN = "7788";
export const BUKU_PIN = "310507";

export const WORK_SHIFTS: WorkShift[] = [
  {
    id: "pagi",
    name: "Pagi",
    workStart: "10:00",
    workEnd: "17:00",
    absenFrom: "08:00",
    absenTo: "15:00",
  },
  {
    id: "malam",
    name: "Malam",
    workStart: "17:00",
    workEnd: "01:00",
    absenFrom: "15:00",
    absenTo: "00:00",
  },
  {
    id: "fullday",
    name: "Fullday",
    workStart: "10:00",
    workEnd: "01:00",
    absenFrom: "08:00",
    absenTo: "15:00",
  },
];

export const ADDONS: Addon[] = [
  { id: "ad1", name: "Extra Shot", price: 8000 },
  { id: "ad2", name: "Oat Milk", price: 5000 },
  { id: "ad3", name: "Less Ice", price: 0 },
  { id: "ad4", name: "Extra Syrup", price: 3000 },
  { id: "ad5", name: "Extra Keju", price: 4000 },
];

export const INVENTORY: Ingredient[] = (
  [
    { id: "inv1", name: "Biji Kopi House Blend", sku: "ING-01", stock: 12.5, minStock: 3, unit: "kg", cost: 240000, opname: "level", fullQty: 12.5, alertAt: "quarter" },
    { id: "inv2", name: "Susu Segar Diamond UHT", sku: "ING-02", stock: 24, minStock: 6, unit: "pcs", cost: 18500, opname: "pcs" },
    { id: "inv3", name: "Sirup House", sku: "ING-03", stock: 4.2, minStock: 1, unit: "L", cost: 45000, opname: "level", fullQty: 4.2, alertAt: "quarter" },
    { id: "inv4", name: "Beras SPHP", sku: "ING-04", stock: 18, minStock: 5, unit: "kg", cost: 14000, opname: "level", fullQty: 18, alertAt: "quarter" },
    { id: "inv5", name: "Telur", sku: "ING-05", stock: 4.5, minStock: 2, unit: "pcs", cost: 28000, opname: "pcs" },
    { id: "inv6", name: "Kentang Crinkle", sku: "ING-06", stock: 6, minStock: 2, unit: "pcs", cost: 22000, opname: "pcs" },
    { id: "inv7", name: "Matcha Ceremonial", sku: "ING-07", stock: 0.8, minStock: 0.3, unit: "kg", cost: 420000, opname: "level", fullQty: 0.8, alertAt: "quarter" },
    { id: "inv8", name: "Bubuk Coklat", sku: "ING-08", stock: 1.6, minStock: 0.4, unit: "kg", cost: 95000, opname: "level", fullQty: 1.6, alertAt: "quarter" },
    { id: "inv9", name: "Ayam Karaage", sku: "ING-09", stock: 3.2, minStock: 1.5, unit: "pcs", cost: 65000, opname: "pcs" },
    { id: "inv10", name: "Cup & Tutup", sku: "ING-10", stock: 420, minStock: 80, unit: "pcs", cost: 350, opname: "pcs" },
  ] as Ingredient[]
).map(normalizeIngredient);

export const RECIPES: RecipeLine[] = [
  { productId: "m03", ingredientId: "inv1", qty: 0.018 },
  { productId: "m03", ingredientId: "inv2", qty: 0.18 },
  { productId: "m03", ingredientId: "inv10", qty: 1 },
  { productId: "m07", ingredientId: "inv1", qty: 0.018 },
  { productId: "m07", ingredientId: "inv10", qty: 1 },
  { productId: "m08", ingredientId: "inv1", qty: 0.018 },
  { productId: "m08", ingredientId: "inv2", qty: 0.18 },
  { productId: "m08", ingredientId: "inv10", qty: 1 },
  { productId: "m04", ingredientId: "inv4", qty: 0.15 },
  { productId: "m04", ingredientId: "inv5", qty: 0.06 },
  { productId: "m01", ingredientId: "inv3", qty: 0.03 },
  { productId: "m01", ingredientId: "inv10", qty: 1 },
  { productId: "m17", ingredientId: "inv6", qty: 0.12 },
  { productId: "m30", ingredientId: "inv7", qty: 0.008 },
  { productId: "m30", ingredientId: "inv2", qty: 0.18 },
  { productId: "m30", ingredientId: "inv10", qty: 1 },
  { productId: "m31", ingredientId: "inv8", qty: 0.02 },
  { productId: "m31", ingredientId: "inv2", qty: 0.18 },
  { productId: "m31", ingredientId: "inv10", qty: 1 },
  { productId: "m15", ingredientId: "inv1", qty: 0.014 },
  { productId: "m15", ingredientId: "inv10", qty: 1 },
  { productId: "m42", ingredientId: "inv1", qty: 0.014 },
  { productId: "m42", ingredientId: "inv10", qty: 1 },
  { productId: "m28", ingredientId: "inv1", qty: 0.018 },
  { productId: "m28", ingredientId: "inv10", qty: 1 },
  { productId: "m38", ingredientId: "inv1", qty: 0.018 },
  { productId: "m38", ingredientId: "inv2", qty: 0.16 },
  { productId: "m38", ingredientId: "inv10", qty: 1 },
  { productId: "m24", ingredientId: "inv1", qty: 0.02 },
  { productId: "m24", ingredientId: "inv10", qty: 1 },
  { productId: "m25", ingredientId: "inv1", qty: 0.024 },
  { productId: "m25", ingredientId: "inv10", qty: 1 },
  { productId: "m26", ingredientId: "inv1", qty: 0.03 },
  { productId: "m26", ingredientId: "inv10", qty: 1 },
  { productId: "m40", ingredientId: "inv1", qty: 0.022 },
  { productId: "m40", ingredientId: "inv2", qty: 0.12 },
  { productId: "m40", ingredientId: "inv10", qty: 1 },
  { productId: "m02", ingredientId: "inv9", qty: 0.08 },
  { productId: "m02", ingredientId: "inv6", qty: 0.04 },
  { productId: "m05", ingredientId: "inv5", qty: 0.04 },
  { productId: "m05", ingredientId: "inv9", qty: 0.05 },
  { productId: "m22", ingredientId: "inv6", qty: 0.1 },
  { productId: "m23", ingredientId: "inv6", qty: 0.1 },
  { productId: "m41", ingredientId: "inv6", qty: 0.1 },
  { productId: "m39", ingredientId: "inv6", qty: 0.08 },
  { productId: "m06", ingredientId: "inv3", qty: 0.025 },
  { productId: "m06", ingredientId: "inv10", qty: 1 },
  { productId: "m09", ingredientId: "inv3", qty: 0.03 },
  { productId: "m09", ingredientId: "inv2", qty: 0.12 },
  { productId: "m09", ingredientId: "inv10", qty: 1 },
  { productId: "m10", ingredientId: "inv10", qty: 1 },
  { productId: "m12", ingredientId: "inv10", qty: 1 },
  { productId: "m13", ingredientId: "inv3", qty: 0.03 },
  { productId: "m13", ingredientId: "inv10", qty: 1 },
  { productId: "m16", ingredientId: "inv10", qty: 1 },
  { productId: "m18", ingredientId: "inv3", qty: 0.03 },
  { productId: "m18", ingredientId: "inv10", qty: 1 },
  { productId: "m19", ingredientId: "inv3", qty: 0.03 },
  { productId: "m19", ingredientId: "inv10", qty: 1 },
  { productId: "m20", ingredientId: "inv3", qty: 0.03 },
  { productId: "m20", ingredientId: "inv10", qty: 1 },
  { productId: "m21", ingredientId: "inv3", qty: 0.03 },
  { productId: "m21", ingredientId: "inv10", qty: 1 },
  { productId: "m27", ingredientId: "inv3", qty: 0.03 },
  { productId: "m27", ingredientId: "inv10", qty: 1 },
  { productId: "m29", ingredientId: "inv7", qty: 0.008 },
  { productId: "m29", ingredientId: "inv10", qty: 1 },
  { productId: "m32", ingredientId: "inv2", qty: 0.16 },
  { productId: "m32", ingredientId: "inv3", qty: 0.02 },
  { productId: "m32", ingredientId: "inv10", qty: 1 },
  { productId: "m33", ingredientId: "inv2", qty: 0.16 },
  { productId: "m33", ingredientId: "inv3", qty: 0.02 },
  { productId: "m33", ingredientId: "inv10", qty: 1 },
  { productId: "m34", ingredientId: "inv8", qty: 0.015 },
  { productId: "m34", ingredientId: "inv2", qty: 0.16 },
  { productId: "m34", ingredientId: "inv10", qty: 1 },
  { productId: "m35", ingredientId: "inv3", qty: 0.025 },
  { productId: "m35", ingredientId: "inv10", qty: 1 },
  { productId: "m36", ingredientId: "inv3", qty: 0.025 },
  { productId: "m36", ingredientId: "inv10", qty: 1 },
  { productId: "m37", ingredientId: "inv2", qty: 0.16 },
  { productId: "m37", ingredientId: "inv10", qty: 1 },
];

export const TUTUP_BUKU: TutupBuku[] = [
  {
    period: "2026-08",
    startDate: "2026-08-07",
    endDate: "2026-09-06",
    income: 47933000,
    expense: 26051300,
    cogs: 13174636,
    profit: 8707064,
    status: "Selesai",
    pic: "Admin HVEN",
    note: "Tutup buku 7 Agustus – 6 September 2026 terarsip 7 September 2026",
  },
  {
    period: "2026-09",
    startDate: "2026-09-07",
    endDate: "2026-10-06",
    income: 0,
    expense: 0,
    cogs: 0,
    profit: 0,
    status: "Dalam Proses",
    pic: "Admin HVEN",
    note: "Periode berjalan. Jadwal kunci: 7 Oktober 2026",
  },
];

export const VENUE_PACKAGES = [
  {
    id: "v1",
    name: "Paket 2 Jam Standar",
    price: 200000,
    points: ["Tanpa meja dan kursi", "Listrik AC & lampu terpasang"],
  },
  {
    id: "v2",
    name: "Paket 2 Jam Lengkap",
    price: 300000,
    points: ["Termasuk 8 meja dan 25 kursi (maks.)", "Listrik AC & lampu terpasang"],
  },
];

export const VENUE_EXTRAS = [
  { name: "Kelebihan waktu per jam", price: "Rp 150.000" },
  { name: "Tambahan perlengkapan", price: "Per item" },
  { name: "Charge makan-minum dari luar", price: "25% dari harga sewa" },
  { name: "Alat musik / band", price: "Rp 100.000" },
  { name: "Listrik melebihi kapasitas", price: "Tambah daya PLN" },
];

export const SAMPLE_ORDERS: Order[] = raw.orders;
export const HISTORIC_ORDER_IDS = new Set(SAMPLE_ORDERS.map((o) => o.id));

function staffPhoto(initials: string, fill: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="${fill}"/><circle cx="80" cy="62" r="28" fill="#f3ece3"/><ellipse cx="80" cy="138" rx="46" ry="36" fill="#f3ece3"/><text x="80" y="68" text-anchor="middle" font-family="Georgia,serif" font-size="22" fill="#1a140c">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_ATTENDANCE: Attendance[] = [
  {
    id: "att-1",
    staffId: "randy",
    staffName: "Randy",
    date: "2026-09-09",
    clockIn: "2026-09-09T07:58:00+07:00",
    clockOut: "2026-09-09T22:04:00+07:00",
    status: "Pulang",
    note: "Buka bar & grind kopi",
    photoIn: staffPhoto("R", "#3d3228"),
    photoOut: staffPhoto("R", "#2a241e"),
    valid: true,
    shiftId: "pagi",
  },
  {
    id: "att-2",
    staffId: "gala",
    staffName: "Gala",
    date: "2026-09-09",
    clockIn: "2026-09-09T08:22:00+07:00",
    clockOut: "2026-09-09T21:48:00+07:00",
    status: "Pulang",
    note: "Kitchen prep",
    photoIn: staffPhoto("G", "#4a3b2a"),
    photoOut: staffPhoto("G", "#2f281f"),
    valid: true,
    shiftId: "pagi",
  },
  {
    id: "att-3",
    staffId: "anto",
    staffName: "Anto",
    date: "2026-09-09",
    clockIn: "2026-09-09T08:01:00+07:00",
    clockOut: "2026-09-09T21:55:00+07:00",
    status: "Pulang",
    note: "Kasir siang-malam",
    photoIn: staffPhoto("A", "#3a332c"),
    photoOut: staffPhoto("A", "#26211c"),
    valid: true,
    shiftId: "pagi",
  },
  {
    id: "att-4",
    staffId: "randy",
    staffName: "Randy",
    date: "2026-09-08",
    clockIn: "2026-09-08T07:55:00+07:00",
    clockOut: "2026-09-08T22:10:00+07:00",
    status: "Pulang",
    note: "Bar & floor",
    photoIn: staffPhoto("R", "#3d3228"),
    photoOut: staffPhoto("R", "#2a241e"),
    valid: true,
    shiftId: "pagi",
  },
  {
    id: "att-5",
    staffId: "anto",
    staffName: "Anto",
    date: "2026-09-08",
    clockIn: "2026-09-08T08:04:00+07:00",
    clockOut: "2026-09-08T21:40:00+07:00",
    status: "Pulang",
    note: "Kasir",
    photoIn: staffPhoto("A", "#3a332c"),
    photoOut: staffPhoto("A", "#26211c"),
    valid: true,
    shiftId: "pagi",
  },
];
