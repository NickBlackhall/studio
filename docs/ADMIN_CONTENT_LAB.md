# Admin Content Lab

The Content Lab is available from **Settings & More → Admin Content Lab** and at `/admin/login`.

## Deployment

1. Apply [`database/migrations/005_admin_content_lab.sql`](../database/migrations/005_admin_content_lab.sql).
2. Apply the calibration seed at [`make-it-terrible-admin-content-lab-kit/supabase/migrations/20260713_002_seed_calibration.sql`](../make-it-terrible-admin-content-lab-kit/supabase/migrations/20260713_002_seed_calibration.sql).
3. Configure these server-only environment variables:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `ADMIN_CONTENT_PIN`
   - `ADMIN_SESSION_SECRET` (or the existing strong `JWT_SECRET`)
   - optionally `OPENAI_MODEL` (defaults to `gpt-5-mini`)
4. Deploy and verify `/admin/content-lab` redirects to `/admin/login` without a valid admin cookie.

The admin PIN is checked only on the server. A successful login creates a four-hour, signed, HTTP-only, SameSite cookie. Every admin page and API route verifies it independently. Login attempts are limited to five per address per ten-minute process window.

Generated candidates must be approved before publishing. Publishing inserts into `response_cards` with `is_active = false`; activation remains a separate database/admin operation.

The admin tables have RLS enabled with no browser-facing policies and are accessed only by the server-side service-role client after authorization.
