#!/bin/bash
# TokUp 健康检查（每 5 分钟 cron 执行）— 只读检查，不影响线上功能
LOG=/var/log/tokup-health.log
FAIL=/var/log/tokup-health.fail
TS=$(date "+%Y-%m-%d %H:%M:%S")
issues=""

# 1) 系统服务
for svc in tokup-backend nginx; do
  if ! systemctl is-active --quiet "$svc" 2>/dev/null; then
    issues="${issues} [服务${svc}异常]"
  fi
done

# 2) 健康接口（匹配 "status":"ok"，避开嵌套引号问题）
health=$(curl -s --max-time 15 "https://tokup.net/api/health" 2>/dev/null)
if ! echo "$health" | grep -q 'status.*"ok"'; then
  issues="${issues} [健康接口异常:${health:0:80}]"
fi

# 3) 磁盘使用率
use=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [ -n "$use" ] && [ "$use" -ge 85 ]; then
  issues="${issues} [磁盘${use}%]"
fi

if [ -n "$issues" ]; then
  echo "$TS FAIL$issues" >> "$LOG"
  echo "$TS$issues" >> "$FAIL"
else
  echo "$TS OK" >> "$LOG"
fi

# 只保留最近 3000 行
tail -n 3000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
# 触发告警推送（未配置渠道则静默）
bash /opt/tokup/scripts/tokup-notify.sh
