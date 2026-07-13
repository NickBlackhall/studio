# Make It Terrible — Protected Admin Content Lab

This is a **drop-in implementation kit** for adding a protected response-card generator to the existing Make It Terrible Next.js/Supabase game.

## What is included

- A protected `/admin` area with a separate Supabase Auth login.
- A `/admin/content-lab` generator UI.
- Existing-scenario search, manual scenario entry, and scenario CSV import.
- AI generation using the OpenAI Responses API with Structured Outputs.
- The complete calibrated writing rules and 109 approved examples.
- Keep, edit, reject, portability-test, and publish workflows.
- Duplicate scoring against the existing response deck.
- Moderation metadata for human review.
- A review queue and Supabase-compatible CSV export.
- A database migration for admin access, sessions, candidates, feedback events, prompt settings, reference examples, and motif cooldowns.
- A seed migration containing the approved calibration examples and learned cooldowns.
- An `AGENTS.md` handoff file for a coding agent working inside the real repository.

## Important limitation

[Unverified] This kit assumes the project uses the **Next.js App Router**, TypeScript, and conventional `src/app` paths. The README confirms Next.js, React, Supabase, Tailwind, and ShadCN, but the actual repository was not available while this kit was created. The files are therefore proposed integration code, not a tested patch against the live game.

Do not blindly overwrite existing Supabase helpers, middleware/proxy files, auth flows, aliases, or Tailwind configuration. Merge the kit into the project after inspecting the repository.

## Start here

1. Read `AGENTS.md`.
2. Read `docs/CONTENT_LAB_HANDOFF.md`.
3. Follow `docs/INTEGRATION_GUIDE.md`.
4. Apply `supabase/migrations/20260713_001_admin_content_lab.sql`.
5. Apply `supabase/migrations/20260713_002_seed_calibration.sql`.
6. Create one Supabase Auth user for the admin and add that user to `public.admin_users`.
7. Merge the `src/` files into the existing application.
8. Add the environment variables from `.env.example`.
9. Run the QA checklist before enabling direct publishing.

## Intended workflow

`Choose/paste/import scenario → Generate → Keep/Edit/Reject → Test portability → Approve → Publish inactive → Activate later`

New response cards are published with `is_active = false` by default.
