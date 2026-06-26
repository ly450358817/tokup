 #!/bin/bash
 # TokUp · 脉充 — 一键部署脚本
 # 用法: ./deploy/deploy.sh
 set -euo pipefail
 
 REPO_DIR="/opt/tokup"
 BACKEND_DIR="$REPO_DIR/backend"
 FRONTEND_DIR="$REPO_DIR/frontend"
 
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
 echo ">>> Restarting backend..."
 sudo systemctl restart tokup-backend 2>/dev/null || echo "  (manual start needed)"
 
 # 5. 重载 Nginx
 echo ">>> Reloading nginx..."
 sudo nginx -s reload 2>/dev/null || echo "  (manual reload needed)"
 
 echo "=== Done: https://tokup.io ==="
