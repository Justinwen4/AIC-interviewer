"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/client/json-fetch";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

const CONSENT_KEY = "aic_interview_consent_v1";

export function InterviewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventSlug = searchParams.get("event") ?? undefined;
  const forceNewSession = searchParams.get("new") === "1";

  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const bootPromiseRef = useRef<Promise<void> | null>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  type SessionPayload = {
    sessionId: string | null;
    messages: ChatMessage[];
    completionStatus?: string;
    error?: string;
  };

  const boot = useCallback(async () => {
    // #region agent log
    fetch("http://127.0.0.1:7483/ingest/46ed386d-f4de-40a7-81f7-25238153133b", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ad68" },
      body: JSON.stringify({
        sessionId: "a1ad68",
        location: "InterviewClient.tsx:boot:entry",
        message: "boot invoked",
        data: {
          forceNewSession,
          hadPendingPromise: !!bootPromiseRef.current,
          urlSearch:
            typeof window !== "undefined" ? window.location.search : "no-window",
        },
        timestamp: Date.now(),
        hypothesisId: "H1",
        runId: "pre-fix",
      }),
    }).catch(() => {});
    // #endregion
    if (bootPromiseRef.current) {
      await bootPromiseRef.current;
      // #region agent log
      fetch("http://127.0.0.1:7483/ingest/46ed386d-f4de-40a7-81f7-25238153133b", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ad68" },
        body: JSON.stringify({
          sessionId: "a1ad68",
          location: "InterviewClient.tsx:boot:after-await-pending",
          message: "early return: awaited existing boot promise",
          data: { forceNewSession },
          timestamp: Date.now(),
          hypothesisId: "H1",
          runId: "pre-fix",
        }),
      }).catch(() => {});
      // #endregion
      return;
    }
    const run = (async () => {
      setLoading(true);
      setError(null);
      try {
        if (forceNewSession) {
          // #region agent log
          fetch("http://127.0.0.1:7483/ingest/46ed386d-f4de-40a7-81f7-25238153133b", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ad68" },
            body: JSON.stringify({
              sessionId: "a1ad68",
              location: "InterviewClient.tsx:boot:forceNew-branch",
              message: "taking POST forceNew path",
              data: {},
              timestamp: Date.now(),
              hypothesisId: "H4",
              runId: "pre-fix",
            }),
          }).catch(() => {});
          // #endregion
          const created = await fetchJson<SessionPayload>("/api/session", {
            method: "POST",
            body: JSON.stringify({ eventSlug, forceNew: true }),
          });
          if (!created.ok) {
            const hint =
              created.status === 503 ||
              /environment variables|supabase|relation|does not exist/i.test(created.error)
                ? " Set SUPABASE_SERVICE_ROLE_KEY in .env.local, run the SQL in supabase/migrations in the Supabase SQL editor, then restart the dev server."
                : "";
            throw new Error(created.error + hint);
          }
          const cr = created.data;
          if (!cr.messages?.length) {
            throw new Error("Session started but no messages returned. Check database and API logs.");
          }
          setMessages(cr.messages);
          setEnded(false);
          const params = new URLSearchParams(searchParams.toString());
          params.delete("new");
          const qs = params.toString();
          router.replace(`/interview${qs ? `?${qs}` : ""}`);
          return;
        }

        // #region agent log
        fetch("http://127.0.0.1:7483/ingest/46ed386d-f4de-40a7-81f7-25238153133b", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ad68" },
          body: JSON.stringify({
            sessionId: "a1ad68",
            location: "InterviewClient.tsx:boot:get-branch",
            message: "taking GET existing session path",
            data: { forceNewSession },
            timestamp: Date.now(),
            hypothesisId: "H2",
            runId: "pre-fix",
          }),
        }).catch(() => {});
        // #endregion
        const existing = await fetchJson<SessionPayload>("/api/session");
        if (!existing.ok) {
          throw new Error(existing.error);
        }
        const ex = existing.data;
        if (ex.sessionId && ex.messages?.length) {
          setMessages(ex.messages);
          if (ex.completionStatus !== "in_progress") {
            setEnded(true);
          }
          return;
        }
        const created = await fetchJson<SessionPayload>("/api/session", {
          method: "POST",
          body: JSON.stringify({ eventSlug }),
        });
        if (!created.ok) {
          const hint =
            created.status === 503 || /environment variables|supabase|relation|does not exist/i.test(
              created.error,
            )
              ? " Set SUPABASE_SERVICE_ROLE_KEY in .env.local, run the SQL in supabase/migrations in the Supabase SQL editor, then restart the dev server."
              : "";
          throw new Error(created.error + hint);
        }
        const cr = created.data;
        if (!cr.messages?.length) {
          throw new Error("Session started but no messages returned. Check database and API logs.");
        }
        setMessages(cr.messages);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start session");
      } finally {
        setLoading(false);
      }
    })();
    bootPromiseRef.current = run;
    try {
      await run;
    } finally {
      bootPromiseRef.current = null;
    }
  }, [eventSlug, forceNewSession, router, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let consentFlag = false;
    try {
      consentFlag = sessionStorage.getItem(CONSENT_KEY) === "1";
    } catch {
      consentFlag = false;
    }
    if (consentFlag) {
      setConsent(true);
      void boot();
    } else {
      setLoading(false);
    }
  }, [boot]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  const acceptConsent = () => {
    try {
      sessionStorage.setItem(CONSENT_KEY, "1");
    } catch {
      /* private mode / quota */
    }
    setConsent(true);
    void boot();
  };

  const send = async (content: string) => {
    if (!content.trim() || streaming || ended) return;
    setError(null);
    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setStreaming(true);

    const assistantId = `assistant-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: assistantId, role: "assistant", content: "", created_at: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.statusText);
      }
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      let buffer = "";
      let full = "";
      if (!reader) throw new Error("No response body");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as { text?: string; error?: string };
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) full += parsed.text;
            } catch (err) {
              if (err instanceof SyntaxError) continue;
              throw err;
            }
          }
        }
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, content: full } : msg)),
        );
      }
      for (const line of buffer.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as { text?: string; error?: string };
          if (parsed.text) full += parsed.text;
        } catch {
          /* ignore */
        }
      }
      setMessages((m) =>
        m.map((msg) => (msg.id === assistantId ? { ...msg, content: full || "…" } : msg)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setMessages((m) => m.filter((msg) => msg.id !== userMsg.id && msg.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  };

  const finish = async (status: "completed" | "abandoned") => {
    setEnded(true);
    setStreaming(false);
    try {
      await fetch("/api/session/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      /* non-blocking */
    }
  };

  if (!consent) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-10">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="font-sans text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Member insights
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            AIC uses this short conversation for internal research and to improve programs. Responses
            are reviewed in aggregate; we avoid collecting unnecessary personal details. Do not share
            passwords or sensitive account information.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            By continuing, you agree your feedback may be used for internal research and product
            planning. A retention policy applies before wider sharing of quotes.
          </p>
          <button
            type="button"
            onClick={acceptConsent}
            className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-zinc-500">
        Starting interviewer…
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => void boot()}
          className="mt-4 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[min(100dvh,800px)] max-w-2xl flex-col px-3 pb-4 pt-4 sm:px-4">
      <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            AIC feedback
          </p>
          <h1 className="font-sans text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Member insights interviewer
          </h1>
          {eventSlug ? (
            <p className="text-xs text-zinc-500">Event context: {eventSlug}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={streaming || ended}
            onClick={() => void send("[SKIP]")}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300"
          >
            Skip question
          </button>
          <button
            type="button"
            disabled={streaming || ended}
            onClick={() => void finish("completed")}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            End interview
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              }`}
            >
              {m.content || (streaming && m.role === "assistant" ? "…" : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}

      {ended ? (
        <p className="mt-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Thanks — you’re all set. Your feedback helps AIC improve.
        </p>
      ) : (
        <form
          className="mt-3 flex shrink-0 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none ring-indigo-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="Type your reply…"
            value={input}
            disabled={streaming || ended}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Your message"
          />
          <button
            type="submit"
            disabled={streaming || ended || !input.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
