import type { Product } from "@/lib/types";

const PHOTOS = {
  latte: "/menu/latte.jpg",
  cappuccino: "/menu/cappuccino.jpg",
  v60: "/menu/v60.jpg",
  mocktail: "/menu/mocktail.jpg",
  nasgor: "/menu/nasgor.jpg",
  fries: "/menu/fries.jpg",
  matcha: "/menu/matcha.jpg",
  wedang: "/menu/wedang.jpg",
  mie: "/menu/mie.jpg",
  water: "/menu/water.jpg",
  choco: "/menu/choco.jpg",
  party: "/menu/party.jpg",
} as const;

export function menuPhoto(p: Product): string {
  const n = p.name.toLowerCase();
  if (n.includes("nasi")) return PHOTOS.nasgor;
  if (n.includes("mie")) return PHOTOS.mie;
  if (n.includes("party")) return PHOTOS.party;
  if (n.includes("fries") || n.includes("tela") || n.includes("singkong") || n.includes("aubergine")) return PHOTOS.fries;
  if (n.includes("mineral") || n.includes("air")) return PHOTOS.water;
  if (n.includes("matcha")) return PHOTOS.matcha;
  if (n.includes("wedang") || n.includes("jamus") || n.includes("belanda") || n.includes("sour")) return PHOTOS.wedang;
  if (n.includes("choco") || n.includes("coklat") || n.includes("vanilla") || n.includes("stroberi") || n.includes("chocolade") || n.includes("claudio") || n.includes("ivada") || n.includes("vicenzo") || n.includes("capri") || n.includes("sweety") || n.includes("cikalopi"))
    return PHOTOS.choco;
  if (n.includes("v60") || n.includes("tier")) return PHOTOS.v60;
  if (n.includes("cappucino") || n.includes("espresso") || n.includes("americano") || n.includes("kakek") || n.includes("nenek") || n.includes("special"))
    return PHOTOS.cappuccino;
  if (n.includes("latte")) return PHOTOS.latte;
  if (p.category === "Mocktail") return PHOTOS.mocktail;
  if (p.category === "Food") return PHOTOS.party;
  if (p.category === "Tea") return PHOTOS.matcha;
  if (p.category === "Water") return PHOTOS.water;
  return PHOTOS.latte;
}

export function menuBlurb(p: Product): string {
  if (p.category === "Coffee") return "Diseduh bar. House blend HVEN.";
  if (p.category === "Tea") return "Racikan teh & signature.";
  if (p.category === "Mocktail") return "Tanpa alkohol. Segar, layered.";
  if (p.category === "Food") return "Dapur HVEN, porsi sharing.";
  if (p.category === "Water") return "Masih, dingin.";
  return "Menu HVEN Space.";
}
