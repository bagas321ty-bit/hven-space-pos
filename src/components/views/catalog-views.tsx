import { useState } from "react";
import { Eye, EyeOff, Pencil, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatIDR } from "@/lib/format";
import { compressMenuPhoto, menuPhoto } from "@/lib/menu-photos";
import { FILL_META, FILL_ORDER, fillFromStock, isIngredientLow, jarFullQty, qtyLabel, stockFromFill } from "@/lib/inventory";
import { usePos } from "@/lib/store";
import { runCloudSync } from "@/components/cloud-sync";
import type { FillLevel, Ingredient, Staff } from "@/lib/types";
import { alertWaText, sendWhatsApp, toWaPhone, type WaMode } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export function ProductsView() {
  const products = usePos((s) => s.products);
  const recipes = usePos((s) => s.recipes);
  const menuCategories = usePos((s) => s.menuCategories);
  const upsert = usePos((s) => s.upsertProduct);
  const del = usePos((s) => s.deleteProduct);
  const setForm = usePos((s) => s.setProductFormOpen);
  const setEditing = usePos((s) => s.setEditingProduct);
  const addMenuCategory = usePos((s) => s.addMenuCategory);
  const renameMenuCategory = usePos((s) => s.renameMenuCategory);
  const removeMenuCategory = usePos((s) => s.removeMenuCategory);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("Semua");
  const [newCat, setNewCat] = useState("");
  const [renameTo, setRenameTo] = useState("");

  const rows = products.filter((p) => {
    if (catFilter !== "Semua" && p.category !== catFilter) return false;
    const s = q.toLowerCase();
    return !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
  });
  const catCount = (c: string) => products.filter((p) => p.category === c).length;
  const selectedCount = catFilter === "Semua" ? products.length : catCount(catFilter);

  const openEdit = (p: (typeof products)[0] | null) => {
    setEditing(p);
    setForm(true);
  };

  const addCat = () => {
    const err = addMenuCategory(newCat);
    if (err) {
      toast.error(err);
      return;
    }
    const n = newCat.trim().replace(/\s+/g, " ");
    setCatFilter(n);
    setRenameTo(n);
    setNewCat("");
    toast.success(`Kategori ${n} tampil di POS. Tambah menunya kapan saja.`);
  };

  const saveRename = () => {
    if (catFilter === "Semua") return;
    const err = renameMenuCategory(catFilter, renameTo);
    if (err) {
      toast.error(err);
      return;
    }
    const n = renameTo.trim().replace(/\s+/g, " ");
    setCatFilter(n);
    setRenameTo(n);
    toast.success(`Kategori jadi ${n}. Menu lama ikut pindah.`);
  };

  const dropCat = () => {
    if (catFilter === "Semua") return;
    const err = removeMenuCategory(catFilter);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(`Kategori ${catFilter} dihapus.`);
    setCatFilter("Semua");
    setRenameTo("");
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">Manajemen Produk</h2>
          <p className="text-sm text-muted-foreground">
            Tambah menu dan ganti foto di sini. Tablet tamu (/pesan) ikut berubah setelah Tersinkron.
          </p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Cari menu / SKU" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 w-48" />
          <Button className="h-12" onClick={() => openEdit(null)}>
            Tambah menu
          </Button>
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-2">
          <Tags className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <h3 className="font-medium">Kategori menu</h3>
            <p className="text-sm text-muted-foreground">
              Tambah Matcha dulu — chip-nya langsung muncul di kasir, meski belum ada menunya.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCatFilter("Semua");
              setRenameTo("");
            }}
            className={cn(
              "h-11 shrink-0 rounded-full px-4 text-sm font-medium",
              catFilter === "Semua" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            Semua · {products.length}
          </button>
          {menuCategories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCatFilter(c);
                setRenameTo(c);
              }}
              className={cn(
                "h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                catFilter === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {c} · {catCount(c)}
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addCat();
          }}
        >
          <Input
            className="h-12 min-w-48 flex-1"
            placeholder="Kategori baru, mis. Matcha"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
          />
          <Button type="submit" className="h-12">
            Tambah kategori
          </Button>
        </form>
        {catFilter !== "Semua" && (
          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <label className="min-w-48 flex-1 space-y-1 text-xs text-muted-foreground">
              Ubah nama {catFilter}
              <Input className="h-12 text-sm text-foreground" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
            </label>
            <Button type="button" variant="secondary" className="h-12" onClick={saveRename}>
              Simpan nama
            </Button>
            <Button type="button" variant="destructive" className="h-12" onClick={dropCat} disabled={selectedCount > 0}>
              Hapus
            </Button>
            {selectedCount > 0 && (
              <p className="w-full text-xs text-muted-foreground">{selectedCount} menu masih di sini. Pindahkan atau hapus menunya dulu.</p>
            )}
          </div>
        )}
      </section>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              {["Produk", "Kategori", "Harga", "COGS", "Resep", "Stok", "Status", ""].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {catFilter !== "Semua" && selectedCount === 0
                    ? `Belum ada menu ${catFilter}. Tekan Tambah menu.`
                    : "Menu tidak ditemukan"}
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const n = recipes.filter((r) => r.productId === p.id).length;
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-md">
                        <img src={menuPhoto(p)} alt="" className="size-10 object-cover" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            try {
                              const raw = await new Promise<string>((resolve, reject) => {
                                const r = new FileReader();
                                r.onload = () => resolve(String(r.result));
                                r.onerror = () => reject(new Error("gagal"));
                                r.readAsDataURL(file);
                              });
                              upsert({ ...p, image: await compressMenuPhoto(raw) });
                              toast.success(`Foto ${p.name} disimpan.`);
                              void runCloudSync("local");
                            } catch {
                              toast.error("Foto gagal.");
                            }
                          }}
                        />
                      </label>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                        {p.blurb ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.blurb}</p> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">{p.category}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{formatIDR(p.price)}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">{formatIDR(p.cogs)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={n ? "success" : "warning"}>{n ? `${n} bahan` : "Belum"}</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono">{p.stock}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => upsert({ ...p, available: !p.available })} className="text-left">
                      <Badge tone={p.available ? "success" : "muted"}>{p.available ? "Ready" : "Habis"}</Badge>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          del(p.id);
                          toast.success(`${p.name} dihapus.`);
                          void runCloudSync("local");
                        }}
                      >
                        Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InventoryView() {
  const inventory = usePos((s) => s.inventory);
  const recipes = usePos((s) => s.recipes);
  const products = usePos((s) => s.products);
  const addIngredient = usePos((s) => s.addIngredient);
  const updateIngredient = usePos((s) => s.updateIngredient);
  const commitOpname = usePos((s) => s.commitOpname);
  const [levelDraft, setLevelDraft] = useState<Record<string, FillLevel>>({});
  const [form, setForm] = useState({ name: "", sku: "", stock: 0, minStock: 1, unit: "pcs", cost: 0 });
  const [edit, setEdit] = useState<Ingredient | null>(null);
  const lowCount = inventory.filter(isIngredientLow).length;
  const jarOf = (i: Ingredient) => ({ ...i, fullQty: jarFullQty(i) });

  const saveOpname = () => {
    commitOpname(
      inventory.map((i) => {
        const jar = jarOf(i);
        return { id: i.id, stock: stockFromFill(jar, levelDraft[i.id] ?? fillFromStock(jar)) };
      }),
    );
    toast.success("Stok opname tersimpan.");
    setLevelDraft({});
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">Stok opname</h2>
          <p className="text-sm text-muted-foreground">Lihat toples. Jumlah tercatat di samping nama bahan.</p>
        </div>
        <div className="flex items-center gap-2">
          {lowCount > 0 && <Badge tone="danger">{lowCount} bahan tidak aman</Badge>}
          <Button onClick={saveOpname}>Simpan opname</Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {inventory.map((i) => {
          const jar = jarOf(i);
          const fill = levelDraft[i.id] ?? fillFromStock(jar);
          const shown = stockFromFill(jar, fill);
          const low = isIngredientLow({ ...jar, stock: shown, opname: "level" });
          return (
            <div key={i.id} className={`rounded-xl border bg-card p-4 ${low ? "border-destructive/50" : "border-border"}`}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {i.name}
                    <span className="ml-2 font-mono text-sm text-muted-foreground">{qtyLabel(shown, i.unit)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{i.sku}</p>
                </div>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setEdit(i)} aria-label="Atur alert">
                  Atur
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FILL_ORDER.map((lv) => (
                  <Button
                    key={lv}
                    type="button"
                    className="h-12"
                    variant={fill === lv ? "default" : "secondary"}
                    onClick={() => setLevelDraft((d) => ({ ...d, [i.id]: lv }))}
                  >
                    {FILL_META[lv].label}
                  </Button>
                ))}
                <p className="col-span-2 text-xs text-muted-foreground">Alert mulai {FILL_META[i.alertAt ?? "quarter"].label}</p>
              </div>
              {low && <p className="mt-2 text-xs text-destructive">Tidak aman — restock.</p>}
            </div>
          );
        })}
      </div>
      <form
        className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name) return;
          addIngredient({
            id: `inv-${Date.now().toString(36)}`,
            name: form.name,
            sku: form.sku || `ING-${inventory.length + 1}`,
            stock: form.stock,
            minStock: form.minStock,
            unit: form.unit || "pcs",
            cost: form.cost,
            opname: "level",
            fullQty: Math.max(form.stock, 0.1),
            alertAt: "quarter",
          });
          setForm({ name: "", sku: "", stock: 0, minStock: 1, unit: "pcs", cost: 0 });
        }}
      >
        <Input placeholder="Nama bahan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Satuan kg/L/pcs" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        <Input type="number" placeholder="Stok awal" value={form.stock || ""} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
        <Input type="number" placeholder="Alert min" value={form.minStock || ""} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} />
        <Input type="number" placeholder="HPP" value={form.cost || ""} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
        <Button type="submit">Tambah bahan</Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Dipakai resep:{" "}
        {inventory
          .filter((i) => recipes.some((r) => r.ingredientId === i.id))
          .map((i) => {
            const n = recipes.filter((r) => r.ingredientId === i.id).length;
            const names = recipes
              .filter((r) => r.ingredientId === i.id)
              .map((r) => products.find((p) => p.id === r.productId)?.name)
              .filter(Boolean)
              .slice(0, 2);
            return `${i.name} (${n}${names.length ? `: ${names.join(", ")}` : ""})`;
          })
          .join(" · ") || "—"}
      </p>
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent title="Atur alert toples" className="max-w-md">
          {edit && (
            <IngredientSettings
              item={edit}
              onSave={(next) => {
                updateIngredient(next);
                setEdit(null);
                toast.success("Pengaturan bahan disimpan.");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IngredientSettings({ item, onSave }: { item: Ingredient; onSave: (i: Ingredient) => void }) {
  const [minStock, setMinStock] = useState(item.minStock);
  const [alertAt, setAlertAt] = useState<FillLevel>(item.alertAt ?? "quarter");
  const [fullQty, setFullQty] = useState(item.fullQty ?? jarFullQty(item));
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {item.name}
        <span className="ml-2 font-mono text-muted-foreground">{qtyLabel(item.stock, item.unit)}</span>
      </p>
      <label className="block space-y-1 text-sm">
        Isi penuh toples
        <Input type="number" step="0.1" className="h-11" value={fullQty} onChange={(e) => setFullQty(Number(e.target.value))} />
      </label>
      <label className="block space-y-1 text-sm">
        Alert jika stok ≤
        <Input type="number" min={0} className="h-11" value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} />
      </label>
      <div>
        <p className="mb-2 text-sm">Alert mulai (tampilan toples)</p>
        <div className="grid grid-cols-2 gap-2">
          {(["half", "quarter", "empty"] as FillLevel[]).map((lv) => (
            <Button key={lv} type="button" variant={alertAt === lv ? "default" : "secondary"} onClick={() => setAlertAt(lv)}>
              {FILL_META[lv].label}
            </Button>
          ))}
        </div>
      </div>
      <Button
        className="w-full"
        size="lg"
        onClick={() =>
          onSave({
            ...item,
            opname: "level",
            minStock,
            alertAt,
            fullQty,
          })
        }
      >
        Simpan pengaturan
      </Button>
    </div>
  );
}

export function StaffView() {
  const staff = usePos((s) => s.staff);
  const addStaff = usePos((s) => s.addStaff);
  const updateStaff = usePos((s) => s.updateStaff);
  const removeStaff = usePos((s) => s.removeStaff);
  const audit = usePos((s) => s.audit);
  const setAdminPin = usePos((s) => s.setAdminPin);
  const waOwner = usePos((s) => s.waOwner);
  const waKitchen = usePos((s) => s.waKitchen);
  const waOwnerMode = usePos((s) => s.waOwnerMode);
  const waKitchenMode = usePos((s) => s.waKitchenMode);
  const setWaOwner = usePos((s) => s.setWaOwner);
  const setWaKitchen = usePos((s) => s.setWaKitchen);
  const setWaOwnerMode = usePos((s) => s.setWaOwnerMode);
  const setWaKitchenMode = usePos((s) => s.setWaKitchenMode);
  const [form, setForm] = useState({ id: "", name: "", role: "Barista", pin: "1234", access: "Kasir Only" as Staff["access"] });
  const [pin, setPin] = useState("");
  const [showNewPin, setShowNewPin] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [ownerPhone, setOwnerPhone] = useState(waOwner);
  const [kitchenPhone, setKitchenPhone] = useState(waKitchen);
  const [ownerMode, setOwnerMode] = useState<WaMode>(waOwnerMode);
  const [kitchenMode, setKitchenMode] = useState<WaMode>(waKitchenMode);
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <h2 className="font-display text-xl font-medium">Akun Staf & Audit</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <form
          className="space-y-2 rounded-xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            addStaff({ ...form, id: form.id || form.name.toLowerCase(), active: true });
          }}
        >
          <p className="text-sm font-medium">Akun baru</p>
          <Input placeholder="ID" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          <Input placeholder="Nama" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Jobdesk" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <div className="relative">
            <Input
              placeholder="PIN"
              maxLength={4}
              type={showNewPin ? "text" : "password"}
              inputMode="numeric"
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
            <button type="button" className="absolute right-2 top-2.5 text-muted-foreground" onClick={() => setShowNewPin((v) => !v)}>
              {showNewPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.access}
            onChange={(e) => setForm({ ...form, access: e.target.value as Staff["access"] })}
          >
            <option>Kasir Only</option>
            <option>Full Admin</option>
          </select>
          <Button type="submit" className="w-full">
            Simpan staf
          </Button>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs text-muted-foreground">Ganti PIN owner</p>
            <div className="flex gap-2">
              <Input maxLength={4} placeholder="PIN baru" value={pin} onChange={(e) => setPin(e.target.value)} />
              <Button type="button" variant="secondary" onClick={() => pin.length === 4 && setAdminPin(pin)}>
                Set
              </Button>
            </div>
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">WhatsApp notifikasi</p>
            <p className="text-xs font-medium">Owner</p>
            <WaModeToggle value={ownerMode} onChange={setOwnerMode} />
            {ownerMode === "number" ? (
              <Input placeholder="WA owner 08…" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
            ) : (
              <p className="text-xs text-muted-foreground">Kirim buka WhatsApp, pilih grup owner. Grup tidak punya nomor.</p>
            )}
            <p className="text-xs font-medium">Dapur</p>
            <WaModeToggle value={kitchenMode} onChange={setKitchenMode} />
            {kitchenMode === "number" ? (
              <Input placeholder="WA dapur 08…" value={kitchenPhone} onChange={(e) => setKitchenPhone(e.target.value)} />
            ) : (
              <p className="text-xs text-muted-foreground">Kirim buka WhatsApp, pilih grup dapur / bar.</p>
            )}
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                if (ownerMode === "number" && ownerPhone && !toWaPhone(ownerPhone)) {
                  toast.error("Nomor owner tidak valid.");
                  return;
                }
                if (kitchenMode === "number" && kitchenPhone && !toWaPhone(kitchenPhone)) {
                  toast.error("Nomor dapur tidak valid.");
                  return;
                }
                setWaOwner(ownerPhone);
                setWaKitchen(kitchenPhone);
                setWaOwnerMode(ownerMode);
                setWaKitchenMode(kitchenMode);
                toast.success(ownerMode === "group" || kitchenMode === "group" ? "WhatsApp disimpan. Grup dipilih saat kirim." : "Nomor WhatsApp disimpan.");
              }}
            >
              Simpan WhatsApp
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                void sendWhatsApp(
                  { mode: ownerMode, phone: ownerPhone || waOwner },
                  alertWaText("Tes notifikasi", "HVEN Space POS terhubung."),
                ).then((ok) => {
                  if (!ok) toast.error("Isi nomor owner yang valid, atau pilih mode Grup.");
                  else if (ownerMode === "group") toast.success("WhatsApp buka. Pilih grup owner.");
                });
              }}
            >
              Tes kirim ke WA
            </Button>
          </div>
        </form>
        <div className="lg:col-span-2 space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  {["Nama", "Jobdesk", "PIN", "Akses", ""].map((h) => (
                    <th key={h} className="px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-3">
                      <p className="font-medium">{s.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{s.id}</p>
                    </td>
                    <td className="px-3 py-3">{s.role}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 font-mono text-sm"
                        onClick={() => setReveal((r) => ({ ...r, [s.id]: !r[s.id] }))}
                      >
                        {reveal[s.id] ? s.pin : "••••"}
                        {reveal[s.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={s.active ? (s.access === "Full Admin" ? "primary" : "success") : "muted"}>
                        {s.active ? s.access : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="secondary" onClick={() => setEditing(s)} aria-label="Edit">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            const msg = removeStaff(s.id);
                            if (msg) toast.error(msg);
                            else toast.success(`${s.name} dihapus.`);
                          }}
                          aria-label="Hapus"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="mb-2 text-sm font-medium">Audit log</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {audit.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span>
                    {a.actor} — {a.action}
                  </span>
                  <span className="font-mono text-xs">{a.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent title="Edit akun staf" className="max-w-sm">
          {editing && (
            <StaffEditor
              staff={editing}
              onSave={(next) => {
                updateStaff(next);
                setEditing(null);
                toast.success("Akun diperbarui.");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StaffEditor({ staff, onSave }: { staff: Staff; onSave: (s: Staff) => void }) {
  const [name, setName] = useState(staff.name);
  const [role, setRole] = useState(staff.role);
  const [pin, setPin] = useState(staff.pin);
  const [show, setShow] = useState(true);
  const [access, setAccess] = useState(staff.access);
  const [active, setActive] = useState(staff.active);
  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-sm">
        Nama
        <Input className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block space-y-1 text-sm">
        Jobdesk
        <Input className="h-11" value={role} onChange={(e) => setRole(e.target.value)} />
      </label>
      <label className="block space-y-1 text-sm">
        PIN
        <div className="relative">
          <Input className="h-11 pr-10 font-mono" maxLength={4} inputMode="numeric" type={show ? "text" : "password"} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          <button type="button" className="absolute right-2 top-2.5 text-muted-foreground" onClick={() => setShow((v) => !v)}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </label>
      <select className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={access} onChange={(e) => setAccess(e.target.value as Staff["access"])}>
        <option>Kasir Only</option>
        <option>Full Admin</option>
      </select>
      <Button type="button" variant={active ? "secondary" : "outline"} className="w-full" onClick={() => setActive((v) => !v)}>
        {active ? "Akun aktif" : "Nonaktif"}
      </Button>
      <Button className="w-full" size="lg" disabled={name.trim().length < 2 || pin.length !== 4} onClick={() => onSave({ ...staff, name: name.trim(), role, pin, access, active })}>
        Simpan
      </Button>
    </div>
  );
}

function WaModeToggle({ value, onChange }: { value: WaMode; onChange: (v: WaMode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {(
        [
          ["number", "Nomor HP"],
          ["group", "Grup WA"],
        ] as const
      ).map(([id, label]) => (
        <Button key={id} type="button" size="sm" variant={value === id ? "default" : "secondary"} onClick={() => onChange(id)}>
          {label}
        </Button>
      ))}
    </div>
  );
}
