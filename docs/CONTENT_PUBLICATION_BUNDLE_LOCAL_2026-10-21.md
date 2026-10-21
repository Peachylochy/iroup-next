# Content Automation — private publication preparation bundles

Date: 2026-10-21 (Asia/Bangkok). Repository: `D:\---------ONLY PEACH----------\iroup-next`.
Branch: `codex/stability-travel-v2-20261021`; starting HEAD: `12f1367` (Visual Brief/manual images).

## Authority and scope

The implementation request authorized the next Content Automation development slice
locally, without push/deployment or Production access. This checkpoint adds preparation
bundles and internal preview/verification to the approved Core and Visual workflow.
The implementation did not commit, push, deploy, migrate Production, import legacy
content, enable providers, choose a Facebook Page, send messages or publish anything.

The subsequent user instruction on 2026-10-21 authorizes a scoped commit and push of
this Publication Bundle slice to `codex/stability-travel-v2-20261021`. Deployment and
Production access remain unauthorized. The branch's existing Git deployment-disable
setting in `vercel.json` is preserved; `main` is not a push target.

This slice can use the newly authored and manually uploaded content already supported
by the application. Legacy import and provider adapters still need their own specific
inputs/decisions; they are not prerequisites for reviewing an approved content/image
combination. Historical architecture documents remain untouched. This checkpoint is
the current implementation record, superseding their historical implementation pause
only for the local work authorized in this conversation.

## Implemented workflow

- Content Core and Visual pages link to
  `/content-production/[kind]/[recordId]/publication` for Scholarship and News.
- A user with active exact-module `view` + `publish` permission can freeze a current
  approved image set and its exact approved brief/content version. `update` alone
  does not grant freeze; a publisher without `update` can freeze. Active office/system
  administrators follow the existing module access contract.
- The server derives channel, version and images from persisted references. A request
  contains only work item, expected revision, idempotency key and selected image-set ID.
  It cannot supply replacement copy, actor, token, destination, private path or images.
- Each bundle pins snapshot/content/brief/image-set IDs and digests. Its frozen
  display payload contains an explicit allowlist: schema/kind/channel, TH/EN copy,
  ordered image IDs/hashes/MIME/dimensions, panel labels, alt text and attribution.
  Source notes, rights notes, internal canonical notes, prompts, original filenames,
  origin URLs and Storage paths are excluded from this payload.
- Internal readers can view the frozen text/images, switch TH/EN with keyboard or
  pointer, filter history by Website/Facebook, and inspect old bundles with reasons
  when their references become stale. Preview is plain-text review of content and
  image order, not a renderer of a future Website theme or Facebook post layout.
- New bundles have immutable per-channel sequence numbers and predecessor links.
  Saving the same approved set again returns the existing bundle without incrementing
  the work revision; same-key retry returns its original result. A changed payload
  under the same key fails. Stale expected revisions fail with `PT409`.
- Source expiration/recheck, changed content/facts, a superseding brief/image set or
  unavailable Storage metadata makes dependent bundles stale. Historical payload and
  hashes remain unchanged. A stale bundle remains viewable by authorized readers.

## What freezing and verification mean

Freezing records an approved editorial combination. It creates no destination,
dispatch intent, queue, provider request, public derivative, `record_assets` link,
public projection or website/Facebook update. The bundle status refers to current
editorial references, not publication status.

This preparation slice intentionally has no target-version binding. A future delivery
workflow must bind an explicitly selected/approved destination version to an immutable
delivery request and perform a fresh dispatch preflight. These records must not be
treated as authorization to publish directly. Scholarship deadline public-primary
mapping and legacy-column mirroring are also still deferred; the exact editorial
snapshot is pinned without inventing that mapping.

The database checks current approvals, the validated image/rights/brief metadata,
matching upload reservation fingerprints and existence/size/MIME of private Storage
objects. It does not download bytes. The separate **ตรวจไฟล์ภาพอีกครั้ง** server action
reads every selected image through the existing reauthorized private-file boundary,
checks its exact frozen SHA-256 and MIME, then rereads the bundle and work revision.
Revoked access, changed source state, corrupt/missing bytes or a concurrent editorial
change fails the check. Reads are sequential and bounded to six images.

A successful result is an ephemeral, dated observation for that exact bundle digest.
It is not a durable delivery receipt or guarantee of future availability. The UI hides
old proof/errors during a new check, discards proof after bundle/revision changes, and
does not display successful proof for stale or mismatched bundles. Real delivery will
need another check immediately before acting.

The preview uses the existing private image route and its no-store/hash verification;
it introduces no signed/public image URLs or image optimizer path. Authenticated view
permission is required for metadata and each file read. A reader can check bytes but
cannot freeze without publish permission. `.env.local` and provider settings remain
unchanged; the QA harness injects only disposable local keys into its child process.

## Database and application boundary

Migration: `supabase/migrations/20261021140000_content_publication_bundle.sql`.
Adds `public.content_publication_bundles` and `private.content_publication_receipts`.
Both have RLS; the public table exposes scoped SELECT only. Client DML, anonymous
access, service-role execute and private helper access are revoked. History/receipts
reject update/delete. Composite keys enforce the work owner and same-channel lineage.

`content_publication_execute` and `content_publication_inspect` are authenticated RPCs
behind `ContentProduction.publication`. Commands pin active profile/permission rows,
check exact parent-module authorization before replay, take request/work-item locks
and share the work revision with Core/Visual. Same-key historical replay can return
the original frozen bundle after staleness, but only under current freeze permission;
a fresh-key freeze must still meet current approval and metadata checks.

Digests use SHA-256 over versioned PostgreSQL JSONB text, with
`canonicalization = postgres-jsonb-text-v1`; no cross-language JCS claim is made.
Bundles are capped at 100 per work item. Read DTOs bound candidates/history to 100
and include only one selected full payload. Existing Visual limits keep sets at 100
and images per set at six. There is no bulk export/history pagination in this slice.

## Verification and local state

Uses only isolated QA `iroup-stability-local-20261021`: API `127.0.0.1:30321`,
DB `127.0.0.1:30322`, temporary Next `127.0.0.1:3105`. The original local stack and
Production were not accessed for this work. No database reset was used.

The first migration attempt exposed a SQL quoting error and rolled back completely;
the absence of the new table was checked before correction. The corrected complete
migration parsed in an explicit BEGIN/ROLLBACK rehearsal and was applied via the
local CLI. Generated public Database types come from that isolated QA schema.

- Vitest: 18 files / 288 tests passed, including 39 new boundary/action/server tests.
- Full ESLint passed; scoped lint covers the final UI proof-state refinement.
- New pgTAP suite: 108 assertions passed. Full suite: 25 files / 810 passed,
  including Core, Visual, Stability and Travel regression checks.
- Typecheck passed using generated RPC types; the nullable/default bundle selector
  is omitted when no specific bundle is requested, matching generated arguments.
- Actual concurrency: 2/2 cases passed with observed advisory/work-row waits. The same
  request produces one bundle/revision; competing keys at the same revision produce
  one winner and `PT409`, then a refreshed request reuses the existing bundle.
  The concurrency harness removed its owned fixtures.
- All four live function bodies match source after only newline/outer whitespace
  normalization. Readback confirms RLS on both tables, no client/service DML, only
  two authenticated public RPC grants and no private-helper/anonymous execute grants.
  Source/QA migration SHA-256 matches:
  `FFCDF0046E30EDC0963747661FA99AA4CEB7518D107F95A16B9D1B2A1A41E2CA`.

- Final typecheck and optimized Next build passed after all UI refinements. Build
  processes used the isolated QA URL/keys through temporary environment overrides;
  no environment file was edited and no deployment was invoked.
- Browser: 13/13 cases passed with actual uploaded synthetic images, including
  exact permissions, bilingual preview, Website/Facebook canonical snapshot reuse,
  retries/conflicts, same-length byte corruption, missing objects, stale history,
  immutable predecessor payloads and unchanged public records/assets. No browser
  requests went to external destinations. Desktop/mobile screenshots were inspected:
  images loaded, keyboard focus was visible and there was no horizontal overflow.
- Final browser evidence in the directory below:
  `content-publication-result-011c68ee.json`,
  `content-publication-next-011c68ee.log`,
  `content-publication-mobile-011c68ee.png` and
  `content-publication-history-011c68ee.png`.
- Independent cleanup readback found zero bundles, bundle receipts, work items,
  manual assets, `content-working` Storage objects and publication test users in
  isolated QA. The temporary Next server on port 3105 is stopped; the isolated
  Supabase stack remains available. At the end of local implementation, HEAD was
  `12f1367`, with no staged changes, commit, push, deployment or Production access.

## Re-run, preservation and remaining work

Evidence directory: `C:\Users\Lenovo\AppData\Local\Temp\iroup-stability-local-20261021`.

- Browser: `node tests/content-publication-browser.mjs --run-local-content-publication`.
- Concurrency: `node tests/content-publication-concurrency.mjs --run-local-publication`.
- Supabase CLI: `--local --workdir <QA directory>` and
  `--network-id iroup-stability-local-20261021-loopback`.

Fixture harnesses must run sequentially. Do not run Next build/typegen while the
browser harness owns port 3105. They create synthetic local records/images only and
remove their own fixtures; no existing `assets/` content is imported.

Pre-existing `PROJECT_STATE.md` edits, `.agents/`, developer logs, `assets/`,
`skills-lock.json` and historical untracked architecture/handoff files remain outside
this change. The authorized commit/push includes only this slice's application files,
migration, generated types, tests and this checkpoint document. No change to the
branch deployment-disable setting is included.

Deferred: approved legacy allowlist/import, image/content providers, brand masters,
abandoned-upload retention, destination configuration, dispatch intents/outbox/
reconciliation, public derivatives/projections, real Facebook delivery and Production
release. The next stage should build on these exact reviewed bundles under its own
authorized local scope and explicit external-action gates.
