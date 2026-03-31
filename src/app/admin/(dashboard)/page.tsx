import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { verifyAdminSession } from "@/lib/auth/admin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminFilters } from "./AdminFilters";

export const dynamic = "force-dynamic";

type Search = {
  event?: string;
  from?: string;
  to?: string;
  q?: string;
};

type SessionRow = {
  id: string;
  completion_status: string;
  started_at: string;
  ended_at: string | null;
  events: { name?: string; slug?: string } | null;
  interview_analysis:
    | { summary?: string; sentiment_summary?: string; themes?: string[] }
    | null;
};

async function loadData(searchParams: Search) {
  const supabase = getSupabaseAdmin();
  const eventSlug = searchParams.event;
  const from = searchParams.from;
  const to = searchParams.to;
  const q = searchParams.q?.trim().toLowerCase() ?? "";

  let eventId: string | null | undefined = undefined;
  if (eventSlug && eventSlug !== "all") {
    const { data: ev } = await supabase
      .from("events")
      .select("id")
      .eq("slug", eventSlug)
      .maybeSingle();
    eventId = ev?.id ?? null;
  }

  const { data: events } = await supabase
    .from("events")
    .select("id, name, slug")
    .order("created_at", { ascending: true });

  let sessionQuery = supabase
    .from("interview_sessions")
    .select(
      `
      id,
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
      return {
        events: events ?? [],
        sessions: [] as SessionRow[],
        aggregate: emptyAgg(),
      };
    }
    sessionQuery = sessionQuery.eq("event_id", eventId);
  }
  if (from) sessionQuery = sessionQuery.gte("started_at", from);
  if (to) sessionQuery = sessionQuery.lte("started_at", to);

  const { data: sessions } = await sessionQuery;

  let list = (sessions ?? []) as SessionRow[];
  if (q) {
    list = list.filter((s) => {
      const summary = s.interview_analysis?.summary ?? "";
      return summary.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    });
  }

  const sessionIds = list.map((s) => s.id);
  let aggregate = emptyAgg();
  if (sessionIds.length > 0) {
    const { data: analyses } = await supabase
      .from("interview_analysis")
      .select("themes, tools_mentioned, tools_requested, quotes")
      .in("session_id", sessionIds);

    aggregate = buildAggregate(analyses ?? []);
  }

  return { events: events ?? [], sessions: list, aggregate };
}

function emptyAgg() {
  return {
    sessionCount: 0,
    themeCounts: [] as { label: string; count: number }[],
    toolsMentioned: [] as { label: string; count: number }[],
    toolsRequested: [] as { label: string; count: number }[],
    sampleQuotes: [] as string[],
  };
}

function buildAggregate(
  analyses: {
    themes: string[] | null;
    tools_mentioned: string[] | null;
    tools_requested: string[] | null;
    quotes: unknown;
  }[],
) {
  const themeMap = new Map<string, number>();
  const toolsMap = new Map<string, number>();
  const requestedMap = new Map<string, number>();
  const quotes: string[] = [];

  for (const row of analyses) {
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
    const q = row.quotes as { text?: string }[] | null;
    if (Array.isArray(q)) {
      for (const item of q) {
        if (item?.text) quotes.push(item.text);
      }
    }
  }

  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([label, count]) => ({ label, count }));

  return {
    sessionCount: analyses.length,
    themeCounts: top(themeMap, 25),
    toolsMentioned: top(toolsMap, 25),
    toolsRequested: top(requestedMap, 25),
    sampleQuotes: quotes.slice(0, 30),
  };
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const sp = await searchParams;
  const { events, sessions, aggregate } = await loadData(sp);

  const exportParams = new URLSearchParams();
  if (sp.event && sp.event !== "all") exportParams.set("event", sp.event);
  if (sp.from) exportParams.set("from", sp.from);
  if (sp.to) exportParams.set("to", sp.to);

  return (
    <div className="space-y-8 font-sans text-zinc-950">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Member insights
        </h1>
        <p className="mt-1 text-sm text-zinc-900">
          Transcripts, summaries, and aggregate themes for filtered sessions.
        </p>
      </div>

      <Suspense fallback={<div className="text-sm text-zinc-800">Loading filters…</div>}>
        <AdminFilters events={events} />
      </Suspense>

      <div className="flex flex-wrap gap-2">
        <a
          className="rounded-lg border border-zinc-400 bg-white px-3 py-1.5 text-xs font-medium text-zinc-950 shadow-sm hover:bg-zinc-50"
          href={`/api/admin/export?format=csv&${exportParams.toString()}`}
        >
          Export CSV
        </a>
        <a
          className="rounded-lg border border-zinc-400 bg-white px-3 py-1.5 text-xs font-medium text-zinc-950 shadow-sm hover:bg-zinc-50"
          href={`/api/admin/export?format=json&${exportParams.toString()}`}
        >
          Export JSON
        </a>
      </div>

      <section className="rounded-xl border border-zinc-300 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-950">Aggregate (filtered)</h2>
        <p className="mt-1 text-xs font-medium text-zinc-900">
          Sessions in current filter with analysis: {aggregate.sessionCount}
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-950">
              Themes
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-zinc-900">
              {aggregate.themeCounts.length === 0 ? (
                <li className="text-zinc-800">No themes yet.</li>
              ) : (
                aggregate.themeCounts.map((t) => (
                  <li key={t.label}>
                    {t.label}{" "}
                    <span className="text-zinc-800">({t.count})</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-950">
              Tools mentioned
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-zinc-900">
              {aggregate.toolsMentioned.length === 0 ? (
                <li className="text-zinc-800">None extracted.</li>
              ) : (
                aggregate.toolsMentioned.map((t) => (
                  <li key={t.label}>
                    {t.label}{" "}
                    <span className="text-zinc-800">({t.count})</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-950">
              Tools requested / excited
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-zinc-900">
              {aggregate.toolsRequested.length === 0 ? (
                <li className="text-zinc-800">None extracted.</li>
              ) : (
                aggregate.toolsRequested.map((t) => (
                  <li key={t.label}>
                    {t.label}{" "}
                    <span className="text-zinc-800">({t.count})</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-950">
              Sample quotes
            </h3>
            <ul className="mt-2 space-y-2 text-sm text-zinc-900">
              {aggregate.sampleQuotes.length === 0 ? (
                <li className="text-zinc-800">No quotes yet.</li>
              ) : (
                aggregate.sampleQuotes.map((q, i) => (
                  <li key={i} className="border-l-2 border-zinc-500 pl-3 text-zinc-950">
                    “{q}”
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-950">Sessions</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-300 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-950">
              <tr>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Summary</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-800">
                    No sessions match filters.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-900">
                      {new Date(s.started_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-zinc-950">{s.completion_status}</td>
                    <td className="px-3 py-2 text-zinc-900">
                      {s.events?.name ?? "—"}
                    </td>
                    <td className="max-w-md truncate px-3 py-2 text-zinc-900">
                      {s.interview_analysis?.summary ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        className="font-medium text-indigo-600 hover:text-indigo-800"
                        href={`/admin/sessions/${s.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
