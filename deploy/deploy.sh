 #!/bin/bash
 # TokUp · 脉充 — 一键部署脚本
 # 用法: ./deploy/deploy.sh
 set -euo pipefail
 
 REPO_DIR="/opt/tokup"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"

read_backend_env() {
  local key="$1"
  [ -f "$BACKEND_DIR/.env" ] || return 0
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$BACKEND_DIR/.env"
}

# Vite 在构建时内联 VITE_* 变量。Sentry DSN 是公开标识符，不是密钥。
export VITE_SENTRY_DSN="${VITE_SENTRY_DSN:-$(read_backend_env VITE_SENTRY_DSN)}"
export VITE_SENTRY_ENVIRONMENT="${VITE_SENTRY_ENVIRONMENT:-$(read_backend_env SENTRY_ENVIRONMENT)}"
export VITE_SENTRY_RELEASE="${VITE_SENTRY_RELEASE:-$(read_backend_env SENTRY_RELEASE)}"
export VITE_SENTRY_TRACES_SAMPLE_RATE="${VITE_SENTRY_TRACES_SAMPLE_RATE:-$(read_backend_env SENTRY_TRACES_SAMPLE_RATE)}"
export SENTRY_ORG="${SENTRY_ORG:-$(read_backend_env SENTRY_ORG)}"
export SENTRY_PROJECT="${SENTRY_PROJECT:-$(read_backend_env SENTRY_PROJECT)}"
export SENTRY_FRONTEND_PROJECT="${SENTRY_FRONTEND_PROJECT:-$(read_backend_env SENTRY_FRONTEND_PROJECT)}"
export SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN:-$(read_backend_env SENTRY_AUTH_TOKEN)}"
# The Vite build must use the frontend release even when a backend release is configured.
export SENTRY_RELEASE="${VITE_SENTRY_RELEASE:-${SENTRY_RELEASE:-$(read_backend_env SENTRY_RELEASE)}}"

echo "=== TokUp Deploy ==="
 
 # 1. 拉取最新代码
 cd "$REPO_DIR"
 git pull origin main
 
 # 2. 安装后端依赖
 echo ">>> Installing backend deps..."
 cd "$BACKEND_DIR"
 python3 -m venv venv
 source venv/bin/activate
 pip install -r requirements.txt -q
 deactivate
 
 # 3. 构建前端
 echo ">>> Building frontend..."
 cd "$FRONTEND_DIR"
 npx vite build
 
 # 4. 重启后端
 echo ">>> Restarting backend (含 .env 权限修正 + worker/健康校验)..."
 if [ -x "$REPO_DIR/scripts/tokup-backend-restart.sh" ]; then
   bash "$REPO_DIR/scripts/tokup-backend-restart.sh" || { echo "  ❌ 后端重启校验失败，部署中止"; exit 1; }
 else
   sudo chown ubuntu:ubuntu "$BACKEND_DIR/.env" 2>/dev/null || true
   sudo chmod 600 "$BACKEND_DIR/.env" 2>/dev/null || true
   sudo systemctl restart tokup-backend 2>/dev/null || echo "  (manual start needed)"
 fi
 
 # 5. 重载 Nginx
 echo ">>> Reloading nginx..."
 sudo nginx -s reload 2>/dev/null || echo "  (manual reload needed)"
 
 echo "=== Done: https://tokup.io ==="
