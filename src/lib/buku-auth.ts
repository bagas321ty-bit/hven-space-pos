import type { BukuUser } from "@/lib/types";
import { sha256Hex, VENUE_LOGIN_EMAIL, VENUE_PASS_SHA256 } from "@/lib/venue-auth";

export const hashPassword = sha256Hex;

export const SEED_BUKU_USERS: BukuUser[] = [
  {
    id: "buku-super",
    email: VENUE_LOGIN_EMAIL,
    name: "Bagas",
    title: "Owner",
    role: "superadmin",
    passHash: VENUE_PASS_SHA256,
    createdAt: "2026-09-10T00:00:00.000Z",
    createdBy: "sistem",
    active: true,
  },
];

export function normalizeBukuEmail(email: string) {
  return email.trim().toLowerCase();
}

export function ensureBukuUsers(list?: BukuUser[]): BukuUser[] {
  const users = list?.length ? list.map((u) => ({ ...u })) : [];
  if (!users.some((u) => u.role === "superadmin" && u.active !== false)) {
    users.unshift({ ...SEED_BUKU_USERS[0] });
  }
  return users;
}

export async function verifyBukuLogin(users: BukuUser[], email: string, password: string): Promise<BukuUser | null> {
  const target = normalizeBukuEmail(email);
  const digest = await hashPassword(password);
  const user = users.find((u) => u.email === target && u.active !== false);
  if (!user || user.passHash !== digest) return null;
  return user;
}
