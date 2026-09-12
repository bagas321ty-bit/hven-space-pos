import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { GuestMenu } from "@/components/guest-menu";
import { HydratePos } from "@/components/hydrate-pos";

export const Route = createFileRoute("/pesan")({
  component: PesanPage,
  head: () => ({
    meta: [{ title: "Menu tamu · HVEN Space" }],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap",
      },
    ],
  }),
});

function PesanPage() {
  return (
    <>
      <HydratePos />
      <GuestMenu />
      <Toaster theme="dark" position="bottom-center" richColors={false} />
    </>
  );
}
