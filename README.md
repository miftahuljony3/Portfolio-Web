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

The live site is served by Cloudflare Workers (static assets); `npx wrangler deploy` publishes it.
Pushes to `main` also deploy the GitHub Pages copy via `.github/workflows/static.yml`.
