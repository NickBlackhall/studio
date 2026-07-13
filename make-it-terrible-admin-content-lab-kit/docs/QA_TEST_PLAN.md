# QA Test Plan

## Authorization
1. Logged-out visitor opens `/admin/content-lab` → redirected to login.
2. Logged-in non-admin opens `/admin/content-lab` → forbidden/redirected.
3. Logged-in admin opens `/admin/content-lab` → page loads.
4. Non-admin calls each `/api/admin/*` route directly → 403.

## Scenario input
1. Search finds known scenarios by text.
2. Category filter uses the five confirmed categories.
3. Manual scenario generation works without a scenario UUID.
4. CSV with `text,category` imports correctly.
5. CSV with missing text reports row-level errors.

## Generation
1. Request count is limited to 4–12.
2. Responses are 105 characters or fewer.
3. Candidate objects conform to the structured schema.
4. Repeated stems are limited within one batch.
5. Existing exact duplicates are removed or clearly blocked.
6. Near duplicates display a warning.
7. A provider error produces a useful admin message without leaking secrets.

## Decisions
1. Keep changes status to approved.
2. Edit-and-keep saves the edited text, not the original.
3. Reject records a reason.
4. Every decision creates a `content_candidate_events` row.
5. Portability test displays unrelated scenarios.

## Publishing
1. Publish requires approved status.
2. Publish inserts one response-card row.
3. Published row has `is_active = false`.
4. Published row text matches the final edited candidate.
5. Re-publishing the same candidate is blocked.
6. Exact duplicate text is blocked.

## Export
1. Export contains the exact six `response_cards` columns.
2. IDs are valid UUIDs.
3. `is_active` is false.
4. CSV opens correctly with commas, quotes, apostrophes, and Unicode punctuation.

## Regression
1. Lobby and player setup still work.
2. Realtime game transitions still work.
3. Scenario category selection still works.
4. Response cards still draw randomly.
5. Boondoggles still trigger as before.
6. Existing PWA behavior and audio still work.
