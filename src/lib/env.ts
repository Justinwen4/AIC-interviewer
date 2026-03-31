import { z } from "zod";

/** Trim whitespace; strip accidental `Bearer ` prefix on API keys. */
function trimKey(s: string): string {
  return s.trim().replace(/^Bearer\s+/i, "");
}

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().url()),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .transform(trimKey)
    .pipe(z.string().min(1)),
  OPENAI_API_KEY: z
    .string()
    .transform(trimKey)
    .pipe(z.string().min(1)),
  ADMIN_PASSWORD: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(12)),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Missing or invalid environment variables: ${parsed.error.flatten().fieldErrors}`,
    );
  }
  return parsed.data;
}

