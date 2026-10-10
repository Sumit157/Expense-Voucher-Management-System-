# Expense Voucher Management System

Full-stack expense-voucher workflow for ABC Company: employees create and submit vouchers, the Director approves or rejects them, and Accounts reviews approved vouchers. This repository contains the application source (`apps/`, `packages/`).

## Product goal

Digitise ABC Company's expense-voucher workflow so employees can create and submit vouchers, the Director can approve or reject them, and Accounts can review approved vouchers for reimbursement processing.

## Recommended stack

- **Frontend:** React + TypeScript + Vite
- **UI:** Tailwind CSS + shadcn/ui (Radix primitives) + selected React Bits components where they improve the design
- **Data fetching/forms:** TanStack Query, React Hook Form, Zod
- **Backend:** Node.js + TypeScript + Express
- **Database:** MySQL 8.0+ with Prisma ORM + migrations
- **Authentication:** short-lived access JWT in a secure, HttpOnly cookie; refresh/session strategy documented in `SECURITY.md`
- **Uploads:** validated image uploads, private storage, access controlled through the API
- **Testing:** Vitest, React Testing Library, Supertest, Playwright
- **Local development:** locally installed MySQL 8.0+ (Docker Compose optional as a fallback; see `DECISIONS.md` D-014)

## Development (Phase 1 foundation)

Prerequisites: Node.js 20+, npm 11+, and MySQL 8.0+ (locally installed per `DECISIONS.md` D-014, or the optional Docker Compose fallback in `docker-compose.yml`).

```bash
npm install                       # install all workspaces
copy .env.example .env            # then edit DATABASE_URL with real credentials
npm run dev                       # API on :3000, web on :5173 (concurrently)
```

Individual commands:

```bash
npm run dev:api                   # Express API only (tsx watch)
npm run dev:web                   # Vite dev server only
npm run lint                      # ESLint
npm run typecheck                 # tsc across workspaces
npm run test                      # Vitest (API)
npm run build                     # production build of shared, api, web
npm run format                    # Prettier write
```

Health endpoints (API): `GET /healthz` (liveness), `GET /readyz` (MySQL readiness via `SELECT 1`).

Optional database fallback (host port 3307, never clashes with local 3306): `docker compose up -d mysql`.

## Development conventions

1. The planning kit (phase plan, requirements, decisions, current state) is maintained locally and is not published to this repository.
2. Follow `PLAN.md` phase by phase. Do not start later phases before the current phase's acceptance criteria pass.
3. Keep `CURRENT_STATE.md` updated at the end of every phase.
4. Use `MASTER_PROMPT.md` as the project-level instruction for the coding agent.
5. Use `UI_UX.md` to prevent generic AI-looking design and keep components consistent.

## Important implementation principles

- Enforce permissions on the server, not just in the interface.
- Derive employee identity from the authenticated session. Never trust an employee ID sent by the browser to determine ownership.
- Make state changes through explicit workflow endpoints and database transactions.
- Never expose uploaded signatures through a public static directory.
- Do not commit real credentials, JWT secrets, production data, or uploaded signatures.
- Keep the application usable at mobile, tablet, and desktop sizes.
- Do not claim a phase is complete until its checks and acceptance criteria pass.

## Source of truth

The supplied assignment PDF is the source of truth for required business behaviour. Where the assignment is silent, the documents state a recommended implementation decision. Record any deliberate change in `DECISIONS.md`.
