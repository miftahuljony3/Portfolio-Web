#!/usr/bin/env python3
"""Generate the Bangla site (bn/index.html) from index.html + i18n/bn.json.

index.html stays the single source of truth for structure; this script only
swaps visible text and a few attributes, so layout changes flow into the
Bangla page automatically.

  python3 scripts/build-bn.py           build bn/index.html
  python3 scripts/build-bn.py --check   exit 1 if bn/index.html is stale
  python3 scripts/build-bn.py --report  list English text still untranslated
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "index.html"
OUT = ROOT / "bn" / "index.html"
DICT = ROOT / "i18n" / "bn.json"
SITE = "https://mjony3.com"

TRANSLATABLE_ATTRS = ("alt", "aria-label", "placeholder", "title", "data-label")
# Text inside these elements is code/art and must never be translated
PROTECTED = re.compile(r"(?s)(<(pre|script|style|svg|code)\b.*?</\2>)")

PRELOAD_EN = (
    '  <link rel="preload" href="fonts/inter-latin-3100e775e8.woff2" as="font" type="font/woff2" crossorigin>\n'
    '  <link rel="preload" href="fonts/instrument-serif-latin-5a51946dff.woff2" as="font" type="font/woff2" crossorigin>'
)
PRELOAD_BN = (
    '  <link rel="preload" href="fonts/anek-bangla-bengali-418c763509.woff2" as="font" type="font/woff2" crossorigin>\n'
    '  <link rel="preload" href="fonts/hind-siliguri-bengali-8ae56aab76.woff2" as="font" type="font/woff2" crossorigin>'
)
SWITCH_EN = '<a class="lang-switch" href="bn/" hreflang="bn"><span class="is-on" lang="en">EN</span><span lang="bn">বাং</span><span class="sr-only"> (বাংলা সংস্করণ)</span></a>'
SWITCH_BN = '<a class="lang-switch" href="../" hreflang="en"><span lang="en">EN</span><span class="is-on" lang="bn">বাং</span><span class="sr-only" lang="en"> (English version)</span></a>'


def norm(text):
    return " ".join(text.split())


def load():
    data = json.loads(DICT.read_text(encoding="utf-8"))
    return data["_meta"], data["text"], data["attr"]


def translate_text_segments(html, table, missing):
    """Replace text between tags when its normalised form is in the table."""
    def repl(match):
        raw = match.group(1)
        key = norm(raw)
        if not key:
            return match.group(0)
        if key in table:
            lead = raw[: len(raw) - len(raw.lstrip())]
            trail = raw[len(raw.rstrip()):]
            value = table[key]
            # a translation may carry its own leading space (Bangla word order); avoid doubling
            if lead and value.startswith(" "):
                value = value.lstrip()
            return ">" + lead + value + trail + "<"
        if re.search(r"[A-Za-z]{3,}.*\s.*[A-Za-z]{3,}", key):
            missing.add(key)
        return match.group(0)

    return re.sub(r">([^<>]+)<", repl, html)


def build():
    meta, text, attrs = load()
    src = SRC.read_text(encoding="utf-8")
    missing = set()

    head_end = src.index("</head>")
    head, body = src[:head_end], src[head_end:]

    # ---- body: translate text outside protected blocks ----
    # re.split with two groups yields [text, block, tagname, text, block, tagname, ..., text]
    parts = PROTECTED.split(body)
    out = []
    for idx in range(0, len(parts), 3):
        out.append(translate_text_segments(parts[idx], text, missing))
        if idx + 1 < len(parts):
            out.append(parts[idx + 1])
    body = "".join(out)

    def attr_repl(m):
        name, val = m.group(1), m.group(2)
        return f'{name}="{attrs.get(val, val)}"'
    body = re.sub(r'\b(' + "|".join(TRANSLATABLE_ATTRS) + r')="([^"]*)"', attr_repl, body)

    if SWITCH_EN not in body:
        raise SystemExit("language switch markup not found in index.html")
    body = body.replace(SWITCH_EN, SWITCH_BN)

    # ---- head ----
    head = head.replace('<html lang="en">', '<html lang="bn">')
    head = re.sub(r"<title>.*?</title>", f"<title>{meta['title']}</title>", head, flags=re.S)
    head = re.sub(r'(<meta name="description" content=")[^"]*(")', rf'\g<1>{meta["description"]}\g<2>', head)
    head = re.sub(r'(<meta property="og:title" content=")[^"]*(")', rf'\g<1>{meta["og_title"]}\g<2>', head)
    head = re.sub(r'(<meta property="og:description" content=")[^"]*(")', rf'\g<1>{meta["og_description"]}\g<2>', head)
    head = head.replace(f'<meta property="og:url" content="{SITE}/">', f'<meta property="og:url" content="{SITE}/bn/">')
    head = head.replace(f'<link rel="canonical" href="{SITE}/">', f'<link rel="canonical" href="{SITE}/bn/">')
    head = head.replace('<meta property="og:type" content="website">',
                        '<meta property="og:type" content="website">\n  <meta property="og:locale" content="bn_BD">')
    if PRELOAD_EN not in head:
        raise SystemExit("font preload block not found in index.html head")
    head = head.replace(PRELOAD_EN, PRELOAD_BN)

    html = head + body

    # ---- relative URLs → one level up (href, src and every srcset candidate) ----
    def fix_srcset(m):
        parts = []
        for cand in m.group(1).split(","):
            cand = cand.strip()
            if cand and not re.match(r"(https?:|/|data:|\.\./)", cand):
                cand = "../" + cand
            parts.append(cand)
        return 'srcset="' + ", ".join(parts) + '"'
    html = re.sub(r'srcset="([^"]+)"', fix_srcset, html)
    html = re.sub(
        r'\b(href|src)="(?!https?:|#|/|mailto:|tel:|data:|\.\./)([^"]+)"',
        r'\1="../\2"', html)

    # footer language link must point back to English on the Bangla page
    html = html.replace('<a href="../bn/" hreflang="bn" lang="bn">English version</a>',
                        '<a href="../" hreflang="en" lang="en">English version</a>')

    header = "<!-- Generated by scripts/build-bn.py from index.html + i18n/bn.json. Do not edit by hand. -->\n"
    html = html.replace("<!DOCTYPE html>\n", "<!DOCTYPE html>\n" + header, 1)
    return html, missing


def main():
    html, missing = build()
    if "--report" in sys.argv:
        for m in sorted(missing):
            print("UNTRANSLATED:", m)
        print(f"{len(missing)} untranslated fragment(s)")
        return 0
    if "--check" in sys.argv:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != html:
            print("bn/index.html is stale: run python3 scripts/build-bn.py", file=sys.stderr)
            return 1
        print("bn/index.html is up to date")
        return 0
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(html):,} bytes); {len(missing)} untranslated fragment(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
