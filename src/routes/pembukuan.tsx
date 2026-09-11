import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { BukuLogin, BukuPinGate } from "@/components/buku-login";
import { BukuShell } from "@/components/buku-shell";
import { HydratePos } from "@/components/hydrate-pos";
import { usePos } from "@/lib/store";

export const Route = createFileRoute("/pembukuan")({
  component: PembukuanPage,
  head: () => ({
    meta: [{ title: "Pembukuan HVEN Space" }],
  }),
});

function PembukuanPage() {
  const hydrated = usePos((s) => s.hydrated);
  const session = usePos((s) => s.bukuSession);
  const unlocked = usePos((s) => s.bukuUnlocked);
  const lockBuku = usePos((s) => s.lockBuku);

  useEffect(() => () => lockBuku(), [lockBuku]);

  let body = <BukuPinGate pending={!hydrated} />;
  if (hydrated && unlocked) body = session ? <BukuShell /> : <BukuLogin />;

  return (
    <>
      <HydratePos />
      {body}
      <Toaster theme="dark" position="bottom-right" richColors={false} />
    </>
  );
}
