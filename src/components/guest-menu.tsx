import { useMemo, useState } from "react";
import { Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
    setTray(true);
  };

  const extraSum = ADDONS.filter((a) => extras.includes(a.id)).reduce((s, a) => s + a.price, 0);

  return (
    <div className="guest-kiosk">
      <header className="sticky top-0 z-30 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="glass mx-auto flex max-w-3xl items-center gap-3 rounded-[28px] px-3 py-2.5">
          <div className="min-w-0 pl-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">HVEN Space</p>
            <p className="truncate font-display text-lg leading-tight">Menu tamu</p>
          </div>
          <label className="glass relative min-w-0 flex-1 rounded-full px-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari menu"
              className="h-11 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
            />
          </label>
          <button
            type="button"
            onClick={() => setTray(true)}
            className="glass-hot relative flex h-11 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium"
          >
            <ShoppingBag className="size-4" />
            <span className="tabular-nums">{totals.qty}</span>
            <span className="hidden font-mono text-xs sm:inline">{formatIDR(totals.total)}</span>
          </button>
        </div>
        <div className="mx-auto mt-3 flex max-w-3xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "glass h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-200",
                cat === c && "glass-hot",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-3xl grid-cols-2 gap-3 px-4 pb-36">
        {list.map((p) => {
          const sold = !p.available || p.stock <= 0;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => openPick(p)}
              disabled={sold}
              className="glass group overflow-hidden rounded-[24px] text-left disabled:opacity-45"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-t-[23px]">
                <img src={menuPhoto(p)} alt="" className="size-full object-cover transition-transform duration-300 group-active:scale-[1.03]" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
                <p className="absolute bottom-2 left-2 font-mono text-sm tabular-nums">{formatIDR(p.price)}</p>
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-1 font-medium leading-tight">{p.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{menuBlurb(p)}</p>
                <span className="mt-1 inline-flex h-9 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {sold ? "Habis" : "Tambah"}
                </span>
              </div>
            </button>
          );
        })}
      </main>

      {pick ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50" onClick={() => setPick(null)}>
          <div
            className="glass max-h-[88dvh] w-full overflow-auto rounded-t-[28px] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
            <div className="flex gap-3">
              <img src={menuPhoto(pick)} alt="" className="size-24 rounded-[18px] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl leading-tight">{pick.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{menuBlurb(pick)}</p>
                <p className="mt-2 font-mono tabular-nums">{formatIDR(pick.price + extraSum)}</p>
              </div>
              <button type="button" className="grid size-11 place-items-center rounded-full glass" onClick={() => setPick(null)}>
                <X className="size-4" />
              </button>
            </div>
            {pick.category !== "Food" && pick.category !== "Water" ? (
              <>
                <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Es</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ICE.map((v) => (
                    <button key={v} type="button" onClick={() => setIce(v)} className={cn("glass h-11 rounded-full px-3 text-sm", ice === v && "glass-hot")}>
                      {v}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Gula</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUGAR.map((v) => (
                    <button key={v} type="button" onClick={() => setSugar(v)} className={cn("glass h-11 rounded-full px-3 text-sm", sugar === v && "glass-hot")}>
                      {v}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {addonPool.length ? (
              <>
                <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Tambahan</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {addonPool.map((a) => {
                    const on = extras.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setExtras((xs) => (on ? xs.filter((id) => id !== a.id) : [...xs, a.id]))}
                        className={cn("glass h-11 rounded-full px-3 text-sm", on && "glass-hot")}
                      >
                        {a.name}
                        {a.price ? ` · ${formatIDR(a.price)}` : ""}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
            <Input className="mt-4 h-11 rounded-2xl bg-transparent" placeholder="Catatan untuk barista / dapur" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button className="mt-4 h-12 w-full rounded-full text-base" onClick={addPicked}>
              Tambah ke pesanan kasir
            </Button>
          </div>
        </div>
      ) : null}

      {tray ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50" onClick={() => setTray(false)}>
          <div
            className="glass max-h-[80dvh] w-full overflow-auto rounded-t-[28px] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Pesanan kamu</h2>
              <button type="button" className="grid size-11 place-items-center rounded-full glass" onClick={() => setTray(false)}>
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Langsung tampil di kasir. Bayar di meja kasir.</p>
            <div className="mt-3 flex gap-2">
              {(["Dine In", "Takeaway"] as OrderType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={cn("glass h-11 flex-1 rounded-full text-sm", orderType === t && "glass-hot")}
                >
                  {t === "Dine In" ? "Dine in" : "Takeaway"}
                </button>
              ))}
            </div>
            {orderType === "Dine In" ? (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTable(n)}
                    className={cn("glass h-11 w-11 shrink-0 rounded-full text-sm", table === n && "glass-hot")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : null}
            <ul className="mt-4 space-y-2">
              {cart.length === 0 ? (
                <li className="py-8 text-center text-sm text-muted-foreground">Belum ada item.</li>
              ) : (
                cart.map((item) => (
                  <li key={item.key} className="glass flex items-center gap-3 rounded-[20px] p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">{item.name}</p>
                      {item.note ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}
                      <p className="font-mono text-xs tabular-nums">{formatIDR(item.price * item.qty)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" className="grid size-11 place-items-center rounded-full glass" onClick={() => changeQty(item.key, -1)}>
                        <Minus className="size-4" />
                      </button>
                      <span className="w-6 text-center tabular-nums">{item.qty}</span>
                      <button type="button" className="grid size-11 place-items-center rounded-full glass" onClick={() => { changeQty(item.key, 1); nudgeCloud(); }}>
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
            <div className="mt-4 flex items-end justify-between">
              <p className="text-sm text-muted-foreground">{totals.qty} item</p>
              <p className="font-display text-2xl tabular-nums">{formatIDR(totals.total)}</p>
            </div>
            <p className="mt-3 rounded-[18px] glass px-3 py-2 text-center text-sm">Serahkan ke kasir untuk bayar. Jangan tutup halaman ini.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
