import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRecharge } from '../contexts/RechargeContext';
import { useLang } from '../contexts/LanguageContext';
import { dashboardApi, subscriptionApi } from '../utils/api';
import EnergyRing from '../components/Energy/EnergyRing';
import {
  Activity,
  Key,
  TrendingUp,
  Zap,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const DEFAULT_MODELS = [
  { id: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra', provider: 'OpenAI', cost: '¥18/1M input' },
  { id: 'gpt-5.5', label: 'GPT-5.5', provider: 'OpenAI', cost: '¥45/1M input' },
  { id: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna', provider: 'OpenAI', cost: '¥10/1M input' },
  { id: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol', provider: 'OpenAI', cost: '¥45/1M input' },
  { id: 'openai/gpt-5.4', label: 'GPT-5.4', provider: 'OpenAI', cost: '¥45/1M input' },
  { id: 'openai/gpt-5-mini', label: 'GPT-5-mini', provider: 'OpenAI', cost: '¥3/1M input' },
  { id: 'gpt-oss-120b', label: 'GPT-OSS 120B', provider: 'OpenAI', cost: '¥2/1M input' },
  { id: 'anthropic/claude-fable-5', label: 'Claude Fable 5', provider: 'Anthropic', cost: '¥90/1M input' },
  { id: 'claude-4.7-opus', label: 'Claude 4.7 Opus', provider: 'Anthropic', cost: '¥45/1M input' },
  { id: 'claude-4.6-sonnet', label: 'Claude 4.6 Sonnet', provider: 'Anthropic', cost: '¥27/1M input' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google', cost: '¥24/1M input' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google', cost: '¥3/1M input' },
  { id: 'x-ai/grok-4.3', label: 'Grok 4.3', provider: 'xAI', cost: '¥23/1M input' },
  { id: 'x-ai/grok-code-fast-1', label: 'Grok Code Fast 1', provider: 'xAI', cost: '¥2/1M input' },
  { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', provider: 'DeepSeek', cost: '¥6~¥12/1M input (闲时~高峰)' },
  { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash', provider: 'DeepSeek', cost: '¥1.5/1M input' },
  { id: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2', provider: 'DeepSeek', cost: '¥3.0/1M input' },
  { id: 'deepseek-v3', label: 'DeepSeek V3', provider: 'DeepSeek', cost: '¥3.0/1M input' },
  { id: 'deepseek-r1', label: 'DeepSeek R1', provider: 'DeepSeek', cost: '¥6.0/1M input' },
  { id: 'deepseek/deepseek-v4-flash-vision-exp', label: 'DeepSeek V4 Flash Vision', provider: 'DeepSeek', cost: '¥4/1M input' },
  { id: 'qwen/qwen3.8-max', label: 'Qwen3.8 Max', provider: '通义千问', cost: '¥16/1M input' },
  { id: 'qwen/qwen3.7-max', label: 'Qwen 3.7 Max', provider: '通义千问', cost: '¥16/1M input' },
  { id: 'qwen/qwen3.7-plus', label: 'Qwen 3.7 Plus', provider: '通义千问', cost: '¥8/1M input' },
  { id: 'qwen3.5-397b-a17b', label: 'Qwen3.5 397B', provider: '通义千问', cost: '¥4.0/1M input' },
  { id: 'glm-5.3', label: 'GLM-5.3', provider: '智谱AI', cost: '¥11/1M input' },
  { id: 'glm-5.2', label: 'GLM-5.2', provider: '智谱AI', cost: '¥11/1M input' },
  { id: 'moonshotai/kimi-k3', label: 'Kimi K3', provider: '月之暗面', cost: '¥26/1M input' },
  { id: 'moonshotai/kimi-k2.7-code', label: 'Kimi K2.7 Code', provider: '月之暗面', cost: '¥9/1M input' },
  { id: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6', provider: '月之暗面', cost: '¥9/1M input' },
  { id: 'MiniMax-M1', label: 'MiniMax M1', provider: 'MiniMax', cost: '¥8.0/1M input' },
  { id: 'minimax/minimax-m3', label: 'MiniMax M3', provider: 'MiniMax', cost: '¥6.0/1M input' },
];


const TIME_RANGES = [
  { key: 'last7d', days: 7 },
  { key: 'last1m', days: 30 },
  { key: 'last3m', days: 90 },
  { key: 'last6m', days: 180 },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { openRecharge } = useRecharge();
  const { t } = useLang();
  const [stats, setStats] = useState<any>(null);
  const [subStatus, setSubStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [lastSync, setLastSync] = useState('');
  const [showAllModels, setShowAllModels] = useState(false);
  const [models, setModels] = useState(DEFAULT_MODELS);

  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };

  const loadStats = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const data = await dashboardApi.stats(d);
      setStats(data);
      setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load stats', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats(days);
  }, [days, loadStats]);

  useEffect(() => {
    // 订阅状态轮询（15s）：让"今日免费剩余"随用户调用实时变动；切回标签页时立即刷新
    let alive = true;
    const refresh = () => {
      subscriptionApi.status().then((d: any) => { if (alive) setSubStatus(d); }).catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    const onVis = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  // 模型目录：从后端单一数据源拉取（含价格/品牌），失败时回退内置列表
  useEffect(() => {
    fetch('/api/v1/models')
      .then(r => r.json())
      .then((d: any) => {
        const list = Array.isArray(d?.data) ? d.data : [];
        if (list.length) {
          setModels(list.map((m: any) => {
            const inp = Number(m.input) || 0;
            const peak = Array.isArray(m.peak) ? Number(m.peak[0]) || 0 : 0;
            return {
              id: m.id,
              label: m.name || m.id,
              provider: m.provider || '',
              cost: peak ? `¥${inp}~¥${peak}/1M input (闲时~高峰)` : `¥${inp}/1M input`,
            };
          }));
        }
      })
      .catch(() => { /* 保留内置列表 */ });
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-[12px] text-white/30">{tr('dashboard.loading')}</span>
        </div>
      </div>
    );
  }

  const balanceYuan = stats?.balance_yuan || 0;
  const balance = stats?.balance || 0;
  const todayUsage = stats?.today_usage || 0;
  const todayUsageYuan = stats?.today_usage_yuan || 0;
  const activeKeys = stats?.active_keys || 0;
  const dailyTrend = stats?.daily_trend || [];

  return (
    <div className="w-full page-container space-y-8">
      {/* Header: title left, sync info right */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-white">{tr('dashboard.title')}</h1>
          <p className="text-[12px] text-white/30 mt-1">{tr('auth.welcome')}, {user?.nickname || 'User'}</p>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-[10px] text-white/20">
          <RefreshCw size={11} className="opacity-50" />
          {lastSync && <span>Updated {lastSync}</span>}
        </div>
      </div>

      {/* Energy ring - centered hero with color indicator */}
      <div className="relative flex flex-col items-center pt-4 pb-12">
        <EnergyRing
          balance={balance}
          balanceYuan={balanceYuan}
          todayUsage={todayUsage}
          todayUsageYuan={todayUsageYuan}
          activeKeys={activeKeys}
          quotaRemaining={subStatus?.today_remaining}
          hasQuota={!!(subStatus?.active && (subStatus?.daily_limit || 0) > 0)}
        />


        {/* New user hint — inline after ring */}
        {(!stats?.today_usage && stats?.active_keys === 0) && (
          <div className="flex items-center justify-center gap-2 mt-4 text-[12px] text-white/40">
            <span className="text-emerald-400/80">{stats?.balance?.toLocaleString()} Token</span>
            <span className="text-white/20">·</span>
            <a href="/keys" className="text-emerald-400/80 hover:text-emerald-300 underline underline-offset-2 transition-colors">
              创建 Key 开始使用 →
            </a>
          </div>
        )}
        {/* Recharge pill */}
        <div className="absolute -bottom-2">
          <button
            onClick={openRecharge}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full
              bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-medium
              hover:bg-emerald-500/25 hover:border-emerald-500/35
              transition-all shadow-lg shadow-emerald-500/5"
          >
            <CreditCard size={13} />
            {tr('dashboard.rechargeNow')}
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      {/* Low balance alert（订阅用户有免费配额时不提示） */}
      {!(subStatus?.active && (subStatus.today_remaining || 0) > 0) && stats?.balance_yuan < 20 && stats?.balance_yuan > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <span className="text-amber-400 text-sm font-bold">!</span>
          </div>
          <div className="flex-1">
            <p className="text-[13px] text-amber-400/90 font-medium">余额告急</p>
            <p className="text-[11px] text-white/40">当前余额 {stats.balance?.toLocaleString()} Token，建议充值避免服务中断</p>
          </div>
          <button onClick={openRecharge} className="px-4 py-2 rounded-xl bg-amber-500/15 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-all shrink-0">
            去充能
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          icon={Activity}
          label={tr('dashboard.todayUsage')}
          value={`${todayUsage.toLocaleString()}`}
          suffix={tr('dashboard.cny')}
        />
        <StatCard
          icon={TrendingUp}
          label={tr('dashboard.totalRecharged')}
          value={`${(stats?.total_recharged || 0).toLocaleString()}`}
          suffix={tr('dashboard.cny')}
        />
        <StatCard
          icon={Key}
          label={tr('dashboard.activeKeys')}
          value={String(activeKeys)}
          suffix={tr('dashboard.keys')}
        />
        <StatCard
          icon={Zap}
          label={tr('dashboard.gatewayStatus')}
          value={tr('dashboard.online')}
          suffix=""
          highlight
        />
        <StatCard
          icon={Activity}
          label="今日请求"
          value={String(stats?.today_requests || '—')}
          suffix="API calls today"
        />
        <StatCard
          icon={TrendingUp}
          label="平均响应"
          value={String(stats?.avg_response_ms || '—')}
          suffix="ms across all models"
        />
      </div>

      {/* Chart + Models */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily trend chart */}
        <div className="lg:col-span-2 backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
          {/* Chart header with time range selector */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-medium text-white/70">{tr('dashboard.dailyTrend')}</h3>
            <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
              {TIME_RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setDays(r.days)}
                  className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${
                    days === r.days
                      ? 'bg-white/[0.08] text-white/80 font-medium'
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  {tr('chart.' + r.key)}
                </button>
              ))}
            </div>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="usage_grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 100).toFixed(1)}`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#22222C',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    fontSize: 12,
                    color: '#F8FAFC',
                  }}
                  formatter={(value: number) => [`${(value / 100).toFixed(4)} CNY`, tr('dashboard.todayUsage')]}
                />
                <Area
                  type="monotone"
                  dataKey="usage"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#usage_grad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#10B981', stroke: '#13131D', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Available Models */}
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
          <h3 className="text-[13px] font-medium text-white/70 mb-1">{tr('dashboard.supportedModels')}</h3>
          <p className="text-[10px] text-white/20 mb-4">{tr('dashboard.modelsDesc')}</p>
                    <div className="space-y-2">
            {(showAllModels ? models : models.slice(0, 5)).map((m) => {
              // 无调用数据 = 无证据表明不可用，默认按可用（绿）展示；仅近24h有调用且错误率>2% 标异常
              const health = (stats?.models?.[m.id] as string) || 'healthy';
              const online = health !== 'degraded';
              const degraded = health === 'degraded';
              return (
                <div key={m.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.02]">
                  <div>
                    <p className="text-[13px] text-white/80">{m.label}</p>
                    <p className="text-[10px] text-white/30">{m.provider} · {m.cost}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.status ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-red-500/10 border-red-500/20 text-red-400">{m.status}</span>
                    ) : (
                      <>
                    <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-amber-400'}`} />
                    <span className={`text-[10px] ${online ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {online ? tr('dashboard.available') : '异常'}
                    </span>
                    </>
                    )}
                  </div>
                </div>
              );
            })}
            {models.length > 5 && (
              <button
                onClick={() => setShowAllModels(!showAllModels)}
                className="w-full py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[10px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all mt-1"
              >
                {showAllModels ? '收起' : '查看全部 ' + models.length + ' 个模型'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  highlight,
}: {
  icon: any;
  label: string;
  value: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 transition-all hover:bg-white/[0.04]">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={highlight ? 'text-emerald-400' : 'text-white/30'} />
        <span className="text-[11px] text-white/30 tracking-[0.05em]">{label}</span>
      </div>
      <p className="text-[22px] font-semibold text-white tracking-tight">{value}</p>
      {suffix && <p className="text-[10px] text-white/20 mt-0.5">{suffix}</p>}
    </div>
  );
}
