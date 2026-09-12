import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  ClipboardList,
  Clock,
  Cloud,
  Coffee,
  CookingPot,
  Fingerprint,
  Landmark,
  LayoutDashboard,
  Lock,
  LockOpen,
  LogOut,
  Menu,
  Package,
  Percent,
  Plus,
  Receipt,
  ScatterChart,
  Search,
  Target,
  TriangleAlert,
  UserCog,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DiscountModal, ModifierModal, NotifCenter, PaymentModal, PinModal, ProductFormModal, ReceiptModal } from "@/components/modals";
import { AdjustLogView } from "@/components/views/adjust-view";
import { PosView } from "@/components/views/pos-view";
import { OrdersView, KitchenView, AttendanceView, ShiftView, IncidentsView, VenueView, SalesLogView } from "@/components/views/ops-views";
import { ProductsView, InventoryView, StaffView } from "@/components/views/catalog-views";
import { CloudHubView } from "@/components/views/cloud-hub-view";
import {
  DashboardView,
  ExpensesView,
  IncomeView,
  MenuEngView,
  TargetView,
  TutupBukuView,
} from "@/components/views/finance-views";
import { formatDateID, formatIDR, formatTimeID, todayISO } from "@/lib/format";
import { playKdsChime } from "@/lib/kds-chime";
import { isIngredientLow } from "@/lib/inventory";
import { usePos } from "@/lib/store";
import type { ViewId } from "@/lib/types";
import { RESTRICTED_VIEWS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CloudSyncBadge } from "@/components/cloud-sync";
import { FeedbackLock } from "@/components/feedback-overlay";

const NAV: { group: string; items: { id: ViewId; label: string; icon: typeof Coffee; hint?: string }[] }[] = [
  {
    group: "Kasir",
    items: [
      { id: "pos", label: "POS Kasir", icon: LayoutDashboard, hint: "F1" },
      { id: "orders", label: "Order List", icon: Receipt },
      { id: "omzet", label: "Log Omzet", icon: Banknote },
      { id: "adjust", label: "Diskon & Pajak", icon: Percent },
      { id: "attendance", label: "Absensi Staf", icon: Fingerprint },
      { id: "kitchen", label: "Kitchen KDS", icon: CookingPot },
      { id: "sewa", label: "Sewa Diantara", icon: Building2 },
    ],
  },
  {
    group: "Operasional",
    items: [
      { id: "products", label: "Produk & Menu", icon: Coffee },
      { id: "inventory", label: "Stok opname", icon: Package },
      { id: "shift", label: "Shift Kasir", icon: Clock },
      { id: "incidents", label: "Log Insiden", icon: TriangleAlert },
      { id: "staff", label: "Akun Staf & Audit", icon: UserCog },
      { id: "cloudhub", label: "Cloud toko", icon: Cloud },
    ],
  },
  {
    group: "Finance",
    items: [
      { id: "dashboard", label: "Dashboard Owner", icon: ScatterChart },
      { id: "target", label: "Target 60 Jt", icon: Target },
      { id: "expenses", label: "Buku Kas Keluar", icon: Wallet },
      { id: "income", label: "Pemasukan Sewa", icon: BookOpen },
      { id: "tutupbuku", label: "Tutup Buku 7–6", icon: CalendarCheck },
      { id: "engineering", label: "Menu Engineering", icon: ClipboardList },
    ],
  },
];

const TITLES: Record<ViewId, string> = {
  pos: "POS Kasir HVEN",
  orders: "Daftar Order",
  omzet: "Log Omzet Hari Ini",
  adjust: "Log Diskon & Pajak",
  attendance: "Absensi Staf",
  kitchen: "Kitchen Display",
  sewa: "Tarif Sewa Diantara",
  products: "Produk & Menu",
  inventory: "Stok opname",
  shift: "Shift Kasir",
  incidents: "Log Insiden",
  staff: "Akun Staf & Audit",
  cloudhub: "Cloud toko (laptop & PC)",
  target: "Dashboard Target",
  dashboard: "Dashboard Owner",
  expenses: "Buku Kas Keluar",
  income: "Pemasukan Non-Kasir",
  tutupbuku: "Tutup Buku Siklus 7–6",
  engineering: "Menu Engineering",
};

function ViewSwitch({ view }: { view: ViewId }) {
  switch (view) {
    case "pos":
      return <PosView />;
    case "orders":
      return <OrdersView />;
    case "omzet":
      return <SalesLogView />;
    case "adjust":
      return <AdjustLogView />;
    case "kitchen":
      return <KitchenView />;
    case "attendance":
      return <AttendanceView />;
    case "shift":
      return <ShiftView />;
    case "incidents":
      return <IncidentsView />;
    case "sewa":
      return <VenueView />;
    case "products":
      return <ProductsView />;
    case "inventory":
      return <InventoryView />;
    case "staff":
      return <StaffView />;
    case "cloudhub":
      return <CloudHubView />;
    case "target":
      return <TargetView />;
    case "dashboard":
      return <DashboardView />;
    case "expenses":
      return <ExpensesView />;
    case "income":
      return <IncomeView />;
    case "tutupbuku":
      return <TutupBukuView />;
    case "engineering":
      return <MenuEngView />;
    default:
      return <PosView />;
  }
}

export function AppShell() {
  const view = usePos((s) => s.view);
  const setView = usePos((s) => s.setView);
  const collapsed = usePos((s) => s.sidebarCollapsed);
  const toggle = usePos((s) => s.toggleSidebar);
  const role = usePos((s) => s.role);
  const staff = usePos((s) => s.staff);
  const currentStaffId = usePos((s) => s.currentStaffId);
  const openPin = () => usePos.setState({ pinOpen: true });
  const logoutOwner = usePos((s) => s.logoutOwner);
  const logoutVenue = usePos((s) => s.logoutVenue);
  const setSearch = usePos((s) => s.setSearch);
  const search = usePos((s) => s.search);
  const orders = usePos((s) => s.orders);
  const inventory = usePos((s) => s.inventory);
  const notifs = usePos((s) => s.notifications);
  const shift = usePos((s) => s.shift);
  const setProductFormOpen = usePos((s) => s.setProductFormOpen);
  const setPaymentOpen = usePos((s) => s.setPaymentOpen);
  const clearCart = usePos((s) => s.clearCart);
  const [clock, setClock] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);

  const me = staff.find((s) => s.id === currentStaffId);
  const activeOrders = orders.filter((o) => o.status === "open" || (o.status === "paid" && o.kdsStatus !== "done")).length;
  const kdsNew = orders.filter((o) => o.status === "paid" && o.kdsStatus !== "done" && o.items.some((i) => i.kitchen)).length;
  const pendingPay = orders.filter((o) => o.status === "pending");
  const confirmGuestPay = usePos((s) => s.confirmGuestPay);
  const feedbackDue = orders.filter((o) => o.feedbackStatus === "due" && o.status !== "void").length;
  const lowStock = inventory.filter(isIngredientLow).length;

  useEffect(() => {
    setClock(formatTimeID());
    const t = setInterval(() => setClock(formatTimeID()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onChime = () => playKdsChime();
    window.addEventListener("hven-kds-chime", onChime);
    return () => window.removeEventListener("hven-kds-chime", onChime);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setView("pos");
      } else if (e.key === "F2") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        clearCart();
        toast("Keranjang dikosongkan");
      } else if (e.key === "F4") {
        e.preventDefault();
        setPaymentOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView, clearCart, setPaymentOpen]);

  const badges = useMemo(
    () => ({
      orders: String(activeOrders),
      kitchen: String(kdsNew),
      inventory: lowStock > 0 ? `${lowStock}` : "",
    }),
    [activeOrders, kdsNew, lowStock],
  );

  const navBtn = (id: ViewId, label: string, Icon: typeof Coffee, hint?: string) => {
    const active = view === id;
    const locked = RESTRICTED_VIEWS.includes(id) && role !== "owner";
    return (
      <button
        key={id}
        onClick={() => {
          setView(id);
          setMobileNav(false);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
          active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {!collapsed && hint && <span className="font-mono text-xs text-muted-foreground">{hint}</span>}
        {!collapsed && locked && <Lock className="size-3 text-primary/80" />}
        {!collapsed && id === "orders" && Number(badges.orders) > 0 && (
          <Badge tone="primary">{badges.orders}</Badge>
        )}
        {!collapsed && id === "kitchen" && (Number(badges.kitchen) > 0 || feedbackDue > 0) && (
          <Badge tone="danger">{feedbackDue > 0 ? `${feedbackDue} FB` : badges.kitchen}</Badge>
        )}
        {!collapsed && id === "inventory" && badges.inventory && <Badge tone="danger">{badges.inventory}</Badge>}
      </button>
    );
  };

  return (
    <div className="relative z-0 flex h-dvh overflow-hidden bg-background text-foreground">
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-border bg-sidebar md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex items-center gap-3 border-b border-border px-3 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-display text-lg font-semibold text-primary">
            H
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-sm font-semibold tracking-wide">HVEN SPACE</p>
              <p className="truncate text-xs text-muted-foreground">Cafe & Experience Hub</p>
            </div>
          )}
          <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={toggle} aria-label="Collapse">
            <Menu className="size-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-3">
          {NAV.map((g) => (
            <div key={g.group}>
              {!collapsed && (
                <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{g.group}</p>
              )}
              <div className="space-y-0.5">
                {g.items.map((it) => navBtn(it.id, it.label, it.icon, it.hint))}
              </div>
            </div>
          ))}
          <a
            href="/pembukuan"
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-primary hover:bg-primary/10",
              collapsed && "justify-center px-0",
            )}
          >
            <Landmark className="size-4 shrink-0" />
            {!collapsed && <span>Portal Pembukuan</span>}
          </a>
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              {(me?.name ?? "R").slice(0, 1)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{me?.name}</p>
                <p className={cn("text-xs", role === "owner" ? "text-success" : "text-primary")}>
                  {role === "owner" ? "Mode Owner" : "Mode Kasir"}
                </p>
              </div>
            )}
            <button
              onClick={() => (role === "owner" ? logoutOwner() : openPin())}
              className="text-muted-foreground hover:text-primary"
              title="PIN"
            >
              {role === "owner" ? <LockOpen className="size-4 text-success" /> : <Lock className="size-4" />}
            </button>
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={() => logoutVenue()}
              className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              Keluar
            </button>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={() => logoutVenue()}
              className="mt-2 flex h-9 w-full items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Keluar"
            >
              <LogOut className="size-3.5" />
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
          <button className="md:hidden" onClick={() => setMobileNav(true)} aria-label="Menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{TITLES[view]}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {shift.open ? "Shift aktif" : "Shift tutup"} • {shift.cashier || me?.name} • {formatDateID(todayISO())} 07.00–02.00
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a
              href="/pesan"
              className="hidden h-8 items-center rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Menu tamu
            </a>
            <CloudSyncBadge compact />
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                id="global-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (view !== "pos") setView("pos");
                }}
                placeholder="Cari menu F2"
                className="h-9 w-44 pl-8"
              />
            </div>
            <a
              href="/pembukuan"
              className="hidden h-8 items-center gap-2 rounded-sm border border-border px-3 text-xs font-medium hover:bg-accent md:inline-flex"
            >
              <Landmark className="size-3.5" /> Pembukuan
            </a>
            <Button size="sm" variant="outline" onClick={() => { usePos.getState().setEditingProduct(null); setProductFormOpen(true); }} className="hidden md:inline-flex">
              <Plus className="size-3.5" /> Menu
            </Button>
            <button className="relative rounded-md p-2 hover:bg-accent" onClick={() => setNotifOpen(true)} aria-label="Notifikasi">
              <Bell className="size-4 text-primary" />
              {notifs.length > 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                  {Math.min(notifs.length, 9)}
                </span>
              )}
            </button>
            {clock && (
              <span className="hidden font-mono text-xs tabular-nums text-primary sm:inline">{clock}</span>
            )}
          </div>
        </header>
        {pendingPay.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/10 px-3 py-2">
            <p className="text-xs font-medium">Tunggu bayar tamu</p>
            {pendingPay.slice(0, 4).map((o) => (
              <Button
                key={o.id}
                size="sm"
                onClick={() => {
                  const msg = confirmGuestPay(o.id);
                  if (msg) toast.error(msg);
                  else toast.success(`${o.number} lunas · masuk KDS`);
                }}
              >
                Konfirmasi {o.customer} · {o.payment} · {formatIDR(o.total)}
              </Button>
            ))}
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-hidden">
          <ViewSwitch view={view} />
        </main>
      </div>

      {mobileNav && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-background/70" onClick={() => setMobileNav(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r border-border bg-sidebar p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display font-semibold">HVEN SPACE</p>
              <button onClick={() => setMobileNav(false)}>
                <X className="size-4" />
              </button>
            </div>
            {NAV.map((g) => (
              <div key={g.group} className="mb-4">
                <p className="mb-1 px-2 text-xs uppercase tracking-wider text-muted-foreground">{g.group}</p>
                {g.items.map((it) => navBtn(it.id, it.label, it.icon, it.hint))}
              </div>
            ))}
            <a href="/pembukuan" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-primary">
              <Landmark className="size-4" /> Portal Pembukuan
            </a>
          </div>
        </div>
      )}

      <PinModal />
      <PaymentModal />
      <ReceiptModal />
      <ModifierModal />
      <ProductFormModal />
      <NotifCenter open={notifOpen} onOpenChange={setNotifOpen} />
      <DiscountModal open={discOpen} onOpenChange={setDiscOpen} />
      <FeedbackLock />
    </div>
  );
}
