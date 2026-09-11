import { useState } from "react";
import {
  ArrowDownUp,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Coins,
  FileSpreadsheet,
  Landmark,
  LogOut,
  PiggyBank,
  ScatterChart,
  Target,
  UserCog,
  Vault,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BukuAccountsView } from "@/components/views/buku-accounts";
import { BukuExportView } from "@/components/views/buku-export-view";
import {
  CashFlowView,
  DashboardView,
  ExpensesView,
  IncomeView,
  MenuEngView,
  MoneyInView,
  SavingCostView,
  SisihGajiView,
  TargetView,
  TutupBukuView,
} from "@/components/views/finance-views";
import { SalesLogView } from "@/components/views/ops-views";
import { usePos } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CloudSyncBadge } from "@/components/cloud-sync";

type BukuView =
  | "export"
  | "target"
  | "dashboard"
  | "omzet"
  | "expenses"
  | "income"
  | "moneyin"
  | "sisih"
  | "saving"
  | "cashflow"
  | "tutupbuku"
  | "engineering"
  | "accounts";

const NAV: { id: BukuView; label: string; icon: typeof Landmark; superOnly?: boolean }[] = [
  { id: "export", label: "Ringkasan & Excel", icon: FileSpreadsheet },
  { id: "target", label: "Dashboard Manager", icon: Target },
  { id: "dashboard", label: "Dashboard", icon: ScatterChart },
  { id: "omzet", label: "Buku Kasir", icon: BookOpen },
  { id: "expenses", label: "Log Pengeluaran", icon: Wallet },
  { id: "income", label: "Log Pemasukan", icon: Landmark },
  { id: "moneyin", label: "Uang masuk", icon: ArrowDownUp },
  { id: "sisih", label: "Log sisih gaji", icon: PiggyBank },
  { id: "saving", label: "Log saving cost", icon: Vault },
  { id: "cashflow", label: "Arus kas & prive", icon: Coins },
  { id: "tutupbuku", label: "Tutup buku", icon: CalendarCheck },
  { id: "engineering", label: "Menu engineering", icon: ClipboardList },
  { id: "accounts", label: "Akun pembukuan", icon: UserCog, superOnly: true },
];

export function BukuShell() {
  const session = usePos((s) => s.bukuSession);
  const logoutBuku = usePos((s) => s.logoutBuku);
  const [view, setView] = useState<BukuView>("export");
  const [navOpen, setNavOpen] = useState(false);
  const isSuper = session?.role === "superadmin";
  const items = NAV.filter((n) => !n.superOnly || isSuper);

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="border-b border-border px-4 py-4">
          <p className="text-xs tracking-[0.2em] text-primary">HVEN SPACE</p>
          <p className="font-display text-lg font-medium">Pembukuan</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setView(it.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm",
                view === it.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <it.icon className="size-4" />
              {it.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-border p-3 space-y-2">
          <p className="truncate px-1 text-xs text-muted-foreground">
            {session?.name} · {session?.role === "superadmin" ? "Superadmin" : "Pembukuan"}
          </p>
          <a href="/" className="flex h-9 items-center justify-center rounded-md border border-border text-xs text-muted-foreground hover:text-foreground">
            Ke POS kasir
          </a>
          <Button variant="ghost" className="h-9 w-full text-xs" onClick={() => logoutBuku()}>
            <LogOut className="size-3.5" /> Keluar
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border bg-card px-3">
          <button type="button" className="md:hidden" onClick={() => setNavOpen(true)}>
            Menu
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium">{items.find((i) => i.id === view)?.label ?? "Pembukuan"}</p>
            <p className="text-xs text-muted-foreground">Portal keuangan · manager tunai max 200rb · sisanya setor</p>
          </div>
          <span className="ml-auto">
            <CloudSyncBadge />
          </span>
          <Badge tone="primary" className="hidden sm:inline-flex">
            {session?.role === "superadmin" ? "Superadmin" : "Staf pembukuan"}
          </Badge>
          {view !== "export" && (
            <Button size="sm" variant="outline" onClick={() => setView("export")}>
              <FileSpreadsheet className="size-3.5" /> Excel
            </Button>
          )}
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">
          {view === "export" && <BukuExportView />}
          {view === "target" && <TargetView />}
          {view === "dashboard" && <DashboardView />}
          {view === "omzet" && <SalesLogView />}
          {view === "expenses" && <ExpensesView />}
          {view === "income" && <IncomeView />}
          {view === "moneyin" && <MoneyInView />}
          {view === "sisih" && <SisihGajiView />}
          {view === "saving" && <SavingCostView />}
          {view === "cashflow" && <CashFlowView />}
          {view === "tutupbuku" && <TutupBukuView />}
          {view === "engineering" && <MenuEngView />}
          {view === "accounts" && <BukuAccountsView />}
        </main>
      </div>
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-background/70" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r border-border bg-sidebar p-3">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-foreground"
                onClick={() => {
                  setView(it.id);
                  setNavOpen(false);
                }}
              >
                <it.icon className="size-4" />
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
