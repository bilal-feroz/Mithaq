-- MITHAQ Gate — demo seed (mirrors src/domain/fixtures.ts exactly).
-- Safe demo-data path: idempotent inserts, demo ids namespaced, no secrets.

insert into public.profiles (id, display_name, role, title) values
  ('owner-umar',     'Umar', 'owner',     'Voice owner'),
  ('requester-bilal', 'Bilal',       'requester', 'Producer, Kanban Studios')
on conflict (id) do nothing;

insert into public.organizations (id, name, slug) values
  ('org-kanban', 'Kanban Studios', 'kanban-studios')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, profile_id) values
  ('org-kanban', 'requester-bilal')
on conflict do nothing;

insert into public.voice_profiles (id, owner_id, display_name, provider_voice_id, description, created_at) values
  ('voice-umar-demo', 'owner-umar', 'Umar Demo Voice', null,
   'Warm bilingual (Arabic/English) narration voice.', '2026-06-15T09:00:00Z')
on conflict (id) do nothing;

insert into public.consent_policies (
  id, version, owner_id, voice_id, status,
  authorized_organization_ids, allowed_purposes, allowed_platforms,
  allowed_languages, allowed_territories, paid_advertising, editing_allowed,
  maximum_assets, assets_used, valid_from, valid_until, prohibited_topics,
  grants, source_consent_text, source_consent_language, owner_approved_at,
  supersedes_policy_id, revoked_at, created_at, updated_at
) values (
  'policy-umar-v1', 1, 'owner-umar', 'voice-umar-demo', 'active',
  '{org-kanban}', '{brand_promotion}', '{instagram,youtube}',
  '{ar,en}', '{AE,SA}', 'prohibited', true,
  1, 0, '2026-07-01T00:00:00Z', '2026-07-30T23:59:59Z', '{politics}',
  '[]',
  'Bilal and Kanban Studios may use my cloned voice for one unpaid Arabic or English social-media promotion until July 30, 2026. Instagram and YouTube are allowed. Paid advertising and political content are prohibited.',
  'en', '2026-07-01T10:00:00Z',
  null, null, '2026-07-01T10:00:00Z', '2026-07-01T10:00:00Z'
)
on conflict (id) do nothing;
