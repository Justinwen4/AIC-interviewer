-- AIC Member Insights — core schema (API uses service role; RLS on for defense in depth)
-- Safe to re-run: uses IF NOT EXISTS where supported.

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  starts_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete set null,
  completion_status text not null default 'in_progress'
    check (completion_status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_interview_sessions_event on public.interview_sessions (event_id);
create index if not exists idx_interview_sessions_started on public.interview_sessions (started_at desc);

create table if not exists public.interview_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_interview_messages_session on public.interview_messages (session_id, created_at);

create table if not exists public.interview_analysis (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  summary text,
  sentiment_summary text,
  themes text[],
  tools_mentioned text[],
  tools_requested text[],
  quotes jsonb not null default '[]'::jsonb,
  labels jsonb not null default '{}'::jsonb,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (session_id)
);

create index if not exists idx_interview_analysis_session on public.interview_analysis (session_id);

alter table public.events enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_messages enable row level security;
alter table public.interview_analysis enable row level security;

-- Default: no direct client access; Next.js uses service role for mutations.

insert into public.events (name, slug)
values ('General / AIC', 'general')
on conflict (slug) do nothing;
