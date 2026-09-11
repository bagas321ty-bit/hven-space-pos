export const VENUE_EMAIL = "hvenspace@gmail.com";
export const VENUE_PASS_SHA256 = "aacdfc2728ad029ce31fe891ec1b03bb3a3278006507652adc60ea699da549ed";

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeVenueEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function verifyVenueLogin(email: string, password: string): Promise<boolean> {
  if (normalizeVenueEmail(email) !== VENUE_EMAIL) return false;
  const digest = await sha256Hex(password);
  return digest === VENUE_PASS_SHA256;
}

export const VENUE_LOGIN_EMAIL = VENUE_EMAIL;
