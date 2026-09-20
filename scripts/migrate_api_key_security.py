#!/usr/bin/env python3
"""API Key 哈希/限制字段的一阶段迁移：加列、回填哈希，不删除明文 Key。"""
import argparse
import hashlib
import sqlite3
from pathlib import Path

COLUMNS = {
    "key_hash": "TEXT",
    "key_prefix": "TEXT DEFAULT ''",
    "key_last4": "TEXT DEFAULT ''",
    "allowed_ips": "TEXT DEFAULT ''",
    "allowed_models": "TEXT DEFAULT ''",
}


def sha256(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def migrate(db_path: Path) -> None:
    con = sqlite3.connect(str(db_path), timeout=30)
    try:
        existing = {row[1] for row in con.execute("PRAGMA table_info(api_keys)").fetchall()}
        for col, ddl in COLUMNS.items():
            if col not in existing:
                con.execute(f"ALTER TABLE api_keys ADD COLUMN {col} {ddl}")
                print(f"added column {col}")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_api_keys_key_hash ON api_keys(key_hash)")
        rows = con.execute(
            "SELECT id, key, key_hash, key_prefix, key_last4 FROM api_keys"
        ).fetchall()
        changed = 0
        for key_id, key_value, key_hash, prefix, last4 in rows:
            key_value = key_value or ""
            new_hash = key_hash or sha256(key_value)
            new_prefix = prefix or key_value[:12]
            new_last4 = last4 or key_value[-4:]
            if (new_hash, new_prefix, new_last4) != (key_hash, prefix, last4):
                con.execute(
                    "UPDATE api_keys SET key_hash=?, key_prefix=?, key_last4=? WHERE id=?",
                    (new_hash, new_prefix, new_last4, key_id),
                )
                changed += 1
        con.commit()
        total = con.execute("SELECT COUNT(*) FROM api_keys").fetchone()[0]
        hashed = con.execute("SELECT COUNT(*) FROM api_keys WHERE key_hash IS NOT NULL AND key_hash<>''").fetchone()[0]
        print(f"migration ok: total={total} hashed={hashed} updated={changed}")
    finally:
        con.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("db", nargs="?", default="backend/tokup.db")
    args = parser.parse_args()
    migrate(Path(args.db))
