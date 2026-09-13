#!/bin/bash
# 网格机器人数据备份到腾讯云 COS（每周一次，远端保留 4 周）
# 运行位置：RackNerd VPS (173.254.234.42)，root cron
set -uo pipefail

SRC=/root/grid-bot
REMOTE=tokup-cos
DEST=gridbot-backup-1447445636/grid-bot
KEEP_DAYS=28
LOG=/var/log/gridbot-backup.log
NAME="grid-bot-$(date +%Y%m%d).tar.gz"
TMP="/tmp/$NAME"

log(){ echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
alert(){ # 复用机器人自己的 PushPlus token 推送失败告警
  log "ALERT $*"
  local tok=""; [ -f /root/grid-bot/.pp_token ] && tok=$(cat /root/grid-bot/.pp_token 2>/dev/null)
  [ -n "$tok" ] && curl -s --max-time 15 https://www.pushplus.plus/send \
    --data-urlencode "token=$tok" --data-urlencode "title=⚠️网格机器人备份失败" \
    --data-urlencode "content=$*" --data-urlencode "template=txt" >/dev/null 2>&1
  return 0
}

[ -d "$SRC" ] || { log "SKIP 源目录不存在"; exit 0; }

# 只打包关键状态与代码，排除大日志/缓存
if ! tar -czf "$TMP" -C /root \
    --exclude='grid-bot/*.log' --exclude='grid-bot/*.gz' --exclude='grid-bot/__pycache__' \
    --exclude='grid-bot/.cache' grid-bot 2>/dev/null; then
  rm -f "$TMP"; alert "打包失败 $NAME"; exit 1
fi
size=$(du -h "$TMP" | cut -f1)

ok=0
for i in 1 2 3; do
  if rclone copyto "$TMP" "$REMOTE:$DEST/$NAME" --no-traverse --retries 2 >/dev/null 2>&1; then ok=1; break; fi
  sleep $((i * 20))
done
rm -f "$TMP"
[ "$ok" -eq 1 ] || { alert "上传失败 $NAME"; exit 1; }

rclone delete "$REMOTE:$DEST" --min-age "${KEEP_DAYS}d" --include 'grid-bot-*.tar.gz' >/dev/null 2>&1 || true
count=$(rclone lsf "$REMOTE:$DEST" --include 'grid-bot-*.tar.gz' 2>/dev/null | wc -l)
log "OK $NAME ($size, 远端保留 $count 份)"
exit 0
