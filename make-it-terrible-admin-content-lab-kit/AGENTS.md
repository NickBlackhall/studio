# AGENTS.md — Make It Terrible Admin Content Lab

## Mission
Integrate the protected Admin Content Lab in this folder into the existing Make It Terrible repository without disrupting the live multiplayer game.

## Non-negotiable behavior
- The normal player flow must remain unchanged.
- The admin menu must only be visible to verified admins.
- Typing an admin URL directly must not bypass authorization.
- `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must remain server-only.
- New generated cards must default to `is_active = false`.
- Human approval is required before a candidate is inserted into `response_cards`.
- Moderation flags are review signals, not automatic proof that a card is acceptable or unacceptable.
- Do not silently alter existing `scenarios` or `response_cards` rows.
- Do not enable or rewrite RLS policies on existing gameplay tables until their current policies and access paths are inspected.

## Known project facts
- Frontend: Next.js + React.
- Backend: Supabase with Realtime.
- UI: Tailwind + ShadCN.
- Existing tables confirmed by export:
  - `public.scenarios(created_at, text, category, id)`
  - `public.response_cards(created_at, text, is_active, id, author_player_id, author_name)`
- Current scenario categories:
  - `Life Things`
  - `Super Powers`
  - `Absurd & Surreal`
  - `Pop Culture & Internet`
  - `R-Rated`
- The game currently has 587 scenario rows and 100 preexisting response-card rows in the supplied exports.
- The calibration produced 109 approved response candidates.

## Assumptions to verify before editing
[Unverified]
- The repository uses the Next.js App Router under `src/app`.
- The project does not already have Supabase Auth configured for an admin.
- The project does not already have a server-only Supabase service client.
- The project does not already have a `proxy.ts` or `middleware.ts` session-refresh implementation.
- Path aliases use `@/`.

## Integration order
1. Inspect `package.json`, app/router structure, Supabase helpers, auth code, existing middleware/proxy, and database types.
2. Adapt imports and folder paths before copying files.
3. Apply the database migration in a development Supabase project first.
4. Create an Auth user and add its UUID to `public.admin_users`.
5. Merge the server-only Supabase client and `requireAdmin` guard.
6. Add `/admin/login`, the protected admin route group, and dashboard navigation.
7. Add read-only scenario search and candidate generation.
8. Add decision logging and CSV export.
9. Add direct publish-to-`response_cards` only after authorization tests pass.
10. Run the QA plan.

## Build requirements
Add these packages if absent:
- `openai`
- `zod`
- `@supabase/ssr`
- `@supabase/supabase-js`
- `papaparse`
- `@types/papaparse` as a dev dependency

## AI implementation
- Use the server-side OpenAI Responses API.
- Use Structured Outputs through `responses.parse` and `zodTextFormat`.
- Keep the model configurable through `OPENAI_MODEL`.
- Inject approved and rejected reference examples from Supabase.
- Run local duplicate checks against the existing deck.
- Store model request IDs when available for debugging.
- Do not expose model chain-of-thought or hidden reasoning.

## Definition of done
- Unauthenticated users are redirected from `/admin/*` to `/admin/login`.
- Authenticated non-admins receive a 403 or redirect.
- Admins can search existing scenarios, paste a scenario, or import a CSV.
- Generation returns structured candidates with character count and labels.
- Admins can edit, approve, reject, test, export, and publish.
- Publishing inserts an inactive response card and blocks exact duplicates.
- Every decision is logged in `content_candidate_events`.
- Service keys are absent from browser bundles and network responses.
- Existing gameplay and realtime behavior still pass regression testing.
