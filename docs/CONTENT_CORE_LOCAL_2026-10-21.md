# Content Automation — Core Content local checkpoint

Date: 2026-10-21 (Asia/Bangkok). Repository: `D:\---------ONLY PEACH----------\iroup-next`.
Branch: `codex/stability-travel-v2-20261021`; starting commit: `add08bf`.

## Authority and scope

The user's current instruction authorizes starting Content Automation in local only.
It supersedes the September architecture handoff's historical implementation pause.
The old charter/handoff and pre-existing `docs/PROJECT_STATE.md` edits are preserved.
This checkpoint implements the first manual editorial slice for Scholarship and News;
it does not claim completion of the wider automation programme.

Implementation and testing were local only. A subsequent explicit user instruction
authorizes committing and pushing this Content Core checkpoint to the existing branch.
Production access/migration, imports, credential changes, provider requests,
publication, merge and deployment remain outside this authorization.

## Implemented behavior

- `/content-production?kind=scholarship|news&page=N`: server pagination, 20 records,
  clamped page, empty/loading/error/retry and permission states. Sidebar and original
  module lists link here. Original Scholarship/News new/edit routes redirect here;
  their old save action rejects writes. Events and Knowledge keep their existing flow.
- `/content-production/[kind]/new` creates a private draft canonical identity.
  Existing record IDs are retained when opening an editorial work item.
- Manual source observations capture requested/final URL, publisher, title,
  observation date, valid-through date, official classification, verification outcome
  and note. No URL is fetched or independently verified by this implementation.
- Facts and selected source/deadline evidence are separate from TH/EN presentation
  copy. Website and Facebook have separate immutable version chains. Saving copy
  alone reuses the fact snapshot; changing facts/evidence creates a new snapshot.
- Scholarship deadlines distinguish university internal, Thai nominating body and
  scholarship owner. Preserve cycle, raw source text and precision: date only,
  local date/time with nullable timezone, or an instant with explicit UTC offset.
  A non-applicable level requires a reason; unknown time/timezone is never invented.
- Drafts may have missing translations, evidence or unresolved deadlines. The deadline
  form's "not checked yet" choice omits that level until it is resolved, rather than
  fabricating a date or non-applicability reason. Submit and approval enforce
  completeness; decisions are append-only. Returned drafts can be corrected in a
  successor version. Concurrent edits produce a conflict instead of overwriting.
- Source appends preserve unsaved draft fields. Save preserves the selected channel.
  Read-only users can inspect history; mutation controls follow the exact module.

## Explicit local implementation choices

These are conservative defaults for this slice, not claims of previously approved
production publication policy:

- Both TH and EN title/body are required to submit or approve, for both channels.
  Summary and scholarship coverage remain optional. Plain text only; no HTML renderer.
- At least one selected official, verified, current source is required; every selected
  observation must be current. `valid_until` is inclusive by Asia/Bangkok calendar date.
  The verifier chooses validity manually; future observation dates are rejected.
- The newest observation for the exact stored final URL supersedes previous checks.
  An adverse recheck blocks approval even before the former check expires. There is
  no waiver. URL alias normalization and automated fetching are deferred.
- All three scholarship deadline levels must be present at review, either specified
  with a selected source or explicitly not applicable. No public primary deadline
  or compatibility mapping to the old `close_date` is selected in this slice.
- Initial facts/copy are read from existing fields for human review. Existing legacy
  text is read without truncation, even if it predates new authoring validation.
  After the first save, the editorial snapshot supplies facts; channel copy never
  feeds back into its digest. Canonical identity/domain columns stay in old tables.
- Deadline revisions are immutable members of a fact snapshot, rather than a second
  separately mutable deadline store. Digest metadata is explicitly SHA-256 over
  PostgreSQL `jsonb` text, `postgres-jsonb-text-v1`; it does not claim RFC 8785/JCS.
- Approval does not publish or mirror content. Existing canonical rows and anonymous
  public projections remain unchanged through enrollment, edits and approval.
  Public pointer cutover, domain fact synchronization and publication remain future work.
- Read models bound sources to 100, recent versions to 20 plus both channel heads,
  reviews to 50, and lists to 20. Full history remains in immutable DB rows. The UI
  cannot append a 101st source observation; history pagination is future work.

## Database and security

Migration: `supabase/migrations/20261021100000_content_core.sql`.
Adds five public editorial tables and private command receipts. Parent ownership is
exact-one Scholarship/News; composite foreign keys bind version/snapshot/review owners.
RLS grants active exact-module viewers read access. Client DML is revoked; authenticated
commands use one transactional `content_core_execute` RPC with actor from `auth.uid()`.
It checks active profile and current permissions before reading idempotency receipts,
pins authorization assignments, takes actor/request and work-item locks, and compares
the expected revision. Same key/payload replays; changed payload with the same key fails.
Managed canonical rows reject old direct updates/deletes. This is scoped to managed
records, not a replacement of every historical content API/policy.

Snapshots, source observations, versions and review decisions reject update/delete.
Read RPCs explicitly allowlist DTO fields. `ContentProduction` is the application
boundary, backed by generated local public-schema TypeScript RPC argument types and
strict runtime DTO schemas. Server actions map DB errors to Thai messages without
returning database internals. No provider credentials or raw actor fields are accepted.

## Local verification and next work

Only the existing isolated QA stack `iroup-stability-local-20261021` is used, with
API `127.0.0.1:30321` and DB `127.0.0.1:30322`. Original local data and `.env.local`
are unchanged. The migration is also copied into that stack's temporary workdir.
Two validation functions were tightened after initial application and replaced locally.
Browser testing then exposed the retry behavior caused by using serialization-failure
SQLSTATE `40001` for expected editorial conflicts; the command RPC now uses `PT409`
for those business conflicts. The final migration includes these definitions.

Final verification:

- Full ESLint passed; final scoped lint also passed after UI/test refinements.
- Typecheck and optimized Next build passed (local compilation only).
- Vitest: 11 files / 120 tests passed. After removing a redundant duplicate property
  in a test fixture caught by TypeScript, all 37 schema tests passed again.
- pgTAP: 23 files / 616 assertions passed, including existing Stability and Travel
  tests. The old fixed public-table count test now asserts that zero public base
  tables lack RLS, so adding a secured table does not invalidate the invariant.
- Actual concurrency: 2/2 cases passed with observed advisory/row-lock waits.
  Same-request overlap creates one canonical record/receipt; competing revisions
  yield one winner and `PT409` without a second write.
- All 15 function bodies in QA match the final migration file.
- Browser: 17/17 cases passed, including TH/EN/coverage, unresolved deadline drafts,
  three precisions, source gates, copy-only snapshot reuse, immutable successors,
  approve/return, channel separation, module roles/inactive sessions, keyboard/mobile
  and unchanged canonical/anonymous public data. Conflict response: 257 ms, exact Thai
  message/reload action, winning state and unsaved stale-tab input preserved.
- Browser external requests: 0. Final Next test log has no error/warning matches.
  Fixtures were removed; work items, canonical Scholarship/News fixtures, test users
  and command receipts all read back as zero. The test Next server on port 3105 stopped.
  The isolated local Supabase stack remains available with the additive migration.

Evidence directory:
`C:\Users\Lenovo\AppData\Local\Temp\iroup-stability-local-20261021`

- `content-core-result-2031ab50.json`
- `content-core-next-2031ab50.log`
- `content-core-approved-2031ab50.png`
- `content-core-readonly-2031ab50.png`
- `content-core-mobile-2031ab50.png`

Re-run browser with `node tests/content-core-browser.mjs --run-local-content-core`;
re-run concurrency with `node tests/content-core-concurrency.mjs --run-local-content`.
Both scripts explicitly pin the disposable local QA target and clean their fixtures.
Run them sequentially, and do not run Next build/type generation while the browser
harness owns its dev server. Supabase CLI commands for this stack require
`--local --workdir <QA directory> --network-id iroup-stability-local-20261021-loopback`.

The scoped Content Core commit includes this checkpoint, application changes,
generated database types, migration and tests. The original `PROJECT_STATE.md` diff
is still exactly 46 insertions / 26 deletions; unrelated untracked work and older
charter/handoff drafts are excluded. Push target is the existing
`codex/stability-travel-v2-20261021` branch, whose Git deployments remain disabled in
the tracked `vercel.json`. No merge into `main` or deployment is requested.

Deferred: legacy import/allowlists, manual/Canva assets and rights, visual briefs,
generation adapters, provider selection, publication bundles/outbox/reconciliation,
Website projection cutover, Facebook credentials/delivery and Production release.
The next development slice should build reviewed visual briefs and manual assets on
the approved immutable version, while preserving the separate publication gate.
