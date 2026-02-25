# Dashmin — Admin Dashboard PRD

## Overview

Dashmin is an admin dashboard for managing users and sessions, built on top of better-auth's admin plugin. The dashboard provides authenticated admin users with the ability to create, view, edit, ban, and delete users, manage their sessions, and impersonate users for debugging purposes.

The project is a monorepo with a React frontend (`apps/admin`), a Hono API backend (`apps/api`), a shared database package (`packages/db`), and a shared UI component library (`packages/ui`).

## Tech Stack

| Concern       | Choice                                                  |
| ------------- | ------------------------------------------------------- |
| Router        | TanStack Router (file-based, type-safe)                 |
| Data fetching | TanStack Query                                          |
| Forms         | TanStack Form + Zod                                     |
| Auth state    | `useSession()` from better-auth React client            |
| Tables        | TanStack Table                                          |
| Toasts        | Sonner                                                  |
| UI primitives | shadcn (base-ui) + Hugeicons (already in `@dashmin/ui`) |

## Roles

Two roles, handled entirely by better-auth's admin plugin defaults:

- **`user`** — default role assigned on signup. No access to the admin dashboard.
- **`admin`** — full access to all dashboard features.

No custom RBAC or shared access control package is needed at this stage.

## Database Schema Changes

The better-auth admin plugin adds the following columns to existing tables.

### `user` table — new columns

| Column       | Type        | Default  | Description                             |
| ------------ | ----------- | -------- | --------------------------------------- |
| `role`       | `string`    | `"user"` | The user's role (`"user"` or `"admin"`) |
| `banned`     | `boolean`   | `false`  | Whether the user is banned              |
| `banReason`  | `string`    | `null`   | Reason for the ban                      |
| `banExpires` | `timestamp` | `null`   | Ban expiry. `null` means permanent      |

### `session` table — new columns

| Column           | Type     | Default | Description                                     |
| ---------------- | -------- | ------- | ----------------------------------------------- |
| `impersonatedBy` | `string` | `null`  | ID of the admin user impersonating this session |

After enabling the admin plugin, the Drizzle schema files in `packages/db/src/schema/` must be updated to include these columns, and a migration must be generated and applied via `drizzle-kit`.

## Auth Configuration

### Server (`apps/api/src/lib/auth.ts`)

Add the `admin()` plugin to the existing better-auth configuration:

```ts
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

export const auth = betterAuth({
  basePath: "/api/v1/auth",
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [admin()],
});
```

The plugin uses sensible defaults: `defaultRole: "user"`, `adminRoles: ["admin"]`.

### Client (`apps/admin`)

Create an auth client with the `adminClient()` plugin:

```ts
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  basePath: "/api/v1/auth",
  plugins: [adminClient()],
});
```

Auth state is accessed via `authClient.useSession()` throughout the app. No additional state management library is needed.

## Route Structure

```
apps/admin/src/routes/
├── __root.tsx                  # Root layout (QueryClientProvider, Sonner)
├── _authenticated.tsx          # Authenticated layout (sidebar, top bar, auth guard)
├── _authenticated/
│   ├── index.tsx               # Dashboard home (/)
│   └── users/
│       ├── index.tsx           # Users list (/users)
│       └── $userId.tsx         # User detail (/users/:userId)
└── login.tsx                   # Login page (/login)
```

### Route Behaviors

- **`__root.tsx`** — Wraps the entire app with `QueryClientProvider` and `Sonner` toaster. Renders `<Outlet />`.
- **`login.tsx`** — Public route. If the user is already authenticated and is an admin, redirect to `/`. Otherwise, show the login form.
- **`_authenticated.tsx`** — Layout route that checks `useSession()`. If not authenticated, redirect to `/login`. If authenticated but not an admin, show a forbidden message. Otherwise, render the dashboard shell (sidebar + top bar) with `<Outlet />`.
- **`_authenticated/index.tsx`** — Dashboard home page. Simple welcome screen showing the logged-in admin's name.
- **`_authenticated/users/index.tsx`** — Users list page.
- **`_authenticated/users/$userId.tsx`** — User detail page with inline editing, session management, and actions.

## Pages

### Login Page (`/login`)

A centered login form with email and password fields.

**Form fields:**

| Field    | Type       | Validation                   |
| -------- | ---------- | ---------------------------- |
| Email    | `email`    | Required, valid email format |
| Password | `password` | Required, min 8 characters   |

**Behavior:**

- Submit calls `authClient.signIn.email()`.
- On success, redirect to `/`.
- On error, display inline error message via Sonner toast.
- If the authenticated user's role is not `admin`, show an error and sign them out.

**Form implementation:** TanStack Form with Zod schema validation.

### Dashboard Home (`/`)

A simple welcome page. Displays:

- Greeting with the admin's name.
- Quick stats summary: total users count, active sessions count, banned users count.

Stats are fetched via `authClient.admin.listUsers()` with appropriate filters.

### Users List Page (`/users`)

A paginated, searchable, sortable table of all users.

**Table columns:**

| Column     | Source                     | Sortable |
| ---------- | -------------------------- | -------- |
| Name       | `user.name`                | Yes      |
| Email      | `user.email`               | Yes      |
| Role       | `user.role`                | Yes      |
| Status     | Derived from `user.banned` | Yes      |
| Created At | `user.createdAt`           | Yes      |

**Features:**

- **Search** — Text input that searches by name or email using `searchValue` / `searchField` / `searchOperator` params from `authClient.admin.listUsers()`.
- **Filter by role** — Dropdown to filter by `admin` or `user`.
- **Filter by status** — Dropdown to filter by active or banned.
- **Sort** — Clickable column headers, using `sortBy` / `sortDirection` params.
- **Pagination** — Server-side pagination using `limit` / `offset` params. Display page size selector and page navigation.
- **Row click** — Navigate to `/users/:userId`.
- **Create user button** — Opens the create user modal.

**Data fetching:** TanStack Query wrapping `authClient.admin.listUsers()`. Query keys include all filter/sort/pagination params for proper cache invalidation.

**Table implementation:** TanStack Table with server-side pagination, sorting, and filtering.

### Create User Modal

A modal dialog triggered from the users list page.

**Form fields:**

| Field    | Type       | Validation                         |
| -------- | ---------- | ---------------------------------- |
| Name     | `text`     | Required                           |
| Email    | `email`    | Required, valid email format       |
| Password | `password` | Required, min 8 characters         |
| Role     | `select`   | Required, options: `user`, `admin` |

**Behavior:**

- Submit calls `authClient.admin.createUser()`.
- On success, close modal, show success toast, invalidate users list query.
- On error, show error toast.

**Form implementation:** TanStack Form with Zod schema validation.

### User Detail Page (`/users/:userId`)

Displays full user information with inline actions. Divided into sections.

#### User Info Section

Displays user fields in a card layout. Each field can be edited inline or via an edit form.

**Displayed fields:**

- Name
- Email
- Role (with badge)
- Status (active/banned, with badge)
- Ban reason (if banned)
- Ban expiry (if banned, or "Permanent")
- Created at
- Updated at

**Actions row (buttons):**

| Action       | Button         | Behavior                                                                                                                     |
| ------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Edit user    | "Edit"         | Opens edit form/modal with TanStack Form. Calls `authClient.admin.updateUser()`                                              |
| Set role     | "Set Role"     | Dropdown or modal. Calls `authClient.admin.setRole()`                                                                        |
| Set password | "Set Password" | Modal with new password field. Calls `authClient.admin.setUserPassword()`                                                    |
| Ban user     | "Ban"          | Shown when user is not banned. Opens modal with reason (text) and expiry (optional date). Calls `authClient.admin.banUser()` |
| Unban user   | "Unban"        | Shown when user is banned. Confirmation dialog. Calls `authClient.admin.unbanUser()`                                         |
| Impersonate  | "Impersonate"  | Confirmation dialog. Calls `authClient.admin.impersonateUser()`                                                              |
| Delete user  | "Delete"       | Destructive confirmation dialog. Calls `authClient.admin.removeUser()`. On success, navigate back to `/users`                |

All mutation actions use TanStack Query mutations with appropriate query invalidation and Sonner toasts for feedback.

#### Sessions Section

A table within the user detail page listing all active sessions for the user.

**Table columns:**

| Column                    | Source                                                |
| ------------------------- | ----------------------------------------------------- |
| Session token (truncated) | `session.token`                                       |
| IP address                | `session.ipAddress`                                   |
| User agent                | `session.userAgent`                                   |
| Created at                | `session.createdAt`                                   |
| Expires at                | `session.expiresAt`                                   |
| Impersonated by           | `session.impersonatedBy` (show admin name if present) |

**Actions:**

- **Revoke session** — Button per row. Calls `authClient.admin.revokeUserSession()`.
- **Revoke all sessions** — Button above the table. Calls `authClient.admin.revokeUserSessions()`. Confirmation dialog.

**Data fetching:** TanStack Query wrapping `authClient.admin.listUserSessions()`.

## Impersonation

When an admin impersonates a user:

1. Clicking "Impersonate" on the user detail page calls `authClient.admin.impersonateUser({ userId })`.
2. A persistent **impersonation banner** appears at the top of the viewport (above the dashboard layout) with:
   - Text: "You are impersonating {user name}"
   - A "Stop Impersonating" button
3. The banner is rendered in `_authenticated.tsx` layout, conditionally shown when the current session has `impersonatedBy` set.
4. Clicking "Stop Impersonating" calls `authClient.admin.stopImpersonating()` and returns the admin to their own session.

## Dashboard Layout

The `_authenticated.tsx` layout renders:

### Sidebar

- **App logo/name** — "Dashmin" at the top.
- **Navigation links:**
  - Dashboard (`/`)
  - Users (`/users`)
- Active link is highlighted based on current route.
- Collapsed/expanded state is not required for v1 (can be fixed width).

### Top Bar

- **User info** — Admin's name and role badge on the right.
- **Logout button** — Calls `authClient.signOut()`, redirects to `/login`.

### Impersonation Banner

- Rendered conditionally above the sidebar + content area.
- Full-width, visually distinct (e.g., warning/amber color).

## UI Components

The following components need to be added to `packages/ui` (via shadcn CLI or manually) as they are built upon during development:

- **Input** — Text/email/password input
- **Table** — Data table
- **Dialog/Modal** — For create user, ban user, set password, confirmations
- **Select** — Role selection, filters
- **Badge** — Role and status badges
- **Card** — User info sections
- **Dropdown Menu** — Action menus
- **Pagination** — Table pagination controls
- **Separator** — Visual dividers
- **Skeleton** — Loading states

Components are added incrementally as needed during each phase. The existing **Button** component in `@dashmin/ui` is already available.

**Form components** — `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldSet`, `FieldLegend` (as shown in the TanStack Form docs pattern) should be added to `@dashmin/ui` for consistent form styling.

## API Integration Pattern

All admin operations use the better-auth client methods under `authClient.admin.*`. No custom API endpoints are needed.

### TanStack Query Integration

**Queries** (wrapped in `useQuery`):

- `authClient.admin.listUsers({ ...params })` — users list with pagination/filter/sort
- `authClient.admin.getUser({ userId })` — single user detail
- `authClient.admin.listUserSessions({ userId })` — user sessions

**Mutations** (wrapped in `useMutation`):

- `authClient.admin.createUser()`
- `authClient.admin.updateUser()`
- `authClient.admin.setRole()`
- `authClient.admin.setUserPassword()`
- `authClient.admin.banUser()`
- `authClient.admin.unbanUser()`
- `authClient.admin.removeUser()`
- `authClient.admin.impersonateUser()`
- `authClient.admin.stopImpersonating()`
- `authClient.admin.revokeUserSession()`
- `authClient.admin.revokeUserSessions()`

Each mutation invalidates the relevant query keys on success and shows a Sonner toast for success/error feedback.

## Development Phases

### Phase 0: Foundation

1. Enable better-auth admin plugin on the API.
2. Update Drizzle schema with new columns (`role`, `banned`, `banReason`, `banExpires` on user; `impersonatedBy` on session).
3. Generate and apply migration.
4. Install frontend dependencies: `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-table`, `@tanstack/react-form`, `sonner`, `zod`.
5. Set up auth client in `apps/admin` with `adminClient()` plugin.
6. Set up TanStack Router with file-based routing.
7. Set up TanStack Query provider at root.
8. Seed an initial admin user (script or manual).

### Phase 1: Auth & Layout Shell

9. Build login page with TanStack Form + Zod validation.
10. Implement auth guard in `_authenticated.tsx` using `useSession()`.
11. Build dashboard layout shell (sidebar + top bar).
12. Build dashboard home page with welcome message and quick stats.

### Phase 2: User Management

13. Build users list page with TanStack Table (pagination, search, filter, sort).
14. Build user detail page with info display and action buttons.
15. Build create user modal with TanStack Form.
16. Implement ban/unban with reason and expiry inputs.
17. Implement delete user with confirmation dialog.
18. Implement set role and set password actions.

### Phase 3: Session Management

19. Build sessions table on user detail page.
20. Implement revoke session and revoke all sessions.

### Phase 4: Impersonation

21. Implement impersonate user action on user detail page.
22. Build impersonation banner in `_authenticated.tsx` layout.
23. Implement stop impersonating action.

## Seeding

An initial admin user is needed to access the dashboard. This can be done via:

- A seed script that calls `authClient.admin.createUser()` or directly inserts into the database with `role: "admin"`.
- Alternatively, register a user normally and manually update their role to `"admin"` in the database.

The approach is left to developer preference. A seed script in `packages/db` is recommended for repeatability.

## Out of Scope

The following are explicitly not included in this version:

- Dark mode
- Custom roles beyond `admin`/`user`
- Shared RBAC/access control package
- Domain-specific entities (projects, content, etc.)
- Email verification flow
- Password reset flow
- User profile/settings page for the admin themselves
- Audit logging
- Export/import of user data
- Sidebar collapse/expand
- Mobile responsive layout
