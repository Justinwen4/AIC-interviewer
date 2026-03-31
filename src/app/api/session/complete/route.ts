import { NextResponse } from "next/server";
import { z } from "zod";
import { getInterviewSessionIdFromCookie } from "@/lib/auth/interview-session";
import { runInterviewAnalysis } from "@/lib/llm/analysis";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const bodySchema = z.object({
  status: z.enum(["completed", "abandoned"]),
});

export async function POST(request: Request) {
  const sessionId = await getInterviewSessionIdFromCookie();
  if (!sessionId) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const endedAt = new Date().toISOString();

  const { error: uErr } = await supabase
    .from("interview_sessions")
    .update({
      completion_status: body.status,
      ended_at: endedAt,
    })
    .eq("id", sessionId);

  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  const { data: rows, error: mErr } = await supabase
    .from("interview_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  const transcript =
    rows
      ?.map((r) => `${r.role === "user" ? "Member" : "Interviewer"}: ${r.content}`)
      .join("\n\n") ?? "";

  if (transcript.length < 40) {
    await supabase.from("interview_analysis").upsert(
      {
        session_id: sessionId,
        summary: "Transcript too short for structured analysis.",
        sentiment_summary: "n/a",
        themes: [],
        tools_mentioned: [],
        tools_requested: [],
        quotes: [],
        labels: {
          skipped: true,
          status: body.status,
        },
        raw: { transcript_length: transcript.length },
      },
      { onConflict: "session_id" },
    );
    return NextResponse.json({ ok: true, analyzed: false });
  }

  try {
    const analysis = await runInterviewAnalysis(transcript);
    const { error: aErr } = await supabase.from("interview_analysis").upsert(
      {
        session_id: sessionId,
        summary: analysis.interview_summary,
        sentiment_summary: analysis.sentiment_summary,
        themes: analysis.recurring_themes,
        tools_mentioned: analysis.tools_mentioned,
        tools_requested: analysis.tools_requested_or_excited,
        quotes: analysis.representative_quotes,
        labels: {
          use_cases: analysis.use_cases,
          interest_areas: analysis.interest_areas,
          pain_points: analysis.pain_points,
          event_feedback_themes: analysis.event_feedback_themes,
          requests_for_aic: analysis.requests_for_aic,
          completion_status: body.status,
        },
        raw: analysis as unknown as Record<string, unknown>,
      },
      { onConflict: "session_id" },
    );
    if (aErr) {
      return NextResponse.json({ error: aErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, analyzed: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
