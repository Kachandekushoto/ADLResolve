# ITResolve API

Express + MySQL backend for the ITResolve IT support platform: user accounts,
support tickets, ticket messaging/attachments, a searchable knowledge base,
and an admin/IT-support surface.

## Stack

- **Node.js / Express** — HTTP API
- **MySQL** (via `mysql2`) — data store, raw SQL (no ORM)
- **JWT** + **bcrypt** — auth for both customer accounts and admin/IT staff accounts
- **multer** — screenshot/image uploads

## Local setup

```bash
cp .env.example .env        # then edit DB_* and JWT_SECRET
npm install
npm run migrate             # creates the database + tables from db/schema.sql
npm run seed                # demo admin user + sample knowledge base articles
npm run dev                 # http://localhost:8080
```

Demo admin login after seeding: `admin@itresolve.local` / `ChangeMe123!`
— change this immediately in anything beyond local dev.

### Gmail password reset email

Password reset requests use Gmail SMTP through Nodemailer. To enable delivery:

1. Turn on 2-Step Verification for the Gmail account that will send mail.
2. Create a Google App Password for this application. Do not use the normal Gmail password.
3. Add these values to `.env`:

```env
GMAIL_USER=your-gmail-address@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
MAIL_FROM=your-gmail-address@gmail.com
FRONTEND_URL=http://localhost:8080/index.php
```

Restart the API after changing `.env`. Reset links expire after one hour. In local development, if Gmail is not configured, the API returns a temporary `devResetToken` so the reset flow can still be tested; this fallback is disabled in production.

## Docker

```bash
docker compose up --build
```

Brings up MySQL, the API, and an nginx reverse proxy on port 80. The schema
is auto-applied on first boot via MySQL's `docker-entrypoint-initdb.d`. Run
`npm run seed` once against the container (or `docker compose exec api npm run seed`)
to load demo data.

## Auth model

Two separate identities, both issued as JWTs with a `type` claim:

- `type: "user"` — customers (`users` table). Can create tickets, view/reply
  to their own tickets, manage their profile.
- `type: "admin"` — IT support staff (`admin_users` table, `role` of `it_staff`
  or `admin`). Can view/filter all tickets, change status, reply, and browse
  customer accounts.

Send the token as `Authorization: Bearer <token>`.

## API reference

### Auth
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | – | customer signup |
| POST | `/api/auth/login` | – | customer login |
| POST | `/api/auth/forgot-password` | – | issues a hashed, one-hour reset token and emails the link |
| POST | `/api/auth/reset-password` | – | consumes the reset token |
| POST | `/api/auth/admin/login` | – | admin or `it_staff` login |
| POST | `/api/auth/admin/forgot-password` | – | non-enumerating reset request for active admin or `it_staff` accounts |
| POST | `/api/auth/admin/reset-password` | – | consumes an active admin/`it_staff` reset token |

### Tickets
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/tickets` | user | multipart form, field `screenshot` optional |
| GET | `/api/tickets` | user or admin | users see only their own; admins see all, with `?status=&categoryId=&search=&page=&pageSize=` |
| GET | `/api/tickets/:id` | user (own) or admin | full detail incl. messages + attachments |
| PATCH | `/api/tickets/:id/status` | admin | body: `{ status, priority, assignedAdminId }` |
| POST | `/api/tickets/:id/messages` | user or admin | reply on the ticket thread, optional `screenshot` |

### Categories & Knowledge Base
| Method | Path | Auth |
|---|---|---|
| GET | `/api/categories` | – |
| GET | `/api/kb?q=&categoryId=` | – |
| GET | `/api/kb/:slug` | – |

### Users
| Method | Path | Auth |
|---|---|---|
| GET | `/api/users/me` | user |
| PATCH | `/api/users/me` | user |
| GET | `/api/users?search=` | admin |

## Not included yet (next steps)

- Email delivery for ticket notifications (password reset email delivery is configured through Gmail SMTP)
- Refresh tokens / logout-everywhere
- The AI troubleshooting assistant described in the product spec — the ticket/category/message
  structure here is intentionally generic so an `/api/ai/suggest` endpoint can slot in later
  without a schema change
- Automated tests
