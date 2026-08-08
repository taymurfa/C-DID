-- DEPRECATED: Speaker Signal persists to MongoDB Atlas only.
-- This Postgres/Supabase schema is retained for historical reference and is
-- not used by the Docker demo stack. See root README collection map:
--   speaker_signal_ingestion  → runs
--   speaker_signal_intelligence → qualifications
--   speaker_signal_gtm        → sequences, funnel_events

create extension if not exists pgcrypto;

create type public.analysis_status as enum ('queued', 'running', 'completed', 'failed');
create type public.outreach_status as enum ('draft', 'scheduled', 'sent', 'replied', 'paused');
create type public.project_stage as enum ('Concept', 'FEL-1', 'FEL-2 / pre-FEED', 'FEED', 'Interconnection', 'FID', 'Construction', 'COD');

create table public.conferences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website_url text not null,
  city text,
  state text,
  country text,
  venue text,
  start_date timestamptz,
  end_date timestamptz,
  status analysis_status not null default 'queued',
  source_url text not null,
  last_scraped_at timestamptz,
  next_scrape_at timestamptz,
  discovered_automatically boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conference_sources (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid references public.conferences(id) on delete cascade,
  url text not null unique,
  source_type text not null,
  content_hash text,
  last_fetched_at timestamptz,
  scrape_status analysis_status not null default 'queued',
  raw_markdown text,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete cascade,
  title text not null,
  description text,
  session_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  source_url text not null,
  relevance_score smallint check (relevance_score between 0 and 100),
  relevance_reason text,
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  normalized_name text not null unique,
  website text,
  industry text,
  company_type text,
  description text,
  icp_score smallint check (icp_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.speakers (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  normalized_name text not null,
  title text,
  company_id uuid references public.companies(id) on delete set null,
  linkedin_url text,
  bio text,
  role_fit smallint not null default 0,
  company_fit smallint not null default 0,
  topic_relevance smallint not null default 0,
  seniority smallint not null default 0,
  buying_influence smallint not null default 0,
  event_proximity smallint not null default 0,
  overall_score smallint not null check (overall_score between 0 and 100),
  score_reason text not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name, company_id)
);

create table public.project_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_name text not null,
  url text not null unique,
  content_hash text,
  last_fetched_at timestamptz,
  next_fetch_at timestamptz,
  scrape_status analysis_status not null default 'queued',
  raw_markdown text,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  normalized_name text not null,
  company_id uuid references public.companies(id) on delete set null,
  project_type text,
  capacity_mw numeric,
  county text,
  state text,
  latitude numeric,
  longitude numeric,
  inferred_stage project_stage not null default 'Concept',
  stage_confidence numeric(4,3) not null check (stage_confidence between 0 and 1),
  signal_score smallint not null check (signal_score between 0 and 100),
  latest_signal text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_aliases (
  project_id uuid references public.projects(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source_url text not null,
  primary key (project_id, normalized_alias)
);

create table public.project_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid references public.project_sources(id) on delete set null,
  evidence_type text not null,
  title text not null,
  excerpt text not null,
  source_url text not null,
  observed_at timestamptz not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table public.project_stage_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  stage project_stage not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  reason text not null,
  evidence_ids uuid[] not null default '{}',
  inferred_at timestamptz not null default now()
);

create table public.person_project_signals (
  project_id uuid references public.projects(id) on delete cascade,
  speaker_id uuid references public.speakers(id) on delete cascade,
  conference_id uuid references public.conferences(id) on delete cascade,
  priority_score smallint not null check (priority_score between 0 and 100),
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, speaker_id, conference_id)
);

create table public.session_speakers (
  session_id uuid references public.sessions(id) on delete cascade,
  speaker_id uuid references public.speakers(id) on delete cascade,
  primary key (session_id, speaker_id)
);

create table public.speaker_evidence (
  id uuid primary key default gen_random_uuid(),
  speaker_id uuid not null references public.speakers(id) on delete cascade,
  evidence_type text not null,
  excerpt text not null,
  source_url text not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  extracted_at timestamptz not null default now()
);

create table public.outreach_sequences (
  id uuid primary key default gen_random_uuid(),
  speaker_id uuid not null references public.speakers(id) on delete cascade,
  conference_id uuid not null references public.conferences(id) on delete cascade,
  status outreach_status not null default 'draft',
  current_step smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (speaker_id, conference_id)
);

create table public.outreach_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.outreach_sequences(id) on delete cascade,
  step_type text not null check (step_type in ('T-14', 'T-7', 'T-2', 'Event', 'T+2')),
  scheduled_for timestamptz not null,
  subject text,
  body text,
  status outreach_status not null default 'draft',
  sent_at timestamptz,
  replied_at timestamptz
);

create table public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  speaker_id uuid not null references public.speakers(id) on delete cascade,
  conference_id uuid not null references public.conferences(id) on delete cascade,
  stage text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_type text not null,
  input_reference jsonb not null,
  output_reference jsonb,
  status analysis_status not null default 'queued',
  confidence numeric(4,3),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);

create index conferences_start_date_idx on public.conferences(start_date);
create index sessions_conference_idx on public.sessions(conference_id);
create index speakers_score_idx on public.speakers(overall_score desc);
create index evidence_speaker_idx on public.speaker_evidence(speaker_id);
create index sequence_schedule_idx on public.outreach_steps(scheduled_for, status);
create index funnel_stage_idx on public.funnel_events(stage, occurred_at desc);
create index projects_signal_score_idx on public.projects(signal_score desc);
create index projects_stage_idx on public.projects(inferred_stage, stage_confidence desc);
create index project_evidence_project_idx on public.project_evidence(project_id, observed_at desc);
create index project_stage_history_idx on public.project_stage_history(project_id, inferred_at desc);
create index person_project_priority_idx on public.person_project_signals(priority_score desc);

alter table public.conferences enable row level security;
alter table public.conference_sources enable row level security;
alter table public.sessions enable row level security;
alter table public.companies enable row level security;
alter table public.speakers enable row level security;
alter table public.session_speakers enable row level security;
alter table public.speaker_evidence enable row level security;
alter table public.outreach_sequences enable row level security;
alter table public.outreach_steps enable row level security;
alter table public.funnel_events enable row level security;
alter table public.agent_runs enable row level security;
alter table public.project_sources enable row level security;
alter table public.projects enable row level security;
alter table public.project_aliases enable row level security;
alter table public.project_evidence enable row level security;
alter table public.project_stage_history enable row level security;
alter table public.person_project_signals enable row level security;

-- Create workspace-scoped policies before exposing these tables to authenticated clients.
-- Until then, use the service role only from trusted server routes.
