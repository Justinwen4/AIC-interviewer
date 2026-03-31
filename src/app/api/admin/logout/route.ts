import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/auth/admin";

export async function POST() {
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
