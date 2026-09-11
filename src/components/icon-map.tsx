import {
  Coffee,
  CupSoda,
  Droplets,
  GlassWater,
  IceCream,
  Leaf,
  type LucideIcon,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Coffee,
  Wine,
  UtensilsCrossed,
  Leaf,
  Droplets,
  CupSoda,
  GlassWater,
  IceCream,
};

export function ProductIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Coffee;
  return <Icon className={className} />;
}
