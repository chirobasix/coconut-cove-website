# Coconut Cove — Website

Pure HTML + CSS website for **Coconut Cove**, a waterfront seafood restaurant
in Surf City, NC. Built for maximum speed (zero frameworks, zero build step)
with a small amount of vanilla JS for the mobile menu, lunch/dinner toggle,
contact form, and live music calendar sync.

```
418 Roland Ave · Surf City, NC 28445 · (910) 752-6780
coconutcovesurfcity@gmail.com · Open 11am–11pm daily
```

## Pages

| File | Path | What it is |
|---|---|---|
| `index.html`       | `/`              | Landing — hero collage, hooked-today, weekend music, visit teaser |
| `menu.html`        | `/menu`          | Full lunch & dinner menu with lunch/dinner toggle |
| `live-music.html`  | `/live-music`    | Calendar grid, up-next card, full upcoming list, subscribe links |
| `visit.html`       | `/visit`         | Map, hours, fact cards, contact form |

## Stack

- **Pure HTML + CSS** — no React, no build step, no bundler
- **Vanilla JS** (~10 KB total across 4 small files) for the modal, nav toggle, lunch/dinner switch, contact mailto, and live calendar sync
- **Custom fonts:** Warung Kopi (display), Sunday April (script), Montserrat (body, via Google Fonts)
- **Schema.org JSON-LD** on every page (`Restaurant`, `Menu`, `EventSeries`, `WebSite`)

## Quickstart (local preview)

Any static file server will do:

```sh
# Python
python3 -m http.server 8080

# Node
npx serve .

# Or just open index.html in your browser
```

Then visit `http://localhost:8080`.

## Deploy to Cloudflare Pages

This site is built to drop straight into Cloudflare Pages with zero config.

1. Push this repo to GitHub (see below).
2. Go to **Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git**.
3. Pick the `coconut-cove-website` repo.
4. **Build settings:**
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/`
5. Click **Save and Deploy**. First deploy takes ~30 seconds.
6. (Optional) Add a custom domain in **Pages → Custom domains**. Cloudflare handles the TLS cert automatically.

Every push to `main` triggers a new production deploy. Preview deploys are
created automatically for every PR.

**After your domain is live**, find-and-replace `https://coconutcovesurfcity.com`
across the site with your real domain (it appears in canonical URLs, OG tags,
JSON-LD, sitemap, and robots.txt). Cmd-shift-F in your editor handles it in
about 10 seconds.

## SEO checklist — what's already in place

- [x] **Title + meta description** on every page (location-keyed for local SEO)
- [x] **Canonical URLs** on every page
- [x] **Open Graph + Twitter Card** for clean social link previews
- [x] **Schema.org JSON-LD** — `Restaurant` (with address, geo, hours, cuisine, telephone), `Menu` (with items + prices), `EventSeries` (live music)
- [x] **Semantic HTML** — proper `<header>`, `<nav>`, `<main>`, `<section>`, `<address>`, headings hierarchy
- [x] **Alt text** on every meaningful image
- [x] **`sitemap.xml`** and **`robots.txt`** at the root
- [x] **Mobile-first responsive** (one breakpoint at 900px, another at 600px)
- [x] **Skip-to-content link** for accessibility
- [x] **Font preload + `font-display: swap`** for fast first paint
- [x] **`fetchpriority="high"`** on the hero logo
- [x] **`loading="lazy"`** on below-the-fold images
- [x] **`preconnect`** to fonts.googleapis.com and fonts.gstatic.com
- [x] **NAP consistency** (Name/Address/Phone identical everywhere — Google's #1 local-SEO signal)
- [x] **`tel:` and `mailto:` links** so phones dial directly
- [x] **Google Maps embed** + outbound link to Maps listing
- [x] **No render-blocking scripts** (all JS uses `defer`)

### After-launch steps (you do these)

1. **Google Business Profile** — claim/verify at <https://business.google.com>. Match the address/phone/hours exactly to what's on the site. This is the single biggest local-SEO lever.
2. **Google Search Console** — add and verify the property at <https://search.google.com/search-console>, then submit `sitemap.xml`.
3. **Bing Webmaster Tools** — same drill at <https://www.bing.com/webmasters>.
4. **Local citations** — make sure the NAP (Name, Address, Phone) is identical on Yelp, TripAdvisor, OpenTable, Topsail Island tourism sites, etc.
5. **Reviews** — ask happy regulars to leave a Google review. Volume + recency are huge ranking signals for "restaurants near me".

## Optional config

### Live Music — Google Calendar API key

`assets/js/live-music.js` syncs with the public Google Calendar at
`coconutcovesurfcity@gmail.com`. Out of the box it uses public CORS proxies
to read the calendar's `.ics` feed — fine for previews, less reliable in
production.

For a faster, more stable production setup:

1. Go to <https://console.cloud.google.com> → create a project.
2. Enable the **Google Calendar API**.
3. Create an **API key**, restricted to the Calendar API (read-only).
4. Open `assets/js/live-music.js`, find `GCAL_API_KEY = ''`, paste the key.

The page will automatically prefer the direct API path once the key is set.

### Contact form

The form on the Visit page submits to **[Web3Forms](https://web3forms.com)**,
which forwards each submission to `coconutcovesurfcity@gmail.com`.

- **Access key** is hard-coded in `visit.html` as a hidden `<input>`.
  Web3Forms keys are designed to be public — they only authorize *which
  inbox* receives the message; they can't be used to read anything.
- **Honeypot** field (`name="botcheck"`) is included to block basic
  spam bots. Real users never see it.
- **mailto: fallback** — if the network call to Web3Forms fails for any
  reason, the form falls back to opening the visitor's email client
  pre-filled, so the message still reaches us.
- **Free tier** is 250 submissions/month. Upgrade at
  <https://web3forms.com> if needed.

To swap the key (e.g. if you rotate it), edit one line at the top of
the form in `visit.html`:

```html
<input type="hidden" name="access_key" value="YOUR-KEY-HERE">
```

## File map

```
coconut-cove-website/
├── index.html                  # Home
├── menu.html                   # Menu
├── live-music.html             # Live Music (with calendar sync)
├── visit.html                  # Visit (map, hours, contact)
├── sitemap.xml
├── robots.txt
├── README.md
├── .gitignore
└── assets/
    ├── css/
    │   └── styles.css          # All styles, one file
    ├── js/
    │   ├── site.js             # Nav, modal, mobile menu (loaded on every page)
    │   ├── menu.js             # Lunch/Dinner toggle
    │   ├── visit.js            # Contact form mailto handler
    │   └── live-music.js       # Calendar render + Google Calendar sync
    ├── fonts/                  # Warung Kopi, Sunday April
    ├── images/                 # Logos, decorative drinks
    └── photos/                 # Restaurant photography
```

## Performance budget

- **First page load:** under 200 KB (including fonts, photos, JS, CSS)
- **HTTP requests:** ~15 per page on first visit (one CSS, one JS, a handful of images, font files)
- **Time to interactive:** sub-1s on a fast connection; sub-2s on 3G
- **Lighthouse target:** 95+ across Performance, Accessibility, Best Practices, SEO

## Brand voice (for any new copy)

Unhurried, lightly playful, coastal-confident. No emoji in marketing copy.
Avoid "paradise" / "experience" / "farm-to-table" language. Brand tokens
live in `assets/css/styles.css` (`:root { --cc-teal: ...; }`).
