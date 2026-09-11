import type { FillLevel, Ingredient, OpnameKind } from "@/lib/types";

export const FILL_ORDER: FillLevel[] = ["full", "half", "quarter", "empty"];

export const FILL_META: Record<FillLevel, { label: string; ratio: number; short: string }> = {
  full: { label: "Penuh", ratio: 1, short: "Full" },
  half: { label: "Setengah", ratio: 0.5, short: "½" },
  quarter: { label: "Seperempat", ratio: 0.25, short: "¼" },
  empty: { label: "Habis", ratio: 0, short: "0" },
};

const PRESET: Record<string, { opname: OpnameKind; unit?: string; alertAt?: FillLevel; fullQty?: number }> = {
  inv1: { opname: "level", alertAt: "quarter", fullQty: 12.5 },
  inv2: { opname: "pcs", unit: "pcs" },
  inv3: { opname: "level", alertAt: "quarter", fullQty: 4.2 },
  inv4: { opname: "level", alertAt: "quarter", fullQty: 18 },
  inv5: { opname: "pcs", unit: "pcs" },
  inv6: { opname: "pcs", unit: "pcs" },
  inv7: { opname: "level", alertAt: "quarter", fullQty: 0.8 },
  inv8: { opname: "level", alertAt: "quarter", fullQty: 1.6 },
  inv9: { opname: "pcs", unit: "pcs" },
  inv10: { opname: "pcs", unit: "pcs" },
};

export function normalizeIngredient(raw: Ingredient): Ingredient {
  const preset = PRESET[raw.id];
  const opname: OpnameKind = raw.opname ?? preset?.opname ?? (raw.unit === "pcs" ? "pcs" : "level");
  const unit = opname === "pcs" ? (raw.unit === "pcs" ? raw.unit : preset?.unit ?? "pcs") : raw.unit;
  const fullQty = opname === "level" ? (raw.fullQty ?? preset?.fullQty ?? Math.max(raw.stock, 0.1)) : raw.fullQty;
  return {
    ...raw,
    opname,
    unit,
    fullQty,
    alertAt: raw.alertAt ?? preset?.alertAt ?? "quarter",
    minStock: raw.minStock,
  };
}

export function fillFromStock(i: Ingredient): FillLevel {
  const full = i.fullQty && i.fullQty > 0 ? i.fullQty : 1;
  const r = i.stock / full;
  if (r <= 0.05) return "empty";
  if (r <= 0.3) return "quarter";
  if (r <= 0.6) return "half";
  return "full";
}

export function stockFromFill(i: Ingredient, fill: FillLevel): number {
  const full = i.fullQty && i.fullQty > 0 ? i.fullQty : Math.max(i.stock, 1);
  return Number((FILL_META[fill].ratio * full).toFixed(3));
}

export function isIngredientLow(i: Ingredient): boolean {
  if (i.opname === "level") {
    const fill = fillFromStock(i);
    const alertAt = i.alertAt ?? "quarter";
    return FILL_ORDER.indexOf(fill) >= FILL_ORDER.indexOf(alertAt);
  }
  return i.stock <= i.minStock;
}

export function stockLabel(i: Ingredient): string {
  if (i.opname === "level") return FILL_META[fillFromStock(i)].label;
  return `${i.stock} ${i.unit}`;
}
