import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string" && error
        ? error
        : "";
  if (/importing a module script failed/i.test(raw)) {
    return "Versi lama tertinggal di browser. Muat ulang paksa (Cmd+Shift+R) atau hapus data situs vercel.app.";
  }
  return raw || "Terjadi kesalahan. Coba muat ulang halaman.";
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <span className="text-destructive" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Halaman gagal dimuat</h1>
      <p className="max-w-md text-sm break-words text-muted-foreground">{errorMessage(error)}</p>
      <button
        type="button"
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        onClick={() => window.location.reload()}
      >
        Muat ulang
      </button>
    </main>
  );
}