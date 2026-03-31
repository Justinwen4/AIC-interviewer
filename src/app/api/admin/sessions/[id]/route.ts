import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data: session, error: sErr } = await supabase
    .from("interview_sessions")
    .select(
      `
      id,
      event_id,
      completion_status,
      started_at,
      ended_at,
      metadata,
      events ( name, slug ),
      interview_messages ( id, role, content, created_at ),
      interview_analysis ( * )
    `,
    )
    .eq("id", id)
    .single();

  if (sErr || !session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = [...(session.interview_messages ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return NextResponse.json({
    session: {
      ...session,
      interview_messages: messages,
    },
  });
}
