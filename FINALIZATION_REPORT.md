# MITHAQ Gate Finalization Report

Finalized: 2026-07-20 (Asia/Dubai)

## 1. Executive summary

MITHAQ Gate is ready for a repeatable, credential-free hackathon demonstration.
The complete owner/requester journey now passes in a production build: reset,
policy v1, organic approval and audio generation, paid-placement denial, narrow
amendment and policy v2, injection resistance, revocation, and public historical
verification. The pass preserved the existing architecture and Obsidian Glass
Security design while correcting authorization races, state consistency gaps,
resource-access gaps, misleading provider copy, a hydration defect, and reset
friction.

The submitted demo mode uses deterministic extraction and playable WAV output.
It does not pretend that Anthropic, ElevenLabs, or Supabase were live-tested.

## 2. Functional issues found and fixed

- Generation previously finalized usage, request state, and asset persistence in
  separate operations. A store-level atomic finalization operation now prevents
  duplicate assets and allowance drift under concurrent redemption.
- Reset could preserve the active persona. UI and API reset paths now restore
  Umar and reseed the exact baseline.
- Repeated amendment decisions and revocation could duplicate history. Both are
  now idempotent.
- Direct request/amendment/rerun routes did not consistently share a resource
  authorization check. They now use a common owner/requester scope check.
- Asset delivery now checks that an owner owns the asset voice and gives files
  the correct WAV/MP3 extension.
- The verifier now accepts an opaque ID or complete verification URL, offers the
  latest generated demo asset when one exists, and validates upload MIME and
  size on both client and server.
- The recording text incorrectly implied transcription. It now explains that
  recording stays local for the session and the typed statement drives policy
  extraction.

## 3. Security issues found and fixed

- The Supabase token-consumption RPC now locks and rechecks the current policy
  version/status inside the same transaction, invalidating unused tokens after
  revocation or supersession.
- Sensitive `SECURITY DEFINER` functions revoke execution from `public`, `anon`,
  and `authenticated` and grant it only to `service_role`.
- Broad direct client-write RLS policies and the cross-aggregate audit read
  policy were removed. Domain writes are server-mediated; public verification
  uses its restricted projection.
- Tokens remain HMAC-SHA256 signed, approximately 60-second, one-use, and bound
  to the complete authorization context. Expanded tests cover contextual
  mismatch and concurrency.
- Uploads receive early content-length and MIME enforcement; asset responses add
  `X-Content-Type-Options: nosniff`.
- Partial Supabase configuration and unsupported provider selection now fail
  loudly. Production persistence requires a stable decision-token secret.
- Repository scans found no real secret or debug logging. The only matched
  secret-like value is an explicit test fixture.
- A fresh registry audit exposed Next.js's nested PostCSS 8.4.31 advisory. A
  package-wide npm override now resolves PostCSS to 8.5.20 without a breaking
  Next.js downgrade; the clean install and full suite pass with zero findings.

## 4. UX issues found and fixed

- Reset now asks for confirmation, reports errors, restores Umar, and returns to
  the baseline immediately.
- Mobile navigation shows the active route and retains quick persona access.
- Revocation clearly explains future-authority consequences and preserves
  historical verification language.
- The verification landing page no longer becomes a dead end after generation.
- Consent Studio and recorder copy now truthfully describe mock/AI extraction,
  local recording, and the absence of transcription/biometric verification.
- Decision, amendment, and verification paths retain explicit text, status,
  reason codes, and next actions rather than relying on toast messages or color.

## 5. Visual improvements

- Preserved the existing Obsidian Glass Security system and its restrained status
  illumination, panel hierarchy, typography, and motion language.
- Made the evaluated Generation Gate state the primary visual focus and retained
  the failed clause, stable code, remedies, and policy context in the hero shot.
- Corrected mobile active-navigation treatment and semantic clause animation.
- Produced three clean 1440x900 submission captures without browser chrome or
  debug overlays.

## 6. Accessibility improvements

- Replaced the revocation confirmation with a labelled, focus-trapped Radix
  dialog that supports Escape and restores focus.
- Added alert semantics to recorder failures and retained live decision status.
- Removed invalid nested list markup that caused React hydration error 418;
  animated clause results are now semantic list items.
- Preserved keyboard-operable native/Radix controls, visible focus treatment,
  status text/icons in addition to color, reduced-motion behavior, Arabic/RTL
  direction, labelled file input, and native accessible audio controls.

## 7. Tests executed

- `npm ci`
- `npm run format` and `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run e2e`
- The production build performed by the Playwright web server
- Production `next start` smoke probes
- `npm audit`
- `git diff --check` plus placeholder, secret-pattern, and debug-call scans

High-value additions cover concurrent generation finalization, repeat amendment
approval, repeat revocation, exact reset state, full token-context mismatch,
reset from a dirty browser state, console/network failures, hydration, horizontal
overflow, and six target viewports.

## 8. Exact test results

| Check                 | Final result                                       |
| --------------------- | -------------------------------------------------- |
| Clean install         | 461 packages installed successfully with `npm ci`  |
| Unit/integration      | 5 files, 75 tests passed                           |
| Playwright            | 5 tests passed in 52.0 seconds, Chromium, 1 worker |
| Responsive sweep      | 6/6 requested viewport sizes passed                |
| TypeScript            | Passed with no errors                              |
| ESLint                | Passed with no errors                              |
| Prettier check        | Passed                                             |
| Dependency audit      | 0 vulnerabilities                                  |
| Diff whitespace check | Passed                                             |

The final browser run reported no unexpected page console errors, hydration
warnings, horizontal overflow, HTTP 5xx response, or non-aborted request failure.
Expected Next.js speculative-prefetch `ERR_ABORTED` events are excluded from the
failure assertion because the browser intentionally cancels them.

## 9. Production build result

The credential-free Next.js 15.5.20 production build compiled successfully,
completed lint/type validation, generated all ten route entries, and started on
the production server. Smoke probes returned HTTP 200 for `/`, `/studio`,
`/gate`, `/console`, `/verify`, `/icon.svg`, and `POST /api/demo/reset`.

## 10. Remaining limitations

- Persona switching is an HTTP-only-cookie demo role system, not production
  authentication or authorization identity proof.
- The voice challenge is not biometric verification and proves neither legal
  identity nor legal voice ownership.
- Exact SHA-256 comparison only recognizes identical bytes; re-encoding changes
  the hash. It is not perceptual matching or deepfake detection.
- The hash-linked audit chain is tamper-evident within the application audit
  model; it is not universally immutable.
- "OAuth-style authorization for your voice" is a product analogy, not an
  implementation of the OAuth protocol.
- MITHAQ cannot prevent actors from using generation systems outside an
  organization-controlled pipeline and does not establish universal legal
  consent validity.

## 11. External setup still required

No external service is required for the submitted demo. For production-like
deployment, configure a stable HTTPS `NEXT_PUBLIC_APP_URL`, a strong persistent
`DECISION_TOKEN_SECRET`, and one or more of the following:

- Anthropic: `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, and the documented
  model. Validate structured extraction against the target account.
- ElevenLabs: `VOICE_PROVIDER=elevenlabs`, `ELEVENLABS_API_KEY`, and authorized
  voice/model IDs. Confirm account permissions and provider limits.
- Supabase: run the migration in `supabase/migrations/0001_init.sql`, configure
  the project URL/service role key and private audio bucket, then exercise RLS,
  storage, RPC grants, backup, and restore in that project.

Live calls to those services were not performed because credentials and a hosted
project were not supplied.

## 12. Exact 90-second demo steps

| Time   | Presenter action                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0-6s   | Click **Reset demo** and confirm. On Home, point to Umar's active policy v1 passport.                                                                                                 |
| 6-16s  | Switch to **Bilal**, open **Gate**, load the approved organic example, and evaluate: **REQUEST APPROVED**.                                                                            |
| 16-25s | Click **Generate voice**; play the deterministic WAV and point to its hash/verification link.                                                                                         |
| 25-37s | Load the paid example and evaluate. Highlight **REQUEST BLOCKED**, `PAID_ADVERTISING_PROHIBITED`, passed clauses, and remedies.                                                       |
| 37-48s | Click **Request amendment**, switch to **Umar**, and open the review. Show one campaign/platform/placement allowance with unchanged restrictions.                                     |
| 48-59s | Approve. Show policy v2 and the original request automatically changing to approved under the scoped grant.                                                                           |
| 59-67s | Load the injection example. Show that "Ignore all previous rules..." remains inert and the deterministic policy result does not change.                                               |
| 67-77s | Return to an approved scoped request, generate it if needed, and open the verification record without copying an ID.                                                                  |
| 77-84s | Switch to Umar, open **Console**, click **Revoke consent**, read the consequence, and confirm.                                                                                        |
| 84-90s | Open the historical verifier: point to original approval, current revoked consent, policy version, fingerprint, and decision trail. Close with "Registries declare. MITHAQ enforces." |

If recording speed is tight, keep the generated asset tab open before revoking
and use the verifier's latest-demo-asset shortcut.

## 13. Recommended screenshot routes and states

- Hero: `/gate` after evaluating the paid demo preset. Use
  `docs/submission-screenshots/generation-gate-blocked.png`.
- Amendment: `/amendments/[id]` as Umar before approval. Use
  `docs/submission-screenshots/amendment-review.png`.
- Verification: `/verify/[verificationId]` after generation and revocation. Use
  `docs/submission-screenshots/public-verification-revoked.png`.

All supplied captures are 1440x900.

## 14. Known risks, if any

- Live Anthropic, ElevenLabs, and hosted Supabase behavior remains an external
  deployment validation item; their code paths were reviewed but not claimed as
  end-to-end tested.
- In-memory demo data is process-local and intentionally resets on server restart;
  use Supabase for durable multi-instance deployment.
- The ephemeral token secret warning is expected only in credential-free demo
  mode. A stable secret is mandatory when requests or tokens must survive a
  restart or move across instances.
- RLS and SQL transaction logic require a live-project migration test before a
  production launch, even though the final migration was statically reviewed.
