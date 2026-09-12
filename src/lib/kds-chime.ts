let ctx: AudioContext | null = null;

export function playKdsChime() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    ctx = ctx ?? new AC();
    void ctx.resume();
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(784, now);
    o.frequency.setValueAtTime(1046, now + 0.12);
    o.frequency.setValueAtTime(1318, now + 0.24);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.56);
  } catch {
    /* autoplay blocked until a tap */
  }
}

export function armKdsChime() {
  window.addEventListener("hven-kds-chime", () => playKdsChime());
}

export function ringKds() {
  playKdsChime();
  window.dispatchEvent(new Event("hven-kds-chime"));
}
