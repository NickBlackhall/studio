# Integration Guide

## 1. Inspect the real repository
Before copying anything, locate:
- `package.json`
- the Next.js router (`app/`, `src/app/`, or Pages Router)
- existing Supabase browser/server clients
- `middleware.ts` or `proxy.ts`
- path aliases in `tsconfig.json`
- database-generated TypeScript types
- existing navigation/menu components
- existing error and toast patterns

[Unverified] The supplied code uses `src/app` and the App Router. Adapt it if the real project differs.

## 2. Add dependencies
Merge the entries from `package-additions.json` rather than replacing `package.json`.

Typical command:

```bash
npm install openai zod papaparse @supabase/ssr @supabase/supabase-js
npm install -D @types/papaparse
```

## 3. Add environment variables
Copy the required values from `.env.example` into the project's local and deployment environments.

Never expose:
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## 4. Apply database migrations
Run these in order in a development project:

1. `supabase/migrations/20260713_001_admin_content_lab.sql`
2. `supabase/migrations/20260713_002_seed_calibration.sql`

Review the migration before applying it to production.

## 5. Create the admin account
Create a Supabase Auth email/password user from the Auth dashboard or existing admin tooling.

Find the user UUID:

```sql
select id, email from auth.users order by created_at desc;
```

Authorize that UUID:

```sql
insert into public.admin_users (user_id, email)
values ('YOUR-AUTH-USER-UUID', 'YOUR-EMAIL')
on conflict (user_id) do update
set email = excluded.email, is_active = true;
```

## 6. Merge Supabase helpers
If the project already has browser/server clients, reuse them. Add only the missing server-only service-role client and `requireAdmin` guard.

The proposed route guard uses a real Auth user lookup and the `is_admin()` database function.

## 7. Merge auth session refresh
The current kit includes `src/proxy.ts`, following current Supabase SSR guidance.

[Unverified] If the project uses a Next.js version that expects `middleware.ts`, adapt the export and filename rather than running two competing session-refresh files.

## 8. Add admin routes
The protected route group keeps the login URL public while guarding the rest:

```text
/admin/login
/admin
/admin/content-lab
/admin/cards
```

Add an Admin menu link to the game's existing menu only after an admin check. Do not render it for ordinary players.

## 9. Add API routes
The API routes perform their own admin authorization:
- scenario search/random selection;
- generation;
- candidate listing;
- keep/edit/reject;
- publish;
- export.

## 10. Verify table compatibility
The direct publish route inserts only:

```ts
{
  text: candidate.response_text,
  is_active: false,
  author_player_id: null,
  author_name: "Admin Content Lab"
}
```

The database should supply `id` and `created_at` defaults. Verify those defaults in the real project before publishing.

## 11. Test in stages
1. Auth and route protection.
2. Read-only scenario search.
3. Generation without saving.
4. Candidate saving and decision logging.
5. CSV export.
6. Direct inactive publishing.
7. Existing game regression tests.

## 12. Deployment
Add environment variables to the deployment platform, apply migrations, create the production admin user, deploy, and run the security checklist again.
