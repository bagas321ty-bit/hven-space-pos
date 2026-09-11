import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";
import { HydratePos } from "@/components/hydrate-pos";
import { LoginScreen } from "@/components/login-screen";
import { usePos } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const hydrated = usePos((s) => s.hydrated);
  const sessionLoggedIn = usePos((s) => s.sessionLoggedIn);

  return (
    <>
      <HydratePos />
      {!hydrated || !sessionLoggedIn ? <LoginScreen pending={!hydrated} /> : <AppShell />}
      <Toaster theme="dark" position="bottom-right" richColors={false} />
    </>
  );
}