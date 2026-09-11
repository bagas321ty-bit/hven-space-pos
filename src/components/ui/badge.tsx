import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "primary" | "success" | "danger" | "warning";
  children: ReactNode;
}) {
  const tones = {
    muted: "bg-muted text-muted-foreground border-border",
    primary: "bg-primary/15 text-primary border-primary/30",
    success: "bg-success/15 text-success border-success/30",
    danger: "bg-destructive/15 text-destructive border-destructive/30",
    warning: "bg-warning/15 text-warning border-warning/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
