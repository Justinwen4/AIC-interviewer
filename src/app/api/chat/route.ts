import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getInterviewSessionIdFromCookie } from "@/lib/auth/interview-session";
import { getServerEnv } from "@/lib/env";
import { INTERVIEWER_SYSTEM_PROMPT } from "@/lib/llm/interviewer-prompt";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const sessionId = await getInterviewSessionIdFromCookie();
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "No session" }), { status: 401 });
  }

  const body = await request.json().catch(() => null) as { content?: string } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return new Response(JSON.stringify({ error: "content required" }), { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: session, error: sErr } = await supabase
    .from("interview_sessions")
    .select("id, completion_status")
    .eq("id", sessionId)
    .single();

  if (sErr || !session) {
    return new Response(JSON.stringify({ error: "Invalid session" }), { status: 400 });
  }
  if (session.completion_status !== "in_progress") {
    return new Response(JSON.stringify({ error: "Session ended" }), { status: 400 });
  }

  const { error: uErr } = await supabase.from("interview_messages").insert({
    session_id: sessionId,
    role: "user",
    content,
  });
  if (uErr) {
    return new Response(JSON.stringify({ error: uErr.message }), { status: 500 });
  }

  const { data: rows, error: mErr } = await supabase
    .from("interview_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (mErr || !rows) {
    return new Response(JSON.stringify({ error: mErr?.message ?? "messages" }), {
      status: 500,
    });
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: INTERVIEWER_SYSTEM_PROMPT },
    ...rows
      .filter((r) => r.role === "user" || r.role === "assistant")
      .map((r) => ({
        role: r.role as "user" | "assistant",
        content: r.content,
      })),
  ];

  const env = getServerEnv();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    stream: true,
    messages,
  });

  const encoder = new TextEncoder();
  let fullAssistant = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullAssistant += delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
          }
        }
        const { error: aErr } = await supabase.from("interview_messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: fullAssistant || "Thanks for sharing — I'll move on.",
        });
        if (aErr) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: aErr.message })}\n\n`),
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
