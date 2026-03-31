import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getInterviewSessionIdFromCookie,
  setInterviewSessionCookie,
} from "@/lib/auth/interview-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const bodySchema = z.object({
  eventSlug: z.string().min(1).optional(),
});

const OPENING =
  "Hi — I'm the AIC feedback interviewer. I'd love to learn a bit about your experience and how you're using AI. This should take about 5 minutes.\n\nTo start: what brought you to this event or to AIC today?";

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => ({}));
    const { eventSlug } = bodySchema.parse(json);
    const supabase = getSupabaseAdmin();

    let eventId: string | null = null;
    let eventName: string | null = null;
    if (eventSlug) {
      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select("id, name")
        .eq("slug", eventSlug)
        .maybeSingle();
      if (evErr) throw evErr;
      if (ev) {
        eventId = ev.id;
        eventName = ev.name;
      }
    }

    const { data: session, error: sErr } = await supabase
      .from("interview_sessions")
      .insert({
        event_id: eventId,
        completion_status: "in_progress",
        metadata: eventSlug ? { event_slug: eventSlug } : {},
      })
      .select("id")
      .single();

    if (sErr || !session) throw sErr ?? new Error("session insert failed");

    const { error: mErr } = await supabase.from("interview_messages").insert({
      session_id: session.id,
      role: "assistant",
      content: OPENING,
    });
    if (mErr) throw mErr;

    await setInterviewSessionCookie(session.id);

    const { data: messages, error: msgErr } = await supabase
      .from("interview_messages")
      .select("id, role, content, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (msgErr) throw msgErr;

    return NextResponse.json({
      sessionId: session.id,
      eventName,
      eventSlug: eventSlug ?? null,
      messages: messages ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  try {
    const sessionId = await getInterviewSessionIdFromCookie();
    if (!sessionId) {
      return NextResponse.json({ sessionId: null, messages: [] });
    }
    const supabase = getSupabaseAdmin();
    const { data: session, error: sErr } = await supabase
      .from("interview_sessions")
      .select("id, event_id, completion_status")
      .eq("id", sessionId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!session) {
      return NextResponse.json({ sessionId: null, messages: [] });
    }

    const { data: messages, error: mErr } = await supabase
      .from("interview_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (mErr) throw mErr;

    let eventName: string | null = null;
    let eventSlug: string | null = null;
    if (session.event_id) {
      const { data: ev } = await supabase
        .from("events")
        .select("name, slug")
        .eq("id", session.event_id)
        .maybeSingle();
      eventName = ev?.name ?? null;
      eventSlug = ev?.slug ?? null;
    }

    return NextResponse.json({
      sessionId: session.id,
      eventName,
      eventSlug,
      completionStatus: session.completion_status,
      messages: messages ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
