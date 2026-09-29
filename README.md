# Portfolio-Web

Personal portfolio of **Miftahul Jony**, full-stack developer. Live at **https://mjony3.com**.

A dependency-free static site (HTML, CSS, vanilla JS) with light/dark themes, responsive
layout, accessible navigation and SEO metadata.

## Structure

```
index.html                       Home page (hero, about, skills, work, process, contact)
case-studies/bpda-smart-app.html BPDA Telemedicine case study
css/style.css                    All styles (theme tokens at the top)
js/script.js                     Theme toggle, mobile nav, scroll effects
404.html, favicon.svg, robots.txt, sitemap.xml, CNAME
```

## Local preview

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deployment

Every push to `main` deploys to GitHub Pages via `.github/workflows/static.yml`.
The custom domain `mjony3.com` is set in **Settings → Pages → Custom domain** (and in `CNAME`).
