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

/** Call after local writes (pengeluaran, pemasukan, dll.) so sync cannot skip. */
export function nudgeCloud() {
  if (handler) handler();
  else pending = true;
}
