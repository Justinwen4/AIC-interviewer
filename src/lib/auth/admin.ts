import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "aic_admin";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const s = process.env.ADMIN_PASSWORD;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_PASSWORD must be set (min 16 characters)");
  }
  return s;
}

export function signAdminSession(): string {
  const secret = getSecret();
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const nonce = randomBytes(16).toString("hex");
  const payload = `${exp}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyAdminSessionToken(token: string): boolean {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret || secret.length < 16) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const payload = `${expStr}.${nonce}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function verifyAdminSession(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  return verifyAdminSessionToken(token);
}

export async function setAdminSessionCookie(): Promise<void> {
  const token = signAdminSession();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  (await cookies()).set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
