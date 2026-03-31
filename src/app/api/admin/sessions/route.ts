import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventSlug = searchParams.get("event") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const q = searchParams.get("q")?.trim() ?? "";

  const supabase = getSupabaseAdmin();

  let eventId: string | null | undefined = undefined;
  if (eventSlug && eventSlug !== "all") {
    const { data: ev } = await supabase
      .from("events")
      .select("id")
      .eq("slug", eventSlug)
      .maybeSingle();
    eventId = ev?.id ?? null;
  }

  let query = supabase
    .from("interview_sessions")
    .select(
      `
      id,
      event_id,
      completion_status,
      started_at,
      ended_at,
      events ( name, slug ),
      interview_analysis ( summary, sentiment_summary, themes )
    `,
    )
    .order("started_at", { ascending: false })
    .limit(200);

  if (eventId !== undefined) {
    if (eventId === null) {
      return NextResponse.json({ sessions: [] });
    }
    query = query.eq("event_id", eventId);
  }

  if (from) {
    query = query.gte("started_at", from);
  }
  if (to) {
    query = query.lte("started_at", to);
  }

  const { data: sessions, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let list = sessions ?? [];
  if (q) {
    const lower = q.toLowerCase();
    list = list.filter((s) => {
      const summary = (s.interview_analysis as { summary?: string } | null)?.summary ?? "";
      return summary.toLowerCase().includes(lower) || s.id.toLowerCase().includes(lower);
    });
  }

  return NextResponse.json({ sessions: list });
}
