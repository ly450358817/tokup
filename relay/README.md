# TokUp 备用入口（Cloudflare Pages 反代）

## 为什么需要
国内部分网络对 `tokup.net` 做了 SNI 层拦截（TLS ClientHello 后被重置），
表现为：Chrome 靠 ECH/HTTP3 能开，但 curl / 老浏览器 / 部分 App 打不开。

## 方案
用 Cloudflare Pages 的免费子域 `tokup-relay.pages.dev` 做反向代理 → 转发到 `https://tokup.net`。
`pages.dev` 未被拦截，用户/API 客户端改用它即可正常访问。

## 现状（2026-09-13 部署并验证）
- 项目：tokup-relay（Pages，production 分支 main）
- 入口：https://tokup-relay.pages.dev
- 验证：/api/health 200、/api/v1/models 33 个模型、POST /api/auth/login 200、首页 200 且 bundle 与生产一致
- 限制：Pages Functions 免费额度 100k 请求/天

## 重新部署（_worker.js 必须走专门的表单字段，不能放 manifest）
```bash
ACCT=<account_id>; TOKEN=<CF_API_TOKEN>
H=$(shasum -a 256 _worker.js | cut -c1-32); IDX=$(shasum -a 256 index.html | cut -c1-32)
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCT/pages/projects/tokup-relay/deployments" \
  -H "Authorization: Bearer $TOKEN" \
  -F "manifest={\"/index.html\":{\"hash\":\"$IDX\",\"size\":$(wc -c < index.html | tr -d ' ')}}" \
  -F 'branch=main' \
  -F "_worker.js=@_worker.js;type=application/javascript" \
  -F "$IDX=@index.html;type=text/html"
```
需要的 CF 权限：账户 → Cloudflare Pages → 编辑
