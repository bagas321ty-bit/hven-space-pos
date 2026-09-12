import { getPhotoClient, putPhotoClient } from "@/lib/pos-cloud-client";
import { menuPhotoId } from "@/lib/menu-photos";
import { VENUE_PASS_SHA256 } from "@/lib/venue-auth";
import type { Product } from "@/lib/types";

export async function flushMenuPhotos(products: Product[]): Promise<void> {
  for (const p of products) {
    if (!p.image?.startsWith("data:image/")) continue;
    const id = menuPhotoId(p.id);
    const res = await putPhotoClient({ token: VENUE_PASS_SHA256, id, data: p.image });
    if (!res.ok) console.warn("menu photo put", p.id, res.error);
  }
}

export async function hydrateMenuPhotos(products: Product[]): Promise<{ rows: Product[]; changed: boolean }> {
  let changed = false;
  const rows = await Promise.all(
    products.map(async (p) => {
      if (!p.image?.startsWith("cloud:")) return p;
      const id = p.image.slice(6);
      const res = await getPhotoClient({ token: VENUE_PASS_SHA256, id });
      if (!res.ok || !("data" in res) || !res.data) return p;
      changed = true;
      return { ...p, image: res.data };
    }),
  );
  return { rows, changed };
}
