#!/usr/bin/env python3
"""Site build: fingerprint CSS/JS URLs, then generate the Bangla page.

CSS and JS are served with a one-year immutable cache (see _headers), so every
HTML reference carries ?v=<content-hash>. Any change to a file changes its URL,
which makes browsers fetch the new version immediately after a deploy.

  python3 scripts/build.py          stamp + build bn/index.html
  python3 scripts/build.py --check  exit 1 if anything is stale (used by redeploy.sh)
"""
import hashlib
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ["css/style.css", "js/script.js", "js/theme.js"]
PAGES = ["index.html", "case-studies/bpda-smart-app.html", "404.html"]


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()[:10]


def stamped(html):
    for asset in ASSETS:
        pattern = re.compile(r'((?:\.\./|/)?' + re.escape(asset) + r')(\?v=[0-9a-f]+)?"')
        html = pattern.sub(lambda m, a=asset: f'{m.group(1)}?v={digest(a)}"', html)
    return html


def main():
    check = "--check" in sys.argv
    stale = []
    for page in PAGES:
        path = ROOT / page
        current = path.read_text(encoding="utf-8")
        new = stamped(current)
        if new != current:
            stale.append(page)
            if not check:
                path.write_text(new, encoding="utf-8")
    bn = subprocess.run([sys.executable, str(ROOT / "scripts/build-bn.py")] + (["--check"] if check else []),
                        capture_output=True, text=True)
    if bn.returncode != 0:
        stale.append("bn/index.html")
    if check:
        if stale:
            print("stale build output: " + ", ".join(stale) + " (run: python3 scripts/build.py)", file=sys.stderr)
            return 1
        print("build is up to date")
        return 0
    print(("stamped: " + ", ".join(stale)) if stale else "asset stamps already current")
    print(bn.stdout.strip())
    return bn.returncode


if __name__ == "__main__":
    sys.exit(main())
