# iROUP Next: Screen and interaction standards

## Information architecture

The workspace is one system with reusable patterns, not separate mini-sites.
The active user sees only modules they can access.

## Standard list screen

1. Breadcrumb and page title
2. One primary create action
3. Search and essential filters
4. Result count and active-filter summary
5. Data table with row actions
6. Server-side pagination

The same shell is reused for MOU, movement categories, scholarships, events,
news, and knowledge. Columns and filters remain domain-specific.

### Private foreign contacts

- Located under `ความร่วมมือและ MOU > ผู้ติดต่อองค์กรต่างประเทศ`
- Internal-only badge and access-denied state are always visible where relevant.
- Default columns: contact, organization, country, position, primary methods,
  relationship level, and latest contact date.
- Filters: country, continent, organization type, field/topic, relationship
  level, active state, and follow-up status.
- Contact detail separates profile, contact methods, interaction timeline,
  linked MOU/movement records, follow-up, and internal notes.
- Export requires MOU access and must never be available on the public portal.

## Standard create/edit screen

1. Record identity and workflow status
2. Essential information
3. Domain-specific detail
4. Relationships: partners, units, or participants
5. Files and funding when applicable
6. Internal note
7. Save draft, review, publish, or archive actions based on permission

## Movement screens

The navigation separates:

- Mobility นิสิต
- Mobility บุคลากร
- เดินทางไปปฏิบัติงาน

All three reuse the movement list, form framework, destination picker,
participant editor, date controls, files, and funding components. Each route
provides a category-specific schema and vocabulary.

## Required states

Every reusable page pattern includes:

- loading skeleton
- no records yet
- no search results
- validation error
- network/server error
- access denied
- read-only published state
- destructive-action confirmation

## Accessibility and localization

- Thai is the default workspace language.
- Public content supports Thai and English.
- Keyboard focus, labels, error association, and contrast are required.
- Dates display in Buddhist Era for Thai UI while APIs and database use ISO
  Gregorian values.
