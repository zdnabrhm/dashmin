# Dashmin — Admin Dashboard PRD

## Overview

Dashmin is an admin dashboard for managing users and sessions, built on top of better-auth's admin plugin. The dashboard provides authenticated admin users with the ability to create, view, edit, ban, and delete users, manage their sessions, and impersonate users for debugging purposes.

The project is a monorepo with a React frontend (`apps/admin`), a Hono API backend (`apps/api`), a shared database package (`packages/db`), and a shared UI component library (`packages/ui`).

## Tech Stack

| Concern       | Choice                                                 |
| ------------- | ------------------------------------------------------ |
| Router        | TanStack Router (file-based, type-safe)                |
| Data fetching | TanStack Query                                         |
| Forms         | TanStack Form + Zod                                    |
| Auth state    | `authClient.getSession()` in route `beforeLoad` guards |
| Tables        | TanStack Table                                         |
| Toasts        | Sonner                                                 |
| UI primitives | shadcn (base-ui) + Hugeicons (`@hugeicons/react`)      |
| Tooling       | pnpm workspaces, moon (task runner), TypeScript 5.9    |
| Linting       | oxlint + oxfmt, husky for git hooks                    |

## Roles

Two roles, handled entirely by better-auth's admin plugin defaults:

- **`user`** — default role assigned on signup. No access to the admin dashboard.
- **`admin`** — full access to all dashboard features.

No custom RBAC or shared access control package is needed at this stage.

## Database Schema

### `user` table

| Column          | Type        | Default  | Description                             |
| --------------- | ----------- | -------- | --------------------------------------- |
| `id`            | `text`      | —        | Primary key                             |
| `name`          | `text`      | —        | NOT NULL                                |
| `email`         | `text`      | —        | NOT NULL, UNIQUE                        |
| `emailVerified` | `boolean`   | `false`  | NOT NULL                                |
| `image`         | `text`      | `null`   | Nullable                                |
| `role`          | `text`      | `"user"` | The user's role (`"user"` or `"admin"`) |
| `banned`        | `boolean`   | `false`  | Whether the user is banned              |
| `banReason`     | `text`      | `null`   | Reason for the ban                      |
| `banExpires`    | `timestamp` | `null`   | Ban expiry. `null` means permanent      |
| `createdAt`     | `timestamp` | `now()`  | NOT NULL                                |
| `updatedAt`     | `timestamp` | `now()`  | NOT NULL, auto-update                   |

Relations: `many(session)`, `many(account)`.

### `session` table

| Column           | Type        | Default | Description                                     |
| ---------------- | ----------- | ------- | ----------------------------------------------- |
| `id`             | `text`      | —       | Primary key                                     |
| `expiresAt`      | `timestamp` | —       | NOT NULL                                        |
| `token`          | `text`      | —       | NOT NULL, UNIQUE                                |
| `createdAt`      | `timestamp` | `now()` | NOT NULL                                        |
| `updatedAt`      | `timestamp` | `now()` | NOT NULL, auto-update                           |
| `ipAddress`      | `text`      | `null`  | Nullable                                        |
| `userAgent`      | `text`      | `null`  | Nullable                                        |
| `userId`         | `text`      | —       | NOT NULL, FK → user.id CASCADE DELETE           |
| `impersonatedBy` | `text`      | `null`  | ID of the admin user impersonating this session |

Index: `session_userId_idx` on `userId`. Relations: `one(user)`.

### `account` table

| Column                  | Type        | Default | Description                           |
| ----------------------- | ----------- | ------- | ------------------------------------- |
| `id`                    | `text`      | —       | Primary key                           |
| `accountId`             | `text`      | —       | NOT NULL                              |
| `providerId`            | `text`      | —       | NOT NULL                              |
| `userId`                | `text`      | —       | NOT NULL, FK → user.id CASCADE DELETE |
| `accessToken`           | `text`      | `null`  | Nullable                              |
| `refreshToken`          | `text`      | `null`  | Nullable                              |
| `idToken`               | `text`      | `null`  | Nullable                              |
| `accessTokenExpiresAt`  | `timestamp` | `null`  | Nullable                              |
| `refreshTokenExpiresAt` | `timestamp` | `null`  | Nullable                              |
| `scope`                 | `text`      | `null`  | Nullable                              |
| `password`              | `text`      | `null`  | Hashed, for email+password auth       |
| `createdAt`             | `timestamp` | `now()` | NOT NULL                              |
| `updatedAt`             | `timestamp` | `now()` | NOT NULL, auto-update                 |

Index: `account_userId_idx`. Relations: `one(user)`.

### `verification` table

| Column       | Type        | Default | Description           |
| ------------ | ----------- | ------- | --------------------- |
| `id`         | `text`      | —       | Primary key           |
| `identifier` | `text`      | —       | NOT NULL              |
| `value`      | `text`      | —       | NOT NULL              |
| `expiresAt`  | `timestamp` | —       | NOT NULL              |
| `createdAt`  | `timestamp` | `now()` | NOT NULL              |
| `updatedAt`  | `timestamp` | `now()` | NOT NULL, auto-update |

Index: `verification_identifier_idx`.

### Migrations

| Index | Tag                       | Description                                                                              |
| ----- | ------------------------- | ---------------------------------------------------------------------------------------- |
| 0000  | `add_user_profile_tables` | Creates all 4 tables (user, session, account, verification)                              |
| 0001  | `add_admin_fields`        | Adds `role`, `banned`, `ban_reason`, `ban_expires` to user; `impersonated_by` to session |

## Auth Configuration

### Server (`apps/api/src/lib/auth.ts`)

```ts
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

export const auth = betterAuth({
  basePath: "/api/v1/auth",
  trustedOrigins: [process.env.FRONTEND_URL!],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  plugins: [admin()],
});
```

The plugin uses sensible defaults: `defaultRole: "user"`, `adminRoles: ["admin"]`.

### Client (`apps/admin/src/lib/auth.ts`)

```ts
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  basePath: "/api/v1/auth",
  plugins: [adminClient()],
});
```

Auth state is fetched via `authClient.getSession()` inside route `beforeLoad` hooks and passed down through router context. The `useSession()` React hook is not used directly — session data flows through TanStack Router's context system instead.

## API

### `apps/api` — Hono Server

Runs on port 8000 via `@hono/node-server`.

**Base path:** `/api/v1`

**Middleware:**

- `hono/logger` — HTTP request logging
- `hono/pretty-json` — Pretty-print JSON responses
- `hono/cors` — CORS from `FRONTEND_URL` env var, with `credentials: true` for cookie-based auth

**Routes:**

| Method     | Path             | Description                             |
| ---------- | ---------------- | --------------------------------------- |
| `POST/GET` | `/api/v1/auth/*` | Delegated to better-auth handler        |
| `GET`      | `/api/v1/`       | Returns `{ message: "Hello {HELLO}!" }` |
| `GET`      | `/api/v1/health` | Returns `{ status: "ok", timestamp }`   |

No custom API endpoints exist — all user management is handled by better-auth's admin plugin endpoints served through `/api/v1/auth/*`.

## Route Structure

```
apps/admin/src/routes/
├── __root.tsx                  # Root layout (QueryClientProvider, Sonner, devtools)
├── _authenticated.tsx          # Auth guard + dashboard shell (sidebar + header)
├── _authenticated/
│   ├── index.tsx               # Dashboard home (/)
│   └── users/
│       ├── index.tsx           # Users list (/users)
│       └── $userId.tsx         # User detail (/users/:userId)
└── login.tsx                   # Login page (/login)
```

### Router Context

The router is created in `main.tsx` with a shared context:

```ts
interface RouterContext {
  queryClient: QueryClient;
  authClient: typeof authClient;
}
```

Both `queryClient` and `authClient` are available to every route via `Route.useRouteContext()`.

### Route Behaviors

- **`__root.tsx`** — Wraps the app with `QueryClientProvider`, `TooltipProvider`, `Sonner` toaster, `ReactQueryDevtools`, and `TanStackRouterDevtools`.
- **`login.tsx`** — Public route. `beforeLoad` checks `authClient.getSession()` — if the user is already logged in with `role === "admin"`, redirects to `/`.
- **`_authenticated.tsx`** — Layout route. `beforeLoad` calls `authClient.getSession()`. If no session, redirects to `/login`. If authenticated but not an admin (and not impersonating), signs out and redirects to `/login`. Passes `{ session, isImpersonating }` to child routes via context.
- **`_authenticated/index.tsx`** — Dashboard home page with welcome greeting and quick stats.
- **`_authenticated/users/index.tsx`** — Users list page with search, filters, sorting, and pagination.
- **`_authenticated/users/$userId.tsx`** — User detail page with profile card, action dialogs, and sessions table.

## Pages

### Login Page (`/login`)

A centered login form with "Dashmin" branding above a card.

**Form fields:**

| Field    | Type       | Validation                   |
| -------- | ---------- | ---------------------------- |
| Email    | `email`    | Required, valid email format |
| Password | `password` | Required, min 8 characters   |

**Behavior:**

- Submit calls `authClient.signIn.email()`.
- On auth error, show Sonner toast with error message.
- On success, re-fetches session and checks role. If not `admin`, calls `authClient.signOut()` and shows "Access denied. Admin role required" toast.
- On admin confirmed, navigates to `/`.

**Form implementation:** TanStack Form with Zod schema validation.

### Dashboard Home (`/`)

Displays:

- Greeting: "Welcome back, {admin name}"
- 3-column grid of stat cards:
  - **Total Users** — fetched via `authClient.admin.listUsers({ limit: 1 })` to get the `total` count.
  - **Banned Users** — fetched via `authClient.admin.listUsers()` with `filterField: "banned"`, `filterValue: true`.
  - **Active Users** — derived as `total - banned`.

### Users List Page (`/users`)

A paginated, searchable, sortable table of all users.

**Table columns:**

| Column     | Source                     | Sortable |
| ---------- | -------------------------- | -------- |
| Name       | `user.name`                | Yes      |
| Email      | `user.email`               | Yes      |
| Role       | `user.role`                | Yes      |
| Status     | Derived from `user.banned` | No       |
| Created At | `user.createdAt`           | Yes      |

Role and status columns render as `Badge` components. Dates display in `ja-JP` locale (YYYY/MM/DD format).

**Features:**

- **Search** — Text input that searches by email only, using `searchValue` / `searchField: "email"` / `searchOperator: "contains"` params. Debounced at 300ms via `@tanstack/react-pacer`.
- **Filter by role** — Select dropdown to filter by `admin` or `user`. Only one filter (role or status) can be active at a time due to better-auth API limitations.
- **Filter by status** — Select dropdown to filter by active or banned.
- **Sort** — Clickable column headers with arrow indicators, using `sortBy` / `sortDirection` params. Default sort: `createdAt` descending.
- **Pagination** — Server-side pagination using `limit` / `offset` params. Page size selector (10 / 25 / 50) and previous/next navigation with "Showing X-Y of Z" indicator. Uses `keepPreviousData` for smooth transitions.
- **Row click** — Navigates to `/users/:userId`.
- **Create user button** — Opens the `CreateUserDialog`.

**Data fetching:** TanStack Query wrapping `authClient.admin.listUsers()`. Query keys include all filter/sort/pagination params for proper cache invalidation.

**Table implementation:** TanStack Table with `manualPagination`, `manualSorting`, and `manualFiltering`. Reusable `DataTable` component handles rendering, loading skeletons, and empty states.

### Create User Dialog

A dialog triggered from the users list page.

**Form fields:**

| Field    | Type       | Validation                         |
| -------- | ---------- | ---------------------------------- |
| Name     | `text`     | Required, min 1 character          |
| Email    | `email`    | Required, valid email format       |
| Password | `password` | Required, min 8 characters         |
| Role     | `select`   | Required, options: `user`, `admin` |

**Behavior:**

- Submit calls `authClient.admin.createUser()`.
- On success, close dialog, show success toast, invalidate users list query, reset form.
- On error, show error toast.

**Form implementation:** TanStack Form with Zod schema validation.

### User Detail Page (`/users/:userId`)

Displays full user information with actions and sessions. Shows a skeleton loading state while data loads, and a "User not found" message if the user doesn't exist.

**Data fetching:** User is fetched via `authClient.admin.listUsers()` with `filterField: "id"`, `filterValue: userId`, `filterOperator: "eq"` (not `getUser()`).

#### User Profile Card

- **Avatar** with initials (max 2 characters, uppercased)
- **Name** with role badge (`default` variant for admin, `secondary` for user) and status badge (`destructive` for banned, `outline` for active)
- **Email**
- **Actions dropdown** (three-dot menu via `DropdownMenu`) with:
  - "Edit User" — opens `EditUserDialog`
  - "Set Password" — opens `SetPasswordDialog`
  - "Impersonate" — opens `ImpersonateUserDialog` (hidden when already impersonating)
  - Separator
  - "Ban User" or "Unban User" (conditional on ban status)
  - Separator
  - "Delete User" (destructive)
- **Ban info alert** — shown when banned, displays reason and expiry in a red-bordered alert box
- **Metadata grid** — created and updated dates in `ja-JP` format

#### User Action Dialogs

| Dialog                    | Trigger                    | Form                                                                                                   | API Call                                              |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `EditUserDialog`          | "Edit User" in dropdown    | Name, email, role (pre-filled). TanStack Form + Zod.                                                   | `updateUser()` + `setRole()` if role changed          |
| `SetPasswordDialog`       | "Set Password"             | New password field (min 8 chars). TanStack Form + Zod.                                                 | `setUserPassword()`                                   |
| `BanUserDialog`           | "Ban User" (if not banned) | Reason (optional text), duration select (permanent / 1d / 7d / 30d / custom days). Uncontrolled state. | `banUser({ banReason?, banExpiresIn? })`              |
| `UnbanUserDialog`         | "Unban User" (if banned)   | Confirmation only — "Are you sure you want to unban {name}?"                                           | `unbanUser()`                                         |
| `DeleteUserDialog`        | "Delete User"              | Destructive confirmation — "This action cannot be undone."                                             | `removeUser()`, then navigates to `/users`            |
| `ImpersonateUserDialog`   | "Impersonate"              | Confirmation dialog.                                                                                   | `impersonateUser()`, invalidates all queries + router |
| `RevokeAllSessionsDialog` | "Revoke All" button        | Confirmation — "They will be signed out from all devices."                                             | `revokeUserSessions()`                                |

All mutations invalidate relevant query keys on success and show Sonner toasts for feedback.

#### Sessions Section

A table within the user detail page listing all active sessions for the user.

**Table columns:**

| Column          | Source                   | Notes                                 |
| --------------- | ------------------------ | ------------------------------------- |
| Token           | `session.token`          | First 12 chars in `<code>` + "..."    |
| IP Address      | `session.ipAddress`      | Em-dash if null                       |
| User Agent      | `session.userAgent`      | Truncated with tooltip for full value |
| Created At      | `session.createdAt`      | `ja-JP` date format                   |
| Expires At      | `session.expiresAt`      | `ja-JP` date format                   |
| Impersonated By | `session.impersonatedBy` | Em-dash if null                       |
| Actions         | —                        | "Revoke" destructive button per row   |

**Actions:**

- **Revoke session** — Button per row. Calls `authClient.admin.revokeUserSession()`.
- **Revoke all sessions** — Button above the table. Opens `RevokeAllSessionsDialog`.

**Data fetching:** TanStack Query wrapping `authClient.admin.listUserSessions()`.

## Impersonation

When an admin impersonates a user:

1. Clicking "Impersonate" on the user detail page opens a confirmation dialog, then calls `authClient.admin.impersonateUser({ userId })`.
2. All queries and the router are invalidated to reflect the new session state.
3. A persistent **impersonation banner** appears at the top of the viewport (above the main content area) with:
   - Text: "You are impersonating **{user name}**"
   - A "Stop Impersonating" button
4. The banner is rendered in `_authenticated.tsx` layout, conditionally shown when the route context's `isImpersonating` flag is `true`.
5. The "Impersonate" action is hidden from the dropdown menu while already impersonating (prevents nested impersonation).
6. Clicking "Stop Impersonating" calls `authClient.admin.stopImpersonating()`, invalidates all queries and the router, and shows a success toast.

## Dashboard Layout

The `_authenticated.tsx` layout renders:

### Sidebar

Uses the `Sidebar` component from `@dashmin/ui` with `collapsible="icon"` mode. Can be toggled via a trigger button or the `b` keyboard shortcut. On mobile, renders as a sheet drawer.

- **Header** — "Dashmin" logo (`CommandIcon` + text), links to `/`.
- **Navigation links** (`NavMain` component):
  - Dashboard (`/`) — `DashboardSquare01Icon`
  - Users (`/users`) — `UserGroupIcon`
  - Active link highlighted via `useMatchRoute({ fuzzy: true })`.
- **Footer** (`NavUser` component) — Current user's avatar, name, and email. Dropdown menu with:
  - User info header
  - "Log out" — calls `authClient.signOut()`, navigates to `/login`

### Header Bar

Sticky top bar with:

- `SidebarTrigger` (hamburger button)
- Vertical `Separator`
- Page title (read from `route.staticData.title`, defaults to "Dashboard")

### Impersonation Banner

- Rendered conditionally above the main content area when `isImpersonating` is `true`.
- Full-width amber-colored bar with user name and "Stop Impersonating" button.

## UI Components (`packages/ui`)

All components are shadcn-style, built on `@base-ui/react` primitives (not Radix).

### Available Components

| Component      | Description                                                                                                                                                                                                        | Used In                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `Avatar`       | Image with initials fallback, badge support. Sizes: `default`, `sm`, `lg`.                                                                                                                                         | User detail, nav                                       |
| `Badge`        | Variants: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`.                                                                                                                                       | Roles, statuses                                        |
| `Breadcrumb`   | Breadcrumb navigation.                                                                                                                                                                                             | Not yet used                                           |
| `Button`       | Variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`.                                                          | Throughout                                             |
| `Card`         | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`. Size prop: `default`/`sm`.                                                                                        | Dashboard, user detail                                 |
| `Chart`        | Recharts wrapper.                                                                                                                                                                                                  | Not yet used                                           |
| `Checkbox`     | Base-UI Checkbox.                                                                                                                                                                                                  | Not yet used                                           |
| `Dialog`       | `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent` (auto close button), `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`.                                | All action dialogs                                     |
| `Drawer`       | Vaul-based drawer.                                                                                                                                                                                                 | Not yet used                                           |
| `DropdownMenu` | Full menu system with items, separators, groups, checkbox/radio items, sub-menus. Item variant: `default`/`destructive`.                                                                                           | User actions dropdown                                  |
| `Input`        | Styled `<input>`.                                                                                                                                                                                                  | Forms, search                                          |
| `Label`        | Styled `<label>`.                                                                                                                                                                                                  | Forms                                                  |
| `Pagination`   | Pagination links with previous/next/ellipsis.                                                                                                                                                                      | Not yet used (custom pagination controls used instead) |
| `Select`       | Base-UI Select with trigger sizes `sm`/`default`, items, groups, separators.                                                                                                                                       | Filters, role select                                   |
| `Separator`    | Horizontal/vertical separator.                                                                                                                                                                                     | Layout                                                 |
| `Sheet`        | (present)                                                                                                                                                                                                          | Not yet used                                           |
| `Sidebar`      | Full featured: `SidebarProvider`, `Sidebar` (collapsible modes), `SidebarHeader/Content/Footer`, `SidebarMenu/MenuItem/MenuButton`, `SidebarTrigger`, `SidebarInset`. Mobile sheet support, `b` keyboard shortcut. | Dashboard layout                                       |
| `Skeleton`     | `bg-muted animate-pulse` div.                                                                                                                                                                                      | Loading states                                         |
| `Table`        | `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`.                                                                                                          | Users list, sessions                                   |
| `Tabs`         | Base-UI Tabs with `default`/`line` variants.                                                                                                                                                                       | Not yet used                                           |
| `Toggle`       | (present)                                                                                                                                                                                                          | Not yet used                                           |
| `ToggleGroup`  | (present)                                                                                                                                                                                                          | Not yet used                                           |
| `Tooltip`      | Base-UI Tooltip with arrow, provider.                                                                                                                                                                              | User agent display                                     |

### Form Components (`Field`)

Custom form field primitives for consistent form styling:

- `Field` (orientations: `vertical`/`horizontal`/`responsive`)
- `FieldLabel`
- `FieldDescription`
- `FieldError` (accepts `errors` array)
- `FieldGroup`
- `FieldSet`
- `FieldLegend`
- `FieldContent`
- `FieldTitle`
- `FieldSeparator`

### Utilities

| Export          | Path                      | Description                        |
| --------------- | ------------------------- | ---------------------------------- |
| `cn()`          | `src/lib/utils.ts`        | `clsx` + `tailwind-merge`          |
| `useIsMobile()` | `src/hooks/use-mobile.ts` | Returns `true` if viewport < 768px |

### CSS

- `src/style.css` — raw source (imports `tw-animate-css` and shadcn tokens)
- `dist/style.css` — pre-compiled output (what apps import)
- Apps import via `@import "@dashmin/ui/style.css"` in their CSS entry point.

## Shared Components (`apps/admin`)

### `DataTable`

Reusable table component used by both the users list and sessions table.

**Props:**

```ts
interface DataTableProps<TData> {
  table: TableInstance<TData>;
  columnCount: number;
  isLoading?: boolean;
  onRowClick?: (row: TData) => void;
}
```

Renders: header row with sort indicators, skeleton rows when loading, "No results found." empty state, clickable data rows.

## Query Keys (`src/lib/query-keys.ts`)

Centralized query key factory:

```ts
queryKeys.users.all; // ["admin", "users"]
queryKeys.users.list(params); // ["admin", "users", "list", params]
queryKeys.users.detail(userId); // ["admin", "users", "detail", userId]
queryKeys.users.sessions(userId); // ["admin", "users", "sessions", userId]
queryKeys.users.stats.total; // ["admin", "users", "total"]
queryKeys.users.stats.banned; // ["admin", "users", "banned"]
```

## API Integration Pattern

All admin operations use the better-auth client methods under `authClient.admin.*`. No custom API endpoints are needed.

### TanStack Query Integration

**Queries** (wrapped in `useQuery`):

- `authClient.admin.listUsers({ ...params })` — users list with pagination/filter/sort
- `authClient.admin.listUsers({ filterField: "id", filterValue: userId })` — single user detail (used instead of `getUser()`)
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

## Seeding

A seed script exists at `packages/db/src/seed.ts`.

- Default credentials: `admin@dashmin.com` / `admin123_`
- Signs up via HTTP POST to `${BETTER_AUTH_URL}/api/v1/auth/sign-up/email`.
- Then updates the user's role to `"admin"` directly in the database via Drizzle.

## Infrastructure

- **Database:** PostgreSQL 17 via Docker Compose (`compose.yaml`), exposed on port 5435.
- **ORM:** Drizzle with `drizzle-kit` for migrations. Schema in `packages/db/src/schema/`, migrations output to `packages/db/drizzle/`.
- **DB connection:** `drizzle("node-postgres")` using `DATABASE_URL` env var.

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
- Mobile responsive layout
