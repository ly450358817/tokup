#!/usr/bin/env bash
# TokUp 部署一致性校验（部署后必跑，吸取 2026-08-20 PaymentModal 漂移教训）
#
# 用途：确认"生产已经上线了本地代码库的版本"，而不是只改了本地/只 build 了 dist。
# 检查三件事：
#   1) 生产 backend/frontend 源码 md5 vs 本地 git HEAD（必须 0 漂移）
#   2) 公网 https://tokup.net 实际引用的 bundle == 生产 dist 最新 bundle（防 CF/浏览器缓存旧版）
#   3) /api/health 正常
#
# 用法:  bash scripts/tokup-deploy-verify.sh
# 退出码: 0=生产与本地一致；1=存在漂移/未上线/健康异常
#
# 可配置环境变量（默认按当前生产拓扑）:
#   TOKUP_SSH_TARGET=ubuntu@101.32.189.59
#   TOKUP_SSH_JUMP=-J root@173.254.234.42
set -uo pipefail

SSH_TARGET="${TOKUP_SSH_TARGET:-ubuntu@101.32.189.59}"
SSH_JUMP="${TOKUP_SSH_JUMP:--J root@173.254.234.42}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15)

echo "== 1/3 生产源码 vs 本地 git HEAD =="
( cd "$REPO" && git ls-files 'backend/*.py' 'frontend/src/*.tsx' 'frontend/src/*.ts' | while read -r f; do
    git show "HEAD:$f" 2>/dev/null | md5 -q | awk -v p="$f" '{print $1"  "p}'
  done | sort ) > /tmp/tokup_local.md5

ssh "${SSH_OPTS[@]}" "$SSH_JUMP" "$SSH_TARGET" \
  "cd /opt/tokup && find frontend/src backend -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.py' \) \
     ! -path '*/venv/*' ! -path '*/__pycache__/*' ! -name '*.bak*' ! -name '*_bak*' \
     -exec md5sum {} + 2>/dev/null | sort" > /tmp/tokup_server.md5

python3 - <<'PY'
import re, sys
server = {}
for line in open('/tmp/tokup_server.md5'):
    m = re.match(r'^([0-9a-f]{32})\s+(.+)$', line.strip())
    if m: server[m.group(2)] = m.group(1)
local = {}
for line in open('/tmp/tokup_local.md5'):
    m = re.match(r'^([0-9a-f]{32})\s+(.+)$', line.strip())
    if m: local[m.group(2)] = m.group(1)
diffs = [f for f in local if f not in server or server[f] != local[f]]
if diffs:
    print("❌ 漂移文件（本地已改但生产未同步）:")
    for f in diffs:
        print("   ", f)
    sys.exit(1)
print(f"✅ 全部一致（{len(local)} 个跟踪文件，0 漂移）")
PY
[ $? -ne 0 ] && FAIL=1

echo
echo "== 2/3 公网 bundle == 生产 dist 最新 bundle =="
SERVER_BUNDLE=$(ssh "${SSH_OPTS[@]}" "$SSH_JUMP" "$SSH_TARGET" \
  "ls -t /opt/tokup/frontend/dist/assets/index-*.js 2>/dev/null | head -1 | xargs basename" 2>/dev/null)
LIVE_BUNDLE=$(curl -s -m 20 "https://tokup.net/?cb=$(date +%s)" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1 | xargs basename 2>/dev/null)
echo "  生产 dist: ${SERVER_BUNDLE:-无}"
echo "  公网实际: ${LIVE_BUNDLE:-无}"
if [ -n "$SERVER_BUNDLE" ] && [ "$SERVER_BUNDLE" = "$LIVE_BUNDLE" ]; then
    echo "✅ 公网已上线最新 bundle: $LIVE_BUNDLE"
else
    echo "❌ 公网未指向生产最新 bundle（可能未部署 / CF 边缘或浏览器缓存旧版）"
    FAIL=1
fi

echo
echo "== 3/3 健康检查 =="
HEALTH=$(curl -s -m 15 https://tokup.net/api/health)
if echo "$HEALTH" | grep -q '"ok"'; then
    echo "✅ /api/health ok"
else
    echo "❌ /api/health 异常: $HEALTH"
    FAIL=1
fi

echo
if [ "$FAIL" -eq 0 ]; then
    echo "🎉 部署一致性校验通过：生产 = 本地代码库 = 公网已生效"
else
    echo "⚠️ 校验未通过：存在未上线/漂移项，禁止视为部署完成"
fi
exit $FAIL
