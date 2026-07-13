# Proposed File Copy Map

These files are written for a `src/app` App Router project.

| Kit file | Proposed repository destination |
|---|---|
| `src/lib/supabase/client.ts` | Merge with existing browser Supabase client |
| `src/lib/supabase/server.ts` | Merge with existing server Supabase client |
| `src/lib/supabase/admin.ts` | Add as a new server-only service client |
| `src/lib/admin/require-admin.ts` | Add |
| `src/lib/content-lab/*` | Add |
| `src/app/admin/login/page.tsx` | Add public admin login |
| `src/app/admin/(protected)/*` | Add protected admin pages |
| `src/app/api/admin/*` | Add protected API routes |
| `src/proxy.ts` | Merge with existing session refresh middleware/proxy |
| `supabase/migrations/*` | Add to migration history |

Do not copy a duplicate Supabase client or proxy file without reconciling the existing implementation.
