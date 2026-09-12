import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Cloud, Laptop, Monitor, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadCloudOrigins, saveCloudOrigins, type CloudOrigins } from "@/lib/cloud-origin";
import { VENUE_PASS_SHA256 } from "@/lib/venue-auth";
import { runCloudSync } from "@/components/cloud-sync";

const GH_CLOUD = "https://github.com/bagas321ty-bit/hven-space-pos/tree/main/cloud";

async function pingOrigin(origin: string): Promise<string> {
  const url = `${origin.replace(/\/+$/, "")}/api/pos-cloud`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ op: "pull", token: VENUE_PASS_SHA256 }),
      signal: ctrl.signal,
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; rev?: number };
    if (data?.ok) return `Terhubung (rev ${data.rev ?? 0})`;
    return data?.error || "Tidak mengenali HVEN Cloud";
  } catch {
    return "Tidak terjangkau";
  } finally {
    clearTimeout(t);
  }
}

export function CloudHubView() {
  const [form, setForm] = useState<CloudOrigins>(() => loadCloudOrigins());
  const [busy, setBusy] = useState<"laptop" | "pc" | "save" | null>(null);
  const [result, setResult] = useState<{ laptop?: string; pc?: string }>({});
  const usingHome = useMemo(() => Boolean(form.laptop.trim() || form.pc.trim()), [form]);

  const persist = (next: CloudOrigins) => {
    setForm(next);
    saveCloudOrigins(next);
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div>
        <h2 className="font-display text-xl font-medium">Cloud toko</h2>
        <p className="text-sm text-muted-foreground">
          Laptop M4 dan PC rumah memakai program yang sama. Nyalakan <span className="text-foreground">satu mesin</span> selama
          shift, colok charger, jangan sleep. Semua tablet/HP buka alamat yang tampil di layar mesin itu.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Laptop className="size-4 text-primary" />
            <h3 className="font-medium">Laptop M4 (toko)</h3>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Unduh folder <span className="text-foreground">cloud</span> dari GitHub.</li>
            <li>Klik <span className="text-foreground">Mulai-Cloud-Mac.command</span>. Kalau diblokir: System Settings → Privacy → Allow.</li>
            <li>Jangan tutup jendela hitam. Di dalamnya ada alamat, contoh <span className="font-mono text-foreground">http://192.168.1.10:8787/</span></li>
            <li>Tablet kasir, HP manager, dan laptop pantau: buka alamat itu (bukan Vercel) selama toko buka.</li>
          </ol>
        </section>
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Monitor className="size-4 text-primary" />
            <h3 className="font-medium">PC rumah (cadangan)</h3>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Copy folder <span className="text-foreground">cloud</span> yang sama ke PC.</li>
            <li>Klik <span className="text-foreground">Mulai-Cloud-Windows.bat</span>. Instal Python jika diminta, centang PATH.</li>
            <li>Colok charger, matikan sleep. Pakai PC hanya jika laptop M4 mati.</li>
            <li>Semua perangkat pindah ke alamat yang tampil di layar PC.</li>
          </ol>
        </section>
      </div>

      <p className="text-sm">
        <a className="text-primary underline" href={GH_CLOUD} target="_blank" rel="noreferrer">
          Unduh program cloud (GitHub)
        </a>
      </p>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Cloud className="size-4 text-primary" />
          <h3 className="font-medium">Alamat cadangan (opsional)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Isi ini hanya jika POS tetap dibuka lewat Vercel, sementara data disimpan di laptop/PC. Harus alamat yang
          sama persis dengan yang tampil di jendela cloud. Kosongkan supaya kembali ke Vercel.
        </p>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">Laptop M4</span>
          <Input
            placeholder="http://192.168.1.10:8787"
            value={form.laptop}
            onChange={(e) => setForm({ ...form, laptop: e.target.value })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">PC rumah</span>
          <Input
            placeholder="http://192.168.0.5:8787"
            value={form.pc}
            onChange={(e) => setForm({ ...form, pc: e.target.value })}
          />
        </label>
        {typeof window !== "undefined" && window.location.protocol === "https:" && usingHome && form.laptop.startsWith("http://") ? (
          <p className="text-sm text-destructive">
            Halaman ini HTTPS, laptop HTTP — browser akan memblokir. Cara benar: buka POS lewat alamat laptop
            (http://…), jangan dari vercel.app.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy !== null}
            onClick={() => {
              persist(form);
              toast.success("Alamat cloud disimpan di perangkat ini.");
              void runCloudSync("manual");
            }}
          >
            Simpan alamat
          </Button>
          <Button
            variant="secondary"
            disabled={busy !== null || !form.laptop.trim()}
            onClick={async () => {
              setBusy("laptop");
              const msg = await pingOrigin(form.laptop);
              setResult((r) => ({ ...r, laptop: msg }));
              setBusy(null);
            }}
          >
            Tes laptop
          </Button>
          <Button
            variant="secondary"
            disabled={busy !== null || !form.pc.trim()}
            onClick={async () => {
              setBusy("pc");
              const msg = await pingOrigin(form.pc);
              setResult((r) => ({ ...r, pc: msg }));
              setBusy(null);
            }}
          >
            Tes PC
          </Button>
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => {
              persist({ laptop: "", pc: "" });
              setResult({});
              toast.success("Kembali ke cloud Vercel.");
              void runCloudSync("manual");
            }}
          >
            <Unplug className="size-4" />
            Pakai Vercel
          </Button>
        </div>
        {result.laptop ? <p className="text-sm text-muted-foreground">Laptop: {result.laptop}</p> : null}
        {result.pc ? <p className="text-sm text-muted-foreground">PC: {result.pc}</p> : null}
      </section>

      <section className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">Kalau mesin cloud mati</p>
        <p>Tablet kasir tetap bisa jualan (data di tablet). Nyalakan laptop atau PC, buka alamat yang baru, ketuk Tersinkron.</p>
        <p>Jangan nyalakan laptop dan PC sebagai “kasir web” bersamaan dengan alamat berbeda — pilih satu gudang hari itu.</p>
      </section>
    </div>
  );
}
