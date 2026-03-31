import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Quote = { text?: string; note?: string };

function topN(map: Map<string, number>, n: number): { label: string; count: number }[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventSlug = searchParams.get("event") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

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

  let sessionQuery = supabase.from("interview_sessions").select("id");

  if (eventId !== undefined) {
    if (eventId === null) {
      return NextResponse.json({
        themeCounts: [],
        toolsMentioned: [],
        toolsRequested: [],
        sampleQuotes: [],
        sessionCount: 0,
      });
    }
    sessionQuery = sessionQuery.eq("event_id", eventId);
  }
  if (from) sessionQuery = sessionQuery.gte("started_at", from);
  if (to) sessionQuery = sessionQuery.lte("started_at", to);

  const { data: sessions, error: sErr } = await sessionQuery;
  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) {
    return NextResponse.json({
      themeCounts: [],
      toolsMentioned: [],
      toolsRequested: [],
      sampleQuotes: [],
      sessionCount: 0,
    });
  }

  const { data: analyses, error: aErr } = await supabase
    .from("interview_analysis")
    .select("themes, tools_mentioned, tools_requested, quotes")
    .in("session_id", sessionIds);

  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  }

  const themeMap = new Map<string, number>();
  const toolsMap = new Map<string, number>();
  const requestedMap = new Map<string, number>();
  const quotes: string[] = [];

  for (const row of analyses ?? []) {
    for (const t of row.themes ?? []) {
      const k = String(t).trim().toLowerCase();
      if (!k) continue;
      themeMap.set(k, (themeMap.get(k) ?? 0) + 1);
    }
    for (const t of row.tools_mentioned ?? []) {
      const k = String(t).trim().toLowerCase();
      if (!k) continue;
      toolsMap.set(k, (toolsMap.get(k) ?? 0) + 1);
    }
    for (const t of row.tools_requested ?? []) {
      const k = String(t).trim().toLowerCase();
      if (!k) continue;
      requestedMap.set(k, (requestedMap.get(k) ?? 0) + 1);
    }
    const q = row.quotes as Quote[] | null;
    if (Array.isArray(q)) {
      for (const item of q) {
        if (item?.text) quotes.push(item.text);
      }
    }
  }

  return NextResponse.json({
    sessionCount: sessionIds.length,
    themeCounts: topN(themeMap, 25),
    toolsMentioned: topN(toolsMap, 25),
    toolsRequested: topN(requestedMap, 25),
    sampleQuotes: quotes.slice(0, 30),
  });
}
