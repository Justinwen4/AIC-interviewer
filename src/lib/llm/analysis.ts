import OpenAI from "openai";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";

export const analysisSchema = z.object({
  interview_summary: z.string(),
  sentiment_summary: z.string(),
  recurring_themes: z.array(z.string()),
  tools_mentioned: z.array(z.string()),
  tools_requested_or_excited: z.array(z.string()),
  use_cases: z.array(z.string()),
  interest_areas: z.array(z.string()),
  pain_points: z.array(z.string()),
  event_feedback_themes: z.array(z.string()),
  requests_for_aic: z.array(z.string()),
  representative_quotes: z.array(
    z.object({
      text: z.string(),
      note: z.string().optional(),
    }),
  ),
});

export type AnalysisResult = z.infer<typeof analysisSchema>;

export async function runInterviewAnalysis(transcript: string): Promise<AnalysisResult> {
  const env = getServerEnv();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You analyze interview transcripts for AIC member research. Output JSON only, matching this shape:
{
  "interview_summary": string (2-4 sentences),
  "sentiment_summary": string (overall tone: positive/mixed/negative and why),
  "recurring_themes": string[] (short labels),
  "tools_mentioned": string[] (AI products/tools named),
  "tools_requested_or_excited": string[] (tools they want to try or learn),
  "use_cases": string[] (how they use AI),
  "interest_areas": string[] (topics they care about),
  "pain_points": string[] (frustrations or gaps),
  "event_feedback_themes": string[] (about the event/session if relevant),
  "requests_for_aic": string[] (what would make AIC more useful),
  "representative_quotes": array of { "text": string, "note": optional short context }
}
Use empty arrays when nothing applies. De-identify: avoid repeating names, employers, or other sensitive details in quotes.`,
      },
      {
        role: "user",
        content: `Transcript:\n\n${transcript}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("analysis: empty model response");
  }
  const parsed = JSON.parse(raw) as unknown;
  return analysisSchema.parse(parsed);
}
