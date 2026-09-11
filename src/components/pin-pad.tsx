import { Delete, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PinPad({
  value,
  onChange,
  show,
  onToggleShow,
  max = 4,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  max?: number;
  disabled?: boolean;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
  return (
    <div className={cn("space-y-3", disabled && "pointer-events-none opacity-50")}>
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex h-12 items-center justify-center rounded-md border border-border bg-muted font-mono tabular-nums",
              max > 4 ? "w-8 text-base" : "w-10 text-lg",
            )}
          >
            {value[i] ? (show ? value[i] : "•") : ""}
          </span>
        ))}
        <button type="button" className="ml-1 rounded-md p-2 text-muted-foreground hover:text-foreground" onClick={onToggleShow} aria-label="Lihat PIN">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <div className="mx-auto grid w-56 grid-cols-3 gap-2">
        {keys.map((d) => (
          <Button
            key={d}
            type="button"
            variant="secondary"
            className="h-12 font-mono text-base"
            disabled={disabled}
            onClick={() => {
              if (d === "C") onChange("");
              else if (d === "⌫") onChange(value.slice(0, -1));
              else onChange(value.length < max ? value + d : value);
            }}
          >
            {d === "⌫" ? <Delete className="size-4" /> : d}
          </Button>
        ))}
      </div>
    </div>
  );
}
