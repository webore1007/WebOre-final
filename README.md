# WebOre website — Netlify edition

Plain HTML, CSS, and JavaScript frontend, backed entirely by **Netlify
Functions**. There is no separate Node/Express server anymore, and nothing
else to deploy or host — `netlify deploy` (or a Git-connected Netlify site)
is the whole story.

## What's in here

```
netlify/functions/     The backend — one Netlify Function per API route group
  utils/                Shared code used by every function (auth, data
                         storage, HTTP helpers, multipart parsing, etc.)
index.html              Home
about.html               About
services.html            Services & pricing
portfolio.html            Portfolio (managed from the admin panel)
blog.html                  Blog listing (managed from the admin panel)
blog-post.html              Single blog post
contact.html                Contact form
login.html                   Client login (+ Google/Facebook)
signup.html                   Client signup (+ Google/Facebook)
dashboard.html                 Logged-in client area
admin.html                      Internal admin area — Dashboard, Projects,
                                 Users, Pages, Portfolio, Messages, Media,
                                 Blog, Analytics, Settings, Security, Deploy
legal/                   Privacy, Terms, Cookies, Refunds, Payment, Revisions,
                          Support, Project Scope, Copyright, Disclaimer
css/style.css             All styling — one file, plain CSS
js/                        Plain JavaScript — one small file per job
netlify.toml                Netlify site configuration
package.json                 Root dependencies for the Functions
.env.example                  Environment variables to copy into Netlify
```

## How it works now

- **Frontend**: unchanged static files, deployed as Netlify's "publish"
  directory (the project root).
- **Backend**: every route the old `server/routes/*.js` Express files
  handled is now its own file in `netlify/functions/`, deployed
  automatically by Netlify as a serverless function reachable at
  `/.netlify/functions/<name>`.
- **Database**: the old `node:sqlite` file database is gone (a local file
  can't survive across serverless invocations) and has been replaced with
  **Netlify Blobs** — Netlify's own built-in key/value store. No external
  database service, connection string, or account to set up; it works
  automatically both when deployed and when running `netlify dev` locally.
- **File uploads** (the admin Media Library) are stored the same way, in
  Netlify Blobs, and served back out through a small `uploads` function so
  `/uploads/<filename>` URLs keep working exactly as before.

## Deploying

1. Push this project to a Git repository (GitHub/GitLab/Bitbucket) and
   "Import an existing project" in Netlify, **or** deploy straight from
   your machine with `npx netlify deploy --prod` after running
   `npx netlify init` once.
2. In Netlify → Site configuration → Environment variables, set at least
   `JWT_SECRET` (see `.env.example` for the full list — social login is
   optional and can also be configured entirely from Admin → Settings
   after your first deploy).
3. Netlify reads `netlify.toml` automatically: it runs `npm install` at
   the project root, publishes the static files, and deploys everything
   in `netlify/functions/` as Functions. There is nothing else to
   configure — no Render/Railway/other backend host involved anywhere.
4. On first request, the very first Function invocation seeds a default
   admin account automatically (see below) — there's no manual database
   setup step.

The default admin account is **admin@webore.com** / **Admin@123** — **log
in and change this password right away** under Admin → Security. It's only
ever printed once to that function's own logs (Netlify → Functions logs),
never shown on the public site.

### Running it locally

```
npm install
cp .env.example .env      # then open .env and set a real JWT_SECRET
npx netlify dev
```

`netlify dev` serves the static site *and* runs the Functions locally,
both on one local URL — there's nothing else to start.

## Turning on "Continue with Google" / "Continue with Facebook"

Unchanged from before — the buttons are already built into `login.html`
and `signup.html`; they just need your own app credentials.

**Easiest: paste them into the admin panel.** Log in to `/admin.html` →
**Settings** → "Social login", paste in your Client ID / App ID, and save.
This takes effect immediately, sitewide, with no file editing or redeploy.

**Or set them as Netlify environment variables** (`GOOGLE_CLIENT_ID`,
`FACEBOOK_APP_ID` — see `.env.example`) as a fallback the first time the
site seeds its settings; the Settings panel's values always take priority
once set.

**Google**
1. Go to the Google Cloud Console → APIs & Services → Credentials.
2. Create an OAuth Client ID, type "Web application".
3. Add your deployed site's URL under "Authorized JavaScript origins".
4. Paste the Client ID into Admin → Settings (or the `GOOGLE_CLIENT_ID`
   environment variable).

**Facebook**
1. Go to developers.facebook.com → My Apps → Create App → Consumer.
2. Add the "Facebook Login" product, and add your site's URL under its
   settings.
3. Paste the App ID into Admin → Settings (or the `FACEBOOK_APP_ID`
   environment variable).

Until these are filled in, the buttons show a friendly "not set up yet"
message instead of failing silently.

## Mobile performance fix

The theme, colors, and layout are unchanged — but a few of the visual
effects were expensive for a phone's GPU to keep redrawing, which was the
main cause of scroll/interaction lag on mobile:

- `backdrop-filter: blur(...)` on glass cards, pills, and the hero form —
  one of the single most expensive things to ask a mobile browser to
  animate/repaint. On phones (max-width: 860px, or any touch/coarse
  pointer device) these now fall back to a solid, slightly translucent
  dark background instead of a live blur — it reads the same at a glance,
  it just isn't recalculated every frame.
- The animated `hue-rotate` filter on the full-screen background artwork,
  and the ribbon "sway" animations underneath it, are frozen on mobile —
  the artwork still renders identically, it just stops drifting.
- The SVG grain/noise overlay (an `feTurbulence` filter, also expensive)
  is hidden on mobile.
- The floating particle field is thinned from 36 down to 12 elements on
  small screens (`js/main.js`), and its glow/animation speed is trimmed
  further as a CSS fallback.

All of this lives in one clearly-labeled "Mobile performance" section at
the bottom of `css/style.css`, plus a small tweak to `initParticles()` in
`js/main.js` — nothing about the desktop experience changed.

## File-by-file: what was created or changed

### Created — Netlify Functions (the new backend)
- **`netlify/functions/login.js`** — `POST` sign in. From
  `server/routes/auth.js`'s `/login`.
- **`netlify/functions/signup.js`** — `POST` create an account. From
  `server/routes/auth.js`'s `/signup`.
- **`netlify/functions/auth-me.js`** — `GET` the logged-in user. From
  `server/routes/auth.js`'s `/me`.
- **`netlify/functions/auth-google.js`** / **`auth-facebook.js`** — social
  sign-in. From `server/routes/auth.js`'s `/google` and `/facebook`.
- **`netlify/functions/contact.js`** — `POST` the contact form. From
  `server/routes/contact.js`.
- **`netlify/functions/dashboard.js`** — the logged-in client area:
  create a project request, list "mine", view one, and post messages on
  it. From `server/routes/projects.js`.
- **`netlify/functions/admin.js`** — everything under Admin except Blog
  and Media (stats, users, project requests, contact inbox, security,
  deploy status). From `server/routes/admin.js`.
- **`netlify/functions/media.js`** — the admin Media Library: list,
  upload (multipart), delete. From `server/routes/media.js`.
- **`netlify/functions/uploads.js`** — serves an uploaded file's bytes
  back out, replacing Express's `express.static("/uploads")`.
- **`netlify/functions/blog.js`** — public published posts *and* the
  admin blog editor, same as the original `server/routes/blog.js` handled
  both in one router.
- **`netlify/functions/pages.js`** — public page content + admin page
  editing. From `server/routes/pages.js`.
- **`netlify/functions/portfolio.js`** — public portfolio list + admin
  CRUD. From `server/routes/portfolio.js`.
- **`netlify/functions/settings.js`** — public safe settings + admin full
  settings read/write. From `server/routes/settings.js`.
- **`netlify/functions/analytics.js`** — pageview beacon + admin summary.
  From `server/routes/analytics.js`.

### Created — shared modules (`netlify/functions/utils/`)
Requirement 8 (no duplicated code) lives here — every function above
imports from these instead of re-implementing the same logic:
- **`http.js`** — JSON response helpers, CORS headers, safe body parsing,
  and `segments()`/`subPath()` for reading a function's sub-path (e.g.
  `admin/users/5` → `["users", "5"]`) since Netlify Functions don't have
  Express's routing.
- **`auth.js`** — JWT signing/verification and `requireAuth()`/
  `requireAdmin()` guards, adapted from `server/middleware/auth.js`.
- **`store.js`** — the Netlify Blobs data layer (replaces `server/db.js`):
  generic collection read/write, an auto-increment `nextId()`, and
  `ensureSeeded()` which seeds the default admin/settings/pages exactly
  once, the first time the site is ever used.
- **`oauth.js`** — shared "find or create" user lookup for Google/Facebook
  sign-in.
- **`login-history.js`** — records a login attempt, shared by `login.js`,
  `auth-google.js`, and `auth-facebook.js`.
- **`multipart.js`** — a small multipart/form-data parser, replacing
  `multer` (see below).

### Created — project configuration
- **`netlify.toml`** — tells Netlify where the static files and Functions
  live, to use the esbuild bundler (needed for the `import`/`export`
  syntax the functions use), and adds a redirect so uploaded media keeps
  its original `/uploads/<file>` URLs.
- **`package.json`** (root) — the dependencies the Functions need
  (`@netlify/blobs`, `bcryptjs`, `jsonwebtoken`); replaces
  `server/package.json`.
- **`.env.example`** (root) — replaces `server/.env.example`.
- **`.gitignore`** (root) — replaces `server/.gitignore`.

### Changed — frontend
- **`js/api.js`** — added a small router (`apiUrl()`) that maps the site's
  existing logical paths (e.g. `/auth/login`, `/admin/projects/5`) onto
  the matching `/.netlify/functions/...` URL. Every call already went
  through this file's `api()` helper, so this one change is what makes
  requirement 5 ("every fetch/axios call now hits `/.netlify/functions/`")
  true across the whole site without editing each page's logic.
- **`js/main.js`**, **`js/blog.js`**, **`js/blog-post.js`**,
  **`js/portfolio.js`**, **`js/admin.js`** — the handful of places that
  called `fetch()` directly (rather than through `api()`) now build their
  URL with the same `apiUrl()` helper. `js/admin.js`'s backup download
  filename also changed from `.db` to `.json` (see "Replaced packages"
  below — the backup is now a JSON export, not a raw database file).
  `js/main.js`'s `initParticles()` also got the mobile particle-count
  reduction described above.
- **`js/config.js`** — comment updated to describe the Netlify Functions
  backend instead of the old Express server; behavior unchanged.
- **`css/style.css`** — added the "Mobile performance" section described
  above; every existing rule is untouched.

### Removed
- **`server/`** (the entire Express app, its `node_modules`, and its
  SQLite database file) — no longer needed; every route now lives in
  `netlify/functions/`.

## Replaced packages (requirement 11: Netlify-incompatible → compatible)

| Old package / approach | Why it doesn't work on Netlify Functions | Replaced with |
|---|---|---|
| `node:sqlite` writing to a local `webore.db` file | Functions run in short-lived, isolated containers — a local file doesn't persist or get shared between invocations, so data would silently vanish. | **Netlify Blobs** (`@netlify/blobs`) — Netlify's own persistent key/value store, no extra service or credentials needed. |
| `multer` (disk-storage file uploads) | Needs a live Node request stream and a writable disk to save to — neither exists in a Function. | A small hand-written multipart parser (`utils/multipart.js`) reading the request body Netlify already hands the function, storing the file bytes in Netlify Blobs. |
| `express.static("/uploads")` | No Express app / static file server exists anymore. | `netlify/functions/uploads.js` reads the bytes back out of Blobs, plus a `netlify.toml` redirect so the URLs look identical. |
| `child_process.execSync("git ...")` for the admin "Deploy status" panel | Functions don't have the project's `.git` history bundled, and shelling out is unreliable in that environment. | Netlify's own runtime environment variables (`COMMIT_REF`, `BRANCH`, `CONTEXT`) which Netlify injects automatically. |
| Downloadable SQLite file backup | There's no single database file anymore. | A full JSON export of every stored collection, downloaded the same way from the same Security tab. |
| `cors` npm package | Simple to just set the handful of headers needed directly. | Manual headers in `utils/http.js`, applied to every response. |
| `dotenv` | Netlify injects environment variables into Functions automatically in production, and `netlify dev` auto-loads `.env` locally without needing the package inside the code. | Removed — not needed either way. |

`bcryptjs` and `jsonwebtoken` (pure JavaScript, no native/OS dependencies)
carried over unchanged — both work fine in Netlify Functions.

## Notes

- Netlify Blobs data isn't included in this project (there's nothing to
  commit) — it's created automatically the first time any Function runs
  after you deploy.
- Since collection writes are "read the whole array, modify it, write it
  back", very high concurrent write volume to the same collection could
  theoretically race — for this app's scale (an admin panel and a handful
  of forms) that's not a practical concern.
