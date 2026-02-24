# Dashmin Admin Dashboard v1 Plan

## Summary

Build an admin dashboard on top of existing Better Auth + Drizzle models, using a session-first architecture with role-based access (`admin`, `user`), no JWT in v1, and direct Better Auth admin APIs. Frontend stack is TanStack Router, TanStack Query, and TanStack Form. No `ky`, no `jotai`.

## Current Baseline (Repo Truth)

- Monorepo layout:
  - `apps/api` = Hono + Better Auth + Drizzle
  - `apps/admin` = React + Vite
  - `packages/ui` = shared UI primitives
- Current auth DB tables exist: `user`, `session`, `account`, `verification`.
- Admin plugin fields are not in DB yet.
- API mounts Better Auth at `/api/auth/*`.
- Tooling conventions: Moon tasks, pnpm workspace, oxlint/oxfmt, strict TS.

## Architecture Decisions

- Auth mode: session-first with Better Auth.
- Bearer support: enabled via Better Auth bearer plugin for token-style clients.
- JWT plugin: not used in v1.
- RBAC model: role-first (`admin`, `user`), server-enforced.
- Tenancy: single-tenant.
- Signup policy: public signup disabled.
- Bootstrap: seed first admin by email/password.
- Frontend libraries:
  - TanStack Router
  - TanStack Query
  - TanStack Form
  - Better Auth client plugins for auth/admin
  - No `ky`
  - No `jotai`

## High-Level Data Flow

1. Admin UI signs in via Better Auth endpoint (`/api/auth/sign-in/email`), receives session cookie.
2. Browser sends cookie with `credentials: include` on subsequent calls.
3. Better Auth resolves session from signed cookie and enforces auth on admin endpoints.
4. Admin plugin checks role/permissions for `/admin/*` actions.
5. UI uses TanStack Query for fetch/caching and invalidation after mutations.
6. TanStack Form handles auth/user-management forms with schema validation.

## Implementation Workstreams

### 1) Env and Runtime Contract

- Align `.env.example` with actual local DB/API ports.
- Ensure `BETTER_AUTH_URL` targets API host (`http://localhost:8000` in dev).
- Add `ADMIN_APP_ORIGIN` and admin seed env keys.
- Define trusted origins for admin frontend.

### 2) Better Auth Server Configuration

- Update auth config to include:
  - `emailAndPassword.enabled = true`
  - `emailAndPassword.disableSignUp = true`
  - `plugins: [admin(...), bearer(...)]`
  - `defaultRole = "user"`
  - `adminRoles = ["admin"]`
  - trusted origins
- Keep auth endpoints under `/api/auth/*`.

### 3) DB Schema and Migrations

- Extend user table with admin plugin fields:
  - `role`, `banned`, `banReason`, `banExpires`
- Extend session table with:
  - `impersonatedBy`
- Generate migration with Drizzle and commit.
- Validate migrate + rollback path locally.

### 4) Admin Bootstrap

- Add idempotent seed script:
  - Create seeded admin user if absent.
  - If present, enforce `admin` role.
- Add Moon task for seed command.

### 5) Frontend Foundation (TanStack Stack)

- Add TanStack Router route tree:
  - public routes: login
  - protected routes: app shell + admin pages
- Add TanStack Query provider and query client config.
- Add TanStack Form for login and admin action forms.
- Integrate Better Auth client (`adminClient`) as API layer.

### 6) v1 Auth Ops Core Screens

- Login.
- Users list with search/pagination.
- User detail/actions:
  - set role
  - ban/unban
  - list sessions
  - revoke session(s)
  - impersonate / stop impersonating
- Add unauthorized and session-expired UX states.

### 7) Guardrails and Error Handling

- Route-level and data-level guards for admin-only access.
- Standardized API error mapping in UI.
- Safe mutation patterns with optimistic updates only where low risk.

### 8) QA and Acceptance

- Add smoke/e2e scenarios for full auth/admin flows.
- Verify migration integrity and seed idempotency.
- Verify bearer mode works for non-browser client flow.

## Public API / Interface / Type Changes

- Database:
  - `user.role: string | null`
  - `user.banned: boolean`
  - `user.ban_reason: string | null`
  - `user.ban_expires: timestamp | null`
  - `session.impersonated_by: string | null`
- Auth server config:
  - admin + bearer plugins enabled
  - signup disabled
- Env surface:
  - `ADMIN_APP_ORIGIN`
  - `ADMIN_SEED_EMAIL`
  - `ADMIN_SEED_PASSWORD`
  - `ADMIN_SEED_NAME`
- Frontend role types:
  - `"admin" | "user"`

## Test Cases and Scenarios

1. Admin sign-in succeeds and protected routes load.
2. Public signup attempt fails.
3. Non-admin cannot access admin endpoints/pages.
4. Admin can list users and mutate role.
5. Ban revokes active sessions.
6. Unban restores login ability.
7. Impersonation swaps session and returns correctly.
8. Bearer token flow works for supported clients.
9. Seed command is idempotent across repeated runs.
10. Query cache invalidates correctly after mutations.

## Assumptions and Defaults

- v1 scope is auth/user operations only; no business domain modules yet.
- Single tenant only.
- No JWT/JWKS in v1.
- No custom wrapper API for Better Auth admin endpoints in v1.
- No `ky` and no `jotai` in v1.
