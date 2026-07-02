"""TokUp CLI — AI API 网关切换与管理工具"""
import argparse
import json
import os
import sys
from typing import Optional

TOKUP_API = os.getenv("TOKUP_API", "https://tokup.net")

def cmd_switch(args):
    """Print switch instructions"""
    if args.provider == "openai":
        print(f"export OPENAI_BASE_URL=\"{TOKUP_API}/v1\"")
        print(f"export OPENAI_API_KEY=\"your_tokup_api_key\"")
        print()
        print("# Python OpenAI SDK:")
        print("from openai import OpenAI")
        print(f'client = OpenAI(base_url="{TOKUP_API}/v1", api_key="your_key")')
    else:
        print(f"export TOKUP_BASE_URL=\"{TOKUP_API}/v1\"")
        print(f"export TOKUP_API_KEY=\"your_tokup_api_key\"")

def cmd_balance(args):
    """Check account balance via API"""
    import urllib.request
    import urllib.error
    if not args.token:
        print("❌ 请提供 Token: tokup balance --token YOUR_TOKEN")
        print("   Token 在 tokup.net 登录后可获取（复制 localStorage 中的 tokup_token）")
        return
    try:
        req = urllib.request.Request(
            f"{TOKUP_API}/api/auth/me",
            headers={"Authorization": f"Bearer {args.token}"}
        )
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read())
        balance = data.get("token_balance", 0)
        print(f"💰 余额: ¥{balance:.2f}")
        print(f"📧 邮箱: {data.get('email', 'unknown')}")
    except Exception as e:
        print(f"❌ 查询失败: {e}")

def cmd_models(args):
    """List available models with prices"""
    import urllib.request
    resp = urllib.request.urlopen(f"{TOKUP_API}/api/v1/models")
    data = json.loads(resp.read())
    print(f"🤖 TokUp 支持的模型 ({len(data['data'])} 个)")
    print("=" * 60)
    for m in data["data"]:
        print(f"  {m['id']:35s} {m['provider']}")

def main():
    parser = argparse.ArgumentParser(description="TokUp CLI — AI API 管理工具")
    parser.add_argument("--api", help="API 地址", default=TOKUP_API)
    sub = parser.add_subparsers(dest="command")
    
    p_switch = sub.add_parser("switch", help="获取切换配置")
    p_switch.add_argument("provider", nargs="?", default="openai", help="openai | tokup")
    
    p_balance = sub.add_parser("balance", help="查询余额")
    p_balance.add_argument("--token", "-t", help="API Token")
    
    sub.add_parser("models", help="列出可用模型")
    sub.add_parser("help", help="显示帮助")
    
    args = parser.parse_args()
    if args.command == "switch":
        cmd_switch(args)
    elif args.command == "balance":
        cmd_balance(args)
    elif args.command == "models":
        cmd_models(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
