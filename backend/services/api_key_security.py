"""API Key 哈希与可选访问限制。"""
import hashlib
import ipaddress


def hash_api_key(key: str) -> str:
    return hashlib.sha256((key or "").encode("utf-8")).hexdigest()


def key_prefix(key: str, n: int = 12) -> str:
    return (key or "")[:n]


def key_last4(key: str) -> str:
    return (key or "")[-4:]


def split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [x.strip() for x in str(value).replace("\n", ",").split(",") if x.strip()]


def validate_ip_rules(value: str | None) -> str:
    """校验逗号分隔的 IP/CIDR，返回标准化文本。"""
    rules = []
    for raw in split_csv(value):
        try:
            if "/" in raw:
                net = ipaddress.ip_network(raw, strict=False)
                rules.append(str(net))
            else:
                rules.append(str(ipaddress.ip_address(raw)))
        except ValueError:
            raise ValueError(f"无效的 IP 或 CIDR：{raw}")
    return ",".join(rules)


def ip_allowed(client_ip: str, rules: str | None) -> bool:
    allowed = split_csv(rules)
    if not allowed:
        return True
    try:
        ip = ipaddress.ip_address(client_ip)
    except ValueError:
        return False
    for raw in allowed:
        try:
            if "/" in raw:
                if ip in ipaddress.ip_network(raw, strict=False):
                    return True
            elif ip == ipaddress.ip_address(raw):
                return True
        except ValueError:
            continue
    return False


def model_allowed(model: str, rules: str | None) -> bool:
    allowed = split_csv(rules)
    return not allowed or model in allowed
