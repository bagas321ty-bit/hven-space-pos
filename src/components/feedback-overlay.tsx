import { useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { usePos } from "@/lib/store";

export function FeedbackLock() {
  const orders = usePos((s) => s.orders);
  const tick = usePos((s) => s.tickFeedbackDue);
  const saveFeedback = usePos((s) => s.saveFeedback);
  const due = useMemo(
    () => orders.find((o) => o.status !== "void" && o.feedbackStatus === "due") ?? null,
    [orders],
  );
  const [acked, setAcked] = useState(false);
  const [complaint, setComplaint] = useState("");

  useEffect(() => {
    tick();
    const t = setInterval(tick, 4000);
    return () => clearInterval(t);
  }, [tick]);

  useEffect(() => {
    setAcked(false);
    setComplaint("");
  }, [due?.id]);

  if (!due) return null;

  const guest = `${due.customer}${due.table !== "-" ? ` · ${due.table}` : ""}`;
  const kitchenItems = due.items.filter((i) => i.kitchen);
  const close = (note: string, msg: string) => {
    saveFeedback(due.id, { note });
    toast.success(msg);
  };

  return (
    <div
      className="overlay-lock fixed inset-0 flex items-center justify-center bg-background p-4 text-foreground"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="feedback-lock-title"
    >
      <div className="flex max-h-full w-full max-w-lg flex-col rounded-xl border border-primary/40 bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3 text-primary">
          <MessageSquare className="size-8 shrink-0" />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Pelayanan · 10 menit setelah KDS selesai</p>
            <h2 id="feedback-lock-title" className="font-display text-3xl font-medium tracking-tight">
              Lakukan Feedback
            </h2>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-mono text-sm text-primary">{due.number}</p>
            <p className="font-mono text-sm tabular-nums">{formatIDR(due.total)}</p>
          </div>
          <p className="mt-1 text-lg font-medium">{guest}</p>
          <p className="text-sm text-muted-foreground">
            {due.type}
            {due.status === "open" ? " · masih open bill" : ""}
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {kitchenItems.map((i) => (
              <li key={i.key}>
                {i.qty}× {i.name}
                {i.note ? <span className="text-primary"> — {i.note}</span> : null}
              </li>
            ))}
          </ul>
        </div>

        {!acked ? (
          <>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              Datangi meja dan tanyakan kabar tamu. Layar terkunci sampai dikonfirmasi Oke.
            </p>
            <Button className="mt-6 h-14 w-full text-base" onClick={() => setAcked(true)}>
              Oke
            </Button>
          </>
        ) : (
          <div className="mt-5 space-y-3">
            <label className="block text-sm font-medium">
              Komplain tamu
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-3 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Isi hanya kalau ada komplain…"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                className="h-12"
                onClick={() => close("", `Feedback ${due.number} · tanpa komplain`)}
              >
                Tidak ada komplain
              </Button>
              <Button
                type="button"
                className="h-12"
                disabled={!complaint.trim()}
                onClick={() => close(complaint.trim(), `Komplain ${due.number} tercatat`)}
              >
                Kirim komplain
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
