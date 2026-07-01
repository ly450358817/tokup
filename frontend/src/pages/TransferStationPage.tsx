import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';
import { keysApi } from '../utils/api';
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

const models: ModelPrice[] = [
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'OpenAI', input: '¥30', output: '¥90', note: '最新旗舰', badge: 'Hot' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', input: '¥15', output: '¥45', note: '快速推理' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', input: '¥20', output: '¥60', note: '通用主力', badge: 'Hot' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', input: '¥1.5', output: '¥4.5', note: '轻量高效' },
  { id: 'o4-mini', name: 'o4-mini', provider: 'OpenAI', input: '¥8', output: '¥24', note: '轻量推理' },
  { id: 'anthropic/claude-fable-5', name: 'Claude Fable 5', provider: 'Anthropic', input: '¥25', output: '¥100', note: '最新 Claude', badge: 'New' },
  { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', provider: 'Anthropic', input: '¥20', output: '¥80', note: '最强推理', badge: 'Hot' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', input: '¥15', output: '¥75', note: '稳定可靠' },
  { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic', input: '¥1.5', output: '¥6', note: '快速响应' },
  { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'DeepSeek', input: '¥0.8', output: '¥1.6', note: '旗舰模型', badge: 'Hot' },
  { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', input: '¥0.3', output: '¥0.6', note: '极致性价比' },
  { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek', input: '¥0.5', output: '¥1.0', note: '通用模型' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', input: '¥1.0', output: '¥2.0', note: '深度推理' },
  { id: 'qwen/qwen3.7-max', name: 'Qwen 3.7 Max', provider: '通义千问', input: '¥5.0', output: '¥15.0', note: '通义旗舰' },
  { id: 'qwen3-max', name: 'Qwen3 Max', provider: '通义千问', input: '¥3.0', output: '¥9.0', note: '通义旗舰' },
  { id: 'qwen3-coder-480b-a35b-instruct', name: 'Qwen3 Coder 480B', provider: '通义千问', input: '¥4.0', output: '¥12.0', note: '代码专用' },
  { id: 'glm-4.5', name: 'GLM-4.5', provider: '智谱AI', input: '¥3.0', output: '¥9.0', note: '智谱旗舰' },
  { id: 'doubao-seed-1.6', name: 'Doubao Seed 1.6', provider: '字节跳动', input: '¥1.5', output: '¥4.5', note: '豆包旗舰' },
  { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6', provider: '月之暗面', input: '¥4.0', output: '¥12.0', note: 'Kimi 最新', badge: 'New' },
];

export default function TransferStationPage() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState('');
  const [testModel, setTestModel] = useState('gpt-4o');
  const [testInput, setTestInput] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testError, setTestError] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const handleTestSend = async () => {
    if (!testInput.trim()) return;
    setTestLoading(true);
    setTestResponse('');
    setTestError('');
    try {
      const token = localStorage.getItem('tokup_token');
      const res = await fetch('/api/v1/test/chat', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + (token || ''), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: testModel, messages: [{ role: 'user', content: testInput }] })
      });
      const data = await res.json();
      if (data.success) {
        const msg = data.data?.choices?.[0]?.message?.content || JSON.stringify(data.data, null, 2);
        setTestResponse(msg);
      } else {
        setTestError(data.detail || '请求失败');
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
    model="gpt-4o",
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
  model: 'gpt-4o',
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
          <span className="text-[12px] text-white/30">Loading transfer station...</span>
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
            中转站
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
          <p className="text-[10px] text-white/20 mt-1">{tokensAll.toLocaleString()} total</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Gauge size={14} className="text-purple-400" /><span className="text-[10px] text-white/30 uppercase">{tr("monitor.avgResponse")}</span></div>
          <p className="text-[28px] font-bold text-white">{avgLatency}<span className="text-[14px] text-white/30">ms</span></p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Server size={14} className="text-emerald-400" /><span className="text-[10px] text-white/30 uppercase">{tr("monitor.balance")}</span></div>
          <p className="text-[28px] font-bold text-white">¥{user?.token_balance?.toFixed?.(1) || '0'}</p>
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
                className="flex-1 bg-[#0A0A0F] border border-white/[0.08] rounded-xl px-4 py-3 text-[12px] font-mono text-emerald-400 outline-none"
              >
                {keys.map((k) => (
                  <option key={k.id} value={k.key} className="text-white">{k.key.substring(0, 20)}... — {k.name}</option>
                ))}
              </select>
              <button onClick={() => handleCopy(activeKey)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:text-white/70 transition-all">
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

      {/* {tr("transfer.quickStart")} with Code Examples */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4 flex items-center gap-2"><Code size={14} /> {tr("transfer.quickStart")}</h3>
        <div className="mb-4 px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-blue-300 text-[11px]">
          {tr("transfer.baseUrl")}: <code className="font-mono text-emerald-400 select-all">https://tokup.net/v1</code>
        </div>
        {['curl', 'Python', 'Node.js'].map((lang) => (
          <div key={lang} className="mb-3 last:mb-0 rounded-xl overflow-hidden border border-white/[0.06]">
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.04]">
              <span className="flex items-center gap-2 text-[11px] text-white/50 font-mono">
                {lang === 'curl' ? <Terminal size={11} /> : <Code size={11} />} {lang}
              </span>
              <button onClick={() => handleCopy(getCodeExample(lang))}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] text-white/40 hover:text-white/70 transition-all">
                <Copy size={11} /> {tr("common.copy")}
              </button>
            </div>
            <pre className="p-4 text-[11px] text-white/50 font-mono leading-relaxed overflow-x-auto bg-[#0A0A0F]">{getCodeExample(lang)}</pre>
          </div>
        ))}
        <a href="/integration" className="inline-flex items-center gap-1.5 mt-3 text-[11px] text-emerald-400 hover:underline">
          <BookOpen size={12} /> {tr("transfer.viewGuide")}
        </a>
      </div>

      {/* {tr("transfer.modelPricing")} */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4 flex items-center gap-2"><BarChart3 size={14} /> {tr("transfer.modelPricing")}</h3>
        <p className="text-[11px] text-white/40 mb-4">{tr("transfer.priceNote")} — no separate billing needed.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left text-white/30 font-medium pb-3 pr-3">Model</th>
                <th className="text-left text-white/30 font-medium pb-3 pr-3">Name</th>
                <th className="text-left text-white/30 font-medium pb-3 pr-3">Provider</th>
                <th className="text-right text-white/30 font-medium pb-3 pr-3">Input</th>
                <th className="text-right text-white/30 font-medium pb-3">Output</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-b border-white/[0.02] last:border-0">
                  <td className="py-3 pr-3 font-mono text-[11px] text-emerald-400">{m.id}</td>
                  <td className="py-3 pr-3 text-white/70">{m.name}</td>
                  <td className="py-3 pr-3 text-white/40">{m.provider}</td>
                  <td className="py-3 pr-3 text-right text-white/60">{m.input}/1M</td>
                  <td className="py-3 text-right text-white/60">{m.output}/1M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
