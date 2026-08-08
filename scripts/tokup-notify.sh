#!/bin/bash
# TokUp 告警推送：健康检查发现异常时推送到微信。
# 渠道配置在 /opt/tokup/scripts/alert-config.env，未配置则静默退出。
CFG=/opt/tokup/scripts/alert-config.env
[ -f "$CFG" ] && . "$CFG"
FAILFILE=/var/log/tokup-health.fail
MARK=/tmp/tokup-alert-sent.marker

[ -f "$FAILFILE" ] || exit 0

# 没有配置任何渠道：不发
if [ -z "$WECOM_WEBHOOK" ] && [ -z "$PUSHPLUS_TOKEN" ] && [ -z "$SENDKEY" ]; then
  exit 0
fi

# 已有新失败才发（文件比上次发送标记新）
if [ -f "$MARK" ] && [ ! "$FAILFILE" -nt "$MARK" ]; then
  exit 0
fi

# flock 防并发
exec 9>/tmp/tokup-alert.lock
flock -n 9 || exit 0

LAST=$(tail -n 5 "$FAILFILE")
TITLE="[TokUp] 监控告警 $(date '+%H:%M')"

if [ -n "$WECOM_WEBHOOK" ]; then
  CONTENT_JSON=$(python3 -c 'import json,sys; print(json.dumps({"msgtype":"text","text":{"content":sys.stdin.read()}}))' <<< "$LAST" 2>/dev/null)
  [ -n "$CONTENT_JSON" ] && curl -s --max-time 15 -H 'Content-Type: application/json' -d "$CONTENT_JSON" "$WECOM_WEBHOOK" >/dev/null 2>&1
elif [ -n "$PUSHPLUS_TOKEN" ]; then
  curl -s --max-time 15 "https://www.pushplus.plus/send" \
    --data-urlencode "token=${PUSHPLUS_TOKEN}" \
    --data-urlencode "title=${TITLE}" \
    --data-urlencode "content=${LAST}" \
    --data-urlencode "template=txt" >/dev/null 2>&1
elif [ -n "$SENDKEY" ]; then
  curl -s --max-time 15 "https://sctapi.ftqq.com/${SENDKEY}.send" \
    --data-urlencode "title=${TITLE}" \
    --data-urlencode "desp=${LAST}" >/dev/null 2>&1
fi

touch "$MARK"
