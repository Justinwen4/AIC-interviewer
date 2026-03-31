import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/admin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: session, error } = await supabase
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

  if (error || !session) {
    notFound();
  }

  const messages = [...(session.interview_messages ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const analysis = session.interview_analysis as {
    summary?: string;
    sentiment_summary?: string;
    themes?: string[];
    tools_mentioned?: string[];
    tools_requested?: string[];
    quotes?: { text?: string; note?: string }[];
    labels?: Record<string, unknown>;
  } | null;

  const ev = session.events as { name?: string; slug?: string } | null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Back
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-white">Session</h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">{session.id}</p>
        <dl className="mt-3 grid gap-2 text-sm text-zinc-400 sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Event</dt>
            <dd>{ev?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Status</dt>
            <dd>{session.completion_status}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Started</dt>
            <dd>{new Date(session.started_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Ended</dt>
            <dd>{session.ended_at ? new Date(session.ended_at).toLocaleString() : "—"}</dd>
          </div>
        </dl>
      </div>

      {analysis ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-semibold text-white">Analysis</h2>
          <div className="mt-3 space-y-3 text-sm text-zinc-300">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Summary
              </h3>
              <p className="mt-1 leading-relaxed">{analysis.summary ?? "—"}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Sentiment
              </h3>
              <p className="mt-1">{analysis.sentiment_summary ?? "—"}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Themes
                </h3>
                <ul className="mt-1 list-inside list-disc text-zinc-400">
                  {(analysis.themes ?? []).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Tools mentioned
                </h3>
                <ul className="mt-1 list-inside list-disc text-zinc-400">
                  {(analysis.tools_mentioned ?? []).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Tools requested / excited
                </h3>
                <ul className="mt-1 list-inside list-disc text-zinc-400">
                  {(analysis.tools_requested ?? []).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Representative quotes
              </h3>
              <ul className="mt-2 space-y-2">
                {(analysis.quotes ?? []).map((q, i) => (
                  <li
                    key={i}
                    className="border-l-2 border-indigo-500/40 pl-3 text-zinc-400"
                  >
                    “{q.text}”
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : (
        <p className="text-sm text-zinc-500">No analysis stored for this session yet.</p>
      )}

      <section>
        <h2 className="text-sm font-semibold text-white">Transcript</h2>
        <div className="mt-3 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          {messages.map((m) => (
            <div key={m.id}>
              <p className="text-xs font-medium uppercase text-zinc-500">
                {m.role === "user" ? "Member" : "Interviewer"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {m.content}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
