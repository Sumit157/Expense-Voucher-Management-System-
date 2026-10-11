# Expense Voucher Management System

A full-stack, role-based web application for creating, submitting, reviewing, and approving employee expense vouchers. It provides separate workspaces for Employees, Directors, and Accounts, with session-based authentication, signature uploads, workflow history, dashboards, and server-side search and filtering.

## Contents

- [Overview](#overview)
- [Features](#features)
- [Roles and permissions](#roles-and-permissions)
- [Voucher workflow](#voucher-workflow)
- [Technology stack](#technology-stack)
- [Container architecture](#container-architecture)
- [Quick start with Docker](#quick-start-with-docker)
- [Demo accounts](#demo-accounts)
- [Persistence and useful commands](#persistence-and-useful-commands)
- [Configuration](#configuration)
- [Local development](#local-development)
- [API overview](#api-overview)
- [Security](#security)
- [Testing and CI](#testing-and-ci)
- [Project structure](#project-structure)
- [Known limitations and production checklist](#known-limitations-and-production-checklist)
- [Contributing](#contributing)
- [License](#license)

## Overview

The system digitises an organisation's expense-voucher process. Employees prepare vouchers and submit them with a signature. A Director reviews submissions and records an approval or rejection decision. Accounts can review organisation-wide voucher records and approved amounts for reimbursement processing.

Role and ownership rules are enforced by the API, while workflow transitions and audit events are persisted in MySQL.

## Features

### Authentication and account access

- Email-and-password sign-in and logout.
- HTTP-only, server-managed session cookies.
- Employee self-registration. The server assigns the Employee role; clients cannot register as Director or Accounts.
- Forgot-password and reset-password endpoints using single-use, expiring tokens stored as hashes.
- Optional “Remember me” session duration.
- Protected routes and role-aware navigation.

### Employee workspace

- Create vouchers as drafts; edit or delete owned drafts.
- Upload an employee signature and submit a completed voucher.
- View personal voucher details, status, workflow history, and rejection reasons.
- Search, filter, sort and paginate personal vouchers.
- Review employee-scoped dashboard totals.

### Director workspace

- View pending approvals and activity metrics.
- Review voucher details and employee signatures.
- Approve pending vouchers with a Director signature.
- Reject pending vouchers with a required reason.
- Search, filter, sort and paginate organisation-wide voucher records.
- View workflow history. Submitted expense details remain read-only.

### Accounts workspace

- View organisation-wide vouchers and dashboard totals.
- Review approved vouchers and amounts.
- Search, filter, sort and paginate records.
- View authorised signatures and workflow history with read-only voucher access.

### Shared functionality

- Server-side search, filtering, sorting and pagination.
- Validation on frontend and API.
- Role-specific dashboards with database-computed aggregates.
- Transactional workflow changes and audit events.
- Private signature storage with authorised retrieval.
- Responsive UI with Light, Dark and System theme preferences.
- Liveness and database-readiness endpoints.

## Roles and permissions

| Capability | Employee | Director | Accounts |
|---|---:|---:|---:|
| View own vouchers | Yes | Yes | Yes |
| View other employees' vouchers | No | Yes | Yes |
| Create vouchers | Yes | No | No |
| Edit or delete an owned draft | Yes | No | No |
| Submit an owned draft | Yes | No | No |
| Approve pending vouchers | No | Yes | No |
| Reject pending vouchers | No | Yes | No |
| View organisation-wide voucher records | No | Yes | Yes |
| Mutate voucher records | Own drafts only | Approval decisions only | No |

The API is the security boundary. Frontend navigation and hidden buttons do not replace server-side authorisation.

## Voucher workflow

```text
Draft
  |
  | Employee completes required details and adds signature
  v
Pending Approval
  |                         \\
  | Director approves        \\ Director rejects with a reason
  | and signs                  \\
  v                             v
Approved                    Rejected
  |
  v
Available for Accounts review
```

Core rules:

- The server generates unique voucher numbers.
- Voucher amounts must be greater than zero.
- An employee signature is required before submission.
- Only a Director can approve or reject a pending voucher.
- Approval requires a Director signature; rejection requires a non-empty reason.
- Draft-only edit and delete operations are rejected for non-draft vouchers.
- Workflow transitions and audit events are persisted transactionally.
- Concurrent decisions are guarded so the same pending voucher cannot be approved and rejected successfully at the same time.

## Technology stack

| Area | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| UI and styling | Tailwind CSS v4, shadcn/ui, Radix UI |
| Routing and server state | React Router, TanStack Query |
| Forms and validation | React Hook Form, Zod |
| Theme | next-themes |
| Backend | Node.js, Express, TypeScript |
| Database | MySQL 8.4 in Docker; MySQL 8+ schema |
| ORM and migrations | Prisma |
| Authentication | bcrypt password hashing, opaque server-side sessions, HTTP-only cookies |
| Tests | Vitest, React Testing Library, Supertest, Playwright |
| Containerisation | Docker, Docker Compose |
| CI | GitHub Actions |

## Container architecture

The default Compose configuration runs two services: MySQL and one application container. The application container serves both the Express API and the built React frontend.

```text
Browser
  |
  | http://localhost:3000
  v
Application container
  |-- Express REST API (/api/v1)
  |-- Built React frontend (apps/web/dist)
  |-- Prisma migrations and development seed
  |-- Private signature files (/data/uploads)
  |
  | Docker internal network
  v
MySQL 8.4 container
  |
  +-- Named volume: evm-mysql-data

Signature volume: evm-uploads
```

At startup, Compose waits for MySQL's health check. The app command applies committed Prisma migrations, runs the development seed, and starts the API. Express serves the frontend build from `apps/web/dist`, so the browser uses one origin.

## Quick start with Docker

### Prerequisite

Install Docker Desktop (Windows/macOS) or Docker Engine plus the Docker Compose plugin (Linux). Node.js, npm, MySQL, and Prisma do not need to be installed on the host for the containerised setup.

Run this from the project root:

```bash
docker compose up --build
```

Then open **http://localhost:3000**. The initial build may take a few minutes. Keep the terminal open to follow startup output.

To run in the background:

```bash
docker compose up --build -d
```

Check status and logs:

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f mysql
```

### Important audit note: Prisma environment variable

The published Prisma schema references both `DATABASE_URL` and `SHADOW_DATABASE_URL`. The current `docker-compose.yml` passes `DATABASE_URL` into the `app` container but does not pass `SHADOW_DATABASE_URL`. The CI workflow explicitly notes that `SHADOW_DATABASE_URL` must exist for schema resolution, even when running `prisma migrate deploy`.

Before relying on a fresh Compose startup, add this entry under `services.app.environment` in `docker-compose.yml`:

```yaml
SHADOW_DATABASE_URL: mysql://${MYSQL_USER:-evoucher}:${MYSQL_PASSWORD:-change-me}@mysql:3306/expense_voucher_shadow
```

For `prisma migrate deploy`, this variable resolves the schema configuration; the deploy command does not create a shadow database. After this change, verify a clean startup using `docker compose up --build` and inspect `docker compose logs -f app`. The Docker-specific path is not currently exercised by the checked-in CI workflow. This is a static configuration finding; it is not a claim that a Docker run was executed as part of this audit.

## Demo accounts

The Compose command runs the development seed script. The seed defines these accounts:

| Email | Role |
|---|---|
| `director@abc.test` | Director |
| `accounts@abc.test` | Accounts |
| `employee1@abc.test` | Employee |
| `employee2@abc.test` | Employee |

Default local seed password: **`SeedDevPassword123!`**. It can be overridden with `SEED_DEFAULT_PASSWORD`.

**Development only:** the seed script uses upserts that update seeded users' profile fields and password each time it runs. Since Compose invokes the seed at each application container start, changes to those demo accounts may be overwritten on restart. Never use these demo credentials or this seed behaviour in production.

Public registration creates Employee accounts only. Director and Accounts users must be provisioned through a controlled process.

## Persistence and useful commands

Compose creates two named volumes:

- `evm-mysql-data` stores MySQL data.
- `evm-uploads` stores signature uploads.

Stop the stack without removing stored data:

```bash
docker compose down
```

Start it again:

```bash
docker compose up -d
```

**Destructive reset:** the following removes the named volumes, including vouchers and uploaded signatures:

```bash
docker compose down -v
```

Use the destructive reset only when you deliberately want to discard all local application data.

The default host port is `3000`. To change it:

```bash
APP_PORT=3100 docker compose up --build
```

PowerShell:

```powershell
$env:APP_PORT = "3100"
docker compose up --build
```

The MySQL service is not published to a host port by default in the full stack. For standalone local database use, it can be started on host port `3307`:

```bash
docker compose up mysql
```

## Configuration

For the standard local Compose flow, `docker-compose.yml` supplies development defaults, so an `.env` file is not normally required. The main variables are:

| Variable | Purpose |
|---|---|
| `APP_PORT` | Published host port; default `3000` |
| `MYSQL_DATABASE` | Application database name |
| `MYSQL_USER` | Local application database user |
| `MYSQL_PASSWORD` | Local application database password |
| `MYSQL_ROOT_PASSWORD` | Local MySQL root password |
| `SESSION_SECRET` | Session-related application secret |
| `SEED_DEFAULT_PASSWORD` | Password for seeded demo accounts |

These defaults are for local development/demo use only. Do not expose them on a public host.

The `.env.example` file documents additional variables for running the API and frontend directly during development, including database URLs, trusted origins, rate limits, upload limits and the seed password. A host `.env` file is not automatically copied into the image; Compose passes only the environment variables defined in its service configuration.

## Local development

To run the API and frontend as separate processes with hot reload, install Node.js compatible with the root package engine (`>=20`), npm, and MySQL 8+.

Install dependencies:

```bash
npm ci
```

Copy `.env.example` to `.env`.

Windows Command Prompt:

```bat
copy .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Configure `DATABASE_URL`, `SHADOW_DATABASE_URL`, `APP_ORIGIN`, `API_ORIGIN` and `SESSION_SECRET`. Create the application and Prisma shadow databases in MySQL and grant the local database user the required privileges. Then run:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

In this mode, Vite runs at `http://localhost:5173` and proxies `/api` requests to the API at `http://localhost:3000`.

### Available commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start API and frontend together |
| `npm run dev:api` | Start the Express API |
| `npm run dev:web` | Start the Vite frontend |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check the workspaces |
| `npm run test` | Run API and frontend Vitest suites |
| `npm run build` | Build shared, API and frontend packages |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Run Prisma development migrations |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Seed development demo accounts |
| `npm run format` | Run Prettier |
| `npm run docker` | Run `docker compose up --build` |

Playwright end-to-end tests are configured in the web workspace. Run them with:

```bash
npm run test:e2e --workspace apps/web
```

They require Playwright browser dependencies and a correctly configured test environment.

## API overview

The REST API base path is `/api/v1`. Protected routes require a valid session cookie. JSON requests use `application/json`; signature uploads use `multipart/form-data`.

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Sign in |
| `POST` | `/api/v1/auth/register` | Register an Employee |
| `POST` | `/api/v1/auth/logout` | Revoke the current session |
| `GET` | `/api/v1/auth/me` | Get the current user and role |
| `POST` | `/api/v1/auth/forgot-password` | Request a password reset |
| `POST` | `/api/v1/auth/reset-password` | Reset a password using a valid token |

### Vouchers

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/vouchers` | Create a draft |
| `GET` | `/api/v1/vouchers` | List authorised vouchers with supported search, filters, sorting and pagination |
| `GET` | `/api/v1/vouchers/:id` | Retrieve voucher details |
| `PATCH` | `/api/v1/vouchers/:id` | Update an owned draft |
| `DELETE` | `/api/v1/vouchers/:id` | Delete an owned draft |
| `POST` | `/api/v1/vouchers/:id/submit` | Submit a draft |
| `POST` | `/api/v1/vouchers/:id/approve` | Approve a pending voucher; Director only |
| `POST` | `/api/v1/vouchers/:id/reject` | Reject a pending voucher; Director only |
| `GET` | `/api/v1/vouchers/:id/events` | Retrieve the authorised workflow timeline |

Signature upload and retrieval routes are also available under the voucher API. Exact request schemas, filters, sort fields and response structures are defined by the implementation and tests.

### Dashboards and health

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/dashboard/employee` | Employee-scoped totals |
| `GET` | `/api/v1/dashboard/director` | Director approval and activity metrics |
| `GET` | `/api/v1/dashboard/accounts` | Organisation-wide Accounts metrics |
| `GET` | `/healthz` | API liveness |
| `GET` | `/readyz` | Database readiness |

## Security

The application includes:

- Password hashing with bcrypt.
- Opaque server-side sessions with token hashes stored in the database.
- HTTP-only session cookies.
- Server-enforced role and ownership checks.
- Origin checks for state-changing requests.
- General API and authentication rate limits.
- Server-side validation and restricted update fields.
- Signature size limits, file validation, random storage keys and private storage.
- Authorised signature retrieval.
- Transactional workflow state changes and audit events.
- Generic login and password-reset responses to reduce account enumeration.
- Single-use, expiring password-reset tokens stored as hashes.
- Security headers and central error handling.

Never commit production secrets, real credentials, database dumps or actual signature files. Do not store long-lived session tokens in browser `localStorage`.

## Testing and CI

The project uses Vitest, React Testing Library, Supertest and Playwright, alongside ESLint and TypeScript checks.

Run the core checks from the project root:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm audit
```

Tests that require a database must use a separate test database, not development or production data.

The latest recorded GitHub Actions run for the containerisation commit passed its configured workflow, which runs dependency installation, Prisma Client generation, lint, type-check, application tests and build. The workflow does **not** build or start Docker Compose, so it does not verify first-run Compose startup or volume persistence. Verify those directly before relying on the containerised setup.

## Project structure

```text
.
├── apps/
│   ├── api/                  # Express API and business logic
│   └── web/                  # React/Vite frontend
├── packages/
│   └── shared/               # Shared types, enums and validation
├── prisma/
│   ├── schema.prisma         # Prisma data model
│   ├── migrations/           # Versioned database migrations
│   └── seed.ts               # Development demo accounts
├── Dockerfile                # Multi-stage app image
├── docker-compose.yml        # App and MySQL services and named volumes
├── .dockerignore
├── .env.example
├── package.json
└── README.md
```

## Known limitations and production checklist

The default Compose setup is for local development and demonstration. Before deploying publicly or using real company data:

- **Fix and verify Prisma container configuration:** pass `SHADOW_DATABASE_URL` to the app container, then verify a clean `docker compose up --build` from an empty local database.
- **Replace defaults:** use unique strong database credentials and a strong session secret; never expose the development defaults publicly.
- **Disable demo seeding:** the current seed script updates seeded users on each run. Do not run it as a production startup step.
- **Configure password-reset delivery:** the API has the reset-token flow, but a production email transport is not configured. In non-production mode, the API exposes a development reset token for testing.
- **Review signature storage:** named Docker volumes provide persistence on one host. Production should use a suitable private storage strategy, backups and retention controls.
- **Prepare operations:** configure HTTPS, trusted-proxy settings, backups and restore tests, monitoring, log retention, database least privilege, container updates and data-retention policies.
- **Verify Docker in CI:** the existing CI workflow does not run a Docker Compose end-to-end test.

Do not treat local Compose defaults as a production deployment without addressing these points.

## Contributing

1. Keep changes focused and follow existing code conventions.
2. Add or update tests when behaviour changes.
3. Update API documentation when request or response contracts change.
4. Run lint, type-check, tests and build checks.
5. Never commit secrets, production data, database dumps or real signature images.
6. Report which checks were actually executed and any remaining limitations.
