#!/bin/bash
# TokUp 数据库自动备份（每天 03:00 cron 执行）— 只读备份，不影响线上功能
BK_DIR=/opt/tokup/db_backups
mkdir -p "$BK_DIR"
TS=$(date "+%Y%m%d_%H%M%S")
# 一致性备份（sqlite3 .backup 支持并发读）
if ! sqlite3 /opt/tokup/backend/tokup.db ".backup $BK_DIR/tokup_$TS.db" 2>/dev/null; then
  echo "$(date "+%Y-%m-%d %H:%M:%S") DB_BACKUP_FAIL" >> /var/log/tokup-health.log
  exit 1
fi
# 校验
if ! sqlite3 "$BK_DIR/tokup_$TS.db" "PRAGMA integrity_check;" 2>/dev/null | grep -q "^ok$"; then
  echo "$(date "+%Y-%m-%d %H:%M:%S") DB_BACKUP_CORRUPT" >> /var/log/tokup-health.log
  exit 1
fi
# 只保留最近 14 份
ls -1t "$BK_DIR"/tokup_*.db 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "$(date "+%Y-%m-%d %H:%M:%S") DB_BACKUP_OK $TS" >> /var/log/tokup-health.log
