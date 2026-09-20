#!/bin/bash
# TokUp 前端安全升级提醒（只读；不自动升级、不自动强制 CSP）
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="ubuntu@101.32.189.59"

echo "TokUp 安全升级检查 $(date '+%Y-%m-%d %H:%M:%S')"

cd "$ROOT/frontend" || exit 0
AUDIT_JSON=$(pnpm audit --prod --json 2>/dev/null || true)
VULN_COUNT=$(printf '%s' "$AUDIT_JSON" | python3 -c 'import sys,json; d=json.load(sys.stdin); m=(d.get("metadata") or {}).get("vulnerabilities") or {}; print(sum(int(m.get(k,0) or 0) for k in ("info","low","moderate","high","critical")))' 2>/dev/null || echo "?")
echo "REACT_ROUTER_CHECK: pnpm audit vulnerabilities=$VULN_COUNT"
if [ "$VULN_COUNT" != "0" ]; then
  echo "REMINDER: 前端依赖仍有漏洞；先在预览环境验证 react-router-dom 7.18+，不要直接改生产。"
else
  echo "REMINDER: 前端依赖已清；如已完成路由回归，可提醒用户是否升级/确认。"
fi

CSP=$(ssh -o ConnectTimeout=12 -o StrictHostKeyChecking=no "$HOST" "grep -E '^add_header Content-Security-Policy' /etc/nginx/snippets/tokup-security-headers.conf 2>/dev/null || true" 2>/dev/null)
if echo "$CSP" | grep -q 'Report-Only'; then
  echo "CSP_CHECK: current=Report-Only"
  echo "REMINDER: 观察至少 7 天浏览器/Sentry/关键流程无 CSP 报错后，再提醒用户切强制模式。"
elif echo "$CSP" | grep -q 'Content-Security-Policy'; then
  echo "CSP_CHECK: current=Enforced"
else
  echo "CSP_CHECK: current=missing"
fi
