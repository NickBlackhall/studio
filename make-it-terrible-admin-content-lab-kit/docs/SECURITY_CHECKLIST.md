# Security Checklist

- [ ] `/admin/login` is the only public admin route.
- [ ] `/admin`, `/admin/content-lab`, and `/admin/cards` reject unauthenticated requests.
- [ ] An authenticated non-admin cannot load protected pages.
- [ ] Every `/api/admin/*` route calls `requireAdmin()`.
- [ ] The browser bundle contains no service-role key or OpenAI key.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only read from a file marked `server-only`.
- [ ] New admin tables have RLS enabled.
- [ ] The `is_admin()` function has a fixed empty search path and limited execute grants.
- [ ] Direct publish blocks exact duplicates.
- [ ] Direct publish always sets `is_active = false`.
- [ ] Existing gameplay-table RLS policies were inspected before any changes.
- [ ] API errors do not return secrets, raw prompts, or stack traces in production.
- [ ] Candidate decisions are written to the audit-event table.
- [ ] Rate limits or request throttling are added if more than one admin will use the tool.
- [ ] OpenAI and Supabase keys are rotated if accidentally exposed.

Supabase secret/service keys bypass RLS and must not be exposed to the frontend. Keep the service client server-only.
