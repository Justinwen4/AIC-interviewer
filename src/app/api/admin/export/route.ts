import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "json";
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
      interview_analysis ( summary, sentiment_summary, themes, tools_mentioned, tools_requested, quotes, labels )
    `,
    )
    .order("started_at", { ascending: false })
    .limit(500);

  if (eventId !== undefined) {
    if (eventId === null) {
      if (format === "csv") {
        return new NextResponse("id,started_at,completion_status,summary\n", {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="aic-interviews.csv"',
          },
        });
      }
      return NextResponse.json({ sessions: [] });
    }
    query = query.eq("event_id", eventId);
  }
  if (from) query = query.gte("started_at", from);
  if (to) query = query.lte("started_at", to);

  const { data: sessions, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (format === "json") {
    return new NextResponse(JSON.stringify({ sessions: sessions ?? [] }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="aic-interviews.json"',
      },
    });
  }

  const header = [
    "id",
    "started_at",
    "completion_status",
    "event_slug",
    "summary",
    "sentiment",
    "themes",
    "tools_mentioned",
    "tools_requested",
  ];
  const lines = [header.join(",")];
  for (const s of sessions ?? []) {
    const ev = s.events as { slug?: string } | null;
    const an = s.interview_analysis as {
      summary?: string;
      sentiment_summary?: string;
      themes?: string[];
      tools_mentioned?: string[];
      tools_requested?: string[];
    } | null;
    const row = [
      s.id,
      s.started_at,
      s.completion_status,
      ev?.slug ?? "",
      csvEscape(an?.summary ?? ""),
      csvEscape(an?.sentiment_summary ?? ""),
      csvEscape((an?.themes ?? []).join("; ")),
      csvEscape((an?.tools_mentioned ?? []).join("; ")),
      csvEscape((an?.tools_requested ?? []).join("; ")),
    ];
    lines.push(row.join(","));
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="aic-interviews.csv"',
    },
  });
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
