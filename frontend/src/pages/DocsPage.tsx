import { useEffect, useState, useCallback } from 'react';
import { keysApi } from '../utils/api';

const CC_SWITCH_RELEASES = 'https://github.com/farion1231/cc-switch/releases';
const CC_SWITCH_DMG = 'https://github.com/farion1231/cc-switch/releases/download/v3.19.2/CC-Switch-v3.19.2-macOS.dmg';
const CC_SWITCH_MSI = 'https://github.com/farion1231/cc-switch/releases/download/v3.19.2/CC-Switch-v3.19.2-Windows.msi';
const CC_SWITCH_APPIMAGE = 'https://github.com/farion1231/cc-switch/releases/download/v3.19.2/CC-Switch-v3.19.2-Linux-x86_64.AppImage';

export default function DocsPage() {
  const [firstKey, setFirstKey] = useState('');
  const [showDownload, setShowDownload] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);

  useEffect(() => {
    keysApi
      .list()
      .then((keys) => setFirstKey(keys.length ? keys[0].key : ''))
      .catch(() => setFirstKey(''));
  }, []);

  const buildImportLink = (key: string) => {
    const params = new URLSearchParams({
      resource: 'provider',
      app: 'codex',
      name: 'TokUp',
      homepage: 'https://tokup.net',
      endpoint: 'https://tokup.net/api/v1',
      model: 'gpt-5.5',
      apiKey: key,
    });
    return `ccswitch://v1/import?${params.toString()}`;
  };

  const openImportLink = useCallback(() => {
    if (!firstKey) return;
    const link = buildImportLink(firstKey);
    let wentHidden = false;
    const onVis = () => {
      if (document.hidden) wentHidden = true;
    };
    document.addEventListener('visibilitychange', onVis);
    // 触发 CC Switch 深链；如果 4 秒内页面从未隐藏过，大概率没装 CC Switch
    window.location.href = link;
    setDetecting(true);
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', onVis);
      setDetecting(false);
      if (!wentHidden) setShowDownload(true);
    }, 4000);
  }, [firstKey]);

  const DIRECT_CONFIG = `model_provider = "custom"
model = "gpt-5.5"
model_reasoning_effort = "medium"
disable_response_storage = true

[model_providers.custom]
name = "custom"
base_url = "https://tokup.net/api/v1"
wire_api = "responses"
requires_openai_auth = true`;

  const copyDirectConfig = async () => {
    try {
      await navigator.clipboard.writeText(DIRECT_CONFIG);
      setConfigCopied(true);
      window.setTimeout(() => setConfigCopied(false), 2000);
    } catch {
      window.prompt('请手动复制下面的配置：', DIRECT_CONFIG);
    }
  };

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
        <div className="bg-[#13131D] rounded-xl overflow-hidden mb-5">
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
                <td className="px-4 py-2.5 font-mono text-white/40">刚才复制的 Key（以 <strong className="text-emerald-400">tok-</strong> 开头）</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-white/60">模型选择</td>
                <td className="px-4 py-2.5 font-mono text-emerald-400/80">deepseek/deepseek-v4-flash（快）· gpt-5.5（强）· kimi-k2.6 等，见下方「快模型推荐」</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Codex 桌面版 / CLI（用 CC Switch） */}
        <div className="bg-[#13131D] rounded-xl p-4 mb-3">
          <h4 className="text-[12px] font-medium text-white/60 mb-2">Codex 桌面版 / CLI</h4>
          <p className="text-[12px] text-white/40 leading-relaxed mb-2">
            Codex 是支持直连的，只是入口藏在一个配置文件里（CC Switch 就是帮你改这个文件的小工具）。
            两种方式任选：<strong className="text-white/70">方式一</strong>用 CC Switch 一键配置（最省事，推荐小白）；
            <strong className="text-white/70">方式二</strong>不装软件、手动改 1 个文件（见下方）。先看方式一，用免费的{" "}
            <a
              href={CC_SWITCH_RELEASES}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:text-emerald-300"
            >
              CC Switch
            </a>{" "}
            一键配置（TokUp 原生直连，不需要任何本地路由 / 中转）：
          </p>
          {firstKey ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4">
              <p className="text-[12px] text-white/70 mb-2">
                最快方式：用你最近创建的 API Key 一键导入
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={openImportLink}
                  disabled={detecting}
                  className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-[12px] font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                >
                  {detecting ? '正在唤起 CC Switch…' : '一键导入 CC Switch'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDownload(true)}
                  className="inline-flex items-center rounded-lg border border-white/15 px-3 py-2 text-[12px] font-medium text-white/70 hover:bg-white/5"
                >
                  还没装 CC Switch？先下载
                </button>
              </div>
              <p className="text-[11px] text-white/40 mt-1 mb-3">
                点击后 CC Switch 会弹出确认窗口，检查无误点「导入」；
                如果没反应，说明还没安装 CC Switch，会自动弹出下载窗口
              </p>
              <img
                src="/assets/cc-switch/cc-switch-import-confirm.png"
                alt="CC Switch 一键导入 TokUp 确认窗口"
                className="w-full max-w-xl rounded-lg border border-white/10"
              />
            </div>
          ) : (
            <p className="text-[12px] text-white/40 leading-relaxed mb-3">
              先在后台创建 API Key，再回到这里就会出现一键导入按钮
            </p>
          )}
          <h5 className="text-[12px] font-medium text-white/60 mb-2">手动添加也行：</h5>
          <ol className="list-decimal list-inside text-[12px] text-white/40 leading-relaxed space-y-1 mb-3">
            <li>
              下载安装 CC Switch（macOS 也可执行{" "}
              <code className="font-mono text-emerald-400">brew install --cask cc-switch</code>）
            </li>
            <li>打开 CC Switch → 选 <strong className="text-white/70">Codex</strong> → 点右上角 <strong className="text-white/70">+ 添加供应商</strong></li>
            <li>供应商类型选 <strong className="text-white/70">自定义 / OpenAI 兼容</strong>，按下图填：</li>
          </ol>
          <img
            src="/assets/cc-switch/cc-switch-tokup-edit.png"
            alt="CC Switch 添加 TokUp 供应商配置"
            className="w-full max-w-xl rounded-lg border border-white/10 mb-3"
          />
          <p className="text-[12px] text-white/40 leading-relaxed mb-2">
            名称填 <strong className="text-white/70">TokUp</strong>，请求地址填{" "}
            <code className="font-mono text-emerald-400">https://tokup.net/api/v1</code>，API Key 填刚才复制的 Key；
            上游格式选 <strong className="text-white/70">Responses（原生直连）</strong>，默认模型可以先填{" "}
            <code className="font-mono text-emerald-400">gpt-5.5</code>
          </p>
          <p className="text-[12px] text-white/40 leading-relaxed mb-2">
            <strong className="text-white/70">想换模型：</strong>在模型输入框右侧点{" "}
            <strong className="text-emerald-400">「获取模型列表」</strong>，会自动拉取 TokUp 全部模型
            （gpt-5.5、deepseek-v4-pro / v4-flash、claude-fable-5、kimi-k2.6、qwen3、glm-5.2 等 20+ 个），
            然后从下拉里选一个就行
          </p>
          <img
            src="/assets/cc-switch/cc-switch-tokup-card.png"
            alt="CC Switch Codex 供应商列表中的 TokUp"
            className="w-full max-w-xl rounded-lg border border-white/10 mb-3"
          />
          <p className="text-[12px] text-white/40 leading-relaxed">
            回到列表点 TokUp 右侧的 <strong className="text-white/70">启用</strong>，然后完全退出并重启 Codex 就能用了；
            TokUp 是 <strong className="text-white/70">Responses 原生直连</strong>，不需要开启本地路由，也不会走任何中转
          </p>
          <p className="text-[12px] text-white/40 leading-relaxed mt-2">
            如果桌面端模型列表没显示 TokUp 模型：在 CC Switch 设置里开启{" "}
            <strong className="text-white/70">保留官方登录</strong>，或命令行启动 Codex 后在{" "}
            <code className="font-mono text-emerald-400">/model</code> 里选择
          </p>

          {/* 方式二：不装 CC Switch 手动直连 */}
          <div className="border-t border-white/[0.06] mt-4 pt-4">
            <h5 className="text-[12px] font-medium text-emerald-400/90 mb-2">方式二：不想装 CC Switch？手动改一个文件就行</h5>
            <p className="text-[12px] text-white/40 leading-relaxed mb-2">
              其实 Codex 天生就能直连 TokUp，不需要任何中转。只是入口藏在一个配置文件里，
              CC Switch 只是帮你改这个文件的工具。不装软件也行，照下面 5 步做：
            </p>
            <ol className="list-decimal list-inside text-[12px] text-white/40 leading-relaxed space-y-1.5 mb-3">
              <li>
                复制你的 API Key（<code className="font-mono text-emerald-400">tok-</code> 开头那串）
              </li>
              <li>
                找到 Codex 的配置文件{" "}
                <code className="font-mono text-emerald-400">~/.codex/config.toml</code>：
                苹果电脑打开「终端」输入{" "}
                <code className="font-mono text-emerald-400">open ~/.codex</code> 回车；
                Windows 在文件资源管理器地址栏输入{" "}
                <code className="font-mono text-emerald-400">%USERPROFILE%\.codex</code> 回车
              </li>
              <li>
                用「文本编辑 / 记事本」打开 config.toml，把里面的内容<strong className="text-white/70">全部删掉</strong>，
                粘贴下面这段（点按钮一键复制）：
              </li>
            </ol>
            <div className="relative mb-3">
              <pre className="rounded-lg bg-black/40 border border-white/10 p-3 text-[11px] font-mono text-emerald-300/90 overflow-x-auto whitespace-pre">{DIRECT_CONFIG}</pre>
              <button
                type="button"
                onClick={copyDirectConfig}
                className="absolute top-2 right-2 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-emerald-400"
              >
                {configCopied ? '已复制 ✓' : '复制配置'}
              </button>
            </div>
            <ol className="list-decimal list-inside text-[12px] text-white/40 leading-relaxed space-y-1.5 mb-2" start={4}>
              <li>
                告诉 Codex 你的 Key（终端里执行，把{" "}
                <code className="font-mono text-emerald-400">tok-你的Key</code> 换成你复制的）：
                <br />
                苹果电脑：<code className="font-mono text-emerald-400">echo 'export OPENAI_API_KEY=tok-你的Key' &gt;&gt; ~/.zshrc &amp;&amp; source ~/.zshrc</code>
                <br />
                Windows：<code className="font-mono text-emerald-400">setx OPENAI_API_KEY "tok-你的Key"</code>
              </li>
              <li>
                完全退出 Codex 再重新打开，就能用了。想换模型？把配置里{" "}
                <code className="font-mono text-emerald-400">gpt-5.5</code> 换成别的（见下方「快模型推荐」）
              </li>
            </ol>
          </div>
        </div>

        {/* 常用软件速查 */}
        <div className="bg-[#13131D] rounded-xl p-4 mb-3">
          <h4 className="text-[12px] font-medium text-white/60 mb-2">常用软件速查（都是同一套参数）</h4>
          <p className="text-[12px] text-white/40 leading-relaxed mb-3">
            所有软件统一用「<strong className="text-white/70">自定义 / OpenAI 兼容</strong>」类型，地址填{" "}
            <code className="font-mono text-emerald-400">https://tokup.net/v1</code>（或 /api/v1），Key 填 tok- 开头，
            模型填 <code className="font-mono text-emerald-400">deepseek/deepseek-v4-flash</code>。
            <strong className="text-amber-400/90">千万别选软件自带的「DeepSeek / OpenAI 官方预设」</strong>，那会请求官方服务器、不认 TokUp 的 Key。
          </p>
          <div className="bg-[#13131D] rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left px-4 py-2 text-white/40 font-medium">软件</th>
                  <th className="text-left px-4 py-2 text-white/40 font-medium">入口</th>
                  <th className="text-left px-4 py-2 text-white/40 font-medium">要点</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/[0.04]">
                  <td className="px-4 py-2 text-white/70">Chatbox（电脑/手机）</td>
                  <td className="px-4 py-2 text-white/40">设置 → 模型提供方 → 添加自定义提供方</td>
                  <td className="px-4 py-2 text-white/40">别选 DeepSeek 预设；模型手动填</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="px-4 py-2 text-white/70">RikkaHub（安卓）</td>
                  <td className="px-4 py-2 text-white/40">设置 → 提供商 → 添加，类型选 OpenAI</td>
                  <td className="px-4 py-2 text-white/40">Base URL 填 https://tokup.net/api/v1</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="px-4 py-2 text-white/70">恋语 LianYu（安卓）</td>
                  <td className="px-4 py-2 text-white/40">我的 → API 设置 → 添加/编辑</td>
                  <td className="px-4 py-2 text-white/40">类型选 OpenAI 兼容/Custom；只让填 Key 没地址框 = 选错预设了</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="px-4 py-2 text-white/70">Cursor</td>
                  <td className="px-4 py-2 text-white/40">Settings → Models → OpenAI API Key</td>
                  <td className="px-4 py-2 text-white/40">地址填 https://tokup.net/api/v1</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="px-4 py-2 text-white/70">LobeChat / NextChat / OpenCat / Cherry Studio</td>
                  <td className="px-4 py-2 text-white/40">设置 → 自定义模型服务商 / 添加供应商</td>
                  <td className="px-4 py-2 text-white/40">OpenAI 兼容，地址 https://tokup.net/v1</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-white/70">沉浸式翻译 / 其他 OpenAI 兼容工具</td>
                  <td className="px-4 py-2 text-white/40">自定义 API / 中转地址</td>
                  <td className="px-4 py-2 text-white/40">同上，一套参数通用</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 快模型推荐 */}
        <div className="bg-[#13131D] rounded-xl p-4 mb-3">
          <h4 className="text-[12px] font-medium text-white/60 mb-2">快模型推荐（日常聊天选这些）</h4>
          <p className="text-[12px] text-white/40 leading-relaxed mb-3">
            觉得回复慢？先换快模型。价格为 ¥/百万 Token（输入/输出）。gpt-5.5、claude-fable-5、deepseek-v4-pro
            是「思考型」模型，想得久、回复慢是正常的，追求速度别选它们。
          </p>
          <div className="bg-[#13131D] rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left px-4 py-2 text-white/40 font-medium">模型（原样填写，区分大小写）</th>
                  <th className="text-left px-4 py-2 text-white/40 font-medium">价格</th>
                  <th className="text-left px-4 py-2 text-white/40 font-medium">定位</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/[0.04]">
                  <td className="px-4 py-2 font-mono text-emerald-400">deepseek/deepseek-v4-flash</td>
                  <td className="px-4 py-2 text-white/60">¥1.5 / ¥3</td>
                  <td className="px-4 py-2 text-white/60">最快 · 最便宜 · 首选</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="px-4 py-2 font-mono text-emerald-400/80">qwen3.5-397b-a17b</td>
                  <td className="px-4 py-2 text-white/60">¥4 / ¥24</td>
                  <td className="px-4 py-2 text-white/60">快 · 性价比高</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="px-4 py-2 font-mono text-emerald-400/80">minimax/minimax-m3</td>
                  <td className="px-4 py-2 text-white/60">¥6 / ¥24</td>
                  <td className="px-4 py-2 text-white/60">快 · 均衡</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="px-4 py-2 font-mono text-emerald-400/80">openai/gpt-5.6-luna</td>
                  <td className="px-4 py-2 text-white/60">¥10 / ¥55</td>
                  <td className="px-4 py-2 text-white/60">快 · 质量更好</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-white/40">gpt-5.5 / claude-fable-5 / deepseek-v4-pro</td>
                  <td className="px-4 py-2 text-white/40">较贵</td>
                  <td className="px-4 py-2 text-white/40">思考型 · 慢 · 追求速度别选</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-[#13131D] rounded-xl p-4">
          <h4 className="text-[12px] font-medium text-white/60 mb-2">TokUp 就是 API，原生直连</h4>
          <p className="text-[12px] text-white/40 leading-relaxed">
            TokUp 本身就是 OpenAI 兼容接口，支持 Responses 原生直连，任何支持自定义 API 的客户端都能直接配，
            不用经过任何中转，也不需要本地路由。
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
            <p className="text-[12px] font-medium text-white/60 mb-1">为什么 CC Switch 里只看到 gpt-5.5？</p>
            <p className="text-[12px] text-white/40">
              一键导入默认填的是 gpt-5.5。想用其他模型，在供应商编辑页的模型输入框右侧点「获取模型列表」，
              会自动拉取 TokUp 全部模型，从下拉里选一个即可
            </p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-white/60 mb-1">Chatbox / 恋语连不上，提示 Key 无效或 role 报错？</p>
            <p className="text-[12px] text-white/40">
              八成是选了软件自带的「DeepSeek / OpenAI 官方预设」——它请求的是官方服务器，不认 TokUp 的 tok- Key。
              改用「自定义 / OpenAI 兼容」服务商，地址填 https://tokup.net/v1（或 /api/v1），
              Key 填 tok- 开头的那个，模型填 deepseek/deepseek-v4-flash 即可。
            </p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-white/60 mb-1">没用完能退吗？</p>
            <p className="text-[12px] text-white/40">数字商品不适用七天无理由退货；未使用余额原则上不退，平台原因、错误扣款、未成年人等法定情形除外，可联系客服处理。Token 长期有效不过期。</p>
          </div>
        </div>
      </div>

      {/* 未检测到 CC Switch 的下载弹窗 */}
      {showDownload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#13131D] p-6">
            <h3 className="text-[15px] font-semibold text-white mb-1">还没安装 CC Switch？</h3>
            <p className="text-[12px] text-white/40 leading-relaxed mb-4">
              需要先安装免费的 CC Switch，才能一键导入 TokUp。按你的系统选一个下载（都是官方渠道）：
            </p>
            <div className="space-y-2 mb-4">
              <a
                href={CC_SWITCH_DMG}
                className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-2.5 text-[12px] text-white/70 hover:bg-white/5"
              >
                <span>macOS（Intel / Apple 芯片）</span>
                <span className="text-emerald-400">下载 .dmg</span>
              </a>
              <a
                href={CC_SWITCH_MSI}
                className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-2.5 text-[12px] text-white/70 hover:bg-white/5"
              >
                <span>Windows</span>
                <span className="text-emerald-400">下载 .msi</span>
              </a>
              <a
                href={CC_SWITCH_APPIMAGE}
                className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-2.5 text-[12px] text-white/70 hover:bg-white/5"
              >
                <span>Linux</span>
                <span className="text-emerald-400">下载 .AppImage</span>
              </a>
              <a
                href={CC_SWITCH_RELEASES}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-2.5 text-[12px] text-white/70 hover:bg-white/5"
              >
                <span>其他版本 / 更新日志</span>
                <span className="text-emerald-400">GitHub Releases ↗</span>
              </a>
              <div className="rounded-lg border border-white/10 px-4 py-2.5 text-[12px] text-white/70">
                <div className="mb-1">macOS 也可以用 Homebrew 一行装：</div>
                <code className="font-mono text-emerald-400">brew install --cask cc-switch</code>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openImportLink}
                className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-[12px] font-semibold text-black hover:bg-emerald-400"
              >
                我已安装，重新导入
              </button>
              <button
                type="button"
                onClick={() => setShowDownload(false)}
                className="rounded-lg border border-white/15 px-4 py-2.5 text-[12px] text-white/70 hover:bg-white/5"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
