# Travel V2 local implementation charter

Date: 2026-10-21. Continues `STABILITY_LOCAL_2026-10-21.md` and the Travel slice
in `HANDOFF_V2_REWRITE.md`. The owner's current instruction authorizes local
Travel V2 implementation and testing; no Production, push or deployment.

## Scope and acceptance

- Replace only `/travel` list with server search, workflow status/country/unit/
  fiscal-year filters, deterministic sorting, and fixed 20-record pagination.
- Persist list state in the URL, including back/refresh and page links; reset the
  page when applying filters. Clamp pages beyond the final result page.
- Return a minimal list DTO plus filtered count, all-visible-record summary,
  and filter options. No internal notes, participant identities or funding data.
- Provide loading, empty, no-results, retryable error, denied and read-only states.
- Verify role/RLS boundaries, desktop/mobile and keyboard behavior, unchanged
  detail/form flows, and database readback using synthetic local QA data.
- Keep other modules on their existing implementation until separately selected.

## Invariants and release boundary

Keep existing URLs, movement schema/records, permissions, imports, source IDs,
snapshots and audit history. No list read may write business records. New SQL is
additive and forward-only; authenticated calls use the caller's RLS, never a
service key in the application. Travel list hides mock topbar controls while
using real fiscal-year filters; shared defaults for existing screens stay intact.

The original local database and `.env.local` remain untouched. Apply and verify
new migrations only in `iroup-stability-local-20261021` (API 127.0.0.1:30321,
DB 127.0.0.1:30322). Do not use linked Supabase, staging, commits, pushes or deploys.
Existing dirty files and earlier handoffs must be preserved.

## Rollback and next gates

The previous `StaffMovementListPage module="travel"` adapter and implementation
remain available. A code rollback can restore that adapter without changing
business data; an additive read RPC may remain unused. Any future release needs
separate owner authorization, migration compatibility/preflight, production
readback, and release validation. This local acceptance does not cover broader
generated database types, CI, all-module rewrite or Content Automation.
