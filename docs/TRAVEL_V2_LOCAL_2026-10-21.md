# Travel V2 — local implementation checkpoint

Date: 2026-10-21. Repository: `D:\---------ONLY PEACH----------\iroup-next`.
Continues `STABILITY_LOCAL_2026-10-21.md` and `V2_REWRITE_CHARTER.md`.

## Completed scope

- `/travel` now searches, filters and sorts on the server, with exactly 20 rows
  per page and a filtered total. Search covers Thai/English title, saved/current
  country and partner names, owner unit and approval reference. `%` and `_` are
  literal search characters. Search text is capped without splitting Unicode.
- URL keys: `q`, `status`, `country`, `unit`, `year`, `sort`, `page`. Applying
  filters resets to page 1; paging preserves filters; refresh/Back restore state;
  out-of-range pages redirect to the last valid page.
- Sort choices: recently updated, departure date descending/ascending, name.
  UUID breaks ties; missing dates sort last. Name order uses the database's
  collation, not a newly configured Thai-specific collation.
- Summary counts and filter choices describe all accessible Travel records,
  separately from the filtered result count. Staff Mobility and deleted cases
  are excluded. No participant identities, funding or internal notes are in the
  list DTO; Zod rejects unexpected fields or malformed responses.
- Added loading, empty, no-results, retryable error, permission-denied and
  read-only states; responsive scoped CSS and larger operational text. The
  read-only label considers all write permissions, including custom publish.
- Travel hides the mock topbar fiscal selector/notification count. Its real
  fiscal-year filter uses returned metadata. Other screens keep their defaults.
- Existing `/travel/new`, detail and edit routes/forms remain in place. Other
  modules still use the existing list implementation.

## Database and security

Added `supabase/migrations/20261021080000_travel_list_v2.sql` containing only a
read RPC, `public.travel_list_v2`. It is STABLE, SECURITY INVOKER, has an empty
search_path, checks active Travel view access before returning any metadata, and
is executable only by authenticated users (not anon/public/service_role).
Existing RLS still filters rows, summary counts and filter options.

Applied only to disposable QA:

- Workdir: `C:\Users\Lenovo\AppData\Local\Temp\iroup-stability-local-20261021`
- Container: `supabase_db_iroup-stability-local-20261021`
- API: `http://127.0.0.1:30321`; DB: `127.0.0.1:30322`
- Network: `iroup-stability-local-20261021-loopback`
- Ledger: 33 migrations (27 baseline, 5 Stability, 1 Travel).
- Migration SHA-256: `1E61F1DB89590D2AB5375F0E5E554969604C8259D245B7E7DA44296DB2D3EBF7`;
  repository and applied QA workdir copies match.

The original local DB and `.env.local` have not been upgraded/changed. The updated
application needs the new RPC and previous Stability migrations; use the isolated
QA environment for this checkpoint. No Production access, migration, commit,
push or deployment was performed. Earlier production counts remain historical.

## Verification

- Full ESLint: PASS.
- TypeScript: PASS; run serially with Next startup/build. One overlapping run
  read partially regenerated `.next/dev/types`; a serial rerun and build passed.
- Vitest: **8 files / 46 tests PASS**, including URL normalization and strict DTO.
- Optimized Next build: PASS; `/travel` remains a dynamic authenticated route.
- pgTAP: **22 files / 534 assertions PASS**, including 74 Travel assertions:
  role matrix (System Admin, Office Admin, Editor, Viewer, inactive, revoked,
  no Travel access, unauthenticated), literal search, filters, sort/null/ties,
  pagination, projection privacy and a restrictive-RLS proof for rows/metadata.
- An old foundation audit test now counts only its own fixture record IDs;
  prior browser-cleanup DELETE audit entries must not change its expected total.
- Travel browser harness: **18 checks PASS** with 45 synthetic Travel records
  plus deleted/other-category sentinels. Verified 20/20/5 pagination, sorting,
  combined filters, URL refresh/Back, no-results/reset, page clamping, keyboard,
  detail link, desktop/mobile overflow and screenshots, delayed loading, real
  RPC error/retry, read-only/custom publish/denied/inactive access.
- Captured initial HTML and RSC responses contained at most 20 fixture records.
  Complete case/participant/funding/workflow snapshots were unchanged by list
  reads. Temporary RPC EXECUTE revocation for error testing was restored.
- Existing Stability browser smoke rerun: PASS (Travel manual-participant save,
  Student Mobility atomic draft, failed-review rollback and inactive API denial).
- Independent code review found retry-refresh and custom-permission read-only
  issues; both were fixed and covered by the passing browser run.

Evidence in the QA workdir:

- `travel-v2-tests-2.log`
- `travel-v2-result-f2c723dd.json`, `travel-v2-next-f2c723dd.log`
- `travel-v2-{empty,desktop,filtered,mobile,loading,error,readonly}-f2c723dd.png`
- `browser-result-a3f51019.json`, `browser-next-a3f51019.log`

Both browser runs removed their synthetic fixtures and stopped their Next3105
processes; no external browser requests occurred. Travel screenshots originally
caused one Playwright caret-style hydration warning; the harness now preserves
the caret when capturing images (syntax verified, assertions unchanged).
Existing form Base UI warnings are unchanged from the Stability checkpoint.

## Repeat and resume

```powershell
$qa = Join-Path $env:TEMP 'iroup-stability-local-20261021'
pnpm.cmd run lint
pnpm.cmd run typecheck
pnpm.cmd run test
pnpm.cmd run build
& .\node_modules\.bin\supabase.cmd test db --local --workdir $qa --network-id iroup-stability-local-20261021-loopback (Join-Path (Get-Location) 'supabase\tests')
node tests\travel-v2-browser.mjs --run-local-travel-v2
node tests\stability-browser.mjs --run-local-stability
```

Run these sequentially, particularly Next/typecheck/build and database/browser
tests. The opt-in browser harness verifies the exact disposable QA destination
and passes its credentials only to the local process; it does not edit env files.

Preserve existing dirty Stability work and `docs/PROJECT_STATE.md` (its prior
46 inserted / 26 deleted lines are untouched by this task). No files were staged.
Technical local QA is complete; owner visual acceptance and any release are
separate. Future production release needs its own authorization and preflight.
Broader database type generation, CI, other modules and Content Automation are
outside this slice. Code rollback can restore the old Travel page adapter while
leaving the unused additive read RPC and business data intact.

## Authorized Git checkpoint

The owner subsequently authorized commit and push on 2026-10-21. The selected
checkpoint includes the completed Stability and Travel V2 implementation and
their tests/handoffs. It is published on `codex/stability-travel-v2-20261021`,
with no merge to `main`. `vercel.json` disables automatic deployments only for
this exact branch; this preserves the separate deployment/Production gate.
The original `PROJECT_STATE.md` changes, local assets, logs, installed skills and
unrelated Content Automation drafts remain outside these commits. The original
local rewrite handoff is also retained locally; this checkpoint's scope and
acceptance are recorded in `V2_REWRITE_CHARTER.md` and this document.
