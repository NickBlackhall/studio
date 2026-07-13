# Admin Content Lab — Engineering Handoff

Date: 2026-07-13

## Executive summary

The proposed `make-it-terrible-admin-content-lab-kit` has been adapted into the live Next.js game repository. The result is a protected writers' room for generating, reviewing, exporting, and publishing response-card candidates.

The implementation is compiled and tested locally, but it is **not deployed or connected to production yet**. The database migration and calibration seed still need to be applied to Supabase, and the server-only environment variables need to be configured in the deployment environment.

The ordinary player flow, gameplay actions, realtime subscriptions, and existing gameplay-table RLS policies were not changed.

## User-facing flow

1. From the main screen, open **Settings & More**.
2. Select **Admin Content Lab**.
3. The browser navigates to `/admin/login`.
4. Enter the administrator PIN.
5. A successful server-side check creates a signed, HTTP-only admin cookie valid for four hours.
6. The admin can:
   - search existing scenarios;
   - type a scenario manually;
   - import scenarios from CSV;
   - generate 4–12 response candidates;
   - edit, approve, or reject candidates;
   - test a response against three unrelated scenarios;
   - request more responses based on a candidate's mechanism;
   - export approved cards as a Supabase-compatible CSV;
   - publish approved cards to `response_cards` as inactive rows.
7. **Lock** deletes the admin session cookie.

## Architecture

```text
Settings menu
  -> /admin/login
  -> POST /api/admin/session
  -> server verifies ADMIN_CONTENT_PIN
  -> signed HttpOnly/SameSite cookie
  -> protected /admin route group
       -> protected /api/admin/* routes
            -> OpenAI Responses + Moderation APIs
            -> Supabase service-role client
                 -> content_* audit/review tables
                 -> scenarios (read only)
                 -> response_cards (inactive insert only)
```

The browser never receives the OpenAI key, Supabase service-role key, configured PIN, or session-signing secret.

## Important deviation from the original kit

The supplied kit assumed a separate Supabase Auth user and an `admin_users` allowlist. The game did not already use Supabase Auth for administrators, and the requested interaction was protection similar to the existing master reset.

The integrated version therefore uses:

- `ADMIN_CONTENT_PIN`, falling back to `MASTER_RESET_PIN` when explicitly configured;
- a signed four-hour JWT stored in an HTTP-only cookie;
- `ADMIN_SESSION_SECRET`, falling back to the existing `JWT_SECRET`;
- the server-only Supabase service-role client after cookie authorization;
- `created_by = 'pin-admin'` in audit records instead of an Auth user UUID.

This is intentionally a single-administrator/shared-PIN design. If individual administrator identities, revocation, or per-user audit records become important, replace it with Supabase Auth and an admin allowlist.

No new npm packages were required. OpenAI is called through server-side `fetch`, and CSV importing uses a small local quoted-field parser.

## Security behavior

### PIN and session

- PIN verification happens on the server in `src/lib/admin/auth.ts`.
- Comparisons use SHA-256 digests plus `timingSafeEqual`.
- Production has no default PIN.
- Development falls back to `6425`, matching the existing testing reset convention.
- The cookie is HTTP-only, SameSite `strict`, secure in production, scoped to `/`, and expires after four hours.
- The token scope must equal `content-lab`.
- Missing, expired, incorrectly signed, or wrongly scoped tokens are rejected.

### Authorization boundaries

- The protected `/admin` layout checks the cookie before rendering.
- Every data API route under `/api/admin` independently calls `requireAdmin()`.
- Directly typing `/admin/content-lab` redirects to `/admin/login` without a valid cookie.
- UI hiding is not treated as authorization.
- Login attempts are limited to five per source address per ten-minute process window.

The rate limiter is intentionally lightweight and stored in process memory. On a horizontally scaled or serverless deployment, use a shared store such as Upstash Redis if brute-force resistance across instances is required.

### Database access

- `SUPABASE_SERVICE_ROLE_KEY` is imported only by a module marked `server-only`.
- The new `content_*` tables have RLS enabled and no browser-facing policies.
- Existing gameplay-table RLS policies were not altered.
- Scenario access is read-only.
- Publishing is allowed only when candidate status is `approved`.
- Already-published candidates are blocked.
- Exact normalized duplicate response text is blocked.
- Published response cards always use `is_active = false`.

### AI handling

- Generation uses the OpenAI Responses API with strict JSON Schema output.
- The returned JSON is validated again with Zod.
- Generation is limited to 4–12 candidates, each at most 105 characters.
- Exact duplicates against the existing deck are discarded.
- Near duplicates carry a similarity warning.
- Moderation results are stored as review metadata only; they do not automatically approve or reject a card.
- No model reasoning or hidden chain-of-thought is requested or stored.

## Database additions

`database/migrations/005_admin_content_lab.sql` creates:

- `content_generator_settings`
- `content_reference_examples`
- `content_motif_cooldowns`
- `content_generation_sessions`
- `content_candidates`
- `content_candidate_events`
- supporting indexes
- the `set_content_updated_at()` trigger function

It references the existing `scenarios` and `response_cards` tables but does not modify them.

The calibration seed remains at:

`make-it-terrible-admin-content-lab-kit/supabase/migrations/20260713_002_seed_calibration.sql`

It supplies the approved examples, review examples, and motif cooldowns used to shape generation.

## Files added

### Admin pages

- `src/app/admin/login/page.tsx` — PIN login.
- `src/app/admin/(protected)/layout.tsx` — protected admin shell and navigation.
- `src/app/admin/(protected)/page.tsx` — dashboard.
- `src/app/admin/(protected)/sign-out-button.tsx` — clears the session.
- `src/app/admin/(protected)/content-lab/page.tsx` — Content Lab route.
- `src/app/admin/(protected)/content-lab/content-lab-client.tsx` — scenario input, CSV import, generation, editing, decisions, and portability UI.
- `src/app/admin/(protected)/cards/page.tsx` — review queue route.
- `src/app/admin/(protected)/cards/review-queue-client.tsx` — status filtering and inactive publishing.

### Admin APIs

- `src/app/api/admin/session/route.ts` — login/logout session endpoint.
- `src/app/api/admin/scenarios/route.ts` — protected scenario search and random portability samples.
- `src/app/api/admin/content-lab/generate/route.ts` — generation, moderation, duplicate scoring, and persistence.
- `src/app/api/admin/content-lab/candidates/route.ts` — candidate listing/filtering.
- `src/app/api/admin/content-lab/candidates/[id]/route.ts` — edit/approve/reject decisions and event logging.
- `src/app/api/admin/content-lab/candidates/[id]/publish/route.ts` — exact-duplicate check and inactive publishing.
- `src/app/api/admin/content-lab/export/route.ts` — approved-card CSV export.

### Server and content libraries

- `src/lib/admin/auth.ts` — PIN verification and signed cookie authorization.
- `src/lib/admin/rate-limit.ts` — login attempt throttling.
- `src/lib/admin/supabase.ts` — server-only service-role client.
- `src/lib/content-lab/openai.ts` — Responses and Moderation API calls.
- `src/lib/content-lab/prompt.ts` — calibrated writing prompt construction.
- `src/lib/content-lab/schema.ts` — Zod request/output validation.
- `src/lib/content-lab/similarity.ts` — normalization and Dice similarity.
- `src/lib/content-lab/csv.ts` — response-card CSV output.
- `src/types/content-lab.ts` — UI-facing candidate/scenario types.

### Database, documentation, and tests

- `database/migrations/005_admin_content_lab.sql`
- `docs/ADMIN_CONTENT_LAB.md`
- `tests/unit/content-lab/contentLabUtils.test.ts`

## Existing files changed

- `src/components/MainMenu.tsx`
  - Adds **Admin Content Lab** under Settings & More.
  - Navigates to `/admin/login`.
- `.env.example`
  - Documents the service-role, OpenAI, PIN, model, and signing-secret variables.
- `tsconfig.json`
  - Excludes the original, unadapted kit folder from application TypeScript compilation. Without this exclusion, both the kit and integrated implementation are compiled, and the kit fails because its proposed dependencies and paths were never installed.

`ROADMAP.md` was already modified before this work and was not intentionally changed as part of the integration.

## Environment variables

Required in production:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
ADMIN_CONTENT_PIN=...
ADMIN_SESSION_SECRET=...
```

Optional:

```dotenv
OPENAI_MODEL=gpt-5-mini
```

`ADMIN_SESSION_SECRET` can be omitted if the existing `JWT_SECRET` is a strong production secret. A separate secret is preferable for isolation and easier rotation.

Do not prefix any of these with `NEXT_PUBLIC_`.

## Deployment procedure

1. Review `database/migrations/005_admin_content_lab.sql` against a development Supabase project.
2. Apply `005_admin_content_lab.sql`.
3. Apply `make-it-terrible-admin-content-lab-kit/supabase/migrations/20260713_002_seed_calibration.sql`.
4. Confirm all six `content_*` tables exist and have RLS enabled.
5. Configure the server-only environment variables in the hosting platform.
6. Deploy with a standard `NODE_ENV=production`.
7. Open `/admin/content-lab` in a private browser window and confirm redirect to `/admin/login`.
8. Confirm a wrong PIN is rejected.
9. Confirm the correct PIN opens the dashboard.
10. Search for a known scenario.
11. Generate a small four-card batch.
12. Approve one card and verify a `content_candidate_events` record exists.
13. Publish it and verify the new `response_cards` row has `is_active = false`.
14. Attempt to publish it again and confirm the request is blocked.
15. Lock the admin session and confirm protected routes redirect again.
16. Run a normal multiplayer smoke test to confirm lobby and realtime behavior remain unchanged.

## Validation completed

- `npm run typecheck` — passed.
- Focused unit tests — passed, 3 tests across 2 suites:
  - existing MainMenu render test;
  - Content Lab normalization/exact-duplicate test;
  - Content Lab CSV quoting/inactive export test.
- `NODE_ENV=production npm run build` — passed.
- The production route manifest includes all admin pages and seven admin API route entries.
- A source scan confirmed all protected data routes call `requireAdmin()`.
- A source scan confirmed publishing checks approval state and inserts `is_active: false`.

The first build attempt used the workspace's nonstandard `NODE_ENV` value and failed while prerendering `/404`. Re-running with the correct production environment completed successfully. This was not caused by an admin route compilation error.

## Not completed

- The SQL migration has not been applied to a live or development Supabase project.
- The calibration seed has not been applied.
- No real OpenAI generation request was made.
- Production environment variables were not configured.
- No deployment was performed.
- No browser E2E test was run against a database containing the new tables.
- The generated cards were not activated; activation is intentionally outside this tool.
- The original kit folder remains in the working tree as reference material.

## Recommended follow-up improvements

1. Add Playwright coverage for login redirect, successful login, generation failure handling, approval, and publishing.
2. Move login throttling to a shared persistent store for multi-instance deployments.
3. Add CSRF/origin validation if the admin surface expands beyond SameSite-protected browser requests.
4. Add structured server logs for generation duration, model request ID, and publish events without logging prompts or secrets.
5. Add pagination to the 250-row review queue.
6. Replace shared-PIN identity with Supabase Auth if multiple administrators need individual audit attribution.
7. Generate updated Supabase TypeScript types after the migration is applied; the service-role client is intentionally untyped for the new tables until then.

## Working-tree note

The integration is currently uncommitted. Preserve the pre-existing `ROADMAP.md` modification and review the untracked original kit folder separately before committing.
