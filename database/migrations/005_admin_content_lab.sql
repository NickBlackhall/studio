-- Protected Admin Content Lab. Apply before the calibration seed in
-- make-it-terrible-admin-content-lab-kit/supabase/migrations/20260713_002_seed_calibration.sql
-- This migration does not alter gameplay tables or their RLS policies.

create extension if not exists pgcrypto;

create table if not exists public.content_generator_settings (
  id text primary key default 'default',
  prompt_version text not null default 'v1',
  model text not null default 'gpt-5-mini',
  batch_size integer not null default 8 check (batch_size between 4 and 12),
  max_character_count integer not null default 105 check (max_character_count between 20 and 200),
  prompt_text text not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.content_reference_examples (
  id uuid primary key default gen_random_uuid(),
  response_text text not null,
  verdict text not null check (verdict in ('approved', 'rejected', 'reference', 'maybe', 'needs_rewrite')),
  origin text,
  source_category text,
  source_scenario text,
  source_scenario_id uuid references public.scenarios(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists content_reference_examples_normalized_text_idx
  on public.content_reference_examples (lower(trim(response_text)));

create table if not exists public.content_motif_cooldowns (
  id uuid primary key default gen_random_uuid(),
  motif text not null unique,
  status text not null default 'cooldown' check (status in ('cooldown', 'limited', 'use_sparingly', 'banned_in_batch')),
  reason text,
  replacement_direction text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.content_generation_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  source_scenario_id uuid references public.scenarios(id) on delete set null,
  scenario_text text not null,
  category text,
  scenario_polarity text check (scenario_polarity in ('positive', 'negative', 'neutral_or_ambiguous')),
  prompt_version text not null default 'v1',
  model text not null,
  requested_count integer not null check (requested_count between 1 and 12),
  inspiration_response text,
  model_request_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.content_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.content_generation_sessions(id) on delete cascade,
  source_scenario_id uuid references public.scenarios(id) on delete set null,
  original_response_text text not null,
  response_text text not null,
  character_count integer generated always as (char_length(response_text)) stored,
  premise_attack text,
  portability text check (portability in ('high', 'medium', 'low')),
  spicy_level text check (spicy_level in ('clean', 'dark', 'crude', 'explicit')),
  generation_rank integer,
  status text not null default 'generated' check (status in ('generated', 'approved', 'rejected', 'needs_edit', 'published')),
  admin_notes text,
  rejection_reason text,
  duplicate_score numeric(5,4) not null default 0,
  duplicate_against text,
  moderation_flagged boolean not null default false,
  moderation_categories jsonb not null default '{}'::jsonb,
  created_by text not null,
  published_response_card_id uuid references public.response_cards(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_candidates_status_idx on public.content_candidates(status);
create index if not exists content_candidates_session_idx on public.content_candidates(session_id);
create index if not exists content_candidates_created_at_idx on public.content_candidates(created_at desc);

create table if not exists public.content_candidate_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.content_candidates(id) on delete cascade,
  event_type text not null check (event_type in ('generated', 'approved', 'rejected', 'edited', 'published', 'portability_tested')),
  previous_text text,
  new_text text,
  previous_status text,
  new_status text,
  reason text,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists content_candidate_events_candidate_idx
  on public.content_candidate_events(candidate_id, created_at desc);

create or replace function public.set_content_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists content_candidates_set_updated_at on public.content_candidates;
create trigger content_candidates_set_updated_at before update on public.content_candidates
for each row execute function public.set_content_updated_at();

-- Only the server-side service-role client accesses these tables.
alter table public.content_generator_settings enable row level security;
alter table public.content_reference_examples enable row level security;
alter table public.content_motif_cooldowns enable row level security;
alter table public.content_generation_sessions enable row level security;
alter table public.content_candidates enable row level security;
alter table public.content_candidate_events enable row level security;

insert into public.content_generator_settings (id, prompt_version, model, batch_size, max_character_count, prompt_text)
values ('default', 'v1', 'gpt-5-mini', 8, 105,
  'Attack the scenario premise first. Produce short, portable, vivid response-card fragments. Human approval is required.')
on conflict (id) do nothing;
