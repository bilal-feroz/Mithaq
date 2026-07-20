# MITHAQ Gate Finalization Checklist

Last updated: 2026-07-20 (Asia/Dubai)

Evidence rule: an item is checked only when this finalization pass verified it
through code inspection, an automated test, a production build, or a production
smoke check. Live paid-provider and hosted-Supabase behavior is deliberately
reported separately because no external credentials were supplied.

## Baseline

- [x] Inspected the repository, instructions, documentation, configuration,
      domain core, tokens, stores, providers, actions, routes, UI, tests,
      migration, and existing assets.
- [x] Preserved the pre-existing `package-lock.json` worktree change.
- [x] Recorded the initial automated baseline: 72/72 tests, 3/3 browser tests,
      and a successful credential-free production build.
- [x] Recorded the formatter baseline failure across 77 files and corrected the
      repository's line-ending configuration.

## P0 - Demo-blocking functionality

- [x] Reset restores Umar, active policy v1, zero usage, and no requests,
      amendments, assets, tokens, revocation, or orphaned versions.
- [x] The organic path approves, generates playable mock WAV audio, registers
      its hash, increments usage once, and creates a public verification record.
- [x] Paid placement blocks on `PAID_ADVERTISING_PROHIBITED` while passed
      clauses, the failed clause, and remedies remain visible.
- [x] Amendment approval preserves v1, creates v2, and automatically approves
      the original narrowly scoped request.
- [x] Prompt-injection text remains inert and cannot alter authorization.
- [x] Revocation blocks future authorization while preserving historical asset
      verification and the original approval decision.
- [x] Public verification supports opaque IDs/full URLs and exact-byte match or
      mismatch; client and server reject unsupported or oversized uploads.

## P1 - Authorization and security

- [x] The policy engine remains deterministic, network-free, deny-by-default,
      and covered across its major policy states and reason codes.
- [x] Request, amendment, rerun, asset, and persona-sensitive access paths
      enforce server-side resource authorization.
- [x] Decision tokens expire in approximately 60 seconds, are single-use, and
      are bound to decision, request, policy/version, voice, organization,
      script hash, provider, and model.
- [x] Replay, expiry, payload mismatch, concurrent redemption, and
      revocation-after-mint behavior are covered.
- [x] Successful generation finalizes asset registration, request state, and
      the correct allowance atomically; provider failure creates no false asset
      or usage increment.
- [x] Optional provider configuration is validated, server-only, and does not
      break the credential-free demo.
- [x] Public verification exposes its dedicated projection rather than private
      records; public audit-event reads and broad direct client writes were
      removed from Supabase RLS.
- [x] No real committed secret, full-token logging, debug statement, or
      unsupported security claim was found.
- [x] Audit-chain serialization, linkage, validation, ordering, and reset
      behavior remain tamper-evident within the application audit model.

## P2 - State and data consistency

- [x] Repeated amendment decisions, revocation, reset, and concurrent generation
      are idempotent or atomic where required.
- [x] Base allowance and amendment-grant allowance remain separate.
- [x] Demo reset is deterministic and was exercised from a dirty end-to-end
      state without a manual reload.
- [x] Supabase migration, restricted RPCs, storage cleanup, public projection,
      and server store match the application contract by static review.
- [x] Token consumption now locks and rechecks the current policy status/version
      in the database transaction, closing the revoke/consume race.

## P3 - UX and accessibility

- [x] The active persona, provider mode, active route, and next action remain
      visible on desktop and mobile navigation.
- [x] Decisions communicate status, counts, policy version, token state, reason
      code, explanation, and remedy with icon/text as well as color.
- [x] Consent Studio truthfully distinguishes typed policy extraction from the
      local, non-biometric recording challenge.
- [x] Amendment review presents changed scope and preserved restrictions.
- [x] The verifier offers a latest-demo-asset shortcut only when one exists.
- [x] Destructive confirmation is focus-trapped, Escape-closeable, and explicit;
      recorder errors are announced and controls retain visible focus states.
- [x] Arabic/RTL content, audio, upload controls, reduced motion, semantic list
      markup, responsive touch targets, and screen-reader labels were reviewed.

## P4 - Visual and responsive polish

- [x] Obsidian Glass Security hierarchy and dominant decision surfaces were
      preserved and refined without adding noisy decorative effects.
- [x] Gate, Studio, amendment, console, verifier, dialog, and mobile navigation
      avoid horizontal overflow in the tested flows.
- [x] Chromium route sweep passed at 1920x1080, 1440x900, 1366x768, 1024x768,
      768x1024, and 390x844.
- [x] No unexpected console error, hydration warning, non-aborted failed request,
      broken screenshot asset, or route failure remained in the final run.

## P5 - Release and submission

- [x] Clean install completed with `npm ci`.
- [x] Formatting applied and `npm run format:check` passed.
- [x] `npm run lint` passed.
- [x] `npm run typecheck` passed.
- [x] Unit/integration suite passed: 75/75.
- [x] Playwright suite passed: 5/5, including the six-viewport sweep.
- [x] Credential-free production build passed under Next.js 15.5.20.
- [x] Production smoke checks returned HTTP 200 for every core page, the app
      icon, and `POST /api/demo/reset`.
- [x] `npm audit` reported 0 vulnerabilities.
- [x] README, environment example, implementation notes, design rules,
      troubleshooting, deployment, reset, and demo journey match behavior.
- [x] Three clean 1440x900 captures exist in
      `docs/submission-screenshots/`.
- [x] `FINALIZATION_REPORT.md` records exact evidence, external setup, honest
      limitations, and remaining risks.

## External validation boundary

- [x] Credential-free mock mode is submission-ready and fully exercised.
- [x] Anthropic, ElevenLabs, and Supabase adapters/migration were reviewed and
      fail configuration safely.
- [ ] Live Anthropic, ElevenLabs, and hosted Supabase calls were not exercised;
      deployment owners must validate them with their own credentials/project.
