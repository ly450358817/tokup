import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRecharge } from '../contexts/RechargeContext';
import { useLang } from '../contexts/LanguageContext';
import { keysApi } from '../utils/api';
import { streamTestChat } from '../lib/streamTestChat';
import {
  Activity, Key, Copy, Check, Terminal, Code,
  Zap, Gauge, Server, BookOpen, RefreshCw, Plus,
  Globe, BarChart3, TrendingUp,
} from 'lucide-react';

interface ApiKey {
  id: string;
  key: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface ModelPrice {
  id: string;
  name: string;
  provider: string;
  input: string;
  output: string;
  note: string;
  badge?: string;
}

const DEFAULT_MODELS: ModelPrice[] = [
  { id: 'openai/gpt-5.6-terra', name: 'GPT-5.6 Terra', provider: 'OpenAI', input: '¥18', output: '¥110', note: '旗舰 Terra', badge: 'New' },
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'OpenAI', input: '¥45', output: '¥270', note: '最新旗舰', badge: 'Hot' },
  { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'OpenAI', input: '¥10', output: '¥55', note: '最新旗舰 Luna', badge: 'New' },
  { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', provider: 'OpenAI', input: '¥45', output: '¥270', note: '高效推理 Sol', badge: 'New' },
  { id: 'anthropic/claude-fable-5', name: 'Claude Fable 5', provider: 'Anthropic', input: '¥90', output: '¥450', note: '最新 Claude', badge: 'New' },
  { id: 'claude-4.7-opus', name: 'Claude 4.7 Opus', provider: 'Anthropic', input: '¥45', output: '¥225', badge: 'New', note: '最新旗舰 Opus' },
  { id: 'claude-4.6-sonnet', name: 'Claude 4.6 Sonnet', provider: 'Anthropic', input: '¥27', output: '¥135', badge: 'New', note: '旗舰 Sonnet' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', input: '¥24', output: '¥141', badge: 'New', note: '谷歌旗舰' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', input: '¥3.0', output: '¥23', badge: '', note: '谷歌高效' },
  { id: 'x-ai/grok-4.3', name: 'Grok 4.3', provider: 'xAI', input: '¥23', output: '¥45', badge: 'New', note: 'xAI 旗舰' },
  { id: 'x-ai/grok-code-fast-1', name: 'Grok Code Fast 1', provider: 'xAI', input: '¥2.0', output: '¥14', badge: 'New', note: '代码高速' },
  { id: 'openai/gpt-5.4', name: 'GPT-5.4', provider: 'OpenAI', input: '¥45', output: '¥202', badge: 'New', note: '新一代旗舰' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5-mini', provider: 'OpenAI', input: '¥3.0', output: '¥19', badge: 'New', note: '轻量快速' },
  { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'OpenAI', input: '¥2.0', output: '¥8.0', badge: 'New', note: '开源高性价比' },
  { id: 'moonshotai/kimi-k3', name: 'Kimi K3', provider: '月之暗面', input: '¥26', output: '¥130', note: '最新旗舰 · 中国开源', badge: 'New' },
  { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6', provider: '月之暗面', input: '¥9', output: '¥36', note: '稳定可靠' },
  { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'DeepSeek', input: '¥6 / ¥12', output: '¥18 / ¥36', note: '旗舰模型 · 峰谷计价', badge: 'Hot' },
  { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', input: '¥1.5', output: '¥3.0', note: '极致性价比' },
  { id: 'deepseek/deepseek-v4-flash-vision-exp', name: 'DeepSeek V4 Flash Vision', provider: 'DeepSeek', input: '¥4', output: '¥12', note: '视觉理解 · 实验版', badge: 'New' },
  { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek', input: '¥3.0', output: '¥11.0', note: '通用模型' },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', input: '¥3.0', output: '¥4.0', note: '达GPT-5水平', badge: 'New' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', input: '¥6.0', output: '¥21.0', note: '深度推理' },
  { id: 'qwen/qwen3.7-max', name: 'Qwen 3.7 Max', provider: '通义千问', input: '¥16', output: '¥48', note: '通义旗舰' },
  { id: 'qwen/qwen3.8-max', name: 'Qwen3.8 Max', provider: '通义千问', input: '¥16', output: '¥48', note: '2.4T参数新旗舰', badge: 'New' },
  { id: 'qwen/qwen3.7-plus', name: 'Qwen 3.7 Plus', provider: '通义千问', input: '¥8', output: '¥32', note: '高性价比中杯', badge: 'New' },
  { id: 'glm-5.2', name: 'GLM-5.2', provider: '智谱AI', input: '¥11', output: '¥37', note: '1M上下文旗舰', badge: 'New' },
  { id: 'glm-5.3', name: 'GLM-5.3', provider: '智谱AI', input: '¥11', output: '¥37', note: '最新一代旗舰', badge: 'New' },
  { id: 'qwen3.5-397b-a17b', name: 'Qwen3.5 397B', provider: '通义千问', input: '¥4.0', output: '¥24.0', note: '397B超大杯旗舰', badge: 'New' },
  { id: 'MiniMax-M1', name: 'MiniMax M1', provider: 'MiniMax', input: '¥8.0', output: '¥32.0', note: '顶级推理旗舰', badge: 'New' },
  { id: 'minimax/minimax-m3', name: 'MiniMax M3', provider: 'MiniMax', input: '¥6.0', output: '¥24.0', note: '最新旗舰', badge: 'New' },
  { id: 'moonshotai/kimi-k2.7-code', name: 'Kimi K2.7 Code', provider: '月之暗面', input: '¥9', output: '¥36', note: '代码最强', badge: 'New' },
];

// Format model ID for display with proper casing
const formatModelId = (id: string, name: string): string => {
  const parts = id.split('/');
  if (parts.length === 1) return name;
  const providerMap: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    deepseek: 'DeepSeek',
    moonshotai: 'MoonshotAI',
    google: 'Google',
    qwen: 'Qwen',
  };
  const provider = providerMap[parts[0]] || parts[0];
  const modelName = name.replace(/ /g, '-');
  return `${provider}/${modelName}`;
};

export default function TransferStationPage() {
  const { openRecharge } = useRecharge();
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState('');
  const [testModel, setTestModel] = useState('gpt-5.5');
  const [models, setModels] = useState<ModelPrice[]>(DEFAULT_MODELS);
  const [testInput, setTestInput] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testReasoning, setTestReasoning] = useState('');
  const [testError, setTestError] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [subStatus, setSubStatus] = useState<any>(null);

  const handleTestSend = async () => {
    if (!testInput.trim()) return;
    setTestLoading(true);
    setTestResponse('');
    setTestReasoning('');
    setTestError('');
    try {
      const token = localStorage.getItem('tokup_token') || '';
      const result = await streamTestChat({
        model: testModel,
        messages: [{ role: 'user', content: testInput }],
        token,
        onDelta: (content, reasoning) => {
          setTestResponse(content);
          setTestReasoning(reasoning);
        },
      });
      if (result.ok) {
        // 检查余额：低于最低充值档 (2990 token) 时提示（订阅用户有免费配额不提示）
        const hasQuota = subStatus?.active && (subStatus.today_remaining || 0) > 0;
        if (!hasQuota && user?.token_balance != null && user.token_balance < 2990 && user.token_balance > 0) {
          setTimeout(() => {
            const el = document.getElementById('low-balance-prompt');
            if (el) el.classList.remove('hidden');
          }, 300);
        }
      } else {
        setTestError(result.error || '请求失败');
        if (result.error?.includes('余额不足')) {
          setTimeout(() => openRecharge(), 500);
        }
      }
    } catch (e: any) {
      setTestError(e?.message || '网络错误');
    }
    setTestLoading(false);
  };
  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [keysData, statsData] = await Promise.all([
        keysApi.list().catch(() => []),
        fetch('/api/monitor/stats', {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('tokup_token') }
        }).then(r => r.json()).catch(() => null),
      ]);
      setKeys(keysData || []);
      setStats(statsData);
      if (keysData?.length > 0) setActiveKey(keysData[0].key);
    } catch (_) {}
    setLoading(false);
  };


  useEffect(() => { loadData(); }, []);

  // 模型目录：从后端单一数据源拉取（名称/品牌/价格/备注），失败回退内置列表
  useEffect(() => {
    fetch('/api/v1/models')
      .then(r => r.json())
      .then((d: any) => {
        const list = Array.isArray(d?.data) ? d.data : [];
        if (list.length) {
          setModels(list.map((m: any) => {
            const inp = Number(m.input) || 0;
            const out = Number(m.output) || 0;
            const peak = Array.isArray(m.peak) ? [Number(m.peak[0]) || 0, Number(m.peak[1]) || 0] : null;
            const fmt = (v: number, p?: number) => p ? `¥${v} / ¥${p}` : `¥${v}`;
            return {
              id: m.id,
              name: m.name || m.id,
              provider: m.provider || '',
              input: fmt(inp, peak ? peak[0] : undefined),
              output: fmt(out, peak ? peak[1] : undefined),
              note: m.note || '',
              badge: m.badge || undefined,
            };
          }));
        }
      })
      .catch(() => { /* 保留内置列表 */ });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('tokup_token');
    if (token) {
      fetch('/api/subscription/status', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(d => setSubStatus(d))
        .catch(() => {});
    }
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCodeExample = (lang: string) => {
    const key = activeKey || 'YOUR_API_KEY';
    const baseUrl = 'https://tokup.net/v1';
    if (lang === 'curl') {
      return `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "Hello"}]}'`;
    }
    if (lang === 'Python') {
      return `from openai import OpenAI

client = OpenAI(
    api_key="${key}",
    base_url="${baseUrl}"
)

response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[{"role": "user", "content": "Hello"}]
)
print(response.choices[0].message.content)`;
    }
    if (lang === 'Node.js') {
      return `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '${key}',
  baseURL: '${baseUrl}',
});

const response = await client.chat.completions.create({
  model: 'gpt-5.5',
  messages: [{ role: 'user', content: 'Hello' }],
});

console.log(response.choices[0].message.content);`;
    }
    return '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-[12px] text-white/30">{tr('transfer.loading')}</span>
        </div>
      </div>
    );
  }

  const tokensToday = stats?.total_tokens_today || 0;
  const tokensAll = stats?.total_tokens_all || 0;
  const todayRequests = stats?.today_requests || 0;
  const avgLatency = stats?.avg_response_ms || 0;

  return (
    <div className="w-full page-container space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-white flex items-center gap-3">
            <Globe size={22} className="text-emerald-400" />
            API 工作台
            <span className="text-[11px] text-white/20 font-normal">{tr("transfer.proxySubtitle")}</span>
          </h1>
          <p className="text-[12px] text-white/30 mt-1">{tr("transfer.description")}</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:text-white/70 transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Activity size={14} className="text-emerald-400" /><span className="text-[10px] text-white/30 uppercase">{tr("monitor.todayRequests")}</span></div>
          <p className="text-[28px] font-bold text-white">{todayRequests.toLocaleString()}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Zap size={14} className="text-blue-400" /><span className="text-[10px] text-white/30 uppercase">{tr("monitor.tokensToday")}</span></div>
          <p className="text-[28px] font-bold text-white">{tokensToday.toLocaleString()}</p>
          <p className="text-[10px] text-white/20 mt-1">{tokensAll.toLocaleString()} {tr('transfer.total')}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Gauge size={14} className="text-purple-400" /><span className="text-[10px] text-white/30 uppercase">{tr("monitor.avgResponse")}</span></div>
          <p className="text-[28px] font-bold text-white">{avgLatency}<span className="text-[14px] text-white/30">ms</span></p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Server size={14} className="text-emerald-400" /><span className="text-[10px] text-white/30 uppercase">{tr("monitor.balance")}</span></div>
          <p className="text-[28px] font-bold text-white">{user?.token_balance?.toLocaleString() || '0'}</p>
        </div>
      </div>

      {/* API Key */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-medium text-white/70 flex items-center gap-2"><Key size={14} /> {tr("transfer.yourApiKey")}</h3>
          <a href="/keys" className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1">
            <Plus size={10} /> {tr("transfer.manageKeys")}
          </a>
        </div>
        {keys.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <select
                value={activeKey}
                onChange={(e) => setActiveKey(e.target.value)}
                className="flex-1 min-w-0 bg-[#13131D] border border-white/[0.08] rounded-xl px-3 py-3 text-[12px] font-mono text-emerald-400 outline-none"
              >
                {keys.map((k) => (
                  <option key={k.id} value={k.key} className="text-white">{k.key.substring(0, 20)}... — {k.name}</option>
                ))}
              </select>
              <button onClick={() => handleCopy(activeKey)}
                className="flex items-center gap-1.5 px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:text-white/70 transition-all shrink-0">
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied ? tr("common.copied") : tr("common.copy")}
              </button>
            </div>
            <p className="text-[11px] text-white/20 font-mono break-all select-all">{activeKey}</p>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-[12px] text-white/40">{tr("transfer.noKeys")}</p>
            <a href="/keys" className="inline-block mt-3 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">{tr("transfer.createKey")}</a>
          </div>
        )}
      </div>

      {/* Chat Test */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-emerald-400" />
          <h3 className="text-[13px] font-medium text-white/70">快速体验 — 试试对话</h3>
          <span className="text-[10px] text-white/20 ml-auto">余额: ¥{(user?.token_balance || 0).toFixed(1)}</span>
        </div>
        <div className="space-y-3">
          {/* Model selector */}
          <div className="flex gap-3">
            <select
              value={testModel}
              onChange={(e) => setTestModel(e.target.value)}
              className="flex-1 bg-[#13131D] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[12px] text-white/60 outline-none"
            >
              {models.filter(m => !m.id.includes('coming-soon')).map((m) => (
                <option key={m.id} value={m.id}>{m.name} — {m.provider}</option>
              ))}
            </select>
          </div>
          {/* Input + Send */}
          <div className="flex gap-3">
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="输入你想问的问题，按 Enter 发送..."
              rows={2}
              className="flex-1 bg-[#13131D] border border-white/[0.08] rounded-xl px-4 py-3 text-[12px] text-white/60 outline-none resize-none"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTestSend(); } }}
            />
            <button
              onClick={handleTestSend}
              disabled={testLoading || !testInput.trim()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] hover:bg-emerald-500/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all self-end"
            >
              {testLoading ? '发送中...' : '发送'}
            </button>
          </div>
          {/* Response */}
          {(testResponse || testReasoning) && (
            <div className="bg-[#13131D] rounded-xl p-4 max-h-72 overflow-y-auto space-y-2">
              {testReasoning && (
                <details className="text-[10px] text-white/30">
                  <summary className="cursor-pointer select-none">💭 思考过程（{testReasoning.length} 字）</summary>
                  <pre className="mt-1 whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">{testReasoning}</pre>
                </details>
              )}
              {testResponse && (
                <pre className="text-[11px] text-white/60 font-mono whitespace-pre-wrap break-all leading-relaxed">{testResponse}</pre>
              )}
            </div>
          )}
          {/* Low balance prompt after test */}
          <div id="low-balance-prompt" className="hidden flex items-center justify-between px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mt-2">
            <div>
              <p className="text-[12px] text-amber-400/90 font-medium">余额告急</p>
              <p className="text-[10px] text-white/40">当前余额 {user?.token_balance?.toLocaleString() || 0} Token，体验完可去充值</p>
            </div>
            <button
              onClick={openRecharge}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-[11px] font-medium hover:bg-amber-500/25 transition-all shrink-0"
            >
              去充能
            </button>
          </div>
          {testError && (
            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
              <p className="text-[11px] text-red-300">{testError}</p>
            </div>
          )}
        </div>
      </div>

      {/* {tr("transfer.modelPricing")} */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4 flex items-center gap-2"><BarChart3 size={14} /> {tr("transfer.modelPricing")}</h3>
        <p className="text-[11px] text-white/40 mb-4">{tr("transfer.priceNote")} — no separate billing needed.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left text-white/30 font-medium pb-3 pr-3">{tr('transfer.tableModel')}</th>
                <th className="text-left text-white/30 font-medium pb-3 pr-3">{tr('transfer.tableName')}</th>
                <th className="text-left text-white/30 font-medium pb-3 pr-3">{tr('transfer.tableProvider')}</th>
                <th className="text-right text-white/30 font-medium pb-3 pr-3">{tr('transfer.tableInput')}</th>
                <th className="text-right text-white/30 font-medium pb-3">{tr('transfer.tableOutput')}</th>
                <th className="text-right text-white/30 font-medium pb-3 pl-3"></th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-b border-white/[0.02] last:border-0">
                  <td className="py-3 pr-3 font-mono text-[11px] text-white/50">{formatModelId(m.id, m.name)}</td>
                  <td className="py-3 pr-3 text-white/70">{m.name}</td>
                  <td className="py-3 pr-3 text-white/40">{m.provider}</td>
                  <td className="py-3 pr-3 text-right text-white/60">{m.input}/1M</td>
                  <td className="py-3 text-right text-white/60">{m.output}/1M</td>
                  <td className="py-3 pl-3 text-right">{m.badge && (() => {
  const badgeColors: Record<string, string> = {
    'New': 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    'Hot': 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    '上游未接入': 'bg-red-500/10 border-red-500/20 text-red-400',
    '暂不可用': 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  };
  const cls = badgeColors[m.badge] || 'bg-gray-500/10 border-gray-500/20 text-gray-400';
  return <span className={'text-[10px] px-1.5 py-0.5 rounded-full border ' + cls}>{m.badge}</span>;
})()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-white/35 mt-3">DeepSeek V4 Pro 为峰谷计价：斜杠前为闲时价、后为高峰价（高峰时段：每日 9:00–12:00、14:00–18:00 北京时间）；其余模型为一口价。</p>
      </div>

      <div className="text-center pt-4">
        <a href="/docs" className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 hover:underline">
          <BookOpen size={12} /> {tr("transfer.viewGuide")}
        </a>
      </div>

      {/* Active endpoints */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4 flex items-center gap-2"><Globe size={14} /> {tr("transfer.apiEndpoints")}</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">POST</span>
            <code className="text-[12px] text-white/60 font-mono">/v1/chat/completions</code>
            <span className="text-[11px] text-white/30 ml-auto">{tr("transfer.chatEndpoint")}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono font-bold">GET</span>
            <code className="text-[12px] text-white/60 font-mono">/v1/models</code>
            <span className="text-[11px] text-white/30 ml-auto">{tr("transfer.modelsEndpoint")}</span>
          </div>
        </div>
      </div>

      </div>
  );
}
