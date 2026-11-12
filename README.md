# Tracklap task management

A responsive task-management dashboard built with React and Vite, with a Node.js/Express API, MySQL persistence, and email/password authentication.

Tasks can optionally have an hours-and-minutes estimate. The timer runs separately for each signed-in member when their task status is In Progress, pauses when it changes to another status, and an in-app alert appears when their elapsed time exceeds the estimate.

Signed-in users can also create, rename, edit, and delete private notes for saving ideas and thoughts.

Visitors see a public product landing page before signing in. The header offers sign-in and account creation dialogs; after signing in, the user is taken to their workspace.

## Requirements

- Node.js 20 or newer
- MySQL 8 or newer

For an explanation of the Redis, migration, monitoring, worker, container, and load-test setup, see [SCALING_GUIDE.md](SCALING_GUIDE.md).

## Security, performance, and scaling

- Never commit credentials. `backend/.env.example` and `compose.env.example` contain placeholders; keep live credentials in ignored `.env` files or a production secret manager. A credential-looking value was removed from the backend sample, so rotate any matching database password or AI key before deploying.
- The API has bounded, configurable MySQL connection and queue limits. Budget `MYSQL_CONNECTION_LIMIT × API instance count` below the database's connection capacity, leaving room for migrations, workers, and monitoring. A full MySQL wait queue returns `503` with `Retry-After` instead of growing without bounds.
- Redis can share rate limits between API instances and cache authenticated sessions for 60 seconds. MySQL remains the source of truth and is used as the fallback when Redis is unavailable. Configure `REDIS_URL` and `REDIS_REQUIRED=true` in production; local development can run without Redis. Authentication limits use `AUTH_RATE_LIMIT_MAX`, defaulting to 10 per IP per 15 minutes.
- Run database changes once with the versioned `npm run migrate --prefix backend` command before starting or rolling out API instances. API startup checks the applied schema version and does not run DDL or data backfills.
- `GET /api/tasks?limit=200&cursor=...` provides keyset pagination with a maximum page size of 200. The workspace consumes these pages in order to preserve its existing cross-page summaries and interactions. The frontend still holds the signed-in user's task set in memory; very large accounts will need server-side aggregate endpoints and page-specific fetching to reduce browser memory and total transfer size.
- `/api/health/live` is a liveness check; `/api/health/ready` checks MySQL and, when required, Redis. `/metrics` exports Prometheus request latency/error, process, MySQL pool, and background queue metrics. Compose keeps API metrics private; set `METRICS_TOKEN` if you expose the endpoint outside a private network.
- The BullMQ worker handles retryable scheduled session cleanup. Add user-facing asynchronous work to this queue when features need it; keep request-critical task writes synchronous.
- The production Nginx container load-balances API replicas, proxies the SPA API requests, and marks Vite's content-hashed assets cacheable for a year. This is CDN-ready; configure your CDN to cache `/assets/*` and revalidate `/index.html`. Private API responses and profile pictures must not be publicly cached.
- `docker-compose.yml` provides MySQL, Redis, an API replica set, the worker, Nginx, and Prometheus. `backend/load/k6-login.js` is a k6 workload for login, session checks, and task reads. Run it against a dedicated test account and isolated environment; its default VU count fits the default login rate limit.
- API instances are stateless apart from MySQL and Redis, so they can be scaled horizontally. Do a load test against production-like CPU, memory, database, and Redis sizes before choosing replica counts or claiming a concurrency target.
- The public landing page includes a lightweight animated cursor-grid canvas. It respects reduced-motion preferences for click animations and leaves the static grid background in place if canvas rendering is unavailable.
- Optional AI features use Gemini from the backend. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey), set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in `backend/.env`, then restart the API. The default model is `gemini-3.5-flash-lite`. Google AI Studio's free-tier model access, quotas, and data-use terms depend on Google's current policies and your account; check them before sending real task data. Keys are never sent to the browser. AI requests send only the signed-in user's accessible task/team data needed for that action; results are suggestions and do not modify tasks. AI actions are limited to 20 requests per signed-in account per 15 minutes.

## Set up MySQL

Create the database before starting the API:

```sql
CREATE DATABASE task_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Copy `backend/.env.example` to `backend/.env` and set your MySQL connection details. Run `npm run migrate --prefix backend` to create or upgrade the schema before starting the API. Migrations are versioned in `schema_migrations`; new accounts start with an empty task list.

Email verification and team invitations use Resend. Set `RESEND_API_KEY`, a verified `EMAIL_FROM` sender, and `APP_ORIGIN` in `backend/.env`, then run `npm run migrate --prefix backend` before restarting the API. New registrations require a 6-digit email code. Team leads can invite addresses from the team creation dialog; invitees must verify and sign in with that same email before the invitation is accepted. Existing accounts are treated as verified by the migration.

Registration is open. Passwords are stored as salted scrypt hashes, and sign-in uses an HTTP-only session cookie. Personal tasks are visible only to their owner. For an assigned task, only the task creator and selected assignee can see it. Team leads can create teams by selecting other registered accounts. A team task is assigned to all current team members, requires a detailed task note, and is visible only to those members. Each member updates their own progress; every team member can see the status of all team members, and the lead can manage the task. The team task's overall status is derived from all member statuses.

Tasks created before sign-in was added have no owner. The migration keeps those existing rows but does not show them to signed-in users.

Signed-in users can click their profile in the sidebar (or their avatar in the top bar) to upload or remove a JPEG, PNG, or WebP profile picture up to 2 MB. Image data is stored in the user's MySQL row. The applied migration adds `avatar_data`, `avatar_mime_type`, and `avatar_updated_at` columns to `users` if they are missing.

Use the sun/moon control in the top bar to switch between light and dark themes. The selected theme is saved in this browser. Both themes include staggered page transitions, cards and task rows that reveal as you scroll, animated theme switching, hover elevation and shadows, and responsive button feedback. Dark mode also has a slowly shifting ambient background. All motion respects the operating system's reduced-motion preference.

## Run locally

Install the frontend dependencies from the project root and the API dependencies from `backend`:

```powershell
npm install
cd backend
npm install
```

Run the schema migration once, then start the API in one terminal:

```powershell
cd ..
npm run migrate --prefix backend
cd backend
npm run dev
```

Start the frontend from the project root in a second terminal:

```powershell
npm run dev
```

Vite forwards `/api` requests to `http://localhost:3001`. Liveness and readiness checks are available at `http://localhost:3001/api/health/live` and `/api/health/ready`.

## Production-style deployment

Docker Compose provides MySQL, Redis, the API, a background worker, Nginx, and Prometheus. Copy `compose.env.example` to `.env`, set unique strong database passwords, then run:

```powershell
docker compose build
docker compose up -d mysql redis
docker compose --profile maintenance run --rm migrate
docker compose up -d --scale api=2
```

The app is available at `http://localhost:8080`; Prometheus is bound to `http://localhost:9090`. Nginx discovers scaled API containers through Docker DNS. Place a TLS reverse proxy or CDN in front of Nginx for a public deployment. Configure the CDN to cache hashed `/assets/*` files and revalidate `/index.html`.

To exercise a dedicated test account against this stack, install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) and run:

```powershell
k6 run -e BASE_URL=http://localhost:8080 -e TEST_EMAIL=load-test@example.com -e TEST_PASSWORD=your-test-password -e VUS=10 backend/load/k6-login.js
```

The scenario logs in once per virtual user, then repeatedly checks the session and task list. Use disposable test accounts and data. Raise `AUTH_RATE_LIMIT_MAX` only in an isolated load-test deployment when testing more than the default 10 login attempts per IP per 15 minutes.

## API

`GET /api/tasks` returns all matching tasks for compatibility. Pass `limit` (1–200) and the returned base64url `cursor` to read a bounded keyset page.

- `POST /api/auth/register` — create an account with `name`, `email`, and `password` (minimum 8 characters)
- `POST /api/auth/login` — sign in
- `GET /api/auth/me` — get the signed-in account
- `POST /api/auth/logout` — end the current session
- `GET /api/tasks` — list tasks
- `GET /api/notes` — list the signed-in user's notes
- `POST /api/notes` — create a note with `title` and `content`
- `PATCH /api/notes/:id` — update a note title or content
- `DELETE /api/notes/:id` — delete one of the signed-in user's notes
- `GET /api/tasks/:id/members/:memberId/avatar` — fetch an assigned user's avatar when the signed-in user can access that task
- `GET /api/ai/status` — check whether AI is configured without exposing credentials
- `POST /api/ai/ask` — answer a general natural-language question like “Who is Virat Kohli?”
- `POST /api/ai/task-breakdown` — suggest subtasks for an accessible task (`taskId`)
- `POST /api/ai/priorities` — rank the signed-in user's open tasks
- `POST /api/ai/team-summary` — summarize an accessible team (`teamId`)
- `POST /api/ai/search` — search accessible tasks with a natural-language `query`
- `POST /api/ai/deadline-risks` — identify open tasks that may be at risk of missing deadlines
- `POST /api/tasks` — create a task
- `PATCH /api/tasks/:id` — update task fields
- `PATCH /api/tasks/:id/progress` — update the signed-in member's status on a team task
- `DELETE /api/tasks/:id` — delete a task
- `GET /api/teams` — list teams the signed-in account belongs to and their members
- `GET /api/teams/:teamId/members/:memberId/avatar` — fetch a profile picture for a member of one of the signed-in user's teams
- `POST /api/teams` — create a team with `name` and `memberIds`; the creator is the lead
- `PATCH /api/teams/:teamId` — rename a team (team lead only)
- `DELETE /api/teams/:teamId` — delete an empty team (team lead only); teams with tasks must have their tasks deleted or moved first
- `GET /api/users/assignees` — list registered account names and IDs for task assignment (requires sign-in)

Task fields include `title`, `project`, `assigneeId`, optional `teamId`, `priority` (`high`, `medium`, `low`), `status` (`pending`, `in_progress`, `completed`), `dueDate` (`YYYY-MM-DD`), optional `estimatedMinutes` (1–10,080), and optional `description` (required for team tasks, up to 5,000 characters).
