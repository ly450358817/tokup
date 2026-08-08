#!/bin/bash
# 确保代理在运行
kill $(lsof -i :15723 2>/dev/null | grep LISTEN | awk '{print $2}') 2>/dev/null
python3 ~/.codex/bin/tokup_proxy.py &
sleep 1

# 改配置
sed -i '' 's|base_url = "http://127.0.0.1:15721/v1"|base_url = "http://127.0.0.1:15723/v1"|' ~/.codex/config.toml
sed -i '' 's|openai_base_url = "http://127.0.0.1:15721"|openai_base_url = "http://127.0.0.1:15723"|' ~/.codex/config.toml

# 如果上面没匹配到，直接用备份里的格式替换
grep -q "15721" ~/.codex/config.toml && sed -i '' 's/15721/15723/g' ~/.codex/config.toml

echo "已切换到 TokUp（端口 15723）"
echo "请重启 Codex"
