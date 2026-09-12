import type { Product } from "@/lib/types";

export const MENU_LIBRARY = [
  { id: "latte", label: "Latte", src: "/menu/latte.jpg" },
  { id: "cappuccino", label: "Cappuccino", src: "/menu/cappuccino.jpg" },
  { id: "v60", label: "V60", src: "/menu/v60.jpg" },
  { id: "mocktail", label: "Mocktail", src: "/menu/mocktail.jpg" },
  { id: "nasgor", label: "Nasi goreng", src: "/menu/nasgor.jpg" },
  { id: "fries", label: "Gorengan", src: "/menu/fries.jpg" },
  { id: "matcha", label: "Matcha", src: "/menu/matcha.jpg" },
  { id: "wedang", label: "Wedang / teh", src: "/menu/wedang.jpg" },
  { id: "mie", label: "Mie", src: "/menu/mie.jpg" },
  { id: "water", label: "Air", src: "/menu/water.jpg" },
  { id: "choco", label: "Cokelat", src: "/menu/choco.jpg" },
  { id: "party", label: "Sharing plate", src: "/menu/party.jpg" },
] as const;

const PHOTOS: Record<string, string> = Object.fromEntries(MENU_LIBRARY.map((x) => [x.id, x.src]));

export function menuPhoto(p: Pick<Product, "name" | "category"> & { image?: string }): string {
  if (p.image) return p.image;
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
  if (p.blurb?.trim()) return p.blurb.trim();
  if (p.category === "Coffee") return "Diseduh bar. House blend HVEN.";
  if (p.category === "Tea") return "Racikan teh & signature.";
  if (p.category === "Mocktail") return "Tanpa alkohol. Segar, layered.";
  if (p.category === "Food") return "Dapur HVEN, porsi sharing.";
  if (p.category === "Water") return "Masih, dingin.";
  return "Menu HVEN Space.";
}

export function compressMenuPhoto(src: string, maxW = 720, quality = 0.68): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = Math.min(maxW, img.naturalWidth || maxW);
      const h = Math.round(((img.naturalHeight || w) / (img.naturalWidth || w)) * w);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h || w;
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Foto tidak terbaca"));
    img.src = src;
  });
}
