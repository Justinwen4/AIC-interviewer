import { cookies } from "next/headers";

const COOKIE = "aic_session_id";

export async function getInterviewSessionIdFromCookie(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function setInterviewSessionCookie(sessionId: string): Promise<void> {
  (await cookies()).set(COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearInterviewSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
