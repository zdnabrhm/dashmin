# Task Feature Spec

## Overview

Add a **Tasks** entity to Dashmin — the first custom (non-better-auth) domain feature. Tasks represent internal admin work items (e.g. "Review flagged account", "Onboard new partner"). Admins can create, assign, prioritize, and track tasks from the dashboard.

This feature establishes the pattern for all future custom entities: Drizzle schema, Hono REST API, and React frontend wired through TanStack Query.

---

## Database

### `task` table (`packages/db/src/schema/task.ts`)

| Column        | Type        | Default    | Nullable | Description                                     |
| ------------- | ----------- | ---------- | -------- | ----------------------------------------------- |
| `id`          | `text`      | `uuidv7()` | no       | Primary key (generated via `uuidv7` — RFC 9562) |
| `title`       | `text`      | —          | no       | Short summary                                   |
| `description` | `text`      | —          | yes      | Longer details (plain text)                     |
| `status`      | `text`      | `"todo"`   | no       | `"todo"` \| `"in_progress"` \| `"done"`         |
| `priority`    | `text`      | `"medium"` | no       | `"low"` \| `"medium"` \| `"high"` \| `"urgent"` |
| `dueDate`     | `timestamp` | —          | yes      | Optional deadline                               |
| `assigneeId`  | `text`      | —          | yes      | FK → `user.id` (SET NULL on delete)             |
| `creatorId`   | `text`      | —          | no       | FK → `user.id` (SET NULL on delete)             |
| `createdAt`   | `timestamp` | `now()`    | no       |                                                 |
| `updatedAt`   | `timestamp` | `now()`    | no       | Auto-updated via `$onUpdate`                    |

**Indexes:**

- `task_assignee_id_idx` on `assigneeId`
- `task_creator_id_idx` on `creatorId`
- `task_status_idx` on `status`

**Relations:**

- `assignee` → `one(user)` (via `assigneeId`)
- `creator` → `one(user)` (via `creatorId`)
- Add `many(task)` relations on the `user` table (as `assignedTasks` and `createdTasks`)

**Exported types** (`packages/db/src/types.ts`):

- `Task = InferSelectModel<typeof task>`
- `CreateTask = InferInsertModel<typeof task>`

**Migration:** `0002_add_task_table.sql`

---

## API

This is the first custom Hono route group. All task endpoints live under `/api/v1/tasks` and require an authenticated admin session.

### Auth middleware

Create a reusable `requireAdmin` middleware in `apps/api/src/middleware/require-admin.ts`.

Uses better-auth's server-side session API (per the [Hono integration guide](https://www.better-auth.com/docs/integrations/hono)):

```ts
const session = await auth.api.getSession({ headers: c.req.raw.headers });
```

The Hono app must declare context variables for type safety:

```ts
type Env = {
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
  };
};
```

**Logic:**

1. Call `auth.api.getSession({ headers: c.req.raw.headers })`
2. No session → 401 `{ error: "Unauthorized" }`
3. `session.user.role !== "admin"` → 403 `{ error: "Forbidden" }`
4. `c.set("user", session.user)` + `c.set("session", session.session)`
5. `await next()`

Downstream handlers access the user via `c.get("user")`. This middleware will be reused by all future custom route groups.

### Route group

Create `apps/api/src/routes/tasks.ts` as a Hono sub-app, mounted in `app.ts`:

```
app.route("/tasks", tasksRoute);
```

### Endpoints

| Method   | Path         | Description     | Request Body / Query                                                                              | Response                                 |
| -------- | ------------ | --------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `GET`    | `/tasks`     | List tasks      | Query: `limit`, `offset`, `sortBy`, `sortDirection`, `search`, `status`, `priority`, `assigneeId` | `{ tasks: Task[], total: number }`       |
| `GET`    | `/tasks/:id` | Get single task | —                                                                                                 | `{ task: Task & { assignee, creator } }` |
| `POST`   | `/tasks`     | Create task     | `{ title, description?, status?, priority?, dueDate?, assigneeId? }`                              | `{ task: Task }` (201)                   |
| `PATCH`  | `/tasks/:id` | Update task     | Partial: `{ title?, description?, status?, priority?, dueDate?, assigneeId? }`                    | `{ task: Task }`                         |
| `DELETE` | `/tasks/:id` | Delete task     | —                                                                                                 | 204 No Content                           |

### Validation

Use Zod schemas in `apps/api/src/routes/tasks.ts` for request validation:

- `createTaskSchema` — title required (min 1, max 255), description optional (max 2000), status enum, priority enum, dueDate optional ISO string, assigneeId optional string
- `updateTaskSchema` — all fields optional, same constraints
- `listTasksSchema` — query param validation: limit (1-100, default 10), offset (>= 0, default 0), sortBy enum, sortDirection enum, etc.

### Error responses

Follow a consistent shape for all custom endpoints:

```json
{ "error": "Human-readable message" }
```

Status codes: 400 (validation), 401 (no session), 403 (not admin), 404 (not found), 500 (unexpected).

### Hono RPC (type-safe client)

Export the task route types so the frontend can use `hc<AppType>` from `hono/client` for type-safe API calls. This replaces the pattern of calling `authClient.admin.*` (which is specific to better-auth) with direct typed HTTP calls for custom entities.

The `AppType` is already exported from `apps/api/src/app.ts`. Adding the tasks route group to `app` automatically includes it in the type.

---

## Frontend

### API Client

Create `apps/admin/src/lib/api.ts`:

```ts
import { hc } from "hono/client";
import type { AppType } from "@dashmin/api";

export const api = hc<AppType>(import.meta.env.VITE_API_URL, {
  init: { credentials: "include" }, // send session cookie
});
```

All custom entity queries use `api.api.v1.tasks.$get(...)` etc. — fully typed, no manual fetch calls. Auth endpoints continue to use `authClient`.

### Query Keys (`apps/admin/src/lib/query-keys.ts`)

Add to existing `queryKeys`:

```ts
tasks: {
  all: ["tasks"] as const,
  list: (params: Record<string, unknown>) => ["tasks", "list", params] as const,
  detail: (taskId: string) => ["tasks", "detail", taskId] as const,
  stats: {
    total: ["tasks", "total"] as const,
    byStatus: ["tasks", "by-status"] as const,
  },
},
```

### Routes

```
apps/admin/src/routes/_authenticated/
└── tasks/
    ├── index.tsx        # /tasks (task list)
    └── $taskId.tsx      # /tasks/:taskId (task detail)
```

### Sidebar Nav

Add "Tasks" entry to `NavMain` menu items between "Dashboard" and "Users":

```ts
{ title: "Tasks", url: "/tasks", icon: <HugeiconsIcon icon={TaskEdit01Icon} strokeWidth={2} /> }
```

### Dashboard Home Updates

Add to the dashboard home page (`_authenticated/index.tsx`):

**Stat card:**

- **Open Tasks** — count of tasks with status `todo` or `in_progress`

**"My Tasks" widget:**

A card below the stats grid showing the current admin's assigned tasks that aren't done (status `todo` or `in_progress`), sorted by priority (urgent first) then due date (soonest first). Maximum 5 items.

Each row shows: title, priority badge, due date (or "No due date"), and a status badge. Clicking a row navigates to `/tasks/:taskId`. A "View All" link at the bottom navigates to `/tasks` pre-filtered by the current user as assignee.

**Data fetching:** `useQuery` wrapping `api.api.v1.tasks.$get({ query: { assigneeId: currentUser.id, status: ["todo", "in_progress"], sortBy: "priority", limit: 5 } })`.

---

## Pages

### Tasks List Page (`/tasks`)

**`staticData: { title: "Tasks" }`**

Follows the exact same structure as the Users list page.

**Table columns:**

| Column   | Source           | Sortable | Rendering                                                                                     |
| -------- | ---------------- | -------- | --------------------------------------------------------------------------------------------- |
| Title    | `task.title`     | yes      | Plain text, truncated if long                                                                 |
| Status   | `task.status`    | yes      | `Badge` — `outline` for todo, `default` for in_progress, `secondary` for done                 |
| Priority | `task.priority`  | yes      | `Badge` — `ghost` for low, `outline` for medium, `default` for high, `destructive` for urgent |
| Assignee | `task.assignee`  | no       | Assignee name or "Unassigned" in muted text                                                   |
| Due Date | `task.dueDate`   | yes      | `ja-JP` date format, muted "No due date" if null, red text if overdue                         |
| Created  | `task.createdAt` | yes      | `ja-JP` date format                                                                           |

**Features:**

- **Search** — Text input searching by `title`, debounced at 300ms
- **Filter by status** — Select: All Statuses / Todo / In Progress / Done
- **Filter by priority** — Select: All Priorities / Low / Medium / High / Urgent
- **Sort** — Default: `createdAt` descending. Clickable column headers.
- **Pagination** — Server-side, same pattern as users (limit/offset, page size selector 10/25/50)
- **Row click** — Navigates to `/tasks/:taskId`
- **Create task button** — Opens `CreateTaskDialog`

**Data fetching:** `useQuery` wrapping `api.api.v1.tasks.$get({ query: ... })`.

### Task Detail Page (`/tasks/:taskId`)

**`staticData: { title: "Task Detail" }`**

Follows the same structure as the User detail page.

**Layout:**

1. **Back link** — "Back to Tasks" with `ArrowLeft01Icon`
2. **Task card:**
   - **Header:** Title + status badge + priority badge + actions dropdown
   - **Description:** Full description text (or "No description" in muted)
   - **Metadata grid:**
     - Assignee (name or "Unassigned")
     - Creator (name)
     - Due date (or "No due date")
     - Created / Updated dates
3. **Actions dropdown** (three-dot menu):
   - "Edit Task" → `EditTaskDialog`
   - "Change Status" → `ChangeStatusDialog`
   - Separator
   - "Delete Task" (destructive) → `DeleteTaskDialog`

**Data fetching:** `useQuery` wrapping `api.api.v1.tasks[":id"].$get({ param: { id: taskId } })`.

---

## Dialogs

All dialogs follow the existing pattern: `{ open, onOpenChange }` props, `useMutation` + `queryClient.invalidateQueries` + `toast`.

### CreateTaskDialog

**Trigger:** "Create Task" button on the list page.

**Form fields:**

| Field       | Type       | Validation                                     |
| ----------- | ---------- | ---------------------------------------------- |
| Title       | `text`     | Required, min 1, max 255                       |
| Description | `textarea` | Optional, max 2000                             |
| Status      | `select`   | Required, default "todo"                       |
| Priority    | `select`   | Required, default "medium"                     |
| Due Date    | `date`     | Optional                                       |
| Assignee    | `select`   | Optional, populated from admin-role users only |

**Mutation:** `POST /tasks`. On success: close dialog, invalidate `queryKeys.tasks.all`, toast success.

**Form:** TanStack Form + Zod, using the `Field/FieldLabel/FieldError/FieldGroup` component system.

### EditTaskDialog

**Trigger:** "Edit Task" in the detail page actions dropdown.

**Form fields:** Same as create, pre-filled with current values.

**Mutation:** `PATCH /tasks/:id`. On success: invalidate `queryKeys.tasks.all`, toast success, close dialog.

### ChangeStatusDialog

**Trigger:** "Change Status" in the detail page actions dropdown.

A simple dialog with a status select and confirm button. Lighter than the edit dialog — avoids opening the full form just to change status.

**Form fields:**

| Field  | Type     | Validation |
| ------ | -------- | ---------- |
| Status | `select` | Required   |

**Mutation:** `PATCH /tasks/:id` with `{ status }`. On success: invalidate `queryKeys.tasks.all`, toast success, close dialog.

### DeleteTaskDialog

**Trigger:** "Delete Task" (destructive) in the detail page actions dropdown.

Confirmation-only dialog: "This action cannot be undone. This will permanently delete the task **{title}**."

**Mutation:** `DELETE /tasks/:id`. On success: invalidate `queryKeys.tasks.all`, toast success, navigate to `/tasks`.

---

## File Structure (new files only)

```
packages/db/
├── src/schema/task.ts              # task table + relations
├── src/schema/index.ts             # + export task
├── src/types.ts                    # + Task, CreateTask types
└── drizzle/
    └── 0002_add_task_table.sql     # migration

apps/api/src/
├── middleware/require-admin.ts     # reusable auth guard
├── routes/tasks.ts                 # task CRUD route group
└── app.ts                          # + mount tasks route

apps/admin/src/
├── lib/api.ts                      # Hono RPC client
├── lib/query-keys.ts               # + tasks keys
├── features/tasks/
│   └── components/
│       ├── task-columns.tsx         # column definitions
│       ├── create-task-dialog.tsx
│       ├── edit-task-dialog.tsx
│       ├── change-status-dialog.tsx
│       └── delete-task-dialog.tsx
├── routes/_authenticated/tasks/
│   ├── index.tsx                    # list page
│   └── $taskId.tsx                  # detail page
└── components/nav-main.tsx          # + Tasks nav link
```

---

## Architectural Notes

### Why custom API routes (not a better-auth plugin)?

Tasks are a domain entity, not an auth concern. better-auth plugins are designed for auth-adjacent features (2FA, organizations, etc.). Custom Hono routes are the correct approach for domain data. This establishes a clean separation: **auth traffic → `authClient`**, **domain traffic → `api` (Hono RPC)**.

### Why Hono RPC?

The `hc` client from `hono/client` gives us end-to-end type safety from route handler to frontend call site — no code generation, no manual type definitions. The types flow from the route definitions via the already-exported `AppType`. This is the idiomatic Hono approach.

### ID generation

Use `uuidv7` for task IDs (RFC 9562 — time-sorted, collision-resistant). Add `uuidv7` to `packages/db` dependencies. Generate IDs at the DB schema level via `.$defaultFn(() => uuidv7())` so they're set automatically on insert.

Also configure better-auth to use UUIDv7 via `advanced.generateId` so all tables (user, session, account, verification) use the same ID format. See [better-auth custom ID generation docs](https://better-auth.com/docs/concepts/database#option-2-custom-id-generation-function).

### Assignee resolution

The `GET /tasks` list endpoint returns tasks with the assignee's `name` joined from the `user` table (via Drizzle `leftJoin` or `with` relation). This avoids N+1 queries on the frontend.

### Creator auto-set

The `POST /tasks` endpoint reads `creatorId` from the authenticated session (`c.get("user").id`), not from the request body. Clients cannot spoof the creator.

---

## Migration Plan (implementation order)

1. **DB schema + migration** — `task` table, types, relations
2. **API middleware** — `requireAdmin` auth guard
3. **API routes** — task CRUD endpoints with Zod validation
4. **Frontend API client** — Hono RPC setup (`lib/api.ts`)
5. **Query keys** — add `tasks` key factory
6. **Column definitions** — `task-columns.tsx`
7. **List page + route** — `/tasks` with search, filters, sort, pagination
8. **Detail page + route** — `/tasks/:taskId`
9. **Dialogs** — create, edit, change status, delete
10. **Nav + dashboard** — sidebar link, stat card, "My Tasks" widget

---

## Resolved Decisions

1. **Assignee scope** — Admins only. The assignee `select` fetches users with `role: "admin"`.
2. **Description format** — Plain text. No markdown rendering.
3. **Activity log** — Deferred. No audit trail for status changes in this version.
4. **Bulk actions** — Deferred. No multi-select on the list page in this version.
5. **Dashboard widget** — "My Tasks" widget showing the current admin's open tasks (see Dashboard Home Updates above).
