# JYM CULTURE GYM & SPA — Enquiry & Booking Backend

An Express API that gives the JYM Culture website a **real backend**. The contact /
booking form on the site no longer just shows a message — it posts to this server,
which validates the enquiry, stores it, and emails a notification to the gym.

- **Node.js + Express** REST API
- **Validation** of every field, with per-field error messages
- **Storage** in a self-contained JSON file (no database to install)
- **Email notification** via Nodemailer over SMTP
- **CORS** enabled so the static website can call it from a different domain
- **Admin API** (protected by an API key) to list, filter, export and manage enquiries

---

## Contents

- [1. Quick start](#1-quick-start)
- [2. Configure `.env`](#2-configure-env)
- [3. Run it](#3-run-it)
- [4. API reference](#4-api-reference)
- [5. Connect the website form](#5-connect-the-website-form)
- [6. Project structure](#6-project-structure)
- [7. Deployment](#7-deployment)
- [8. Troubleshooting](#8-troubleshooting)
- [9. Security notes](#9-security-notes)

---

## 1. Quick start

Requires **Node.js 18 or newer** (check with `node -v`).

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
#  ... now edit .env — see section 2 ...
npm start
```

You should see:

```
[2026-01-01T10:00:00.000Z] INFO  ==================================================
[2026-01-01T10:00:00.000Z] INFO    JYM CULTURE GYM & SPA - enquiry API is running
[2026-01-01T10:00:00.000Z] INFO  ==================================================
[2026-01-01T10:00:00.000Z] INFO    Local:      http://localhost:5000
[2026-01-01T10:00:00.000Z] INFO    Health:     http://localhost:5000/api/health
[2026-01-01T10:00:00.000Z] INFO    Data file:  /path/to/backend/data/enquiries.json
```

Prove it works in one command (server must be running):

```bash
npm run smoke
```

That submits a sample enquiry through the real endpoint, reads it back through the
admin API, checks the validation errors, confirms the admin key is enforced, then
cleans up after itself.

---

## 2. Configure `.env`

Everything is configured in `.env` (created from `.env.example`). **Never commit
this file** — it is already listed in `.gitignore`.

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `5000` | Port the API listens on |
| `NODE_ENV` | `development` | `production` hides internal error detail |
| `CORS_ORIGIN` | `*` | Allowed origins, comma-separated. `*` = any |
| `ADMIN_API_KEY` | `change-me-...` | **Change this.** Protects every `/api/admin/*` route |
| `DATA_FILE` | `./data/enquiries.json` | Where enquiries are stored |
| `STATIC_DIR` | _(empty)_ | Optional: also serve the website from this server |
| `EMAIL_ENABLED` | `true` | Master switch for notifications |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server |
| `SMTP_PORT` | `587` | `587` = STARTTLS, `465` = implicit TLS |
| `SMTP_SECURE` | `false` | `true` for port 465, `false` for 587 |
| `SMTP_USER` | — | The account that sends the mail |
| `SMTP_PASS` | — | SMTP password / app password |
| `MAIL_TO` | `JYMCULTURE@gmail.com` | Where notifications land (the gym's inbox) |
| `MAIL_FROM` | `SMTP_USER` | The "from" line on the email |
| `SMTP_TIMEOUT_MS` | `10000` | Give up on the mail server after this long |

### Setting up Gmail SMTP

Gmail will **not** accept your normal account password. Use an App Password:

1. Turn on **2-Step Verification** — <https://myaccount.google.com/security>
2. Open <https://myaccount.google.com/apppasswords>
3. Create an app password, copy the **16-character** code
4. Use it as `SMTP_PASS` (spaces are fine, they are ignored)

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gym-account@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
MAIL_TO=JYMCULTURE@gmail.com
MAIL_FROM="JYM Culture Website <your-gym-account@gmail.com>"
```

Generate a strong admin key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Email is optional

Leave `EMAIL_ENABLED=false`, **or** leave `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`
empty, and the API still works: every enquiry is validated and stored, the email
step is simply skipped (the reason is saved on the record as `mailError`).
This is handy for local development.

---

## 3. Run it

| Command | What it does |
|---|---|
| `npm start` | Run the server |
| `npm run dev` | Run with auto-restart on file changes (Node 18+) |
| `npm run smoke` | Run the end-to-end smoke test against a running server |

Useful environment: `BASE_URL=http://localhost:4000 npm run smoke` targets a server on a different port.

---

## 4. API reference

Base URL in the examples: `http://localhost:5000`.

All responses are JSON with a `success` boolean. Errors look like:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "details": [{ "field": "phone", "message": "Enter a valid phone number (at least 10 digits)." }]
  }
}
```

### Route summary

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | public | Server + config health check |
| `POST` | `/api/enquiries` | public | **Submit an enquiry — used by the website form** |
| `GET` | `/api/enquiries` | admin | Alias of the admin list |
| `GET` | `/api/enquiries/:id` | admin | One enquiry |
| `GET` | `/api/admin/enquiries` | admin | List, filter, search, paginate |
| `GET` | `/api/admin/enquiries/export.csv` | admin | Download all enquiries as CSV |
| `GET` | `/api/admin/enquiries/:id` | admin | One enquiry |
| `PATCH` | `/api/admin/enquiries/:id` | admin | Change status |
| `DELETE` | `/api/admin/enquiries/:id` | admin | Delete |
| `GET` | `/api/admin/stats` | admin | Dashboard counts |

**Admin auth** — send the key as either header:

```
x-api-key: <ADMIN_API_KEY>
Authorization: Bearer <ADMIN_API_KEY>
```

---

### `POST /api/enquiries` — submit an enquiry

The endpoint the website form posts to.

**Fields**

| Field | Required | Notes |
|---|---|---|
| `name` | ✅ | 2–80 characters |
| `phone` | ✅ | 10–15 digits; `+91`, spaces and dashes are stripped automatically |
| `email` | ❌ | Must be a valid address if given |
| `program` | ✅ | What they are interested in |
| `time` | ❌ | Preferred slot, e.g. `Evening (4:00 - 10:00 PM)` |
| `plan` | ❌ | One of `1m`, `3m`, `6m`, `8m`, `12m` |
| `message` | ❌ | Free text, up to 2000 characters |
| `trial` | ❌ | `true` for a Free 1-Day Trial request |
| `zumba` | ❌ | `true` for the 6 PM Zumba class |

> `trial` is set automatically when `program` mentions "free", and `zumba` when the
> chosen time is the 6 PM Zumba slot — the form does not have to send them.

**Request**

```bash
curl -X POST http://localhost:5000/api/enquiries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Priya Verma",
    "phone": "+91 98765 43210",
    "email": "priya@example.com",
    "program": "Summer Offer Package",
    "plan": "6m",
    "time": "Zumba class (6:00 PM)",
    "message": "Please call in the evening."
  }'
```

**Response — `201 Created`**

```json
{
  "success": true,
  "message": "Thanks! Your enquiry is in. Our team will call you back shortly.",
  "data": {
    "id": "enq_ac3ffb853689bc46",
    "createdAt": "2026-10-01T05:33:53.914Z",
    "status": "new",
    "name": "Priya Verma",
    "program": "Summer Offer Package",
    "plan": "6m",
    "trial": false,
    "notificationSent": true
  }
}
```

> `notificationSent` tells you whether the email actually went out. The enquiry is
> stored either way — a mail failure never loses a lead.

**Response — `422 Unprocessable Entity`** (validation failed)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "details": [
      { "field": "name", "message": "Name must be at least 2 characters." },
      { "field": "phone", "message": "Enter a valid phone number (at least 10 digits)." },
      { "field": "email", "message": "Enter a valid email address." },
      { "field": "program", "message": "Please choose what you are interested in." }
    ]
  }
}
```

Other status codes: `400` bad JSON or spam honeypot, `413` body over 32 kB,
`500` unexpected server error.

---

### `GET /api/admin/enquiries` — list enquiries

**Query parameters**

| Param | Default | Notes |
|---|---|---|
| `page` | `1` | Page number |
| `limit` | `50` | Up to 200 |
| `status` | — | `new` \| `contacted` \| `converted` \| `closed` |
| `q` | — | Search name, phone, email, program, plan, message |
| `sort` | `newest` | `newest` \| `oldest` |

```bash
curl "http://localhost:5000/api/admin/enquiries?limit=20&status=new&sort=newest" \
  -H "x-api-key: $ADMIN_API_KEY"
```

**Response — `200 OK`**

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "limit": 20,
  "pages": 1,
  "items": [
    {
      "id": "enq_ac3ffb853689bc46",
      "createdAt": "2026-10-01T05:33:53.914Z",
      "updatedAt": "2026-10-01T05:33:53.915Z",
      "status": "new",
      "source": "website-contact-form",
      "name": "Priya Verma",
      "phone": "9876543210",
      "email": "priya@example.com",
      "program": "Summer Offer Package",
      "time": "Zumba class (6:00 PM)",
      "message": "Please call in the evening.",
      "plan": "6m",
      "trial": false,
      "zumba": true,
      "notified": true,
      "notifiedAt": "2026-10-01T05:33:54.100Z",
      "mailError": null
    }
  ]
}
```

**`401 Unauthorized`** — missing or wrong key:

```json
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Invalid or missing API key. Send it as the x-api-key header." } }
```

---

### `PATCH /api/admin/enquiries/:id` — update status

```bash
curl -X PATCH http://localhost:5000/api/admin/enquiries/enq_ac3ffb853689bc46 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"status": "contacted"}'
```

```json
{ "success": true, "data": { "id": "enq_ac3ffb853689bc46", "status": "contacted", "updatedAt": "2026-10-01T06:00:00.000Z" } }
```

Valid statuses: `new`, `contacted`, `converted`, `closed`.

---

### `DELETE /api/admin/enquiries/:id`

```bash
curl -X DELETE http://localhost:5000/api/admin/enquiries/enq_ac3ffb853689bc46 \
  -H "x-api-key: $ADMIN_API_KEY"
```

```json
{ "success": true, "message": "Enquiry enq_ac3ffb853689bc46 deleted." }
```

---

### `GET /api/admin/stats` — dashboard counts

```bash
curl http://localhost:5000/api/admin/stats -H "x-api-key: $ADMIN_API_KEY"
```

```json
{
  "success": true,
  "data": { "total": 12, "byStatus": { "new": 7, "contacted": 3, "converted": 1, "closed": 1 }, "trials": 5, "lastAt": "2026-10-01T05:33:53.914Z" }
}
```

---

### `GET /api/admin/enquiries/export.csv`

Returns a CSV file (`jym-culture-enquiries.csv`) that opens directly in Excel or
Google Sheets:

```bash
curl -OJ http://localhost:5000/api/admin/enquiries/export.csv -H "x-api-key: $ADMIN_API_KEY"
```

---

### `GET /api/health`

```json
{
  "success": true,
  "status": "ok",
  "service": "jym-culture-gym-backend",
  "version": "1.0.0",
  "env": "production",
  "uptimeSeconds": 128,
  "time": "2026-10-01T05:33:53.914Z",
  "storage": { "file": "data/enquiries.json", "total": 12 },
  "email": { "enabled": true, "configured": true, "to": "JYMCULTURE@gmail.com" }
}
```

`email.configured` is the quickest way to confirm SMTP is wired up correctly.

---

## 5. Connect the website form

The contact page (`contact.html`) already posts to `POST /api/enquiries` with
`fetch()`. Point it at your deployed backend by editing this one line in the page:

```html
<script>
  window.JYM_API_BASE = "http://localhost:5000";   // ← your backend URL
</script>
```

Leave it empty (`""`) when the front-end and API are on the same origin.

**How the form behaves**

- Validates on the client first and shows inline field errors
- Shows a **"Sending…"** state on the button and disables it while in flight
- **Green** message on success, with the reference ID from the API
- **Red** message on failure — including the server's field errors mapped back
  onto the right inputs, and a fallback phone number if the API is unreachable

**Deep links from the pricing cards**

Every "Join Now" button links to `contact.html?plan=12m#contact`. The page reads
`?plan=12m`, pre-selects the plan and marks the form so the API records which
package the visitor wanted.

---

## 6. Project structure

```
backend/
├── server.js                      Entry point: Express app, CORS, routes, graceful shutdown
├── package.json                   Dependencies and npm scripts
├── .env.example                   Template for your .env (copy it, then fill it in)
├── .gitignore                     Keeps .env, node_modules and real data out of git
├── Dockerfile                     Production container image
├── .dockerignore
├── README.md                      This file
│
├── src/
│   ├── config/
│   │   └── index.js               Loads .env once, exposes typed settings to the whole app
│   │
│   ├── routes/
│   │   ├── enquiryRoutes.js       Public POST + admin-only GET, mounted at /api/enquiries
│   │   └── adminRoutes.js         All /api/admin/* routes, behind the API key
│   │
│   ├── controllers/
│   │   └── enquiryController.js   Request handling: create, list, get, update, delete, stats, CSV
│   │
│   ├── middleware/
│   │   ├── validateEnquiry.js     Field validation + normalisation → clean payload or 422
│   │   ├── apiKey.js              Constant-time API key check for admin routes
│   │   └── errorHandler.js        404 handler and the single JSON error formatter
│   │
│   ├── services/
│   │   ├── store.js               JSON-file storage: atomic writes, write queue, list/search/stats
│   │   └── mailer.js              Nodemailer transport + the HTML/text notification email
│   │
│   └── utils/
│       ├── logger.js              Timestamped console logger
│       ├── httpError.js           Error class carrying status, code and field details
│       └── asyncHandler.js        Forwards rejected promises to the error handler
│
├── scripts/
│   └── smoke-test.js              End-to-end test of every endpoint
│
└── data/
    └── enquiries.json             Created automatically on the first submission
```

**No database server required.** `src/services/store.js` is the only file that
touches storage, so moving to SQLite or Postgres later means rewriting that one
file — the controllers and routes stay exactly as they are.

---

## 7. Deployment

### Render / Railway / Fly.io (easiest)

1. Push the `backend/` folder to a Git repository
2. Create a new **Web Service** and point it at that repo
3. Build command: `npm install` · Start command: `npm start`
4. Add every variable from `.env` in the dashboard's **Environment** section,
   with `NODE_ENV=production` and a strong `ADMIN_API_KEY`
5. Set `CORS_ORIGIN` to your real site origin, e.g.
   `https://jymculture.com,https://www.jymculture.com`
6. Deploy, then confirm `https://your-app.onrender.com/api/health` returns `"status": "ok"`

### Docker

```bash
docker build -t jym-culture-backend .
docker run -d -p 5000:5000 \
  --env-file .env \
  -v "$(pwd)/data:/app/data" \
  --name jym-backend \
  jym-culture-backend
```

The `-v` volume is important — without it, enquiries are lost when the container
is replaced.

### A plain VPS (systemd)

```ini
# /etc/systemd/system/jym-backend.service
[Unit]
Description=JYM Culture enquiry API
After=network.target

[Service]
WorkingDirectory=/var/www/jym-culture/backend
ExecStart=/usr/bin/node server.js
Restart=always
User=www-data
EnvironmentFile=/var/www/jym-culture/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now jym-backend
```

Put Nginx or Caddy in front for HTTPS, and keep the Node port closed to the
public internet.

### After deploying — checklist

- [ ] `ADMIN_API_KEY` changed from the placeholder to a long random value
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN` limited to your real domain(s), not `*`
- [ ] `MAIL_TO` set to the gym's inbox
- [ ] `/api/health` reports `email.configured: true`
- [ ] A test submission arrives in the inbox
- [ ] `data/` sits on persistent storage (a mounted volume), not the container's
      ephemeral filesystem
- [ ] Update `window.JYM_API_BASE` in `contact.html` to the deployed URL

---

## 8. Troubleshooting

**`Invalid login: 535-5.7.8 Username and Password not accepted`**
You are using the account password. Create a Gmail **App Password** (section 2).

**Emails never arrive**
Check `GET /api/health` → `email.configured`. If it is `false`, one of
`EMAIL_ENABLED`, `SMTP_HOST`, `SMTP_USER` or `SMTP_PASS` is missing. Then check the
stored record's `mailError` field, and look for the `Could not send notification`
line in the console.

**CORS error in the browser**
Set `CORS_ORIGIN` to the exact origin shown in the browser console — scheme and
host, no trailing slash. `*` allows everything and is fine for testing.

**Admin routes return 503**
`ADMIN_API_KEY` is empty. Set it and restart.

**Everything returns 500 after a crash**
The data file may be corrupt. The store parks a bad file as
`enquiries.json.corrupt-<timestamp>` and starts fresh rather than deleting your
data — inspect that file to recover anything important.

**Port already in use**
Change `PORT` in `.env`, or stop the other process:
`lsof -i :5000` then `kill <pid>`.

---

## 9. Security notes

Built in already:

- Admin routes require the API key, compared with `crypto.timingSafeEqual`
- Body size capped at 32 kB; unknown fields are dropped, never stored
- All user input is HTML-escaped before it goes into the notification email
- A hidden honeypot field silently rejects simple bots
- Internal error detail is hidden when `NODE_ENV=production`
- `.env` and the real data file are git-ignored

Worth adding for a public production launch:

- **Rate limiting** on `POST /api/enquiries` (e.g. 5 requests per IP per 10 minutes)
  so the form cannot be spammed — `express-rate-limit` is a two-line addition
- Serve the API over **HTTPS** only
- If you build an admin UI, put it behind real login rather than a bare API key
- Back up `data/enquiries.json` on a schedule (or migrate to SQLite/Postgres)
- Consider a CAPTCHA (hCaptcha / reCAPTCHA) if spam does get through

---

## License

MIT — written for JYM CULTURE GYM & SPA, Ambala.
