type Handler = () => void;

let handler: Handler | null = null;
let pending = false;

export function onCloudNudge(fn: Handler) {
  handler = fn;
  if (pending) {
    pending = false;
    fn();
  }
}

/** Wajib setelah setiap tulis data (pengeluaran, setor, menu, stok, …).
 *  Tanpa ini sinkron bisa skip. Lihat AGENTS.project.md. */
export function nudgeCloud() {
  if (handler) handler();
  else pending = true;
}