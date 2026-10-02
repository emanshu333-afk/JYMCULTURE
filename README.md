# JYM CULTURE GYM & SPA — Full Source Code

Complete, editable source for the JYM Culture Gym & Spa website (Prem Nagar, Ambala):
a **static front-end** (HTML + CSS + JS, self-hosted fonts, works fully offline) plus a
**Node.js + Express backend** that receives the enquiry/booking form, stores submissions
and emails a notification to the gym.

Everything is included so you can run the site and the API on your own machine or server.

---

## 📁 Project structure

```
jym-culture-gym-full-source/
│
├── html/                     ← the 4 pages of the website
│   ├── index.html            Home: hero, stats, programs, Why JYM Culture, gallery,
│   │                         testimonials, Summer Offer pricing, timings, benefits,
│   │                         equipment, achievements, CTA
│   ├── services.html         Classes: program cards with expandable details, the weekly
│   │                         timetable, the Zumba 6 PM schedule and the offer packages
│   ├── about.html            About: gym story, the "Our Story" founder block
│   │                         (Dr. Sameer Bernard), stats, trainers, achievements
│   └── contact.html          Contact: address, phone, email, timings, working days,
│                             spa note, the enquiry/booking form and the Google Map
│
├── css/
│   ├── styles.css            All site styling — the black + purple + white theme,
│   │                         layout, components, animations and every mobile
│   │                         breakpoint. Theme colours live in the :root variables
│   │                         at the top of the file.
│   └── fonts.css             Self-hosted @font-face rules for Anton + Barlow
│                             (points at ../fonts/*.woff2). No Google Fonts CDN.
│
├── js/
│   └── script.js             All front-end interactivity: mobile nav, header scroll
│                             effect, scroll-reveal, animated stat counters, testimonial
│                             slider, image lightbox, expandable class cards, plan
│                             deep-linking, and the enquiry-form validation + POST.
│
├── images/                   The 4 gym photographs (each used in its own section)
│   ├── gym2.jpeg             Hero image + page-hero backgrounds
│   ├── gym3.jpeg             "Why JYM Culture" split section (Home)
│   ├── gym4.jpeg             "Inside The Gym" section (Home)
│   └── gym5.jpeg             "Our Story" split section (About)
│
├── fonts/                    Anton + Barlow as .woff2 (latin, latin-ext, vietnamese
│                             subsets) — self-hosted so the site needs no internet
│
├── favicon.svg               Purple "J" monogram shown in the browser tab
│
├── backend/                  The API (see its own README.md for full detail)
│   ├── server.js             Entry point: Express app, CORS, routes, static-serving
│   ├── package.json          Dependencies (express, cors, nodemailer, dotenv) + scripts
│   ├── package-lock.json     Locked dependency versions
│   ├── .env.example          Config template — copy to .env and fill in
│   ├── .gitignore            Keeps .env, node_modules and real data out of git
│   ├── Dockerfile            Production container image
│   ├── .dockerignore
│   ├── README.md             Backend docs: install, .env, API reference, deployment
│   ├── src/
│   │   ├── config/index.js           Reads .env once; all settings flow from here
│   │   ├── routes/enquiryRoutes.js   Public POST + admin GET  (/api/enquiries)
│   │   ├── routes/adminRoutes.js     All /api/admin/* routes (API-key protected)
│   │   ├── controllers/enquiryController.js   Create, list, get, update, delete, stats, CSV
│   │   ├── middleware/validateEnquiry.js      Field validation + normalisation
│   │   ├── middleware/apiKey.js               Constant-time API-key check
│   │   ├── middleware/errorHandler.js         404 handler + JSON error formatter
│   │   ├── services/store.js                  JSON-file storage (atomic writes, search)
│   │   ├── services/mailer.js                 Nodemailer transport + notification email
│   │   └── utils/                             logger, httpError, asyncHandler
│   ├── scripts/smoke-test.js End-to-end test of every endpoint  (npm run smoke)
│   └── data/                 Enquiry storage (enquiries.json is created at runtime)
│
└── README.md                 ← this file
```

---

## 🖥️ Run the front-end

The front-end is pure HTML/CSS/JS — no build step, no dependencies.

### Option A — just open it (simplest)

Open the `html/` folder and **double-click `index.html`**. The relative paths
(`../css/…`, `../js/…`, `../images/…`) resolve correctly, so the whole site —
styling, fonts, photos, sliders, the lightbox — works straight from the file system.

> The only thing that needs internet is the Google Map on the Contact page (an
> embedded iframe). Everything else is fully offline, including the fonts, because
> Anton and Barlow are self-hosted in `fonts/`.

### Option B — serve it over HTTP (recommended when testing the form)

Because the pages reach their assets through `../`, start the server from the
**project root**, not from inside `html/`:

```bash
# from the jym-culture-gym-full-source folder
python3 -m http.server 8080
#   → open http://localhost:8080/html/index.html

# or, with Node installed:
npx serve .
```

Use Option B when you want the enquiry form to talk to a locally running backend —
browsers are stricter about cross-origin requests from `file://` origins.

---

## ⚙️ Run the backend

```bash
cd backend
npm install
cp .env.example .env      # then edit .env
npm start                 # → http://localhost:5000
```

Check it is alive:

```bash
curl http://localhost:5000/api/health
```

**Test everything at once (15 checks: create, validate, auth, list, update, delete):**

```bash
npm run smoke
```

The server works out of the box: with `EMAIL_ENABLED=false` it still validates and
stores every submission — it simply skips the email step. To turn email on, set
`EMAIL_ENABLED=true` plus `SMTP_USER` and a Gmail **App Password** in `SMTP_PASS`
(not your normal Gmail password), with `MAIL_TO=emanshu001@gmail.com`.
Full details, the API reference and deployment instructions are in
**`backend/README.md`**.

---

## 🔗 How the two connect — `JYM_API_BASE`

The front-end knows where the API lives through one variable, declared in the
`<head>` of **`html/contact.html`**:

```html
<script>
  window.JYM_API_BASE = "http://localhost:5000";
</script>
```

- **Local development** — leave it as `http://localhost:5000` and run the backend
  with `npm start`.
- **Production** — change it to your deployed API URL, e.g.
  `window.JYM_API_BASE = "https://jym-culture-api.onrender.com";`
- **Same origin** — if you set `STATIC_DIR` in the backend's `.env` so the API also
  serves the website, set it to `""` (an empty string) so the form posts to its own
  origin.

When the form is submitted, `js/script.js` sends a JSON `POST` to
`{JYM_API_BASE}/api/enquiries` with the name, phone, email, program/interest,
selected plan, preferred time, message and free-trial flag. The page then shows a
real success message with the reference ID returned by the API, or a red error
banner with the server's field messages — and a "call 9996224486" fallback if the
API cannot be reached at all.

---

## 🎨 Changing the theme

Every colour is a CSS variable at the top of `css/styles.css`:

```css
:root {
  --bg: …;           /* page background       */
  --bg-2: …;         /* alternate section bg  */
  --accent: #8b5cf6; /* primary purple        */
  --accent-2: …;     /* light purple highlight*/
  --text: …;         /* body text             */
}
```

Edit those values and the whole site repaints — buttons, eyebrows, borders, the
marquee, badges and the CTA band all derive from them.

---

## 🌐 Publishing

- **Front-end** — upload the contents of `html/`, `css/`, `js/`, `images/`, `fonts/`
  and `favicon.svg` to any static host (Netlify, Vercel, GitHub Pages, cPanel,
  S3/CloudFront, nginx). Keep the folder names exactly as they are, because the
  pages reference `../css/`, `../js/` and `../images/`.
- **Backend** — deploy `backend/` to Render, Railway, Fly.io, a VPS or Docker
  (`Dockerfile` included). Then point `window.JYM_API_BASE` at the public URL and
  add that site's domain to `CORS_ORIGIN` in the backend `.env`.

---

## 🔒 Notes

- **Never commit `.env`** — it is already listed in `backend/.gitignore`.
- **Change `ADMIN_API_KEY`** to a long random string before deploying; it protects
  every `/api/admin/*` route.
- `backend/data/enquiries.json` is runtime data and is not shipped in this archive;
  the backend creates it on the first submission (the empty `data/` folder and its
  `.gitkeep` are included so the directory exists).
- `node_modules/` is intentionally excluded — run `npm install` in `backend/` to
  restore dependencies.
