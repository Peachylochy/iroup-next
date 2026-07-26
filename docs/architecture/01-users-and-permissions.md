# iROUP Next: Users and permissions

Status: accepted architecture baseline  
Scope: the complete internal workspace and public portal

## Principles

- Supabase Auth proves identity; application authorization is stored separately.
- A signed-in user receives no operational access until a role or module permission is assigned.
- Public users see only deliberately published, public-safe fields.
- Person-level data, budgets, import payloads, audit history, and internal notes are never public.
- Editors work only in assigned modules.
- Publishing and deletion are separate permissions from editing.
- React is not a security boundary. PostgreSQL grants and RLS enforce access.

## User groups

| User group | Purpose | Default access |
| --- | --- | --- |
| Anonymous public | Read the public website | Published public-safe records only |
| Signed in, unassigned | Account exists but is not approved | Own profile only |
| Viewer | Internal read-only work | Assigned modules only |
| Editor | Day-to-day data entry | Assigned modules; no publishing or deletion by default |
| Office administrator | Operate the complete iROUP workspace | All operational modules, masters, publishing, and soft deletion |
| System administrator | Technical ownership and recovery | All office permissions plus roles and system configuration |

## Modules

- `mou`: agreements, partner organizations, private partner contacts,
  interaction history, milestones, and agreement files
- `mobility`: student and staff mobility, inbound and outbound
- `travel`: official staff travel
- `scholarship`: scholarship opportunities
- `events`: activities and events
- `news`: public news and announcements
- `knowledge`: knowledge articles and resources
- `reports`: cross-module dashboards and exports
- `settings`: users, permissions, master data, and system configuration

Mobility and official staff travel share the International Movement data core,
but retain separate module permissions and workflows.

## Module actions

Each user can receive these actions per module:

- `view`
- `create`
- `update`
- `publish`
- `delete`
- `import`

## Permission matrix

| Capability | Public | Unassigned | Viewer | Editor | Office admin | System admin |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Read published public-safe records | Yes | Yes | Yes | Yes | Yes | Yes |
| Read internal records | No | No | Assigned | Assigned | All | All |
| Read person-level data | No | No | Assigned | Assigned | All | All |
| Read foreign partner contacts | No | No | MOU only | MOU only | Yes | Yes |
| Create records | No | No | No | Assigned | All | All |
| Update drafts | No | No | No | Assigned | All | All |
| Publish or unpublish | No | No | No | Explicit grant | All | All |
| Delete records | No | No | No | Explicit grant | All | All |
| Import files | No | No | No | Explicit grant | All | All |
| View cross-module reports | No | No | Explicit grant | Explicit grant | Yes | Yes |
| Manage master data | No | No | No | No | Yes | Yes |
| Assign roles and permissions | No | No | No | No | No | Yes |

## Movement permission routing

| Movement category | Module used by RLS |
| --- | --- |
| Student mobility | `mobility` |
| Staff mobility | `mobility` |
| Visiting delegation | `mobility` |
| Official staff travel | `travel` |

This permits a user to manage student and staff mobility without automatically
receiving access to official staff travel records or internal funding.

## Publishing rule

Editors without `publish` permission cannot create a published record, change a
draft to published, unpublish an existing record, or modify an already published
record. Public content always passes a deliberate review boundary.

## Foreign partner contact privacy

- Contact names, positions, direct contact methods, interaction history, and
  internal notes are never granted to `anon`.
- An authenticated user must also have `mou.view`; sign-in alone is not enough.
- Create, update, delete, and import remain separate MOU permissions.
- Partner organizations may be public when used by a published agreement, but
  their contact people and communication details remain internal.
- No real contact record is committed to the public GitHub repository.

## Bootstrap rule

The first system administrator is assigned manually after their Supabase Auth
user exists. No user can promote themselves. Authorization must never use
editable `user_metadata`.
