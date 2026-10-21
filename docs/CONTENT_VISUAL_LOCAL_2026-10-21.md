# Content Automation — Visual Brief and manual images, local checkpoint

Date: 2026-10-21 (Asia/Bangkok). Repository: `D:\---------ONLY PEACH----------\iroup-next`.
Branch: `codex/stability-travel-v2-20261021`; starting HEAD: `89951ab` (Content Core).

## Scope and authority

Implementation and testing of Visual Brief and manual image management were local only.
A subsequent explicit user instruction authorizes committing and pushing this Visual
checkpoint to the existing branch. Deployment, Production migration/access, publication,
provider generation, credential changes and import of existing brand assets remain
outside this authorization.
The earlier charter/handoffs and pre-existing `PROJECT_STATE.md` edits are preserved.

## User workflow

- The Content Core editor links to
  `/content-production/[kind]/[recordId]/visual` for Scholarship and News.
- A brief pins an approved, current immutable content version for Website or Facebook.
  It records objective, audience, key message, layout guidance, brand notes, dimensions,
  optional prompt/negative prompt and 1–6 named panels. These prompts are stored text;
  they are not sent to an image generator. Brand notes are reviewed per work item;
  this slice does not claim an authoritative logo, font or brand-template library.
- Briefs have draft, review, approved and returned states. Saving an edit creates a
  successor; history and decisions cannot be overwritten. Brand notes are required
  to submit/approve. The existing exact-module update/publish permissions control
  editing and review respectively; approval here does not publish content.
- Approved current briefs accept manual uploads, including files exported manually
  from Canva. The user records ownership/license/permission/public-domain basis,
  a required rights note, optional credit/source URL and an optional earlier image
  from the same work item. These are user declarations for review, not independent
  license verification. No Canva API is invoked and source URLs are not fetched.
- The image library shows previews, dimensions, provenance and rights. Select one
  distinct image per panel, reorder panels with their images and alt text, and save
  immutable image-set versions. Partial drafts are allowed; submission and approval
  require every panel exactly once and both Thai and English alt text.
- A newer content version, changed facts, superseding/expired source verification or
  newer brief invalidates dependent work. Old images remain inspectable by authorized
  viewers. Uploading another candidate alone does not invalidate an approved set.
  Newer image-set versions supersede older sets. No public pointer is changed.

## Image validation and private access

`sharp@0.34.5` is an explicit runtime dependency, reused from the installed cache.
The server accepts still PNG/JPEG/WebP only, with matching magic bytes, extension and
declared MIME (empty declared MIME is allowed). It fully decodes the pixels, rejects
corruption/animation, applies EXIF orientation, converts to sRGB and strips embedded
metadata before encoding. JPEG/WebP use quality 95; original file bytes are not retained.
Each input and stored output is limited to 8 MiB. Dimensions must match the approved
brief exactly, within 64–4096 pixels per side and 16 million decoded pixels.

The asset registry records SHA-256 for both original upload and normalized stored
bytes, dimensions, MIME, byte count and provenance. The upload reservation also pins
the `visual-raster-v1` processing contract. Replacements create new assets and optional
parent lineage, never overwrite an object. Existing unrelated asset rows still work
with the new nullable metadata columns.

The `content-working` bucket is private with no client read/write/delete policies.
The server validates the logged-in user, reserves an upload through the authenticated
RPC, uploads to its immutable random path with `upsert: false`, then invokes a
service-only finalizer. The finalizer rechecks active identity, exact module rights,
revision, approved brief and Storage metadata before registering the verified image.
An authenticated client cannot bypass decoding by calling the finalizer or writing
directly to Storage. No `record_assets` link is created.

Previews go through `/api/content-visual/assets/[assetId]`. Each new request checks the
current active user and exact module visibility, downloads through the server and
checks stored size/hash. Responses use `private, no-store`, `Vary: Cookie` and
`nosniff`; there are no public or reusable signed image URLs in the client DTO.
Revocation blocks subsequent reads; it cannot erase pixels already received by a user.

The server requires `SUPABASE_SERVICE_ROLE_KEY` and the matching Supabase URL.
The QA harness passes disposable local values only to its Next child process.
Repository `.env.local` and Production settings were not changed. Starting a separate
local app needs matching local configuration; it should not be pointed at Production
to try this unapplied migration.

## Database, retries and limits

Migration: `supabase/migrations/20261021120000_content_visual.sql`.
Adds four public history tables, private upload tickets/receipts, asset metadata,
private Storage bucket and scoped RPCs. New public tables have RLS; client DML and
unneeded function grants are revoked. Composite foreign keys bind related rows to
the same work item. `ContentProduction.visual` is the application boundary, with
generated local Database argument types and strict runtime command/read DTO schemas.

Visual and Core commands share the work item's revision lock. Same actor/key/payload
replays; changed payload fails. A reservation is operational and does not increment
the editorial revision; successful finalization increments it once. Pending retries
must still match the current revision and approved brief. Completed retries can
return their original asset even after upstream changes, after current permission
checks. Parallel finalizers serialize; stale competing work returns `PT409`.
History is sorted by semantic revision, including transactions with identical timestamps.

If upload response delivery fails, retry reconciles only that exact path and expected
stored hash. It never overwrites or deletes an ambiguous object. A pending ticket or
private object can remain after abandoned uploads, permission revocation or a competing
edit. Automatic cleanup/retention and resumable UI across reloads are deferred; no
claim is made that every interrupted upload is automatically recovered or removed.

Briefs, registered images and sets are each capped at 100 per work item, panels at 6,
and review reads at the latest 100. Content reads retain Core's latest 20 versions
plus channel heads. Full history pagination and large collections are future work.

## Local verification

Only the isolated `iroup-stability-local-20261021` QA stack is used:
API `127.0.0.1:30321`, DB `127.0.0.1:30322`. The original local stack/data is untouched.
The new migration is copied into the QA temporary workdir; after first application,
the execute/inspect functions were replaced with their final definitions to add the
pending-retry guard and deterministic history ordering. No reset was used.

- Vitest: 15 files / 249 tests passed, including image decoding, spoofed/corrupt files,
  EXIF, dimensions/size limits, safe errors, provenance and upload/proxy boundaries.
- Full ESLint and TypeScript checks passed.
- Final TypeScript check and optimized Next build passed after the panel-key fix.
  The build process used only the QA loopback URL/keys as temporary environment
  overrides; no environment file was edited and no deployment was performed.
- pgTAP: 24 files / 702 assertions passed, including 86 Visual checks and existing
  Core, Stability and Travel tests.
- Actual overlapping concurrency: 3/3 passed with observed advisory/work-row waits:
  duplicate reservation, duplicate finalization with simultaneous retry, and competing
  distinct finalizers. One asset/revision wins; stale competing work is rejected.
  Owned fixtures were cleaned; test users and orphan upload/asset readbacks were zero.
- All 12 Visual function bodies match QA. Source and QA migration copies have the
  same SHA-256: `E0DE9E5AEB68F757648612A22B0A45288158A00DCCC49E97DCB11C79DF408AB1`.
  Readback confirms the private bucket limits and authenticated-only command/read
  RPCs, service-only finalization/file lookup and no public/client private-helper grants.

- Browser: 13/13 cases passed with real PNG/JPEG uploads, normalized byte/hash readback,
  private previews, anonymous/unrelated/inactive access denial, direct Storage and
  finalizer denial, brief/set review gates, bilingual alt text, immutable reordering,
  idempotent replay, stale-tab input preservation and source invalidation. Scholarship
  keyboard input and a 390px viewport passed without horizontal overflow. Canonical
  rows, anonymous public projections and `record_assets` remained unchanged.
  Browser external requests: zero. Owned fixtures were removed and port 3105 stopped.
- A final UI review found that deleting a middle panel and adding another could reuse
  a remaining panel key. The add button now selects the first unused key. A focused
  browser regression passed 1/1, confirming the surviving panel contents and unique
  saved keys. Final scoped ESLint passed after the refinement.
- Final fixture readback: all Visual history tables, tickets, receipts, registered
  images, Storage objects in `content-working` and browser test users are zero.
  The isolated Supabase stack remains available with the additive migration; the
  temporary Next test server is stopped.

Browser evidence: `content-visual-result-58b32f31.json`,
`content-visual-next-58b32f31.log`, `content-visual-mobile-58b32f31.png` and
`content-visual-history-58b32f31.png` in the evidence directory below. Focused regression:
`content-visual-result-5c8e3632.json`, `content-visual-next-5c8e3632.log` and
`content-visual-panel-regression-5c8e3632.png`.

## Re-run and next work

Evidence directory: `C:\Users\Lenovo\AppData\Local\Temp\iroup-stability-local-20261021`.

- Browser: `node tests/content-visual-browser.mjs --run-local-content-visual`.
- Focused panel regression: add `--panel-regression-only` to that browser command.
- Concurrency: `node tests/content-visual-concurrency.mjs --run-local-visual`.
- Supabase CLI requires `--local --workdir <QA directory>` and
  `--network-id iroup-stability-local-20261021-loopback`.

Run DB/browser fixture harnesses sequentially. Do not run Next build/type generation
while the browser harness owns port 3105. Harnesses use synthetic fixtures and clean
only their own records/objects. They do not import existing images from `assets/`.

Deferred: provider generation/adapters, authoritative brand library, advanced image
editing/cropping, abandoned-upload retention jobs, legacy imports, publication bundle/
outbox/reconciliation, Website cutover, Facebook delivery and Production release.
The next implementation step should be chosen separately after this local slice is reviewed.

The pre-existing `PROJECT_STATE.md` diff remains exactly 46 insertions / 26 deletions.
Unrelated `.agents/`, developer logs, `assets/`, `skills-lock.json` and historical
untracked architecture/handoff documents remain outside this change. The scoped Visual
commit starts from `89951ab` and includes its application changes, dependency update,
generated database types, migration, tests and this checkpoint. The push target is
`codex/stability-travel-v2-20261021`; the tracked branch deployment disable setting
remains unchanged. No merge into `main` or deployment is requested.
