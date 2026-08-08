#!/bin/bash
echo "=== 代理端口 15723 ==="
lsof -i :15723 2>/dev/null | grep LISTEN && echo "✓ 运行中" || echo "✗ 未运行"
echo ""
echo "=== CC Switch 端口 15721 ==="
lsof -i :15721 2>/dev/null | grep LISTEN && echo "✓ 运行中" || echo "✗ 未运行"
echo ""
echo "=== 当前配置 ==="
grep "base_url\|openai_base_url" ~/.codex/config.toml
