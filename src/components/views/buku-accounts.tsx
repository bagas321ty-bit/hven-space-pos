import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePos } from "@/lib/store";

export function BukuAccountsView() {
  const users = usePos((s) => s.bukuUsers);
  const session = usePos((s) => s.bukuSession);
  const createBukuUser = usePos((s) => s.createBukuUser);
  const setBukuUserActive = usePos((s) => s.setBukuUserActive);
  const resetBukuPassword = usePos((s) => s.resetBukuPassword);
  const bukuPin = usePos((s) => s.bukuPin);
  const setBukuPin = usePos((s) => s.setBukuPin);
  const [form, setForm] = useState({ name: "", email: "", title: "Pembukuan", password: "" });
  const [resetId, setResetId] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [pinDraft, setPinDraft] = useState("");
  const [showPin, setShowPin] = useState(false);

  if (session?.role !== "superadmin") {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Hanya superadmin yang bisa mengelola akun pembukuan.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div>
        <h2 className="font-display text-xl font-medium">Akun pembukuan</h2>
        <p className="text-sm text-muted-foreground">Tidak ada registrasi publik. Hanya kamu (superadmin) yang bisa membuat, menonaktifkan, atau ganti sandi.</p>
      </div>
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const msg = setBukuPin(pinDraft);
          if (msg) toast.error(msg);
          else {
            toast.success("PIN portal pembukuan diganti.");
            setPinDraft("");
          }
        }}
      >
        <div className="min-w-40 flex-1">
          <p className="text-sm font-medium">PIN portal</p>
          <p className="text-xs text-muted-foreground">6 digit, berbeda dari PIN kasir. Sekarang {showPin ? bukuPin : "••••••"}</p>
        </div>
        <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowPin((v) => !v)}>
          {showPin ? "Sembunyikan" : "Lihat PIN"}
        </button>
        <Input
          className="h-12 w-36 font-mono"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="PIN baru"
          value={pinDraft}
          onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 8))}
        />
        <Button type="submit" className="h-12" disabled={pinDraft.length < 6}>
          Ganti PIN
        </Button>
      </form>
      <div className="grid gap-4 lg:grid-cols-3">
        <form
          className="space-y-3 rounded-xl border border-border bg-card p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const msg = await createBukuUser(form);
            if (msg) toast.error(msg);
            else {
              toast.success("Akun dibuat. Mereka masuk di /pembukuan.");
              setForm({ name: "", email: "", title: "Pembukuan", password: "" });
            }
          }}
        >
          <p className="text-sm font-medium">Akun baru</p>
          <Input placeholder="Nama" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Jobdesk" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Kata sandi (min. 8)" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" className="h-11 w-full">
            Buat akun
          </Button>
        </form>
        <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                {["Nama", "Email", "Jobdesk", "Peran", "Status", ""].map((h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-3 font-medium">{u.name}</td>
                  <td className="px-3 py-3 font-mono text-xs">{u.email}</td>
                  <td className="px-3 py-3">{u.title}</td>
                  <td className="px-3 py-3">
                    <Badge tone={u.role === "superadmin" ? "primary" : "muted"}>{u.role}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={u.active ? "success" : "danger"}>{u.active ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {u.role !== "superadmin" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const msg = setBukuUserActive(u.id, !u.active);
                            if (msg) toast.error(msg);
                          }}
                        >
                          {u.active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => { setResetId(u.id); setResetPw(""); }}>
                        Ganti sandi
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {resetId && (
        <form
          className="flex max-w-lg flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const msg = await resetBukuPassword(resetId, resetPw);
            if (msg) toast.error(msg);
            else {
              toast.success("Kata sandi diganti.");
              setResetId("");
              setResetPw("");
            }
          }}
        >
          <label className="min-w-48 flex-1 space-y-1 text-sm">
            Sandi baru
            <Input type="password" minLength={8} value={resetPw} onChange={(e) => setResetPw(e.target.value)} required />
          </label>
          <Button type="submit">Simpan sandi</Button>
          <Button type="button" variant="ghost" onClick={() => setResetId("")}>
            Batal
          </Button>
        </form>
      )}
    </div>
  );
}
