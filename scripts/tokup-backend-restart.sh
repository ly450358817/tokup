#!/bin/bash
# TokUp 后端重启 + 健康校验（在服务器上执行）
# 任何改动后端代码或 .env 之后使用：
#   1) 修正 .env 属主/权限（防 PermissionError 导致 worker 启动失败，2026-09-12 事故）
#   2) 重启 tokup-backend
#   3) 校验 worker 数量与公网健康接口
set -uo pipefail

ENV_FILE=/opt/tokup/backend/.env
SVC=tokup-backend
HEALTH_URL=https://tokup.net/api/health

echo ">>> 1/3 修正 .env 属主与权限"
if [ -f "$ENV_FILE" ]; then
  sudo chown ubuntu:ubuntu "$ENV_FILE" 2>/dev/null || true
  sudo chmod 600 "$ENV_FILE" 2>/dev/null || true
  ls -l "$ENV_FILE"
else
  echo "  ⚠️ 未找到 $ENV_FILE（跳过）"
fi

echo ">>> 2/3 重启 $SVC"
sudo systemctl restart "$SVC"
sleep 4

echo ">>> 3/3 校验"
workers=$(pgrep -f 'from multiprocessing.spawn import spawn_main' 2>/dev/null | wc -l | tr -d ' ')
health=$(curl -s --max-time 15 "$HEALTH_URL" 2>/dev/null)
echo "    worker 进程数: $workers（期望 ≥2）"
echo "    health: ${health:0:120}"

if [ "$workers" -ge 2 ] && echo "$health" | grep -q '"status":"ok"'; then
  echo "  ✅ 后端重启成功，worker 与健康接口正常"
  exit 0
fi

echo "  ❌ 后端异常（workers=$workers）——最近日志："
sudo journalctl -u "$SVC" -n 20 --no-pager | tail -20
exit 1
