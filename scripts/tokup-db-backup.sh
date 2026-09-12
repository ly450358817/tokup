#!/bin/bash
# TokUp 数据库自动备份（每天 03:00 cron 执行）— 只读备份，不影响线上功能
# 2026-09-13: 失败/损坏时清理残留文件，避免 0 字节文件占用轮换名额（9/11 故障）
BK_DIR=/opt/tokup/db_backups
LOG=/var/log/tokup-health.log
mkdir -p "$BK_DIR"
TS=$(date "+%Y%m%d_%H%M%S")
OUT="$BK_DIR/tokup_$TS.db"
# 一致性备份（sqlite3 .backup 支持并发读）
if ! sqlite3 /opt/tokup/backend/tokup.db ".backup $OUT" 2>/dev/null; then
  rm -f "$OUT"   # 清理半成品/空文件，避免污染备份列表
  echo "$(date "+%Y-%m-%d %H:%M:%S") DB_BACKUP_FAIL" >> "$LOG"
  exit 1
fi
# 校验
if ! sqlite3 "$OUT" "PRAGMA integrity_check;" 2>/dev/null | grep -q "^ok$"; then
  rm -f "$OUT"   # 损坏文件同样删除，避免被误当作可用备份
  echo "$(date "+%Y-%m-%d %H:%M:%S") DB_BACKUP_CORRUPT" >> "$LOG"
  exit 1
fi
# 清理历史遗留的空/损坏备份（如 9/11 留下的 0 字节文件）
find "$BK_DIR" -maxdepth 1 -name 'tokup_*.db' -size 0 -delete 2>/dev/null
# 只保留最近 14 份有效备份
ls -1t "$BK_DIR"/tokup_*.db 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "$(date "+%Y-%m-%d %H:%M:%S") DB_BACKUP_OK $TS" >> "$LOG"
