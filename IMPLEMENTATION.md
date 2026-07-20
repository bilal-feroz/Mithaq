# MITHAQ Gate — Implementation Checklist

All phases complete. Verification status: **72/72 unit tests · 3/3 Playwright
E2E · `tsc --noEmit` clean · ESLint clean · Prettier applied.**

## Phase 1 — Repository & design foundation
- [x] Inspect repository (empty fresh git repo — built from scratch)
- [x] Scaffold: Next.js 15 App Router, strict TS, Tailwind v4, ESLint, Prettier
- [x] Vitest + Playwright configuration
- [x] `.env.example` (placeholders only)
- [x] `DESIGN.md` — Obsidian Glass Security system
- [x] Design tokens in `globals.css` (colors, glass recipes, motion, type)
- [x] Glass primitives (`GlassPanel`, `DecisionBadge`, `ClauseResultRow`,
      `PolicyChip`, `MetricGlass`, `TimelineEvent`, `SecurityLabel`, `Reveal`,
      `RoleSwitcher`, status seals, actions)
- [x] Environment validation (`src/server/env.ts`), demo mode default

## Phase 2 — Deterministic domain core
- [x] Zod schemas + TS types: `ConsentPolicy`, `GenerationRequest`, grants, enums
- [x] Stable reason codes + UI message map
- [x] Script normalization (documented + tested, incl. NFC/CRLF/NBSP)
- [x] SHA-256 helpers, canonical JSON, opaque IDs
- [x] Pure deterministic engine — deny-by-default, prohibitions override,
      scoped amendment grants, stable codes, injected clock
- [x] 50 domain tests incl. prompt injection, determinism, every lifecycle state

## Phase 3 — Persistence
- [x] `DataStore` interface (data-access layer)
- [x] `LocalStore` (in-process, atomic ops, seeded, reset)
- [x] Seed: Umar (owner) / Bilal @ Kanban Studios / policy v1 (mirrors fixtures)
- [x] Supabase migration: 12 tables, FKs, indexes, unique constraints,
      atomic SQL functions (`consume_decision_token`, `increment_policy_usage`,
      `create_policy_version`), linear-audit-chain unique index, RLS,
      `public_verifications` view, private storage bucket + `seed.sql`
- [x] `SupabaseStore` adapter (auto-selected when credentials exist)
- [x] Hash-linked audit chain + verification function
- [x] Policy versioning (copy → increment → supersede; never mutate)

## Phase 4 — Authorization & generation
- [x] Decision persistence with full clause results
- [x] Signed tokens (HMAC-SHA256, 60s TTL, jti, single-use, full binding)
- [x] Atomic consumption, replay rejection, mismatch rejection,
      revocation-after-mint rejection, usage recheck
- [x] Mock voice provider (deterministic playable WAV from script hash)
- [x] ElevenLabs adapter (server-side only, used only with key)
- [x] Asset hashing, storage, registration, atomic usage increment (base/grant)
- [x] Opaque verification IDs + server-generated QR codes
- [x] 22 token/service integration tests

## Phase 5 — Application workflows
- [x] Shell: rail nav, role switcher, provider badge, atmosphere, mobile bar
- [x] Landing (hook, policy passport, persona entry, pipeline, limitations)
- [x] Consent Studio (dynamic consent challenge, recorder, extraction,
      missing/ambiguity review, owner approval → versioned policy)
- [x] Generation Gate (form + dominant decision surface, all clauses, remedies,
      convert-to-organic, amendment request, re-run, token trail, asset panel)
- [x] Amendment workflow (agent draft → owner comparison → approve/reject →
      v2 → automatic rerun)
- [x] Owner Console (passport + version chips, usage meters incl. grants,
      amendment inbox, activity, audit timeline, isolated revoke zone)
- [x] Public Verifier (status seal active/expired/revoked, facts, decision
      trail, QR, hash-compare upload, honest wording)
- [x] Demo reset endpoint + asset streaming + compare API

## Phase 6 — Visual refinement
- [x] Screenshot walk of all 18 screen states at 1440×900 + mobile 390
- [x] Fixed: grid-overlay mask bleeding onto landing content
- [x] Fixed: decision-first ordering on mobile gate
- [x] Fixed: amendment decision copy shows the actual proposed version
- [x] Verified: focal points, layered glass, readable text, non-color status
      cues, grid alignment, negative space, purposeful motion

## Phase 7 — Proof
- [x] `npm test` — 72 passed
- [x] `npm run e2e` — 3 passed (primary flow, injection defense, studio)
- [x] `npm run typecheck` — clean
- [x] `npm run lint` — clean
- [x] `npm run format` — applied, all checks re-verified
- [x] `README.md` (setup, architecture, security model, demo script, limitations)
- [x] Final visual inspection
