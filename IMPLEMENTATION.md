# MITHAQ Gate — Implementation Checklist

Working checklist. Updated at the end of every phase.

## Phase 1 — Repository & design foundation
- [x] Inspect repository (empty fresh git repo — building from scratch)
- [x] Project scaffold: Next.js 15 App Router, strict TS, Tailwind v4, ESLint, Prettier
- [x] Vitest + Playwright configuration
- [x] `.env.example` (placeholders only)
- [x] `DESIGN.md` — Obsidian Glass Security system
- [ ] Design tokens in `globals.css`
- [ ] Glass primitives (`GlassPanel`, `DecisionBadge`, `ClauseResultRow`, …)
- [ ] Environment validation (`src/server/env.ts`), demo mode default
- [ ] App shell boots

## Phase 2 — Deterministic domain core
- [ ] Zod schemas + TS types: `ConsentPolicy`, `GenerationRequest`, grants, enums
- [ ] Stable reason codes
- [ ] Script normalization (documented + tested)
- [ ] SHA-256 hashing helpers, canonical JSON
- [ ] Pure deterministic policy engine (deny-by-default, prohibitions override)
- [ ] Amendment grant evaluation (narrow scoped exceptions)
- [ ] Engine unit tests incl. prompt-injection, determinism, every reason code

## Phase 3 — Persistence
- [ ] Store interface (data-access layer)
- [ ] Local demo store (in-process, atomic ops, seeded)
- [ ] Seed data: Awaiz (owner) / Bilal @ Kanban Studios (requester), v1 policy
- [ ] Supabase migrations (all 12 tables, FKs, indexes, RLS)
- [ ] Supabase adapter (used when credentials present)
- [ ] Audit event chain (canonical JSON, hash-linked, verification fn)
- [ ] Policy versioning (copy → increment → supersede, never mutate)

## Phase 4 — Authorization & generation
- [ ] Decision persistence with clause results
- [ ] Signed decision tokens (HMAC-SHA256, 60s TTL, jti, single-use)
- [ ] Atomic consumption, replay rejection, binding checks, revocation recheck
- [ ] Mock voice provider (deterministic playable WAV)
- [ ] ElevenLabs adapter (used only with API key)
- [ ] Asset hashing, storage, registration, usage increment
- [ ] Opaque verification IDs + QR codes
- [ ] Token unit tests (expiry, replay, mismatch, revocation)

## Phase 5 — Application workflows
- [ ] App shell: rail nav, role switcher, provider badge, atmosphere
- [ ] Consent Studio (dynamic consent challenge, extraction, review, approve)
- [ ] Generation Gate (form, decision surface, clause results, remedies)
- [ ] Amendment workflow (draft → owner review comparison → approve → v2 → auto-rerun)
- [ ] Owner Console (passport, usage, inbox, timeline, revoke)
- [ ] Public Verifier (status, hash compare upload, QR, decision trail)
- [ ] Demo reset endpoint

## Phase 6 — Visual refinement
- [ ] Design-review pass on all five screens vs. quality gate
- [ ] Responsive review 390 → 1440
- [ ] Reduced-motion + keyboard pass

## Phase 7 — Proof
- [ ] All unit tests green
- [ ] Playwright E2E demo flow green
- [ ] `tsc --noEmit` clean
- [ ] `eslint` clean
- [ ] README (setup, security model, demo script, limitations)
- [ ] Final visual inspection
