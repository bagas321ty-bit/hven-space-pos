import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CloudSyncBadge } from "@/components/cloud-sync";
import { usePos } from "@/lib/store";
import { VENUE_LOGIN_EMAIL } from "@/lib/venue-auth";

export function LoginScreen({ pending }: { pending?: boolean }) {
  const loginVenue = usePos((s) => s.loginVenue);
  const [email, setEmail] = useState(VENUE_LOGIN_EMAIL);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || busy) return;
    setBusy(true);
    setErr("");
    const ok = await loginVenue(email, password);
    setBusy(false);
    if (!ok) {
      setErr("Email atau kata sandi salah.");
      setPassword("");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      <aside className="flex flex-col justify-between border-b border-border px-8 py-10 md:w-[42%] md:border-b-0 md:border-r md:px-12 md:py-14">
        <div>
          <p className="text-xs font-medium tracking-[0.28em] text-primary">HVEN SPACE</p>
          <h1 className="mt-4 font-display text-4xl font-medium leading-tight text-foreground md:text-5xl">
            Sistem POS
            <br />
            kafe
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Kasir, dapur, absensi, dan pembukuan. Masuk dengan akun venue sebelum shift dibuka.
            Data tablet dan laptop disinkronkan otomatis ke cloud yang sama.
          </p>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">Cafe & Experience Hub · Malang</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <LockKeyhole className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-medium">Masuk</h2>
              <p className="text-xs text-muted-foreground">Akun operasional HVEN Space</p>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={pending}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Kata sandi</span>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={pending}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Sembunyikan sandi" : "Tampilkan sandi"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>

          {err ? <p className="text-xs text-destructive">{err}</p> : null}

          <Button type="submit" className="h-11 w-full" disabled={pending || busy || !password}>
            {busy ? "Memeriksa…" : "Masuk ke POS"}
          </Button>
          <a href="/pembukuan" className="block text-center text-xs text-muted-foreground hover:text-foreground">
            Buka portal pembukuan →
          </a>
          <a href="/pesan" className="block text-center text-xs text-primary hover:underline">
            Buka menu tamu (tablet depan kasir) →
          </a>
          <div className="flex justify-center pt-1">
            <CloudSyncBadge />
          </div>
        </form>
      </main>
    </div>
  );
}
