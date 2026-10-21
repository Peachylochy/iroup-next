# iROUP Next — Necessary Stability, local checkpoint

Date: 21 October 2026 (Asia/Bangkok)

## Authorization and scope

The user authorized necessary stability implementation and testing in local only.
Production access, production migrations, deployment, commit and push are not part
of this checkpoint. Travel V2 and Content Automation implementation have not begun.

Starting application revision: `8ff0b6db83247c5679bae799efc39b5949d24f4b`, branch
`main`. All changes from this checkpoint remain uncommitted.

The pre-existing 46-insertion / 26-deletion diff in `docs/PROJECT_STATE.md` was
preserved. Existing assets, logs, skills and the September handoffs were preserved.
No historical migration was edited and no existing local database was reset.

## Implemented behavior

1. Database role/module helpers now require an active profile. A disabled account
   or batch creator whose import permission was revoked cannot keep staging access.
   Master and legacy imports require System Admin at both the app and DB boundary;
   ordinary student import retains its module-permission contract.
2. Student Mobility form saving now uses one transaction for project,
   participants, funding and optional review submission. A late failure rolls
   back the entire operation, including existing child identities and audit rows.
   Existing guarded component RPCs remain available for compatibility.
3. Staff participants entered manually use the existing `external` person type.
   Both Student and Staff form actions reject missing/malformed array JSON before
   calling the database; an explicit empty array remains an intentional draft edit.
4. Master preview reads all pages in stable ID order. An unreadable page fails the
   preview. Master commit respects reviewed skips, blocks unresolved/invalid
   identities and writes each actual `target_record_id`; intentional master
   upserts remain supported.
5. Existing-record student and legacy imports now fail the whole batch with an
   explicit reconciliation message, preserving manual enrichment and prior import
   provenance. They do not silently replace participants/contact methods or MOU
   links. Automatic merging of existing records is deliberately not implemented.
6. Concurrent legacy contact imports serialize before matching natural identity.
   This protects contact-import batches against one another; manual contact CRUD
   is not part of that serialization contract.
7. Unused generic authenticated writes to `assets` and `record_assets` are closed,
   including column grants. Permission-checked MOU attach/detach RPCs, private
   storage retention, reads and service-role grants remain available. Future
   Content work needs scoped asset write RPCs before adding new write workflows.
8. Direct staging writes lock/check the current batch state. Completed history
   cannot be reviewed, reopened, deleted or forged through the Data API. Trusted
   commit RPCs retain the ability to write commit markers. A review/commit lock
   collision may abort one request with a deadlock; reload/retry is required, but
   committed history cannot be changed by that stale review.

## Forward migrations

- `20261021070000_stability_access_guards.sql`
- `20261021071000_stability_movement_atomic_save.sql`
- `20261021072000_stability_import_integrity.sql`
- `20261021073000_stability_asset_write_boundary.sql`
- `20261021074000_stability_import_review_boundary.sql`

Only the disposable local QA database has these five migrations applied.

## Local isolation and evidence

- QA workdir: `C:\Users\Lenovo\AppData\Local\Temp\iroup-stability-local-20261021`
- Database container: `supabase_db_iroup-stability-local-20261021`
- API: `http://127.0.0.1:30321`; DB port: `127.0.0.1:30322`
- Docker network: `iroup-stability-local-20261021-loopback`, `10.240.96.0/24`
- DB and gateway port bindings verified as loopback-only.
- Baseline: all 27 committed migrations replayed into an empty QA database;
  baseline schema saved as `baseline-schema.sql` in the QA workdir.
- Baseline SQL suite: 16 files / 187 assertions passed.
- Upgraded ledger: 32 migrations (27 baseline + 5 new).
- Upgraded SQL suite: **21 files / 460 assertions passed**. Two old SQL-text
  assertions were replaced by behavioral authorization coverage.
- Unit tests: **6 files / 27 tests passed**.
- Full lint, TypeScript and production build: **passed**. ESLint now excludes
  installed `.agents` tooling; no skill source was changed.
- `node tests/stability-concurrency.mjs`: **2 scenarios passed** with actual
  overlapping DB sessions and observed lock waits, followed by readback:
  concurrent contact imports create one contact and roll back the second batch;
  late staging review waits for commit and then fails without changing history.
- All SQL suite fixtures roll back; concurrency fixtures are removed by the
  harness. No production data was copied into QA.

- Opt-in local browser smoke: **passed** (installed Chromium, no browser install):
  login; Travel draft with manual participant and `external` DB readback; Student
  Mobility draft with participant/funding; failed review leaves the complete
  database snapshot unchanged; existing session receives API 403 immediately
  after profile deactivation. Synthetic fixtures were removed and the runner's
  Next process was stopped. No external browser requests were made.
- Browser evidence: `browser-result-de0f33dc.json` and `browser-next-de0f33dc.log`
  in the QA workdir. The log contains two Base UI uncontrolled-field warnings in
  existing form rendering; the tested workflows passed. UI warning cleanup is
  deferred to the form/UI workstream.

## Repeat local checks

From the repository root, with the existing QA containers running:

```powershell
$qa = Join-Path $env:TEMP 'iroup-stability-local-20261021'
pnpm.cmd run lint
pnpm.cmd run typecheck
pnpm.cmd run test
pnpm.cmd run build
& .\node_modules\.bin\supabase.cmd test db --local --workdir $qa --network-id iroup-stability-local-20261021-loopback (Join-Path (Get-Location) 'supabase\tests')
node tests\stability-concurrency.mjs
node tests\stability-browser.mjs --run-local-stability
```

The concurrency runner refuses to run unless the exact disposable QA container
exists with loopback-only bindings. The browser runner verifies the exact QA
container, local API/DB ports and installed browser, then supplies temporary
process-only environment values without changing `.env.local`. The QA workdir
has no linked production project. Use explicit `--local` and this workdir; do not
use `--linked`.

## Boundaries and next work

- Production migration alignment, backups, data readback and release checks have
  not been performed in this session. Earlier production counts remain historical.
- `.env.local` and the original `iroup-next` local containers/data were not changed.
  That original database does not yet have the new RPC/migrations; run the updated
  app against QA for verification until a separate local-data upgrade is arranged.
- No cleanup of original QA records or real business records was performed.
- Generated Database types, broad CI work and a whole-application browser
  regression are separate follow-up scope, not claimed complete here.
- Next planned product slice is bounded Travel V2 after this local checkpoint is
  reviewed. Its UI/search/pagination work is not included in these changes.
