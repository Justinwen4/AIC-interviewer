import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setAdminSessionCookie } from "@/lib/auth/admin";
import { getServerEnv } from "@/lib/env";

const bodySchema = z.object({
  password: z.string().min(1),
});

function timingSafeStringEqual(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a, "utf8").digest();
  const bh = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ah, bh);
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const env = getServerEnv();
    if (!timingSafeStringEqual(body.password, env.ADMIN_PASSWORD)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    await setAdminSessionCookie();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
