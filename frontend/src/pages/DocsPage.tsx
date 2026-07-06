export default function DocsPage() {
  return (
    <div className="w-full page-container space-y-8">
      {/* 标题 */}
      <div>
        <h1 className="text-[20px] font-semibold text-white">TokUp · 脉充 — 接入指南</h1>
        <p className="text-[12px] text-white/30 mt-1">如果你已有 TokUp 账号，按这三步走</p>
      </div>

      {/* 第一步 */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-3">1. 获取 API Key</h3>
        <p className="text-[12px] text-white/50 leading-relaxed">
          登录 <a href="/dashboard" className="text-emerald-400 hover:text-emerald-300">后台</a> → <strong className="text-white/80">API 密钥</strong> → 点"创建" → 复制 Key
        </p>
      </div>

      {/* 第二步 */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-3">2. 配置你的客户端</h3>
        <p className="text-[12px] text-white/40 mb-4">所有兼容 OpenAI 的软件，按下面填就行：</p>

        {/* 配置表 */}
        <div className="bg-[#0A0A0F] rounded-xl overflow-hidden mb-5">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left px-4 py-2.5 text-white/40 font-medium">配置项</th>
                <th className="text-left px-4 py-2.5 text-white/40 font-medium">填什么</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/[0.04]">
                <td className="px-4 py-2.5 text-white/60">请求地址</td>
                <td className="px-4 py-2.5 font-mono text-emerald-400">https://tokup.net/api/v1</td>
              </tr>
              <tr className="border-b border-white/[0.04]">
                <td className="px-4 py-2.5 text-white/60">API Key</td>
                <td className="px-4 py-2.5 font-mono text-white/40">刚才复制的那个 Key</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-white/60">模型选择</td>
                <td className="px-4 py-2.5 font-mono text-emerald-400/80">gpt-5.5、deepseek-v4-flash 等</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Codex */}
        <div className="bg-[#0A0A0F] rounded-xl p-4 mb-3">
          <h4 className="text-[12px] font-medium text-white/60 mb-2">Codex 用户</h4>
          <p className="text-[12px] text-white/40 leading-relaxed">
            打开 CC Switch → 添加供应商 → 服务器地址填 <code className="font-mono text-emerald-400">https://tokup.net/api/v1</code> → API Key 填你的 Key → 选择 <code className="font-mono text-emerald-400">gpt-5.5</code> 模型 → 保存即可使用
          </p>
        </div>

        {/* 其他客户端 */}
        <div className="bg-[#0A0A0F] rounded-xl p-4">
          <h4 className="text-[12px] font-medium text-white/60 mb-2">其他客户端（Chatbox、LobeChat、OpenCat 等）</h4>
          <p className="text-[12px] text-white/40 leading-relaxed">
            设置 → 自定义 API → 填上面三个配置项 → 保存
          </p>
        </div>
      </div>

      {/* 第三步 */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-3">3. 开始使用</h3>
        <p className="text-[12px] text-white/50 leading-relaxed">
          所有模型共享余额，按量扣费，用完再充
        </p>
      </div>

      {/* 常见问题 */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">常见问题</h3>
        <div className="space-y-4">
          <div>
            <p className="text-[12px] font-medium text-white/60 mb-1">充多少钱？</p>
            <p className="text-[12px] text-white/40">¥1 = 100 Token</p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-white/60 mb-1">都能用啥模型？</p>
            <p className="text-[12px] text-white/40">GPT-5.5、DeepSeek V4、Claude Fable 5、Qwen3、Kimi K2.6…</p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-white/60 mb-1">没用完能退吗？</p>
            <p className="text-[12px] text-white/40">不支持退款，但 Token 长期有效不过期</p>
          </div>
        </div>
      </div>
    </div>
  );
}
