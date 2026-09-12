import { useMemo, useState } from "react";
import { Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ADDONS } from "@/data/seed";
import { nudgeCloud } from "@/lib/cloud-nudge";
import { formatIDR } from "@/lib/format";
import { menuBlurb, menuPhoto } from "@/lib/menu-photos";
import { usePos } from "@/lib/store";
import type { Addon, OrderType, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import "@/styles-guest.css";

const ICE = ["Normal ice", "Less ice", "No ice"] as const;
const SUGAR = ["Normal sugar", "Less sugar", "No sugar"] as const;

export function GuestMenu() {
  const products = usePos((s) => s.products);
  const cats = usePos((s) => s.menuCategories);
  const addToCart = usePos((s) => s.addToCart);
  const cart = usePos((s) => s.cart);
  const changeQty = usePos((s) => s.changeQty);
  const removeCart = usePos((s) => s.removeCart);
  const totals = usePos((s) => s.totals)();
  const orderType = usePos((s) => s.orderType);
  const setOrderType = usePos((s) => s.setOrderType);
  const table = usePos((s) => s.table);
  const setTable = usePos((s) => s.setTable);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Semua");
  const [pick, setPick] = useState<Product | null>(null);
  const [tray, setTray] = useState(false);
  const [ice, setIce] = useState<(typeof ICE)[number]>("Normal ice");
  const [sugar, setSugar] = useState<(typeof SUGAR)[number]>("Normal sugar");
  const [note, setNote] = useState("");
  const [extras, setExtras] = useState<string[]>([]);

  const categories = ["Semua", ...(cats.length ? cats : [...new Set(products.map((p) => p.category))])];
  const list = useMemo(() => {
    return products.filter((p) => {
      if (cat !== "Semua" && p.category !== cat) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [products, cat, q]);

  const drinkAddons = ADDONS.filter((a) => a.id !== "ad5");
  const foodAddons = ADDONS.filter((a) => a.id === "ad5");
  const addonPool = pick?.category === "Food" ? foodAddons : drinkAddons;

  const openPick = (p: Product) => {
    if (!p.available || p.stock <= 0) return;
    setPick(p);
    setIce("Normal ice");
    setSugar("Normal sugar");
    setNote("");
    setExtras([]);
  };

  const addPicked = () => {
    if (!pick) return;
    const addons: Addon[] = ADDONS.filter((a) => extras.includes(a.id));
    if (ice === "Less ice" && !addons.some((a) => a.id === "ad3")) {
      const less = ADDONS.find((a) => a.id === "ad3");
      if (less) addons.push(less);
    }
    const bits = [ice !== "Normal ice" ? ice : "", sugar !== "Normal sugar" ? sugar : "", note.trim()].filter(Boolean);
    addToCart(pick, addons, bits.join(" · "));
    nudgeCloud();
    toast.success(`${pick.name} masuk ke kasir`);
    setPick(null);
  };

  const sendToPos = () => {
    if (!cart.length) {
      toast.error("Keranjang masih kosong.");
      return;
    }
    nudgeCloud();
    const payload = {
      source: "hven-guest-menu",
      at: new Date().toISOString(),
      type: orderType,
      table: orderType === "Dine In" ? table : "-",
      items: cart.map((i) => ({
        id: i.productId,
        name: i.name,
        qty: i.qty,
        note: i.note,
        modifiers: i.addons.map((a) => a.name),
        price: i.price,
      })),
      total: totals.total,
    };
    window.dispatchEvent(new CustomEvent("hven-pos-checkout", { detail: payload }));
    toast.success("Pesanan sudah di kasir. Bayar di meja kasir.");
    setTray(false);
  };

  const extraSum = ADDONS.filter((a) => extras.includes(a.id)).reduce((s, a) => s + a.price, 0);

  return (
    <div className="guest-kiosk">
      <header className="sticky top-0 z-30 px-4 pb-3 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <div className="glass mx-auto flex max-w-lg items-center gap-3 rounded-full px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">HVEN Space</p>
            <p className="truncate text-base font-semibold leading-tight">Digital menu</p>
          </div>
          <button type="button" onClick={() => setTray(true)} className="glass relative grid size-11 place-items-center rounded-full">
            <ShoppingBag className="size-4" />
            {totals.qty > 0 ? (
              <span className="cta absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full px-1 text-[10px] tabular-nums">
                {totals.qty}
              </span>
            ) : null}
          </button>
        </div>
        <label className="glass mx-auto mt-3 flex max-w-lg items-center gap-2 rounded-full px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search menu"
            className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </label>
        <div className="mx-auto mt-3 flex max-w-lg gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn("glass h-10 shrink-0 rounded-full px-4 text-sm font-medium", cat === c && "glass-hot")}
            >
              {c === "Semua" ? "All" : c}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-lg grid-cols-2 gap-3 px-4 pb-32">
        {list.map((p) => {
          const sold = !p.available || p.stock <= 0;
          return (
            <article key={p.id} className="glass group overflow-hidden rounded-[22px]">
              <button type="button" onClick={() => openPick(p)} disabled={sold} className="block w-full text-left disabled:opacity-40">
                <div className="relative aspect-square overflow-hidden bg-black/25">
                  <img src={menuPhoto(p)} alt="" className="size-full object-cover transition-transform duration-300 group-active:scale-105" />
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-1 text-sm font-semibold leading-tight">{p.name}</p>
                  <p className="line-clamp-2 min-h-8 text-[11px] leading-snug text-muted-foreground">{menuBlurb(p)}</p>
                  <p className="price-glow text-sm font-semibold tabular-nums">{formatIDR(p.price)}</p>
                </div>
              </button>
              <div className="px-3 pb-3">
                <button
                  type="button"
                  disabled={sold}
                  onClick={() => openPick(p)}
                  className={cn("cta h-9 w-full rounded-full text-sm", sold && "opacity-40")}
                >
                  {sold ? "Habis" : "Add"}
                </button>
              </div>
            </article>
          );
        })}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto glass-deep mx-auto flex max-w-lg items-center gap-3 rounded-[22px] p-2.5 pl-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">{totals.qty} item</p>
            <p className="truncate text-lg font-semibold tabular-nums leading-tight">{formatIDR(totals.total)}</p>
          </div>
          <button type="button" className="cta h-11 shrink-0 rounded-full px-4 text-sm" onClick={() => (cart.length ? sendToPos() : setTray(true))}>
            Checkout to POS
          </button>
        </div>
      </div>

      {pick ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/55" onClick={() => setPick(null)}>
          <div
            className="glass-deep sheet-in max-h-[88dvh] w-full overflow-auto rounded-t-[28px] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex gap-3">
              <img src={menuPhoto(pick)} alt="" className="size-24 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold leading-tight">{pick.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{menuBlurb(pick)}</p>
                <p className="price-glow mt-2 font-semibold tabular-nums">{formatIDR(pick.price + extraSum)}</p>
              </div>
              <button type="button" className="glass grid size-11 place-items-center rounded-full" onClick={() => setPick(null)}>
                <X className="size-4" />
              </button>
            </div>
            {pick.category !== "Food" && pick.category !== "Water" ? (
              <>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ice</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ICE.map((v) => (
                    <button key={v} type="button" onClick={() => setIce(v)} className={cn("glass h-10 rounded-full px-3 text-sm", ice === v && "glass-hot")}>
                      {v}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sugar</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUGAR.map((v) => (
                    <button key={v} type="button" onClick={() => setSugar(v)} className={cn("glass h-10 rounded-full px-3 text-sm", sugar === v && "glass-hot")}>
                      {v}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {addonPool.length ? (
              <>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Modifiers</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {addonPool.map((a) => {
                    const on = extras.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setExtras((xs) => (on ? xs.filter((id) => id !== a.id) : [...xs, a.id]))}
                        className={cn("glass h-10 rounded-full px-3 text-sm", on && "glass-hot")}
                      >
                        {a.name}
                        {a.price ? ` · ${formatIDR(a.price)}` : ""}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
            <Input className="glass mt-4 h-11 rounded-2xl border-white/10 bg-transparent" placeholder="Notes for barista" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="button" className="cta mt-4 h-12 w-full rounded-full text-base" onClick={addPicked}>
              Add to Order
            </button>
          </div>
        </div>
      ) : null}

      {tray ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/55" onClick={() => setTray(false)}>
          <div
            className="glass-deep sheet-in max-h-[80dvh] w-full overflow-auto rounded-t-[28px] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your order</h2>
              <button type="button" className="glass grid size-11 place-items-center rounded-full" onClick={() => setTray(false)}>
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              {(["Dine In", "Takeaway"] as OrderType[]).map((t) => (
                <button key={t} type="button" onClick={() => setOrderType(t)} className={cn("glass h-11 flex-1 rounded-full text-sm", orderType === t && "glass-hot")}>
                  {t === "Dine In" ? "Dine in" : "Takeaway"}
                </button>
              ))}
            </div>
            {orderType === "Dine In" ? (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((n) => (
                  <button key={n} type="button" onClick={() => setTable(n)} className={cn("glass size-11 shrink-0 rounded-full text-sm", table === n && "glass-hot")}>
                    {n}
                  </button>
                ))}
              </div>
            ) : null}
            <ul className="mt-4 space-y-2">
              {cart.length === 0 ? (
                <li className="py-8 text-center text-sm text-muted-foreground">Keranjang kosong.</li>
              ) : (
                cart.map((item) => (
                  <li key={item.key} className="glass flex items-center gap-3 rounded-2xl p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">{item.name}</p>
                      {item.note ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}
                      <p className="price-glow text-xs font-medium tabular-nums">{formatIDR(item.price * item.qty)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" className="glass grid size-11 place-items-center rounded-full" onClick={() => changeQty(item.key, -1)}>
                        <Minus className="size-4" />
                      </button>
                      <span className="w-6 text-center tabular-nums">{item.qty}</span>
                      <button type="button" className="glass grid size-11 place-items-center rounded-full" onClick={() => { changeQty(item.key, 1); nudgeCloud(); }}>
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <button type="button" className="text-xs text-destructive" onClick={() => removeCart(item.key)}>
                      Hapus
                    </button>
                  </li>
                ))
              )}
            </ul>
            <button type="button" className="cta mt-4 h-12 w-full rounded-full text-base" onClick={sendToPos}>
              Checkout to POS
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
