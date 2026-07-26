# iROUP Next: Application architecture

## Runtime

- Next.js App Router and React Server Components
- Supabase Auth with `@supabase/ssr`
- Supabase Postgres with RLS as the authorization boundary
- Supabase Storage for files and media
- Server Actions or Route Handlers for validated mutations
- Background jobs only for long-running imports, notifications, and exports

## Application areas

```text
/(public)       public bilingual portal
/(auth)         sign-in and account recovery
/(workspace)    permission-aware staff workspace
/api            controlled integration and export endpoints
```

## Workspace shell

- persistent sidebar with only permitted modules
- top bar with global search, fiscal year, locale, and account menu
- breadcrumbs and page title
- one primary action per screen
- consistent loading, empty, error, and permission-denied states

## Page patterns

### Dashboard

- cross-module work requiring attention
- agreement expiry and upcoming deadlines
- current inbound/outbound movement
- recently published content
- shortcuts based on the user's permissions

### List

- server-side search, filtering, sorting, and pagination
- saved URL query state
- bulk actions only when authorized
- compact table on desktop and structured rows on mobile
- export respects the same RLS scope as the visible list

### Create and edit

- shared record header and status
- domain sections, not one enormous form
- autosaved draft only after the first valid save
- explicit publish/review action
- unsaved-change protection
- validation beside the affected field

### Detail

- summary and lifecycle state
- tabs for participants, partners, files, funding, and history only when relevant
- activity history is read-only evidence

## Mutation path

```text
UI form
-> Zod validation
-> Server Action / Route Handler
-> Supabase session
-> PostgreSQL grants and RLS
-> audit trigger
-> cache revalidation
```

Service-role credentials are restricted to trusted server jobs and are never
sent to the browser.

## Shared frontend packages

```text
src/
  app/
    (public)/
    (auth)/
    (workspace)/
  components/
    app-shell/
    data-table/
    forms/
    feedback/
    ui/
  features/
    agreements/
    movements/
    scholarships/
    events/
    news/
    knowledge/
    reports/
    settings/
  lib/
    auth/
    permissions/
    supabase/
    validation/
```

Feature modules own their queries, schemas, forms, and domain components.
Generic UI components do not contain domain rules.
