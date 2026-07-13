# Architecture

```text
Browser admin UI
  ↓ authenticated fetch
Next.js /api/admin/* route
  ↓ requireAdmin() using Supabase Auth + is_admin()
  ├─ OpenAI Responses API for structured candidates
  ├─ OpenAI Moderation API for review metadata
  └─ Server-only Supabase service client
       ├─ scenarios (read)
       ├─ response_cards (read/publish inactive)
       └─ content_* admin tables (sessions, candidates, events, examples, cooldowns)
```

## Why a server-only service client
The current RLS policies on the existing gameplay tables were not available. The API therefore verifies the admin with a normal authenticated Supabase client, then performs controlled writes through a server-only service client. This avoids casually changing gameplay-table policies.

The service role bypasses RLS, so every route must call `requireAdmin()` before creating or using the admin client for a sensitive operation.

## Why store candidates
Storing all candidates and decisions provides:
- a review queue;
- auditability;
- rejected-example feedback for later prompts;
- measured motif repetition;
- recovery if the browser refreshes;
- future evaluation data.

## Why publish inactive
Generation and approval are separate from gameplay activation. An inactive publish allows one final review inside the real response-card table before the card enters live hands.
