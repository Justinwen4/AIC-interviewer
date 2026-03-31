"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

const CONSENT_KEY = "aic_interview_consent_v1";

export function InterviewClient() {
  const searchParams = useSearchParams();
  const eventSlug = searchParams.get("event") ?? undefined;

  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const boot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const existing = await fetch("/api/session").then((r) => r.json());
      if (existing.error) throw new Error(existing.error);
      if (existing.sessionId && existing.messages?.length) {
        setMessages(existing.messages);
        if (existing.completionStatus !== "in_progress") {
          setEnded(true);
        }
        setLoading(false);
        return;
      }
      const created = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug }),
      }).then((r) => r.json());
      if (created.error) throw new Error(created.error);
      setMessages(created.messages ?? []);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session");
      setLoading(false);
    }
  }, [eventSlug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = sessionStorage.getItem(CONSENT_KEY) === "1";
    if (ok) {
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
    sessionStorage.setItem(CONSENT_KEY, "1");
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
