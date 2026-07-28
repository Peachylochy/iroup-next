# Master Import — staging contract

This import reads `IROUP_DATABASE_PRODUCTION.xlsx` only after an administrator selects the master entities to review. It creates an internal **staging batch**; it does not write to master tables and does not create Mobility projects.

| Source sheet | Destination | Matching key | Staging decision |
| --- | --- | --- | --- |
| `COUNTRY_MASTER` | `countries` | `iso2` | Insert / update / skip; aliases preserve Thai, English and legacy IDs. |
| `UP_UNIT_MASTER` | `organization_units` | `unit_code` | Insert / update / skip; parent relation remains a source reference until commit. |
| `PARTNER_ORG_MASTER` | `partner_organizations` | `partner_org_id` -> `legacy_id` | Insert / update / skip; country is resolved by the staged ISO-2 code. |
| `PERSON_STUDENT` | `people` | `(student, student_id)` | Insert / update / skip; unit is kept as a source code until commit. |
| `PERSON_STAFF` | `people` | `(staff, staff_id)` | Insert / update / skip; unit is kept as a source code until commit. |

Rules:

- Empty formatting rows are ignored using the source key, not Excel's used range.
- Missing key/name is `invalid`; it can be fixed in a later review flow but cannot be committed.
- Existing equal data is `skip`; changed existing data is `update` and is retained for review.
- Master batches contain internal person data and are System Admin-only through RLS. They are never exposed in the public portal.
- A separate, explicit commit step will apply approved staging rows in dependency order: countries -> units -> people/partners. That step is intentionally not included in this change.
