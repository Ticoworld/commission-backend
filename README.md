# Commission Backend

## Project summary
`commission-backend` is an Express API server for ESLGSC operations. It exposes role-protected administrative endpoints, public news and announcement endpoints, and data services backed by Prisma/PostgreSQL.

## Problem solved
This service centralizes backend workflows required by the portal:

- authentication and role-based access control
- user invitation and password onboarding/reset
- employee record management
- employee edit suggestion and approval workflow
- newsroom moderation workflow
- retirement alert computation and export
- LGA-scoped document upload and retrieval
- activity and dashboard notifications

## Features (confirmed)
- Auth endpoints: login, invite, set password, reset password, current user
- Invite management: list, resend, revoke
- User administration: list users, update role, force reset, activate/deactivate
- Employee endpoints: list/by-id/create/update/delete and `my-lga`
- Employee edit suggestions (`employee-edits`) with queue approval/rejection
- News endpoints:
  - public: published list, by slug, by published ID
  - protected: draft/update/submit/approve/reject/delete
- LGA management endpoints
- Upload endpoints:
  - upload document
  - list my LGA uploads
  - list all uploads (admin)
  - filename-based download route
- Retirement alerts list and export endpoint
- Activity log endpoint
- Dashboard notifications endpoint
- Announcements list/create
- Health endpoint at `/api/health`
- Monthly cron task for retirement report processing

## Stack
- Node.js (CommonJS)
- Express 5
- Prisma ORM + `@prisma/client`
- PostgreSQL datasource
- JWT (`jsonwebtoken`)
- Validation with Zod
- File upload with Multer
- Security and middleware:
  - Helmet
  - CORS
  - Morgan
  - Rate limiting with `rate-limiter-flexible`
- Scheduled jobs with `node-cron`
- Transactional email with Brevo SDK (`sib-api-v3-sdk`)

## Setup
### Prerequisites
- Node.js and npm
- PostgreSQL instance reachable by `DATABASE_URL`

### Install
```bash
npm install
```

### Configure environment
Copy `.env.example` to `.env` and set values.

Minimum required by runtime checks:
- `DATABASE_URL`
- `JWT_SECRET`
- `UPLOAD_DIR`
- `EMAIL_FROM`

Additional keys used by code:
- `PORT`
- `NODE_ENV`
- `ALLOWED_ORIGINS`
- `APP_BASE_URL`
- `BREVO_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `PRISMA_CONN_LIMIT`

Seed-specific keys:
- `SEED_SUPER_NAME`
- `SEED_SUPER_EMAIL`
- `SEED_SUPER_PASSWORD`
- `SEED_RESET_SUPER_PASSWORD`
- `ALLOW_PROD_SEED`

### Database lifecycle
```bash
npm run generate
npm run migrate
npm run seed
```

### Run
```bash
# development
npm run dev

# production
npm start
```

## Project structure
```text
commission-backend/
+-- index.js
+-- package.json
+-- prisma/
|   +-- schema.prisma
|   +-- migrations/
|   +-- seed.js
+-- scripts/
|   +-- health-check.js
|   +-- list-users.js
|   +-- cleanup-test-users.js
|   +-- backfill-news-slugs.js
|   +-- test-prisma-connection.js
+-- src/
    +-- config/       # env loading and defaults
    +-- db/           # Prisma client bootstrap
    +-- middleware/   # auth, error, rate limit, validation, upload middleware
    +-- routes/       # route groups
    +-- controllers/  # request handlers and workflow logic
    +-- services/     # uploads, retirement, mail
    +-- schemas/      # zod request schemas
    +-- utils/        # activity/date helpers
```

## Architecture overview
```text
HTTP client
  -> Express routes (/api/*)
  -> Controllers
  -> Services + Prisma client
  -> PostgreSQL

Background process:
- node-cron scheduler inside server process

External service:
- Brevo transactional email API
```

## Deployment/runtime notes (confirmed)
- Server starts only after Prisma `$connect()` succeeds.
- Health endpoint is `/api/health`.
- CORS behavior:
  - non-production: open `cors()`
  - production: origin check against `ALLOWED_ORIGINS`
- Static upload serving is enabled only when `NODE_ENV !== 'production'`.
- Upload directory is created on startup via `ensureUploadDir()`.
- Cron expression for monthly retirement report: `0 6 1 * *`.
- Graceful shutdown disconnects Prisma on `SIGINT`.

## Limitations (confirmed in current code)
- No automated test script is defined in `package.json`.
- `src/controllers/uploadsController.js` defines `downloadFile` but does not export it, while routes reference it.
- `src/services/retirement.js` maps employee name using `e.name` although employee schema uses `full_name`.
- Cron mail call passes recipient arrays and attachments, but `src/services/mail.js` currently assigns a single `to` object and does not map attachments.

