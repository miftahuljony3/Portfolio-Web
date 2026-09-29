#!/usr/bin/env bash
# =============================================================================
# redeploy.sh — zero-downtime deploy of mjony3.com to Cloudflare Workers
#
#   1. Preflight   validate files and JS syntax before anything is uploaded
#   2. Upload      create a new Worker version (assets included), not yet live
#   3. Canary      route CANARY_PERCENT of traffic to it; the rest stays on the
#                  current version, so visitors never see a gap
#   4. Smoke test  request key pages pinned to the new version via the
#                  Cloudflare-Workers-Version-Overrides header
#   5. Promote     send 100% of traffic to the new version
#   6. Verify      re-check production; on any failure after step 2 the script
#                  restores the previous version at 100% and exits non-zero
#
# Usage:   scripts/redeploy.sh              deploy
#          DRY_RUN=1 scripts/redeploy.sh    preflight + plan only
# Env:     CLOUDFLARE_API_TOKEN  (required unless DRY_RUN=1)
#          SITE_URL              default https://mjony3.com
#          CANARY_PERCENT        default 10 (1-99)
#          CANARY_SOAK_SECONDS   default 20 (time on canary before promoting)
#          WRANGLER              default "wrangler"
#          DEPLOY_MESSAGE        default: latest git commit subject
# =============================================================================
set -Eeuo pipefail

cd "$(dirname "$0")/.."

WORKER_NAME="mjony3-portfolio"
SITE_URL="${SITE_URL:-https://mjony3.com}"
CANARY_PERCENT="${CANARY_PERCENT:-10}"
CANARY_SOAK_SECONDS="${CANARY_SOAK_SECONDS:-20}"
WRANGLER="${WRANGLER:-wrangler}"
DRY_RUN="${DRY_RUN:-0}"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo local)"
DEPLOY_MESSAGE="${DEPLOY_MESSAGE:-$(git log -1 --pretty=%s 2>/dev/null || echo manual deploy)}"
DEPLOY_MESSAGE="${DEPLOY_MESSAGE:0:100}"

# Paths that must be served correctly by the new version: "path expected_status [must_contain]"
SMOKE_CHECKS=(
  "/ 200 id=\"hero-slides\""
  "/bn/ 200 lang=\"bn\""
  "/css/style.css 200 .hero-slider"
  "/js/script.js 200 heroSlider"
  "/case-studies/bpda-smart-app 200 BPDA"
  "/assets/work/mjpay.webp 200"
  "/favicon.svg 200"
  "/this-page-does-not-exist 404"
)

OLD_VERSION=""
NEW_VERSION=""
PROMOTED=0
ROLLED_BACK=0

log()  { printf '\033[1;36m[redeploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[redeploy]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[redeploy]\033[0m %s\n' "$*" >&2; exit 1; }

summary() {
  # Append to the GitHub Actions job summary when available
  [[ -n "${GITHUB_STEP_SUMMARY:-}" ]] && printf '%s\n' "$*" >> "$GITHUB_STEP_SUMMARY"
  return 0
}

rollback() {
  local reason="$1"
  ROLLED_BACK=1
  warn "FAILED: $reason"
  if [[ -n "$OLD_VERSION" && -n "$NEW_VERSION" ]]; then
    warn "Rolling back: ${OLD_VERSION} → 100%"
    if "$WRANGLER" versions deploy "${OLD_VERSION}@100%" --yes \
         --message "rollback: ${reason:0:80}" >/dev/null; then
      warn "Rollback complete. Production is on ${OLD_VERSION}."
      summary "### ❌ Deploy failed, rolled back" "- Reason: ${reason}" "- Live version: \`${OLD_VERSION}\`"
    else
      warn "ROLLBACK FAILED. Check the Cloudflare dashboard immediately."
      summary "### 🚨 Deploy and rollback failed" "- Reason: ${reason}"
    fi
  fi
  exit 1
}

# Unexpected errors after upload also roll back
on_exit() {
  local rc=$?
  if [[ $rc -ne 0 && -n "$NEW_VERSION" && $PROMOTED -eq 0 && $ROLLED_BACK -eq 0 ]]; then
    rollback "unexpected error (exit $rc)"
  fi
}
trap on_exit EXIT

# -----------------------------------------------------------------------------
# HTTP check: check_url <url> <expected_status> [must_contain] [version_override]
# Retries briefly to absorb edge propagation.
# -----------------------------------------------------------------------------
check_url() {
  local url="$1" expect="$2" needle="${3:-}" pin="${4:-}"
  local attempt body status tmp
  tmp="$(mktemp)"
  for attempt in 1 2 3 4 5; do
    local args=(-sS -o "$tmp" -w '%{http_code}' --max-time 15 -H 'Cache-Control: no-cache')
    [[ -n "$pin" ]] && args+=(-H "Cloudflare-Workers-Version-Overrides: ${WORKER_NAME}=\"${pin}\"")
    status="$(curl "${args[@]}" "${url}?v=${GIT_SHA}-${attempt}" || echo 000)"
    if [[ "$status" == "$expect" ]]; then
      if [[ -z "$needle" ]] || grep -qF -- "$needle" "$tmp"; then
        rm -f "$tmp"; return 0
      fi
    fi
    sleep $((attempt * 2))
  done
  body="$(head -c 200 "$tmp" | tr '\n' ' ')"
  rm -f "$tmp"
  warn "check failed: ${url} → got ${status}, want ${expect}${needle:+ containing \"${needle}\"} | ${body}"
  return 1
}

run_smoke() {
  local pin="${1:-}" check path expect needle failed=0
  for check in "${SMOKE_CHECKS[@]}"; do
    read -r path expect needle <<<"$check"
    if check_url "${SITE_URL}${path}" "$expect" "$needle" "$pin"; then
      log "  ✓ ${path} (${expect})"
    else
      failed=1
    fi
  done
  return $failed
}

# -----------------------------------------------------------------------------
# 1. Preflight
# -----------------------------------------------------------------------------
log "Preflight (${GIT_SHA}: ${DEPLOY_MESSAGE})"
for f in index.html bn/index.html i18n/bn.json 404.html css/style.css js/script.js wrangler.jsonc .assetsignore; do
  [[ -f "$f" ]] || die "missing required file: $f"
done
command -v node >/dev/null || die "node is required for the JS syntax check"
node --check js/script.js || die "js/script.js has a syntax error"
python3 - <<'PY' || die "HTML nesting check failed"
import html.parser, sys
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr'}
SVG_LEAF = {'path','circle','rect','stop','ellipse','line','polyline','polygon'}
class P(html.parser.HTMLParser):
    def __init__(s): super().__init__(); s.stack=[]; s.errors=[]
    def handle_starttag(s, t, a):
        if t not in VOID and t not in SVG_LEAF: s.stack.append((t, s.getpos()))
    def handle_startendtag(s, t, a): pass
    def handle_endtag(s, t):
        if t in SVG_LEAF: return
        if s.stack and s.stack[-1][0] == t: s.stack.pop()
        else: s.errors.append(f"unexpected </{t}> at line {s.getpos()[0]}")
for f in ['index.html', 'bn/index.html', '404.html', 'case-studies/bpda-smart-app.html']:
    p = P(); p.feed(open(f, encoding='utf-8').read())
    if p.errors or p.stack:
        print(f"{f}: {p.errors[:3]} unclosed={[t for t,_ in p.stack][:5]}", file=sys.stderr); sys.exit(1)
PY
python3 scripts/build-bn.py --check >/dev/null \
  || die "bn/index.html is stale: run 'python3 scripts/build-bn.py' and commit the result"
log "  ✓ files, JS syntax, HTML structure and Bangla build OK"
command -v "$WRANGLER" >/dev/null || die "wrangler not found (set WRANGLER=...)"

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY_RUN: would upload a new version, canary ${CANARY_PERCENT}% for ${CANARY_SOAK_SECONDS}s, smoke-test ${#SMOKE_CHECKS[@]} checks, then promote to 100%."
  exit 0
fi
[[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || die "CLOUDFLARE_API_TOKEN is not set"
if ! [[ "$CANARY_PERCENT" =~ ^[0-9]+$ ]] || (( CANARY_PERCENT < 1 || CANARY_PERCENT > 99 )); then
  die "CANARY_PERCENT must be 1-99"
fi

# -----------------------------------------------------------------------------
# 2. Record current version, upload new one (not yet serving traffic)
# -----------------------------------------------------------------------------
OLD_VERSION="$("$WRANGLER" deployments status --json 2>/dev/null | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    v = sorted(d.get("versions", []), key=lambda x: -x.get("percentage", 0))
    print(v[0]["version_id"] if v else "")
except Exception:
    print("")
')"
log "Current live version: ${OLD_VERSION:-<none>}"

log "Uploading new version…"
upload_out="$("$WRANGLER" versions upload --tag "$GIT_SHA" --message "$DEPLOY_MESSAGE" 2>&1)" \
  || { echo "$upload_out" >&2; die "upload failed (production untouched)"; }
NEW_VERSION="$(grep -i 'version id' <<<"$upload_out" \
  | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | tail -1 || true)"
[[ -n "$NEW_VERSION" ]] || { echo "$upload_out" >&2; die "could not parse new version id (production untouched)"; }
log "  ✓ uploaded ${NEW_VERSION}"

# First-ever deploy: nothing to canary against
if [[ -z "$OLD_VERSION" || "$OLD_VERSION" == "$NEW_VERSION" ]]; then
  log "No previous version; deploying directly."
  "$WRANGLER" versions deploy "${NEW_VERSION}@100%" --yes --message "$DEPLOY_MESSAGE" >/dev/null
  PROMOTED=1
  run_smoke || die "post-deploy checks failed (no previous version to roll back to)"
  exit 0
fi

# -----------------------------------------------------------------------------
# 3. Canary
# -----------------------------------------------------------------------------
log "Canary: ${NEW_VERSION}@${CANARY_PERCENT}% / ${OLD_VERSION}@$((100 - CANARY_PERCENT))%"
"$WRANGLER" versions deploy "${NEW_VERSION}@${CANARY_PERCENT}%" "${OLD_VERSION}@$((100 - CANARY_PERCENT))%" \
  --yes --message "canary: ${DEPLOY_MESSAGE}" >/dev/null \
  || rollback "canary deployment rejected"

# -----------------------------------------------------------------------------
# 4. Smoke test pinned to the new version
# -----------------------------------------------------------------------------
log "Smoke-testing new version (pinned)…"
run_smoke "$NEW_VERSION" || rollback "smoke test failed on new version"

log "Soaking on canary for ${CANARY_SOAK_SECONDS}s…"
sleep "$CANARY_SOAK_SECONDS"
run_smoke "$NEW_VERSION" >/dev/null || rollback "new version failed after soak"

# -----------------------------------------------------------------------------
# 5. Promote
# -----------------------------------------------------------------------------
log "Promoting ${NEW_VERSION} → 100%"
"$WRANGLER" versions deploy "${NEW_VERSION}@100%" --yes --message "$DEPLOY_MESSAGE" >/dev/null \
  || rollback "promotion rejected"

# -----------------------------------------------------------------------------
# 6. Verify production (unpinned)
# -----------------------------------------------------------------------------
log "Verifying production…"
run_smoke || rollback "production verification failed after promotion"
PROMOTED=1

log "Done. ${SITE_URL} is serving ${NEW_VERSION} (previous: ${OLD_VERSION})."
summary "### ✅ Deployed ${GIT_SHA}" \
        "- Message: ${DEPLOY_MESSAGE}" \
        "- New version: \`${NEW_VERSION}\`" \
        "- Previous version: \`${OLD_VERSION}\` (instant rollback: \`wrangler versions deploy ${OLD_VERSION}@100% -y\`)" \
        "- Canary: ${CANARY_PERCENT}% for ${CANARY_SOAK_SECONDS}s, ${#SMOKE_CHECKS[@]} smoke checks passed"
