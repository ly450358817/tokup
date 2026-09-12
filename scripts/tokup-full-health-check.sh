#!/bin/bash
# ============================================================
# TokUp 全面健康检查（本地 Mac 执行，每周/每日自动化使用）
# 只读为主 + 一次低成本 chat 冒烟（用管理员现有 key，deepseek-v3）
# 覆盖：服务/健康接口/磁盘/内存/日志/DB/备份/pending单/API冒烟
# 2026-09-13: 公网 HTTP 检查改为「在服务器上执行 curl」——本机网络曾被
#   SNI 层拦截导致 tokup.net 全部请求被重置（误报为站点故障）。
#   服务器侧 curl 仍经过 Cloudflare 回源，端到端验证能力不变。
# ============================================================
set -u
HOST="ubuntu@101.32.189.59"
BASE="https://tokup.net"
NOW=$(date "+%Y-%m-%d %H:%M:%S")
ISSUES=0

pass(){ echo "  ✅ $1"; }
warn(){ echo "  ⚠️  $1"; }
fail(){ echo "  ❌ $1"; ISSUES=$((ISSUES+1)); }
SSH(){ ssh -o ConnectTimeout=12 -o StrictHostKeyChecking=no "$HOST" "$@"; }

echo "============================================================"
echo "TokUp 全面健康检查  $NOW"
echo "============================================================"

# 1) 系统服务
echo "▍1. 系统服务"
for svc in tokup-backend nginx; do
  if SSH "systemctl is-active --quiet $svc" 2>/dev/null; then
    pass "服务 $svc active"
  else
    fail "服务 $svc 异常"
  fi
done

# 2) 健康接口（在服务器上请求公网地址，经 Cloudflare）
echo "▍2. 健康接口"
health=$(SSH "curl -s --max-time 20 '$BASE/api/health'" 2>/dev/null)
if echo "$health" | grep -q '"status":"ok"'; then
  pass "GET /api/health"
else
  fail "GET /api/health → ${health:0:100}"
fi

# 3) 磁盘
echo "▍3. 磁盘 / 内存"
disk=$(SSH "df / | awk 'NR==2 {gsub(/%/,\"\",\$5); print \$5}'" 2>/dev/null)
if [ "${disk:-100}" -lt 85 ]; then pass "磁盘使用 ${disk}%"; else fail "磁盘使用 ${disk}%"; fi
mem=$(SSH "free -m | awk 'NR==2{printf \"%d\", \$3*100/\$2}'" 2>/dev/null)
if [ "${mem:-100}" -lt 90 ]; then pass "内存使用 ${mem}%"; else fail "内存使用 ${mem}%"; fi

# 4) 最近7天后端错误日志（仅最近24h的新错误算故障；历史错误多为已解决的上游429/配额事件）
echo "▍4. 后端日志（7天 / 最近24h）"
# 已知可忽略项：glm-4.6v-flash（智谱免费私有视觉模型，仅 admin 自用）429 限流 = 非故障（用户决策 2026-09-02）
IGNORE_429='model=glm-4.6v-flash provider=zhipu err=HTTP 429'
err=$(SSH "journalctl -u tokup-backend --since '-7 days' 2>/dev/null | grep -cE 'ERROR|Traceback'" 2>/dev/null)
err=${err:-0}
err_all24=$(SSH "journalctl -u tokup-backend --since '-24 hours' 2>/dev/null | grep -cE 'ERROR|Traceback'" 2>/dev/null)
err_all24=${err_all24:-0}
err_ign24=$(SSH "journalctl -u tokup-backend --since '-24 hours' 2>/dev/null | grep -E 'ERROR|Traceback' | grep -c '$IGNORE_429'" 2>/dev/null)
err_ign24=${err_ign24:-0}
err24=$(( err_all24 - err_ign24 ))
echo "      7天共 ${err} 条；最近24h ${err_all24} 条（可忽略 glm-4.6v 智谱429 ${err_ign24} 条；需排查 ${err24} 条）"
if [ "$err24" -eq 0 ]; then
  pass "最近24h无异常错误日志（glm-4.6v-flash 智谱429 已按策略忽略，非故障）"
else
  fail "最近24h错误日志 ${err24} 条（需排查）"
fi
if [ "$err" -gt 0 ]; then
  echo "      最近错误："
  SSH "journalctl -u tokup-backend --since '-7 days' 2>/dev/null | grep -E 'ERROR|Traceback' | tail -5" 2>/dev/null | sed 's/^/        /'
fi

# 5) 数据库完整性
echo "▍5. 数据库"
dbok=$(SSH "sqlite3 /opt/tokup/backend/tokup.db 'PRAGMA integrity_check;'" 2>/dev/null | head -1)
if [ "$dbok" = "ok" ]; then pass "SQLite integrity_check ok"; else fail "SQLite integrity_check → $dbok"; fi
pend=$(SSH "sqlite3 /opt/tokup/backend/tokup.db \"SELECT count(*) FROM transactions WHERE status='pending'\"" 2>/dev/null)
echo "      ℹ️  pending 充值单: ${pend}（历史未付单，XorPay 侧已 expire 可忽略）"
pend_stale=$(SSH "sqlite3 /opt/tokup/backend/tokup.db \"SELECT count(*) FROM transactions WHERE status='pending' AND created_at < datetime('now','-3 days')\"" 2>/dev/null)
echo "      ℹ️  其中 >3 天未付: ${pend_stale}"
usg=$(SSH "sqlite3 /opt/tokup/backend/tokup.db \"SELECT count(*) || ' 次, 失败 ' || sum(CASE WHEN status='error' THEN 1 ELSE 0 END) FROM usage_records WHERE created_at > datetime('now','-24 hours')\"" 2>/dev/null)
echo "      ℹ️  24h 调用: ${usg:-N/A}"

# 6) 备份新鲜度
echo "▍6. 备份"
bk=$(SSH "ls -t /opt/tokup/db_backups/tokup_*.db 2>/dev/null | head -1" 2>/dev/null)
if [ -n "$bk" ]; then
  bktime=$(SSH "stat -c %Y '$bk'" 2>/dev/null)
  nowsec=$(date +%s)
  age=$(( (nowsec - bktime) / 3600 ))
  bk_size=$(SSH "stat -c %s '$bk'" 2>/dev/null)
  if [ "$age" -le 30 ] && [ "${bk_size:-0}" -gt 0 ]; then
    pass "最新备份 $age 小时前（$(echo $((bk_size/1024/1024)))MB）"
  elif [ "${bk_size:-0}" -eq 0 ]; then
    fail "最新备份为 0 字节：$bk"
  else
    fail "备份过期 ${age}h 前: $bk"
  fi
else
  fail "无数据库备份"
fi

# 7) API 冒烟（全部在服务器上执行）
echo "▍7. API 冒烟"
models=$(SSH "curl -s --max-time 20 '$BASE/api/v1/models'" 2>/dev/null)
if echo "$models" | grep -q '"data"'; then
  cnt=$(echo "$models" | python3 -c 'import sys,json; print(len(json.load(sys.stdin).get("data",[])))' 2>/dev/null)
  pass "GET /api/v1/models（$cnt 个模型）"
else
  fail "GET /api/v1/models → ${models:0:100}"
fi

ADMIN_PASS=$(SSH "sudo grep -oE 'TOKUP_ADMIN_PASSWORD=[^ ]*' /etc/systemd/system/tokup-backend.service | cut -d= -f2" 2>/dev/null)
if [ -n "$ADMIN_PASS" ]; then
  LOGIN_BODY=$(printf '{"email":"admin@tokup.io","password":"%s"}' "$ADMIN_PASS")
  TOKEN=$(printf '%s' "$LOGIN_BODY" | SSH "curl -s --max-time 20 -H 'Content-Type: application/json' -d @- '$BASE/api/auth/login'" 2>/dev/null \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
  if [ -n "$TOKEN" ]; then
    pass "管理员登录 /api/auth/login"
    astats=$(SSH "curl -s --max-time 20 -H 'Authorization: Bearer $TOKEN' '$BASE/api/admin/stats'" 2>/dev/null)
    if echo "$astats" | grep -q '"total_users"'; then
      pass "GET /api/admin/stats（${astats:0:120}）"
    else
      fail "GET /api/admin/stats → ${astats:0:100}"
    fi
    dstats=$(SSH "curl -s --max-time 20 -H 'Authorization: Bearer $TOKEN' '$BASE/api/dashboard/stats'" 2>/dev/null)
    if echo "$dstats" | grep -q '"'; then
      pass "GET /api/dashboard/stats"
    else
      fail "GET /api/dashboard/stats → ${dstats:0:100}"
    fi
    # 用现有 key 做一次低价 chat 冒烟（不新建 key，避免脏数据）
    keys=$(SSH "curl -s --max-time 20 -H 'Authorization: Bearer $TOKEN' '$BASE/api/keys'" 2>/dev/null)
    key=$(echo "$keys" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  print(d[0]["key"] if isinstance(d,list) and d else "")
except Exception: print("")' 2>/dev/null)
    if [ -n "$key" ]; then
      CHAT_BODY='{"model":"deepseek-v3","messages":[{"role":"user","content":"ping"}],"max_tokens":5}'
      chat=$(printf '%s' "$CHAT_BODY" | SSH "curl -s --max-time 45 -H 'Authorization: Bearer $key' -H 'Content-Type: application/json' -d @- '$BASE/api/v1/chat/completions'" 2>/dev/null)
      if echo "$chat" | grep -q '"choices"'; then
        pass "chat/completions 非流式冒烟（deepseek-v3）"
      else
        warn "chat/completions → ${chat:0:140}"
      fi
      # 无效 key 应 401
      code=$(printf '%s' "$CHAT_BODY" | SSH "curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H 'Authorization: Bearer sk-invalid-test' -H 'Content-Type: application/json' -d @- '$BASE/api/v1/chat/completions'" 2>/dev/null)
      [ "$code" = "401" ] && pass "无效 key 被拒（401）" || warn "无效 key 返回 $code"
    else
      warn "管理员账号无 API Key，跳过 chat 冒烟"
    fi
  else
    fail "管理员登录失败"
  fi
else
  fail "无法读取管理员密码"
fi

echo "------------------------------------------------------------"
if [ "$ISSUES" -eq 0 ]; then
  echo "🎉 全部通过"
else
  echo "⚠️  共 $ISSUES 项异常，请人工查看上述 ❌"
fi
exit $ISSUES
