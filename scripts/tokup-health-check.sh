#!/bin/bash
# TokUp 健康检查（每 5 分钟 cron 执行）— 只读检查，不影响线上功能
# 告警分级：issues=重大问题（推送微信）  warns=轻微问题（只写日志，不推送）
# 测试用覆盖（设置 TOKUP_HEALTH_LOG 或 TOKUP_HEALTH_FAIL 时不会触发推送）：
#   TOKUP_HEALTH_LOG TOKUP_HEALTH_FAIL TOKUP_FORCE_MODEL_PROBE TOKUP_PROBE_MODEL
#   TOKUP_MODEL_PROBE_EVERY_MIN TOKUP_DISK_WARN TOKUP_DISK_CRIT TOKUP_PROBE_FAIL_STREAK
LOG="${TOKUP_HEALTH_LOG:-/var/log/tokup-health.log}"
FAIL="${TOKUP_HEALTH_FAIL:-/var/log/tokup-health.fail}"
DISK_WARN="${TOKUP_DISK_WARN:-85}"     # 85% 起：只记录
DISK_CRIT="${TOKUP_DISK_CRIT:-90}"     # 90% 起：重大
PROBE_FAIL_STREAK="${TOKUP_PROBE_FAIL_STREAK:-2}"   # 连续失败次数达此值才升级为重大
CNT_FILE="${TOKUP_PROBE_COUNT_FILE:-/tmp/tokup-model-probe.failcount}"
TS=$(date "+%Y-%m-%d %H:%M:%S")
issues=""
warns=""

# 1) 系统服务（重大）
for svc in tokup-backend nginx; do
  if ! systemctl is-active --quiet "$svc" 2>/dev/null; then
    issues="${issues} [服务${svc}异常]"
  fi
done

# 2) 健康接口（重大）
health=$(curl -s --max-time 15 "https://tokup.net/api/health" 2>/dev/null)
if ! echo "$health" | grep -q 'status.*"ok"'; then
  issues="${issues} [健康接口异常]"
fi

# 3) 磁盘使用率（>=90 重大；85~89 仅记录）
use=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [ -n "$use" ]; then
  if [ "$use" -ge "$DISK_CRIT" ]; then
    issues="${issues} [磁盘${use}%(严重)]"
  elif [ "$use" -ge "$DISK_WARN" ]; then
    warns="${warns} [磁盘${use}%]"
  fi
fi

# 4) 模型可用性探测（默认每 30 分钟一次）
#    必要性：/api/health 只反映进程存活；deepseek 系有官方兜底，上游欠费/限额时
#    面板仍报 ok，但非 deepseek 模型全线 502（2026-10-02 真实故障，health 未发现）。
#    为避免瞬态抖动骚扰：连续失败 PROBE_FAIL_STREAK 次才升级为重大告警。
PROBE_EVERY_MIN="${TOKUP_MODEL_PROBE_EVERY_MIN:-30}"
PROBE_MODEL="${TOKUP_PROBE_MODEL:-deepseek/deepseek-v4-flash-20260731}"  # 2026-10-12 改：gemini-2.5-flash 将于 2026-10-20 上游退役，探测改用稳定的 DeepSeek Flash，避免退役后每 30 分钟误报
FORCE_PROBE="${TOKUP_FORCE_MODEL_PROBE:-0}"
cur_min=$((10#$(date +%M)))
due=0
if [ "$FORCE_PROBE" = "1" ]; then
  due=1
elif [ "$PROBE_EVERY_MIN" -gt 0 ] 2>/dev/null && [ $((cur_min % PROBE_EVERY_MIN)) -eq 0 ]; then
  due=1
fi

if [ "$due" = "1" ]; then
  ENVF=/opt/tokup/backend/.env
  PW=$(grep -oE '^TOKUP_ADMIN_PASSWORD=.*' "$ENVF" 2>/dev/null | cut -d= -f2-)
  if [ -z "$PW" ]; then
    issues="${issues} [模型探测异常]"
    echo "$TS MODEL_PROBE_ERR 读不到管理员口令" >> "$LOG"
  else
    TOKEN=$(curl -s --max-time 20 -A 'tokup-healthcheck/1.0' -H 'Content-Type: application/json' \
      -d "{\"email\":\"admin@tokup.io\",\"password\":\"$PW\"}" \
      "https://tokup.net/api/auth/login" 2>/dev/null \
      | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
    KEY=$(curl -s --max-time 20 -H "Authorization: Bearer $TOKEN" "https://tokup.net/api/keys" 2>/dev/null \
      | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["key"] if isinstance(d,list) and d else "")' 2>/dev/null)
    if [ -z "$KEY" ]; then
      issues="${issues} [模型探测异常]"
      echo "$TS MODEL_PROBE_ERR 取不到API Key" >> "$LOG"
    else
      RES=$(curl -s --max-time 45 -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
        -d "{\"model\":\"$PROBE_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"max_tokens\":1}" \
        "https://tokup.net/api/v1/chat/completions" 2>/dev/null)
      if echo "$RES" | grep -q '"choices"'; then
        echo "$TS MODEL_PROBE_OK $PROBE_MODEL" >> "$LOG"
        rm -f "$CNT_FILE" 2>/dev/null
      else
        # 失败详情只进日志；告警文本保持稳定，便于去重冷却
        echo "$TS MODEL_PROBE_FAIL $PROBE_MODEL ${RES:0:200}" >> "$LOG"
        cnt=$(cat "$CNT_FILE" 2>/dev/null || echo 0)
        case "$cnt" in ''|*[!0-9]*) cnt=0 ;; esac
        cnt=$((cnt + 1))
        echo "$cnt" > "$CNT_FILE" 2>/dev/null
        if [ "$cnt" -ge "$PROBE_FAIL_STREAK" ]; then
          issues="${issues} [模型探测失败(${PROBE_MODEL})连续${cnt}次]"
        else
          warns="${warns} [模型探测失败(${PROBE_MODEL})第${cnt}次]"
        fi
      fi
    fi
  fi
fi

if [ -n "$issues" ]; then
  echo "$TS FAIL$issues$warns" >> "$LOG"
  echo "$TS$issues" >> "$FAIL"
else
  if [ -n "$warns" ]; then
    echo "$TS WARN$warns" >> "$LOG"
  else
    echo "$TS OK" >> "$LOG"
  fi
fi

# 只保留最近 3000 行
tail -n 3000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
# 触发告警推送（未配置渠道则静默）；测试模式（自定义日志路径）不推送
if [ -z "${TOKUP_HEALTH_LOG:-}" ] && [ -z "${TOKUP_HEALTH_FAIL:-}" ]; then
  bash /opt/tokup/scripts/tokup-notify.sh
fi
