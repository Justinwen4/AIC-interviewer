"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type EventRow = { id: string; name: string; slug: string };

export function AdminFilters({ events }: { events: EventRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const apply = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const event = searchParams.get("event") ?? "all";
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    params.set("event", event);
    if (from) params.set("from", from);
    else params.delete("from");
    if (to) params.set("to", to);
    else params.delete("to");
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    startTransition(() => {
      router.push(`/admin?${params.toString()}`);
    });
  }, [router, searchParams, q]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4 font-sans shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-950">
        Event
        <select
          className="rounded-lg border border-zinc-400 bg-white px-2 py-1.5 font-sans text-sm text-zinc-950 shadow-sm"
          defaultValue={searchParams.get("event") ?? "all"}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("event", e.target.value);
            startTransition(() => router.push(`/admin?${params.toString()}`));
          }}
        >
          <option value="all">All events</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.slug}>
              {ev.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-950">
        From
        <input
          type="date"
          className="rounded-lg border border-zinc-400 bg-white px-2 py-1.5 font-sans text-sm text-zinc-950 shadow-sm"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) params.set("from", e.target.value);
            else params.delete("from");
            startTransition(() => router.push(`/admin?${params.toString()}`));
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-950">
        To
        <input
          type="date"
          className="rounded-lg border border-zinc-400 bg-white px-2 py-1.5 font-sans text-sm text-zinc-950 shadow-sm"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) params.set("to", e.target.value);
            else params.delete("to");
            startTransition(() => router.push(`/admin?${params.toString()}`));
          }}
        />
      </label>
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-semibold text-zinc-950">
        Search summaries
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-zinc-400 bg-white px-2 py-1.5 font-sans text-sm text-zinc-950 shadow-sm placeholder:text-zinc-600"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Keyword…"
          />
          <button
            type="button"
            onClick={() => apply()}
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </label>
    </div>
  );
}
