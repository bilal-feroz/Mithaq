-- ═══════════════════════════════════════════════════════════════════════
-- MITHAQ Gate — initial schema
-- Postgres / Supabase. All authorization decisions are made by the
-- application's deterministic engine; this schema persists them and
-- guarantees atomicity for the security-critical mutations via functions.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── identity ─────────────────────────────────────────────────────────────

create table public.profiles (
  id            text primary key,
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  display_name  text not null,
  role          text not null check (role in ('owner', 'requester')),
  title         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.organizations (
  id          text primary key,
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.organization_members (
  organization_id text not null references public.organizations (id) on delete cascade,
  profile_id      text not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create table public.voice_profiles (
  id                 text primary key,
  owner_id           text not null references public.profiles (id) on delete cascade,
  display_name       text not null,
  provider_voice_id  text,
  description        text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index voice_profiles_owner_idx on public.voice_profiles (owner_id);

-- ── consent policies (versioned, never mutated in place) ────────────────

create table public.consent_policies (
  id                          text primary key,
  version                     integer not null check (version >= 1),
  owner_id                    text not null references public.profiles (id),
  voice_id                    text not null references public.voice_profiles (id) on delete cascade,
  status                      text not null check (status in ('draft','active','superseded','revoked','expired')),
  authorized_organization_ids text[] not null default '{}',
  allowed_purposes            text[] not null default '{}',
  allowed_platforms           text[] not null default '{}',
  allowed_languages           text[] not null default '{}',
  allowed_territories         text[] not null default '{}',
  paid_advertising            text not null check (paid_advertising in ('allowed','prohibited')),
  editing_allowed             boolean not null default false,
  maximum_assets              integer not null check (maximum_assets >= 0),
  assets_used                 integer not null default 0 check (assets_used >= 0),
  valid_from                  timestamptz not null,
  valid_until                 timestamptz not null,
  prohibited_topics           text[] not null default '{}',
  grants                      jsonb not null default '[]',
  source_consent_text         text not null default '',
  source_consent_language     text not null default 'en',
  owner_approved_at           timestamptz,
  supersedes_policy_id        text references public.consent_policies (id),
  revoked_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (voice_id, version),
  check (assets_used <= maximum_assets or maximum_assets = 0)
);
create index consent_policies_voice_idx on public.consent_policies (voice_id, version desc);
create index consent_policies_status_idx on public.consent_policies (status);

-- At most one ACTIVE policy version per voice.
create unique index consent_policies_one_active_per_voice
  on public.consent_policies (voice_id) where status = 'active';

-- ── generation requests ─────────────────────────────────────────────────

create table public.generation_requests (
  id               text primary key,
  requester_id     text not null references public.profiles (id),
  organization_id  text not null references public.organizations (id),
  voice_id         text not null references public.voice_profiles (id),
  script           text not null,
  script_hash      text not null check (script_hash ~ '^[0-9a-f]{64}$'),
  campaign_name    text not null,
  purpose          text not null,
  platform         text not null,
  language         text not null,
  placement        text not null check (placement in ('organic','paid')),
  territory        text not null,
  publication_date timestamptz not null,
  topic_tags       text[] not null default '{}',
  status           text not null check (status in ('draft','evaluating','blocked','approved','generating','generated','failed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index generation_requests_org_idx on public.generation_requests (organization_id, created_at desc);
create index generation_requests_voice_idx on public.generation_requests (voice_id, created_at desc);

-- ── decisions + clause results ──────────────────────────────────────────

create table public.policy_decisions (
  id               text primary key,
  request_id       text not null references public.generation_requests (id) on delete cascade,
  policy_id        text not null references public.consent_policies (id),
  policy_version   integer not null,
  outcome          text not null check (outcome in ('approved','blocked')),
  matched_grant_id text,
  evaluated_at     timestamptz not null,
  created_at       timestamptz not null default now()
);
create index policy_decisions_request_idx on public.policy_decisions (request_id, created_at);

create table public.decision_clause_results (
  id           bigint generated always as identity primary key,
  decision_id  text not null references public.policy_decisions (id) on delete cascade,
  position     integer not null,
  clause       text not null,
  status       text not null check (status in ('passed','failed')),
  code         text not null,
  expected     jsonb,
  received     jsonb,
  explanation  text not null,
  suggested_remedy text,
  unique (decision_id, position)
);
create index decision_clause_results_decision_idx on public.decision_clause_results (decision_id);

-- ── single-use decision tokens ──────────────────────────────────────────

create table public.decision_tokens (
  jti              text primary key,
  decision_id      text not null references public.policy_decisions (id),
  request_id       text not null references public.generation_requests (id),
  policy_id        text not null references public.consent_policies (id),
  policy_version   integer not null,
  status           text not null check (status in ('minted','consumed','rejected','expired')),
  minted_at        timestamptz not null default now(),
  consumed_at      timestamptz,
  rejected_reason  text
);
create index decision_tokens_request_idx on public.decision_tokens (request_id);

-- ── amendments ──────────────────────────────────────────────────────────

create table public.amendment_requests (
  id                        text primary key,
  policy_id                 text not null references public.consent_policies (id),
  policy_version            integer not null,
  request_id                text not null references public.generation_requests (id),
  decision_id               text not null references public.policy_decisions (id),
  organization_id           text not null references public.organizations (id),
  voice_id                  text not null references public.voice_profiles (id),
  requested_by_id           text not null references public.profiles (id),
  failed_clause_codes       text[] not null default '{}',
  original_clause           text not null default '',
  proposal                  jsonb not null,
  status                    text not null check (status in ('pending','approved','rejected')),
  owner_decision_at         timestamptz,
  owner_decision_note       text,
  resulting_policy_id       text references public.consent_policies (id),
  resulting_policy_version  integer,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index amendment_requests_voice_idx on public.amendment_requests (voice_id, created_at desc);
create index amendment_requests_request_idx on public.amendment_requests (request_id);

-- ── generated assets ────────────────────────────────────────────────────

create table public.generated_assets (
  id                text primary key,
  verification_id   text not null unique,
  decision_id       text not null references public.policy_decisions (id),
  request_id        text not null unique references public.generation_requests (id),
  policy_id         text not null references public.consent_policies (id),
  policy_version    integer not null,
  voice_id          text not null references public.voice_profiles (id),
  organization_id   text not null references public.organizations (id),
  storage_path      text not null,
  sha256            text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type         text not null,
  byte_length       bigint not null check (byte_length > 0),
  provider          text not null,
  provider_asset_id text,
  created_at        timestamptz not null default now()
);
create index generated_assets_org_idx on public.generated_assets (organization_id, created_at desc);
create index generated_assets_voice_idx on public.generated_assets (voice_id, created_at desc);

-- ── tamper-evident audit chain ──────────────────────────────────────────

create table public.audit_events (
  id                  text primary key,
  seq                 bigint generated always as identity,
  aggregate_type      text not null,
  aggregate_id        text not null,
  event_type          text not null,
  actor_id            text references public.profiles (id),
  payload             jsonb not null,
  payload_hash        text not null,
  previous_event_hash text,
  current_event_hash  text not null unique,
  created_at          timestamptz not null default now()
);
create index audit_events_aggregate_idx on public.audit_events (aggregate_type, aggregate_id);
create index audit_events_seq_idx on public.audit_events (seq);
-- Linear-chain guarantee: at most one successor per event. Concurrent
-- appenders race on this index; the loser re-reads the head and retries.
create unique index audit_events_prev_unique
  on public.audit_events (previous_event_hash) where previous_event_hash is not null;

-- ═══════════════════════════════════════════════════════════════════════
-- Atomic operations (SECURITY DEFINER, called by the application server)
-- ═══════════════════════════════════════════════════════════════════════

-- Single-use token consumption: succeeds exactly once per jti.
create or replace function public.consume_decision_token(p_jti text, p_consumed_at timestamptz)
returns table (ok boolean, reason text) language plpgsql security definer as $$
declare v_status text; v_policy_status text; v_policy_id text; v_voice_id text; v_policy_version int;
begin
  -- Lock the policy row while validating and consuming so revocation cannot
  -- commit between the gateway's final status check and token consumption.
  select dt.status, cp.status, cp.id, cp.voice_id, cp.version
    into v_status, v_policy_status, v_policy_id, v_voice_id, v_policy_version
    from public.decision_tokens dt
    join public.consent_policies cp on cp.id = dt.policy_id
   where dt.jti = p_jti
   for share of cp;

  if v_status is null then
    return query select false, 'TOKEN_UNKNOWN'; return;
  elsif v_status = 'consumed' then
    return query select false, 'TOKEN_REPLAYED'; return;
  elsif v_status <> 'minted' then
    return query select false, 'TOKEN_INVALIDATED'; return;
  end if;

  if v_policy_status = 'revoked' then
    update public.decision_tokens
       set status = 'rejected', rejected_reason = 'POLICY_REVOKED'
     where jti = p_jti and status = 'minted';
    return query select false, 'POLICY_REVOKED'; return;
  end if;
  if v_policy_status <> 'active' or exists (
    select 1 from public.consent_policies newer
     where newer.voice_id = v_voice_id and newer.version > v_policy_version
  ) then
    update public.decision_tokens
       set status = 'rejected', rejected_reason = 'POLICY_SUPERSEDED'
     where jti = p_jti and status = 'minted';
    return query select false, 'POLICY_SUPERSEDED'; return;
  end if;

  update public.decision_tokens
     set status = 'consumed', consumed_at = p_consumed_at
   where jti = p_jti and status = 'minted';
  if found then
    return query select true, null::text; return;
  end if;
  return query select false, 'TOKEN_INVALIDATED';
end $$;

-- Atomic usage increment with headroom check (base pool or a grant pool).
create or replace function public.increment_policy_usage(
  p_policy_id text, p_grant_id text, p_updated_at timestamptz
) returns void language plpgsql security definer as $$
declare v_grants jsonb; v_grant jsonb; v_index int;
begin
  if p_grant_id is null then
    update public.consent_policies
       set assets_used = assets_used + 1, updated_at = p_updated_at
     where id = p_policy_id and assets_used < maximum_assets;
    if not found then raise exception 'USAGE_LIMIT_REACHED'; end if;
  else
    select grants into v_grants from public.consent_policies where id = p_policy_id for update;
    if v_grants is null then raise exception 'POLICY_NOT_FOUND'; end if;
    v_index := null;
    for i in 0 .. jsonb_array_length(v_grants) - 1 loop
      if v_grants -> i ->> 'id' = p_grant_id then v_index := i; v_grant := v_grants -> i; end if;
    end loop;
    if v_index is null then raise exception 'GRANT_NOT_FOUND'; end if;
    if (v_grant ->> 'assetsUsed')::int >= (v_grant ->> 'maximumAssets')::int then
      raise exception 'USAGE_LIMIT_REACHED';
    end if;
    v_grant := jsonb_set(v_grant, '{assetsUsed}', to_jsonb((v_grant ->> 'assetsUsed')::int + 1));
    update public.consent_policies
       set grants = jsonb_set(grants, array[v_index::text], v_grant), updated_at = p_updated_at
     where id = p_policy_id;
  end if;
end $$;

-- Atomic successful-generation finalization. Storage upload happens first;
-- this transaction then consumes allowance, registers exactly one asset per
-- request, and marks the request generated. Any error rolls all database
-- mutations back; the server removes the uploaded private object on failure.
create or replace function public.finalize_generation(
  p_asset jsonb, p_grant_id text, p_completed_at timestamptz
) returns void language plpgsql security definer as $$
begin
  perform public.increment_policy_usage(
    p_asset ->> 'policyId', p_grant_id, p_completed_at
  );

  insert into public.generated_assets (
    id, verification_id, decision_id, request_id, policy_id, policy_version,
    voice_id, organization_id, storage_path, sha256, mime_type, byte_length,
    provider, provider_asset_id, created_at
  ) values (
    p_asset ->> 'id', p_asset ->> 'verificationId',
    p_asset ->> 'decisionId', p_asset ->> 'requestId',
    p_asset ->> 'policyId', (p_asset ->> 'policyVersion')::int,
    p_asset ->> 'voiceId', p_asset ->> 'organizationId',
    p_asset ->> 'storagePath', p_asset ->> 'sha256',
    p_asset ->> 'mimeType', (p_asset ->> 'byteLength')::bigint,
    p_asset ->> 'provider', p_asset ->> 'providerAssetId',
    (p_asset ->> 'createdAt')::timestamptz
  );

  update public.generation_requests
     set status = 'generated', updated_at = p_completed_at
   where id = p_asset ->> 'requestId' and status = 'generating';
  if not found then raise exception 'REQUEST_NOT_GENERATING'; end if;
end $$;

-- Atomic policy versioning: supersede the active version + insert the new one.
create or replace function public.create_policy_version(
  p_superseded_id text, p_new_policy jsonb
) returns void language plpgsql security definer as $$
begin
  update public.consent_policies
     set status = 'superseded', updated_at = (p_new_policy ->> 'createdAt')::timestamptz
   where id = p_superseded_id and status = 'active';
  if not found then raise exception 'POLICY_NOT_ACTIVE'; end if;

  insert into public.consent_policies (
    id, version, owner_id, voice_id, status,
    authorized_organization_ids, allowed_purposes, allowed_platforms,
    allowed_languages, allowed_territories, paid_advertising, editing_allowed,
    maximum_assets, assets_used, valid_from, valid_until, prohibited_topics,
    grants, source_consent_text, source_consent_language, owner_approved_at,
    supersedes_policy_id, revoked_at, created_at, updated_at
  )
  select
    p_new_policy ->> 'id', (p_new_policy ->> 'version')::int,
    p_new_policy ->> 'ownerId', p_new_policy ->> 'voiceId', p_new_policy ->> 'status',
    coalesce(array(select jsonb_array_elements_text(p_new_policy -> 'authorizedOrganizationIds')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_new_policy -> 'allowedPurposes')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_new_policy -> 'allowedPlatforms')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_new_policy -> 'allowedLanguages')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_new_policy -> 'allowedTerritories')), '{}'),
    p_new_policy ->> 'paidAdvertising', (p_new_policy ->> 'editingAllowed')::boolean,
    (p_new_policy ->> 'maximumAssets')::int, (p_new_policy ->> 'assetsUsed')::int,
    (p_new_policy ->> 'validFrom')::timestamptz, (p_new_policy ->> 'validUntil')::timestamptz,
    coalesce(array(select jsonb_array_elements_text(p_new_policy -> 'prohibitedTopics')), '{}'),
    coalesce(p_new_policy -> 'grants', '[]'::jsonb),
    coalesce(p_new_policy ->> 'sourceConsentText', ''),
    coalesce(p_new_policy ->> 'sourceConsentLanguage', 'en'),
    (p_new_policy ->> 'ownerApprovedAt')::timestamptz,
    p_new_policy ->> 'supersedesPolicyId', null,
    (p_new_policy ->> 'createdAt')::timestamptz, (p_new_policy ->> 'updatedAt')::timestamptz;
end $$;

-- These SECURITY DEFINER mutations are server-only RPCs. Supabase exposes
-- database functions over its API, so default PUBLIC execute privileges must
-- be removed explicitly.
revoke execute on function public.consume_decision_token(text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.increment_policy_usage(text, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.finalize_generation(jsonb, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.create_policy_version(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.consume_decision_token(text, timestamptz)
  to service_role;
grant execute on function public.increment_policy_usage(text, text, timestamptz)
  to service_role;
grant execute on function public.finalize_generation(jsonb, text, timestamptz)
  to service_role;
grant execute on function public.create_policy_version(text, jsonb)
  to service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- The application server uses the service-role key (bypasses RLS) and is
-- the sole writer of decisions, tokens and assets. RLS protects every
-- direct client access path:
--   • owners manage their voices, policies, amendments, revocations
--   • organization members see their organization's requests/assets
--   • requesters see only policies that authorize their organization
--   • the public sees only the public_verifications view
--   • token internals and provider credentials are never client-readable
-- ═══════════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.voice_profiles enable row level security;
alter table public.consent_policies enable row level security;
alter table public.generation_requests enable row level security;
alter table public.policy_decisions enable row level security;
alter table public.decision_clause_results enable row level security;
alter table public.decision_tokens enable row level security;
alter table public.amendment_requests enable row level security;
alter table public.generated_assets enable row level security;
alter table public.audit_events enable row level security;

-- helpers
create or replace function public.current_profile_id() returns text
language sql stable security definer as $$
  select id from public.profiles where auth_user_id = auth.uid();
$$;

create or replace function public.is_member_of(p_org text) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org and profile_id = public.current_profile_id()
  );
$$;

create or replace function public.owns_voice(p_voice text) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.voice_profiles
    where id = p_voice and owner_id = public.current_profile_id()
  );
$$;

-- Profiles: read own row. Domain writes are server-only through authorized
-- application actions; the service role bypasses RLS.
create policy profiles_select_own on public.profiles
  for select using (auth_user_id = auth.uid());

-- organizations: members can read their organization
create policy organizations_select_member on public.organizations
  for select using (public.is_member_of(id));

create policy organization_members_select_own on public.organization_members
  for select using (profile_id = public.current_profile_id());

-- Voice profiles: owners read their records; requesters may read voices whose
-- policies authorize them. Creation/changes remain server-only.
create policy voice_profiles_owner_read on public.voice_profiles
  for select using (owner_id = public.current_profile_id());
create policy voice_profiles_requester_read on public.voice_profiles
  for select using (exists (
    select 1 from public.consent_policies cp
    where cp.voice_id = id
      and cp.authorized_organization_ids && (
        select coalesce(array_agg(organization_id), '{}')
        from public.organization_members
        where profile_id = public.current_profile_id()
      )
  ));

-- Consent policies: owners and authorized requesters can read. Versioning,
-- approval and revocation remain server-only atomic operations.
create policy consent_policies_owner_read on public.consent_policies
  for select using (owner_id = public.current_profile_id());
create policy consent_policies_requester_read on public.consent_policies
  for select using (
    authorized_organization_ids && (
      select coalesce(array_agg(organization_id), '{}')
      from public.organization_members
      where profile_id = public.current_profile_id()
    )
  );

-- generation requests: members of the requesting organization + the voice owner
create policy generation_requests_member on public.generation_requests
  for select using (public.is_member_of(organization_id) or public.owns_voice(voice_id));

-- decisions + clauses: visible to the request's organization and the voice owner
create policy policy_decisions_visible on public.policy_decisions
  for select using (exists (
    select 1 from public.generation_requests gr
    where gr.id = request_id
      and (public.is_member_of(gr.organization_id) or public.owns_voice(gr.voice_id))
  ));
create policy decision_clause_results_visible on public.decision_clause_results
  for select using (exists (
    select 1 from public.policy_decisions pd
    join public.generation_requests gr on gr.id = pd.request_id
    where pd.id = decision_id
      and (public.is_member_of(gr.organization_id) or public.owns_voice(gr.voice_id))
  ));

-- decision tokens: NO client policies. Server-only (service role bypasses RLS).
-- Token internals are never exposed to browsers.

-- amendments: requesting organization + voice owner read; owner decides server-side
create policy amendment_requests_visible on public.amendment_requests
  for select using (public.is_member_of(organization_id) or public.owns_voice(voice_id));

-- assets: requesting organization + voice owner
create policy generated_assets_visible on public.generated_assets
  for select using (public.is_member_of(organization_id) or public.owns_voice(voice_id));

-- Audit events are server-only. The owner console reads them through the
-- authorized application server; no direct client policy is intentionally
-- granted because aggregate payloads span owners and organizations.

-- ── public verifier view (anon-safe fields only) ────────────────────────

create or replace view public.public_verifications
with (security_invoker = off) as
select
  ga.verification_id,
  ga.policy_version                as policy_version_used,
  ga.sha256                        as asset_sha256,
  ga.mime_type,
  ga.byte_length,
  ga.provider,
  ga.created_at                    as generated_at,
  pd.evaluated_at                  as approved_at,
  pr.display_name                  as owner_display_name,
  vp.display_name                  as voice_display_name,
  org.name                         as organization_name,
  gr.purpose, gr.platform, gr.language, gr.territory, gr.placement,
  cur.status                       as current_policy_status,
  cur.version                      as current_policy_version,
  cur.revoked_at
from public.generated_assets ga
join public.policy_decisions pd on pd.id = ga.decision_id
join public.generation_requests gr on gr.id = ga.request_id
join public.voice_profiles vp on vp.id = ga.voice_id
join public.profiles pr on pr.id = vp.owner_id
join public.organizations org on org.id = ga.organization_id
join lateral (
  select status, version, revoked_at
  from public.consent_policies
  where voice_id = ga.voice_id
  order by version desc limit 1
) cur on true;

grant select on public.public_verifications to anon, authenticated;

-- Storage: private bucket for generated masters (server-side access only).
insert into storage.buckets (id, name, public)
values ('mithaq-assets', 'mithaq-assets', false)
on conflict (id) do nothing;
