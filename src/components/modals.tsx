import { useEffect, useState } from "react";
import { MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProductIcon } from "@/components/icon-map";
import { ADDONS } from "@/data/seed";
import { toast } from "sonner";
import { formatIDR, formatTimeID, uid } from "@/lib/format";
import { compressMenuPhoto, MENU_LIBRARY, menuPhoto } from "@/lib/menu-photos";
import { usePos } from "@/lib/store";
import { runCloudSync } from "@/components/cloud-sync";
import type { PaymentMethod, Product, Quadrant } from "@/lib/types";
import { DISCOUNT_PRESETS } from "@/lib/types";
import { PinPad } from "@/components/pin-pad";
import { alertWaText, openWhatsAppGroup, receiptWaText, sendWhatsApp } from "@/lib/whatsapp";
import { printBluetooth, printSystem } from "@/lib/print-receipt";

export function PinModal() {
  const open = usePos((s) => s.pinOpen);
  const confirmPin = usePos((s) => s.confirmPin);
  const closePin = usePos((s) => s.closePin);
  const [buf, setBuf] = useState("");
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setBuf("");
      setErr("");
    }
  }, [open]);

  useEffect(() => {
    if (buf.length === 4) {
      const ok = confirmPin(buf);
      if (!ok) {
        setErr("PIN salah");
        setTimeout(() => setBuf(""), 400);
      }
    }
  }, [buf, confirmPin]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closePin()}>
      <DialogContent title="Otorisasi Owner" className="max-w-xs">
        <p className="mb-4 text-center text-sm text-muted-foreground">Masukkan PIN admin 4 digit</p>
        <p className="mb-3 min-h-5 text-center text-xs text-destructive">{err}</p>
        <PinPad value={buf} onChange={setBuf} show={show} onToggleShow={() => setShow((v) => !v)} />
        <p className="mt-4 text-center text-xs text-muted-foreground">Akses owner. PIN diatur di Akun Staf.</p>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentModal() {
  const open = usePos((s) => s.paymentOpen);
  const setOpen = usePos((s) => s.setPaymentOpen);
  const totals = usePos((s) => s.totals);
  const checkout = usePos((s) => s.checkout);
  const openBillId = usePos((s) => s.openBillId);
  const orders = usePos((s) => s.orders);
  const table = usePos((s) => s.table);
  const customer = usePos((s) => s.customer);
  const t = totals();
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [tendered, setTendered] = useState(0);
  const editing = orders.find((o) => o.id === openBillId && o.status === "open");

  useEffect(() => {
    if (open) {
      setMethod("Cash");
      setTendered(t.total);
    }
    // hanya saat buka modal — jangan reset saat total berubah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const change = method === "Cash" ? Math.max(0, tendered - t.total) : 0;
  const methods: PaymentMethod[] = ["Cash", "QRIS", "Debit", "Transfer"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title={editing ? "Tutup open bill" : "Pembayaran"} className="max-w-md">
        <div className="mb-4 rounded-lg bg-muted px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {editing
              ? `${editing.number}${editing.table !== "-" ? ` · meja ${editing.table}` : ""} · ${editing.customer}`
              : customer || table
                ? `${table ? `Meja ${table}` : ""} ${customer}`.trim()
                : "Total tagihan"}
          </p>
          <p className="font-mono text-2xl font-medium tabular-nums text-primary">{formatIDR(t.total)}</p>
        </div>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {methods.map((m) => (
            <Button key={m} variant={method === m ? "default" : "secondary"} size="sm" onClick={() => setMethod(m)}>
              {m}
            </Button>
          ))}
        </div>
        {method === "Cash" && (
          <div className="mb-4 space-y-2">
            <label className="text-xs text-muted-foreground">Uang diterima</label>
            <Input
              type="number"
              value={tendered || ""}
              onChange={(e) => setTendered(Number(e.target.value))}
              className="font-mono"
            />
            <div className="flex flex-wrap gap-2">
              {[t.total, 50000, 100000, 150000, 200000].map((n) => (
                <Button key={n} size="sm" variant="outline" onClick={() => setTendered(n)}>
                  {n === t.total ? "Uang pas" : formatIDR(n)}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Kembalian <span className="font-mono text-foreground">{formatIDR(change)}</span>
            </p>
          </div>
        )}
        <Button
          className="w-full"
          size="lg"
          disabled={method === "Cash" && tendered < t.total}
          onClick={() => checkout(method, tendered)}
        >
          Konfirmasi {editing ? "tutup bill" : "bayar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function ReceiptModal() {
  const open = usePos((s) => s.receiptOpen);
  const setOpen = usePos((s) => s.setReceiptOpen);
  const order = usePos((s) => s.lastReceipt);
  const waOwner = usePos((s) => s.waOwner);
  const waOwnerMode = usePos((s) => s.waOwnerMode);
  const [busy, setBusy] = useState(false);
  if (!order) return null;
  const sendWa = async (group: boolean) => {
    const text = receiptWaText(order);
    const ok = group || waOwnerMode === "group" ? await openWhatsAppGroup(text) : await sendWhatsApp({ mode: "number", phone: waOwner }, text);
    if (!ok) toast.error("Isi nomor WhatsApp owner di Akun Staf, atau ketuk WA grup.");
  };
  const bt = async () => {
    setBusy(true);
    try {
      const via = await printBluetooth(order);
      toast.success(via === "rawbt" ? "Mengirim ke printer Bluetooth (RawBT)." : "Terkirim ke printer BLE.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal cetak Bluetooth.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title={order.status === "open" ? "Open bill" : "Struk"} className="max-w-sm">
        <div id="thermal-receipt" className="rounded-md bg-foreground p-4 font-mono text-xs text-background">
          <div className="text-center">
            <p className="font-display text-base font-semibold">HVEN SPACE</p>
            <p>Cafe & Experience Hub</p>
            <p className="mt-1">{order.number}</p>
            <p>{formatTimeID(order.createdAt)}</p>
            {order.status === "open" && <p className="mt-1 font-semibold">OPEN BILL · BELUM LUNAS</p>}
          </div>
          <div className="my-2 border-t border-dashed border-background/30" />
          <p>
            {order.type} {order.table !== "-" ? `• Meja ${order.table}` : ""} • {order.customer}
          </p>
          <div className="my-2 space-y-1">
            {order.items.map((it) => (
              <div key={it.key} className="flex justify-between gap-2">
                <span>
                  {it.qty}× {it.name}
                </span>
                <span>{formatIDR((it.price + it.addons.reduce((s, a) => s + a.price, 0)) * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-background/30 pt-2 space-y-0.5">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatIDR(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between">
                <span>Diskon {order.discountLabel}{order.discountReason ? ` · ${order.discountReason}` : ""}</span>
                <span>-{formatIDR(order.discount)}</span>
              </div>
            )}
            {(order.service ?? 0) > 0 && (
              <div className="flex justify-between">
                <span>Service 5%</span>
                <span>{formatIDR(order.service ?? 0)}</span>
              </div>
            )}
            {order.taxExempt ? (
              <div className="flex justify-between">
                <span>PB1 dibebaskan</span>
                <span>Rp 0</span>
              </div>
            ) : order.tax > 0 ? (
              <div className="flex justify-between">
                <span>PB1 10%</span>
                <span>{formatIDR(order.tax)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-sm font-semibold">
              <span>TOTAL</span>
              <span>{formatIDR(order.total)}</span>
            </div>
            {order.status === "open" ? (
              <div className="flex justify-between">
                <span>Status</span>
                <span>Belum lunas</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span>{order.payment}</span>
                <span>{formatIDR(order.tendered)}</span>
              </div>
            )}
            {order.change > 0 && (
              <div className="flex justify-between">
                <span>Kembali</span>
                <span>{formatIDR(order.change)}</span>
              </div>
            )}
          </div>
          <p className="mt-3 text-center">Kasir {order.cashier}</p>
          <p className="text-center">Terima kasih</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button className="h-12" disabled={busy} onClick={bt}>
            <Printer className="size-4" /> Bluetooth
          </Button>
          <Button className="h-12" variant="secondary" onClick={printSystem}>
            Cetak dialog
          </Button>
          {waOwnerMode === "number" ? (
            <Button variant="outline" onClick={() => void sendWa(false)}>
              <MessageCircle className="size-4" /> WA
            </Button>
          ) : null}
          <Button
            variant="outline"
            className={waOwnerMode === "group" ? "col-span-2" : ""}
            onClick={() => void sendWa(true)}
          >
            <MessageCircle className="size-4" /> WA grup
          </Button>
          <Button className="col-span-2" variant="ghost" onClick={() => setOpen(false)}>
            Tutup
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Tablet Android: pairing printer di Bluetooth, instal RawBT, lalu ketuk Bluetooth. WA grup buka WhatsApp — pilih grup owner/dapur, struk sudah terisi.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function ModifierModal() {
  const product = usePos((s) => s.productModal);
  const setProductModal = usePos((s) => s.setProductModal);
  const addToCart = usePos((s) => s.addToCart);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    setPicked([]);
    setNote("");
  }, [product?.id]);

  return (
    <Dialog open={!!product} onOpenChange={(v) => !v && setProductModal(null)}>
      <DialogContent title={product?.name ?? "Modifier"}>
        {product && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-primary">
                <ProductIcon name={product.icon} className="size-5" />
              </div>
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="font-mono text-sm text-primary">{formatIDR(product.price)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ADDONS.map((a) => {
                const on = picked.includes(a.id);
                return (
                  <Button
                    key={a.id}
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                  >
                    {a.name} {a.price ? `+${formatIDR(a.price)}` : ""}
                  </Button>
                );
              })}
            </div>
            <Input placeholder="Catatan dapur (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button
              className="w-full"
              onClick={() => {
                addToCart(
                  product,
                  ADDONS.filter((a) => picked.includes(a.id)),
                  note,
                );
                setProductModal(null);
              }}
            >
              Tambah ke keranjang
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProductFormModal() {
  const open = usePos((s) => s.productFormOpen);
  const setOpen = usePos((s) => s.setProductFormOpen);
  const editing = usePos((s) => s.editingProduct);
  const upsert = usePos((s) => s.upsertProduct);
  const inventory = usePos((s) => s.inventory);
  const setProductRecipes = usePos((s) => s.setProductRecipes);
  const setEditingProduct = usePos((s) => s.setEditingProduct);
  const menuCategories = usePos((s) => s.menuCategories);
  const addMenuCategory = usePos((s) => s.addMenuCategory);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [cat, setCat] = useState("Coffee");
  const [newCat, setNewCat] = useState("");
  const [price, setPrice] = useState(25000);
  const [cogs, setCogs] = useState(7000);
  const [stock, setStock] = useState(20);
  const [kitchen, setKitchen] = useState(true);
  const [image, setImage] = useState("");
  const [blurb, setBlurb] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [lines, setLines] = useState<{ ingredientId: string; qty: number }[]>([]);
  const editingId = editing?.id ?? "";

  useEffect(() => {
    if (!open) return;
    const cur = usePos.getState().editingProduct;
    const rec = usePos.getState().recipes;
    if (cur) {
      setId(cur.id);
      setName(cur.name);
      setCat(cur.category);
      setPrice(cur.price);
      setCogs(cur.cogs);
      setStock(cur.stock);
      setKitchen(cur.kitchen);
      setImage(cur.image ?? "");
      setBlurb(cur.blurb ?? "");
      setLines(rec.filter((r) => r.productId === cur.id).map((r) => ({ ingredientId: r.ingredientId, qty: r.qty })));
    } else {
      setId(uid("m"));
      setName("");
      setCat("Coffee");
      setPrice(25000);
      setCogs(7000);
      setStock(20);
      setKitchen(true);
      setImage("");
      setBlurb("");
      setLines([]);
    }
    setNewCat("");
  }, [open, editingId]);

  const recipeCost = lines.reduce((s, l) => {
    const ing = inventory.find((i) => i.id === l.ingredientId);
    return s + (ing ? ing.cost * l.qty : 0);
  }, 0);

  const close = (v: boolean) => {
    if (!v) setEditingProduct(null);
    setOpen(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={editing ? `Edit ${editing.name}` : "Menu baru"} className="max-w-lg">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const p: Product = {
              id,
              name,
              category: cat,
              sku: editing?.sku ?? `HVN-X${Date.now().toString().slice(-4)}`,
              price,
              cogs,
              margin: price ? (price - cogs) / price : 0,
              stock,
              available: editing?.available ?? true,
              icon: editing?.icon ?? "Coffee",
              soldQty: editing?.soldQty ?? 0,
              quadrant: editing?.quadrant ?? ("Puzzle" as Quadrant),
              recommendation: editing?.recommendation ?? "Menu baru — pantau penjualan 2 minggu",
              kitchen,
              image: image || undefined,
              blurb: blurb.trim() || undefined,
            };
            upsert(p);
            setProductRecipes(
              id,
              lines.map((l) => ({ productId: id, ingredientId: l.ingredientId, qty: l.qty })),
            );
            setEditingProduct(null);
            setOpen(false);
            toast.success("Menu disimpan. Menyinkronkan…");
            void runCloudSync("local");
          }}
        >
          <Input required placeholder="Nama menu" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Deskripsi singkat di tablet tamu (opsional)" value={blurb} onChange={(e) => setBlurb(e.target.value)} />
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Foto menu tamu</p>
            <p className="text-xs text-muted-foreground">Tampil di tablet /pesan. Unggah foto sendiri atau pilih galeri HVEN.</p>
            <div className="flex gap-3">
              <img
                src={image || menuPhoto({ name, category: cat, image })}
                alt=""
                className="size-24 rounded-lg object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                  {photoBusy ? "Memproses…" : "Pilih dari galeri"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={photoBusy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      setPhotoBusy(true);
                      try {
                        const raw = await new Promise<string>((resolve, reject) => {
                          const r = new FileReader();
                          r.onload = () => resolve(String(r.result));
                          r.onerror = () => reject(new Error("Gagal baca file"));
                          r.readAsDataURL(file);
                        });
                        setImage(await compressMenuPhoto(raw));
                        toast.success("Foto siap. Simpan menu supaya tampil di tamu.");
                      } catch {
                        toast.error("Foto gagal diproses.");
                      } finally {
                        setPhotoBusy(false);
                      }
                    }}
                  />
                </label>
                <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-border px-3 text-sm font-medium">
                  Ambil kamera
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={photoBusy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      setPhotoBusy(true);
                      try {
                        const raw = await new Promise<string>((resolve, reject) => {
                          const r = new FileReader();
                          r.onload = () => resolve(String(r.result));
                          r.onerror = () => reject(new Error("Gagal baca file"));
                          r.readAsDataURL(file);
                        });
                        setImage(await compressMenuPhoto(raw));
                        toast.success("Foto siap. Simpan menu supaya tampil di tamu.");
                      } catch {
                        toast.error("Foto gagal diproses.");
                      } finally {
                        setPhotoBusy(false);
                      }
                    }}
                  />
                </label>
                {image ? (
                  <Button type="button" variant="ghost" className="h-11" onClick={() => setImage("")}>
                    Pakai foto otomatis
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {MENU_LIBRARY.map((shot) => (
                <button
                  key={shot.id}
                  type="button"
                  title={shot.label}
                  onClick={() => setImage(shot.src)}
                  className={`overflow-hidden rounded-md border ${image === shot.src ? "border-primary" : "border-border"}`}
                >
                  <img src={shot.src} alt={shot.label} className="aspect-[3/4] w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Kategori</label>
            <select
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            >
              {(menuCategories.includes(cat) ? menuCategories : [cat, ...menuCategories].filter(Boolean)).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Input
                className="h-12"
                placeholder="Kategori baru, mis. Matcha"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                className="h-12 shrink-0"
                onClick={() => {
                  const err = addMenuCategory(newCat);
                  if (err) {
                    toast.error(err);
                    return;
                  }
                  const n = newCat.trim().replace(/\s+/g, " ");
                  setCat(n);
                  setNewCat("");
                  toast.success(`Kategori ${n} ditambah.`);
                }}
              >
                Tambah
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-muted-foreground">
              Harga jual
              <Input className="mt-1" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </label>
            <label className="text-xs text-muted-foreground">
              COGS
              <Input className="mt-1" type="number" value={cogs} onChange={(e) => setCogs(Number(e.target.value))} />
            </label>
            <label className="text-xs text-muted-foreground">
              Stok porsi
              <Input className="mt-1" type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={kitchen} onChange={(e) => setKitchen(e.target.checked)} />
            Masuk ke KDS
          </label>
          <p className="text-xs text-muted-foreground">Harga baru hanya berlaku di penjualan berikutnya. Struk 8–9 Sep tidak berubah.</p>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Resep → inventory</p>
              <span className="font-mono text-xs text-muted-foreground">HPP resep {formatIDR(recipeCost)}</span>
            </div>
            {lines.map((l, i) => {
              const ing = inventory.find((x) => x.id === l.ingredientId);
              return (
                <div key={`${l.ingredientId}-${i}`} className="grid grid-cols-6 gap-2">
                  <select
                    className="col-span-3 h-9 rounded-md border border-input bg-background px-2 text-xs"
                    value={l.ingredientId}
                    onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, ingredientId: e.target.value } : x)))}
                  >
                    {inventory.map((ingOpt) => (
                      <option key={ingOpt.id} value={ingOpt.id}>
                        {ingOpt.name} ({ingOpt.unit})
                      </option>
                    ))}
                  </select>
                  <Input
                    className="col-span-2 h-9"
                    type="number"
                    step="0.001"
                    value={Number(l.qty.toFixed(4))}
                    onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))}
                  />
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}>
                    ×
                  </Button>
                  {ing && (
                    <p className="col-span-6 -mt-1 text-[11px] text-muted-foreground">
                      Stok {ing.stock} {ing.unit} · {formatIDR(ing.cost * l.qty)} / porsi
                    </p>
                  )}
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setLines((prev) => [...prev, { ingredientId: inventory[0]?.id ?? "inv1", qty: 0.01 }])}
              >
                Tambah bahan
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setCogs(Math.round(recipeCost))} disabled={!recipeCost}>
                Pakai HPP resep
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full">
            {editing ? "Simpan perubahan" : "Simpan menu"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NotifCenter({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const items = usePos((s) => s.notifications);
  const waOwner = usePos((s) => s.waOwner);
  const waOwnerMode = usePos((s) => s.waOwnerMode);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Notifikasi owner" className="max-w-md">
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada notifikasi</p>}
          {items.map((n) => (
            <div key={n.id} className="rounded-md border border-border bg-muted/50 p-3">
              <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-primary">{n.title}</span>
                <span className="font-mono">{n.time}</span>
              </div>
              <p className="mt-1 text-sm">{n.message}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    void sendWhatsApp({ mode: waOwnerMode, phone: waOwner }, alertWaText(n.title, n.message)).then((ok) => {
                      if (!ok) toast.error("Isi nomor WhatsApp owner di Akun Staf, atau ketuk WA grup.");
                    });
                  }}
                >
                  <MessageCircle className="size-3.5" /> {waOwnerMode === "group" ? "WA grup" : "Kirim WA"}
                </Button>
                {waOwnerMode === "number" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => void openWhatsAppGroup(alertWaText(n.title, n.message))}
                  >
                    WA grup
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DiscountModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const setDiscount = usePos((s) => s.setDiscount);
  const totals = usePos((s) => s.totals)();
  const [mode, setMode] = useState<"rp" | "pct">("rp");
  const [val, setVal] = useState(0);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Diskon struk">
        <p className="mb-3 text-xs text-muted-foreground">Hanya untuk bill berjalan. Transaksi spreadsheet 8–9 Sep tidak diubah.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {DISCOUNT_PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant="secondary"
              onClick={() => {
                setMode("pct");
                setVal(p.pct);
                setReason(p.reason);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="mb-3 flex gap-2">
          <Button size="sm" variant={mode === "rp" ? "default" : "secondary"} onClick={() => setMode("rp")}>
            Rupiah
          </Button>
          <Button size="sm" variant={mode === "pct" ? "default" : "secondary"} onClick={() => setMode("pct")}>
            Persen
          </Button>
        </div>
        <Input type="number" value={val || ""} onChange={(e) => setVal(Number(e.target.value))} placeholder={mode === "pct" ? "Contoh 10" : "Nominal"} />
        <Input className="mt-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan (promo, member, staf…)" />
        <p className="mt-2 text-xs text-muted-foreground">
          Potongan {formatIDR(mode === "pct" ? Math.round((totals.subtotal * val) / 100) : val)} dari subtotal {formatIDR(totals.subtotal)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setDiscount(0, "", "");
              onOpenChange(false);
            }}
          >
            Hapus diskon
          </Button>
          <Button
            onClick={() => {
              const amount = mode === "pct" ? Math.round((totals.subtotal * val) / 100) : val;
              const label = mode === "pct" ? `${val}%` : formatIDR(amount);
              setDiscount(amount, label, reason || label);
              onOpenChange(false);
            }}
          >
            Terapkan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
