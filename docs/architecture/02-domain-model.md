# iROUP Next: Domain and data model

Status: accepted target architecture  
Scope: complete iROUP Portal; no pilot-only domain

## Architecture decision

Mobility and official staff travel use one shared **International Movement**
core because they share dates, destinations, partners, participants, units,
funding, files, and reporting dimensions.

They remain separate workflows through `movement_category`:

- `student_mobility`
- `staff_mobility`
- `staff_official_travel`
- `visiting_delegation`

The database is normalized once. The application presents separate navigation,
forms, rules, permissions, and reports for each category.

## Domain boundaries

### Identity and access

- `profiles`: application identity linked one-to-one with `auth.users`
- `private.user_roles`: global roles
- `private.module_permissions`: per-user module actions

### Shared master data

- `countries`: ISO country source of truth
- `organization_units`: University of Phayao units and hierarchy
- `people`: staff, students, and reusable external/manual people
- `partner_organizations`: universities, agencies, and external partners
- `budget_types`: reusable funding classifications
- `file_roles`: poster, agreement, evidence, report, and attachment roles

### Partnership and MOU

- `agreements`: one agreement lifecycle
- `agreement_partners`: supports bilateral and multilateral agreements
- `agreement_units`: UP owners and participating units

Public output contains agreement identity, partner, country, responsible unit,
period, and public status only.

### International Movement

- `movement_cases`: one project, activity, visit, or official mission
- `movement_participants`: one person in one movement case
- `movement_funding`: internal funding lines

Shared fields include direction, destination, partner, owner unit, dates,
purpose, fiscal year, status, publication state, and participant count.

Category-specific meaning remains in workflow:

| Category | Important workflow fields |
| --- | --- |
| Student mobility | inbound/outbound, level, study program, mobility mode |
| Staff mobility | inbound/outbound, activity role, host organization |
| Official staff travel | duty purpose, approval/order reference, funding |
| Visiting delegation | inbound, host unit, delegation role |

Project count and participant count are different metrics and must never be
merged.

### Scholarships

- `scholarships`: opportunity dates, audience, coverage, institution, links,
  bilingual content, and publication lifecycle

### Events

- `events`: activity type, organizer, venue/mode, start/end time, registration,
  bilingual detail, participant aggregate, and publication lifecycle

### Editorial content

- `news_articles`: bilingual news and announcements
- `knowledge_items`: bilingual articles, media, guides, and downloadable
  resources

These remain separate because their lifecycle, validation, filters, and public
presentation differ even though they reuse UI components.

### Files

- `assets`: Supabase Storage metadata
- domain junction tables connect assets to agreements, movements,
  scholarships, events, news, and knowledge

Only assets explicitly marked public and attached to a published public record
may appear on the public portal.

### Imports

- `import_batches`: one uploaded source and its processing lifecycle
- `import_rows`: normalized staging rows with validation status and messages

Import is a shared platform capability, not a Travel-specific feature:

```text
upload -> parse -> normalize -> validate -> review -> commit -> audit
```

Rows are never written directly into production tables during preview.

### Audit and reporting

- `private.audit_logs`: append-only change evidence
- public-safe views: one per publishable domain
- internal dashboard views: counts and trends derived from RLS-protected tables

## Cross-domain rules

- Primary keys are UUIDs.
- Dates are stored as Gregorian dates/timestamps; Buddhist Era conversion is UI
  presentation logic.
- Thai fiscal year is stored explicitly as an integer for reporting.
- Records use `created_at`, `created_by`, `updated_at`, and `updated_by`.
- Operational deletion is soft deletion; hard deletion is restricted.
- Public data is exposed through `security_invoker` views and column-level
  grants.
- Historical participant snapshots remain stable when master person data changes.
- Foreign keys used for joins and deletes receive covering indexes.
- Module RLS is enforced in PostgreSQL, including subtype routing for movements.

## System navigation

```text
ภาพรวม
ความร่วมมือและ MOU
การเดินทางและ Mobility
  - ภาพรวมการเคลื่อนย้าย
  - Mobility นิสิต
  - Mobility บุคลากร
  - เดินทางไปปฏิบัติงาน
ทุนการศึกษา
กิจกรรม
ข่าวประชาสัมพันธ์
คลังความรู้
รายงาน
ตั้งค่าระบบ
```

Menu visibility follows permissions, but direct route and database access are
still protected independently.
