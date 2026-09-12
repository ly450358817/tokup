#!/bin/bash
# TokUp 数据库异地备份（每周上传一份压缩全量快照，远端保留 4 周）
# 依赖：rclone + /opt/tokup/scripts/offsite.conf（配置 OFFSITE_REMOTE / OFFSITE_PATH）
# 失败时写入 /var/log/tokup-health.fail 并触发微信告警（tokup-notify.sh）
# 建议以 root 运行（备份文件属 root），cron: 0 4 * * 0
set -uo pipefail

BK_DIR=/opt/tokup/db_backups
CONF=/opt/tokup/scripts/offsite.conf
LOG=/var/log/tokup-health.log
FAIL=/var/log/tokup-health.fail
NOTIFY=/opt/tokup/scripts/tokup-notify.sh
KEEP_DAYS="${OFFSITE_KEEP_DAYS:-28}"

log(){ echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
alert(){ echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$FAIL"; [ -x "$NOTIFY" ] && bash "$NOTIFY" >/dev/null 2>&1 || true; }

[ -f "$CONF" ] && . "$CONF"
REMOTE="${OFFSITE_REMOTE:-}"
DEST="${OFFSITE_PATH:-}"

if [ -z "$REMOTE" ] || [ -z "$DEST" ]; then
  log "OFFSITE_SKIP 未配置异地存储（缺 $CONF）"
  exit 0
fi

src=$(ls -1t "$BK_DIR"/tokup_*.db 2>/dev/null | head -1)
[ -n "$src" ] || { log "OFFSITE_SKIP 本地无备份"; exit 0; }
[ "$(stat -c %s "$src")" -gt 0 ] || { log "OFFSITE_SKIP 最新备份为 0 字节"; exit 0; }

name="$(basename "$src" .db).db.gz"
tmp="$(mktemp /tmp/tokup-offsite-XXXXXX.db.gz)"
trap 'rm -f "$tmp"' EXIT

if ! gzip -c "$src" > "$tmp" 2>/dev/null; then
  alert "OFFSITE_FAIL gzip 失败: $src"; exit 1
fi
size_mb=$(( $(stat -c %s "$tmp") / 1024 / 1024 ))

ok=0
for i in 1 2 3; do
  if rclone copyto "$tmp" "$REMOTE:$DEST/$name" --no-traverse --retries 2 >/dev/null 2>&1; then ok=1; break; fi
  sleep $((i * 20))
done
[ "$ok" -eq 1 ] || { alert "OFFSITE_FAIL 上传失败: $name"; exit 1; }

# 远端只保留最近 4 周
rclone delete "$REMOTE:$DEST" --min-age "${KEEP_DAYS}d" --include 'tokup_*.db.gz' >/dev/null 2>&1 || true
count=$(rclone lsf "$REMOTE:$DEST" --include 'tokup_*.db.gz' 2>/dev/null | wc -l)
log "OFFSITE_OK $name (${size_mb}MB, 远端保留 ${count} 份)"
exit 0
