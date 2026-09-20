#!/usr/bin/env python3
"""从 docs/用户注册服务协议与隐私政策.md 生成前端协议内容。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "用户注册服务协议与隐私政策.md"
OUT = ROOT / "frontend" / "src" / "pages" / "termsContent.ts"


def main() -> None:
    lines = SRC.read_text(encoding="utf-8").splitlines()
    started = False
    sections = []
    for raw in lines:
        line = raw.strip()
        if not started:
            if line.startswith("# "):
                started = True
            else:
                continue
        if not line or line == "---" or line.startswith(">"):
            continue
        if line.startswith("### "):
            sections.append(("h3", line[4:].strip()))
        elif line.startswith("## "):
            sections.append(("h2", line[3:].strip()))
        elif line.startswith("# "):
            sections.append(("h1", line[2:].strip()))
        else:
            sections.append(("p", line))

    body = ",\n".join(
        "  { type: " + json.dumps(kind) + ", text: " + json.dumps(text, ensure_ascii=False) + " }"
        for kind, text in sections
    )
    content = (
        "// 由 docs/用户注册服务协议与隐私政策.md 生成（2026-09-20），勿手改；改协议请改 markdown 后重新生成\n"
        "export type TermsSection = { type: 'h1' | 'h2' | 'h3' | 'note' | 'p'; text: string };\n"
        "export const TERMS_SECTIONS: TermsSection[] = [\n"
        + body
        + ",\n];\n"
    )
    OUT.write_text(content, encoding="utf-8")
    print(f"generated {OUT} ({len(sections)} sections)")


if __name__ == "__main__":
    main()
