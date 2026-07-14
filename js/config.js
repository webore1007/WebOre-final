/**
 * WebOre front-end config.
 *
 * The backend now runs entirely as Netlify Functions deployed alongside
 * this site (see netlify/functions/), reached at /.netlify/functions/...
 * on the same origin — so this stays an empty string for a normal Netlify
 * deploy, no separate server to point at.
 *
 * If you ever host these HTML files somewhere other than Netlify while
 * still using Netlify Functions for the backend, put that Netlify site's
 * full URL here instead, e.g. "https://your-site.netlify.app"
 */
const API_BASE = "";

/**
 * Social login setup — fill these in to turn on "Continue with Google / Facebook".
 * Until you do, the buttons show a friendly message instead of failing silently.
 *
 * Google:   Google Cloud Console → APIs & Services → Credentials → Create OAuth
 *           client ID (Web application) → add your site's URL under
 *           "Authorized JavaScript origins" → paste the Client ID below
 *           (or, easier, paste it into Admin → Settings → "Google Client ID"
 *           once the site is running — no file editing needed).
 *
 * Facebook: developers.facebook.com → My Apps → Create App → Consumer →
 *           add "Facebook Login" product → Settings → Basic → App ID below
 *           (or, easier, paste it into Admin → Settings → "Facebook App ID").
 *           Add your site's URL under Facebook Login → Settings → Valid OAuth
 *           Redirect URIs / Allowed Domains.
 *
 * These two act only as a fallback — if the admin panel's Settings page has
 * values saved, those win (see js/main.js's loadPublicSettings()).
 */
const GOOGLE_CLIENT_ID = "";
const FACEBOOK_APP_ID = "";
