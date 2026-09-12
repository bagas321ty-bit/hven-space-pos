import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { runCloudSync } from "@/components/cloud-sync";
import { ADDONS } from "@/data/seed";
import { formatIDR } from "@/lib/format";
import { menuBlurb, menuPhoto } from "@/lib/menu-photos";
import { usePos } from "@/lib/store";
import { PAYMENT_METHODS, SERVICE_RATE, TAX_RATE, type Addon, type CartItem, type OrderType, type PaymentMethod, type Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import "@/styles-guest.css";

const ICE = ["Normal ice", "Less ice", "No ice"] as const;
const SUGAR = ["Normal sugar", "Less sugar", "No sugar"] as const;

export function GuestMenu() {
  const products = usePos((s) => s.products);
  const cats = usePos((s) => s.menuCategories);
  const taxEnabled = usePos((s) => s.taxEnabled);
  const serviceFlag = usePos((s) => s.serviceEnabled);
  const submitGuestOrder = usePos((s) => s.submitGuestOrder);
  const orders = usePos((s) => s.orders);
  const [bag, setBag] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("Dine In");
  const [table, setTable] = useState("01");
  const [guestName, setGuestName] = useState("");
  const [pay, setPay] = useState<PaymentMethod>("QRIS");
  const [waitId, setWaitId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Semua");
  const [pick, setPick] = useState<Product | null>(null);
  const [tray, setTray] = useState(false);
  const [ice, setIce] = useState<(typeof ICE)[number]>("Normal ice");
  const [sugar, setSugar] = useState<(typeof SUGAR)[number]>("Normal sugar");
  const [note, setNote] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [bump, setBump] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const qty = bag.reduce((s, c) => s + c.qty, 0);
    if (!qty) return;
    setBump((n) => n + 1);
  }, [bag]);

  const waitOrder = waitId ? orders.find((o) => o.id === waitId) : undefined;

  useEffect(() => {
    const lock = (screen.orientation as ScreenOrientation & { lock?: (m: string) => Promise<void> }).lock;
    void lock?.call(screen.orientation, "landscape").catch(() => undefined);
  }, []);

  const categories = ["Semua", ...(cats.length ? cats : [...new Set(products.map((p) => p.category))])];
  const list = useMemo(() => {
    return products.filter((p) => {
      if (cat !== "Semua" && p.category !== cat) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [products, cat, q]);

  useEffect(() => {
    const stage = stageRef.current;
    const root = stage ?? window;
    const onScroll = () => {
      const y = stage ? stage.scrollTop : window.scrollY;
      stage?.style.setProperty("--gk-scroll", String(y));
      stage?.parentElement?.style.setProperty("--gk-scroll", String(y));
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.classList.add("in-view");
      },
      { root: stage ?? null, threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
    );
    gridRef.current?.querySelectorAll(".menu-card").forEach((el) => io.observe(el));
    return () => {
      root.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, [list]);

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
    const noteText = bits.join(" · ");
    const key = `${pick.id}-${addons.map((a) => a.id).join(",")}-${noteText}`;
    setBag((prev) => {
      const hit = prev.find((c) => c.key === key);
      if (hit) return prev.map((c) => (c.key === key ? { ...c, qty: c.qty + 1 } : c));
      return [
        {
          key,
          productId: pick.id,
          name: pick.name,
          price: pick.price,
          cogs: pick.cogs,
          qty: 1,
          addons,
          note: noteText,
          kitchen: pick.kitchen,
        },
        ...prev,
      ];
    });
    toast.success(`${pick.name} masuk pesanan`);
    setPick(null);
  };

  const qty = bag.reduce((s, c) => s + c.qty, 0);
  const subtotal = bag.reduce((s, c) => s + (c.price + c.addons.reduce((a, x) => a + x.price, 0)) * c.qty, 0);
  const serviceOn = orderType === "Dine In" && serviceFlag;
  const service = serviceOn ? Math.round(subtotal * SERVICE_RATE) : 0;
  const tax = taxEnabled ? Math.round((subtotal + service) * TAX_RATE) : 0;
  const total = subtotal + service + tax;

  const sendToPos = () => {
    if (!bag.length) {
      toast.error("Keranjang masih kosong.");
      return;
    }
    if (!guestName.trim()) {
      toast.error("Tulis nama dulu.");
      return;
    }
    const res = submitGuestOrder({
      customer: guestName,
      payment: pay,
      type: orderType,
      table,
      items: bag,
    });
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setWaitId(res.order.id);
    setBag([]);
    setTray(true);
    void runCloudSync("local");
    toast.success("Menunggu kasir konfirmasi bayar.");
  };

  const extraSum = ADDONS.filter((a) => extras.includes(a.id)).reduce((s, a) => s + a.price, 0);

  return (
    <div className="guest-kiosk">
      <div className="gk-orb" aria-hidden />
      <p className="rotate-hint glass mx-4 mt-3 justify-center rounded-full px-4 py-2 text-center text-xs text-muted-foreground">
        Putar tablet ke landscape untuk tampilan penuh.
      </p>
      <aside className="guest-rail relative z-10 px-4 pb-2 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <div className="mb-3 hidden px-1 landscape:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">HVEN Space</p>
          <p className="text-sm font-semibold">Menu</p>
        </div>
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
      </aside>

      <div ref={stageRef} id="guest-stage" className="guest-stage relative z-10 min-w-0">
        <header className="sticky top-0 z-30 px-4 pb-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
          <div className="glass mx-auto flex max-w-6xl items-center gap-3 rounded-full px-4 py-2">
            <div className="min-w-0 flex-1 landscape:hidden">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">HVEN Space</p>
              <p className="truncate text-base font-semibold leading-tight">Digital menu</p>
            </div>
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari menu"
                className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </label>
            <button type="button" onClick={() => setTray(true)} className="glass relative grid size-11 place-items-center rounded-full">
              <ShoppingBag className="size-4" />
              {qty > 0 ? (
                <span key={bump} className="cta badge-pop absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full px-1 text-[10px] tabular-nums">
                  {qty}
                </span>
              ) : null}
            </button>
          </div>
        </header>

        <main ref={gridRef} className="guest-grid mx-auto max-w-6xl px-4 pb-32">
          {list.map((p) => {
            const sold = !p.available || p.stock <= 0;
            return (
              <article key={`${cat}-${q}-${p.id}`} className="glass menu-card group overflow-hidden rounded-[22px]">
                <button type="button" onClick={() => openPick(p)} disabled={sold} className="block w-full text-left disabled:opacity-40">
                  <div className="relative aspect-[4/3] overflow-hidden bg-black/25">
                    <img src={menuPhoto(p)} alt="" className="size-full object-cover" />
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-1 text-sm font-semibold leading-tight">{p.name}</p>
                    <p className="line-clamp-2 min-h-8 text-[11px] leading-snug text-muted-foreground">{menuBlurb(p)}</p>
                    <p className="price-glow text-sm font-semibold tabular-nums">{formatIDR(p.price)}</p>
                  </div>
                </button>
                <div className="px-3 pb-3">
                  <button type="button" disabled={sold} onClick={() => openPick(p)} className={cn("cta h-9 w-full rounded-full text-sm", sold && "opacity-40")}>
                    {sold ? "Habis" : "Add"}
                  </button>
                </div>
              </article>
            );
          })}
        </main>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto glass-deep dock-in mx-auto flex max-w-3xl items-center gap-3 rounded-[22px] p-2.5 pl-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">{qty} item</p>
            <p className="truncate text-lg font-semibold tabular-nums leading-tight">{formatIDR(total)}</p>
          </div>
          <button type="button" className="cta h-11 shrink-0 rounded-full px-4 text-sm" onClick={() => setTray(true)}>
            Lanjut bayar
          </button>
        </div>
      </div>

      {pick ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/55 veil landscape:items-stretch landscape:justify-end" onClick={() => setPick(null)}>
          <div
            className="glass-deep sheet-in max-h-[88dvh] w-full overflow-auto rounded-t-[28px] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 landscape:hidden" />
            <div className="flex gap-3">
              <img src={menuPhoto(pick)} alt="" className="size-24 rounded-2xl object-cover landscape:size-36" />
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
        <div className="fixed inset-0 z-40 flex items-end bg-black/55 veil landscape:items-stretch landscape:justify-end" onClick={() => setTray(false)}>
          <div
            className="glass-deep sheet-in max-h-[80dvh] w-full overflow-auto rounded-t-[28px] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {waitOrder?.status === "paid" ? "Pesanan diterima" : waitOrder ? "Menunggu kasir" : "Pesanan kamu"}
              </h2>
              <button type="button" className="glass grid size-11 place-items-center rounded-full" onClick={() => setTray(false)}>
                <X className="size-4" />
              </button>
            </div>
            {waitOrder?.status === "paid" ? (
              <p className="mt-6 text-center text-sm">Kasir sudah konfirmasi. Pesanan masuk dapur.</p>
            ) : waitOrder?.status === "void" ? (
              <p className="mt-6 text-center text-sm text-destructive">Pesanan dibatalkan kasir.</p>
            ) : waitOrder ? (
              <div className="mt-6 space-y-2 text-center">
                <p className="font-mono text-lg">{waitOrder.number}</p>
                <p className="text-sm text-muted-foreground">
                  {waitOrder.customer} · {waitOrder.payment} · {formatIDR(waitOrder.total)}
                </p>
                <p className="text-sm">Bayar di kasir. Tunggu konfirmasi.</p>
              </div>
            ) : (
              <>
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
              {bag.length === 0 ? (
                <li className="py-8 text-center text-sm text-muted-foreground">Keranjang kosong.</li>
              ) : (
                bag.map((item) => (
                  <li key={item.key} className="glass flex items-center gap-3 rounded-2xl p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">{item.name}</p>
                      {item.note ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}
                      <p className="price-glow text-xs font-medium tabular-nums">{formatIDR((item.price + item.addons.reduce((s, a) => s + a.price, 0)) * item.qty)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" className="glass grid size-11 place-items-center rounded-full" onClick={() => setBag((xs) => xs.map((c) => (c.key === item.key ? { ...c, qty: c.qty - 1 } : c)).filter((c) => c.qty > 0))}>
                        <Minus className="size-4" />
                      </button>
                      <span className="w-6 text-center tabular-nums">{item.qty}</span>
                      <button type="button" className="glass grid size-11 place-items-center rounded-full" onClick={() => setBag((xs) => xs.map((c) => (c.key === item.key ? { ...c, qty: c.qty + 1 } : c)))}>
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <button type="button" className="text-xs text-destructive" onClick={() => setBag((xs) => xs.filter((c) => c.key !== item.key))}>
                      Hapus
                    </button>
                  </li>
                ))
              )}
            </ul>
            <Input className="glass mt-4 h-11 rounded-2xl bg-transparent" placeholder="Nama kamu" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Metode bayar</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button key={m} type="button" onClick={() => setPay(m)} className={cn("glass h-11 rounded-full text-sm", pay === m && "glass-hot")}>
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-3 text-right font-semibold tabular-nums">{formatIDR(total)}</p>
            <button type="button" className="cta mt-4 h-12 w-full rounded-full text-base" onClick={sendToPos}>
              Kirim ke kasir
            </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
