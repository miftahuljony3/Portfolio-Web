# Portfolio-Web

Personal portfolio of **Miftahul Jony**, full-stack developer. Live at **https://mjony3.com**.

A dependency-free static site (HTML, CSS, vanilla JS) with light/dark themes, responsive
layout, accessible navigation and SEO metadata.

## Structure

```
index.html                       Home page (hero art, work, about, principles, skills, process, contact)
case-studies/bpda-smart-app.html BPDA Telemedicine case study
css/style.css                    All styles (theme tokens at the top)
js/script.js                     Theme toggle, mobile nav, scroll effects
assets/work/                     Product screenshots (WebP)
404.html, favicon.svg, robots.txt, sitemap.xml, CNAME
```

## Local preview

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deployment

Production (`https://mjony3.com`) runs on **Cloudflare Workers static assets** and deploys
automatically on every push to `main` via `.github/workflows/deploy-cloudflare.yml`.

The workflow runs [`scripts/redeploy.sh`](scripts/redeploy.sh), a zero-downtime pipeline:

1. **Preflight**: required files, JS syntax and HTML structure are validated before upload
2. **Upload**: a new Worker version is created but does not serve traffic yet
3. **Canary**: 10% of traffic goes to the new version, 90% stays on the current one
4. **Smoke test**: key pages are requested *pinned to the new version*
   (`Cloudflare-Workers-Version-Overrides` header), then re-checked after a short soak
5. **Promote**: 100% of traffic moves to the new version
6. **Verify**: production is re-checked; any failure after upload restores the previous version automatically

Manual runs: **Actions → Deploy to Cloudflare → Run workflow** (custom canary % and soak time).

Local deploy or dry run:

```bash
DRY_RUN=1 scripts/redeploy.sh                              # checks + plan only
CLOUDFLARE_API_TOKEN=... scripts/redeploy.sh               # full canary deploy
```

Instant manual rollback: `npx wrangler versions deploy <previous-version-id>@100% -y`
(the previous ID is printed in each run's job summary).

Required repository secret: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit).

A copy is also published to GitHub Pages by `.github/workflows/static.yml`.
