import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRecharge } from '../contexts/RechargeContext';
import { useLang } from '../contexts/LanguageContext';
import { dashboardApi } from '../utils/api';
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

const MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI', cost: '20/1M input' },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'Anthropic', cost: '15/1M input' },
  { id: 'deepseek-chat', label: 'DeepSeek V3', provider: 'DeepSeek', cost: '0.5/1M input' },
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
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [lastSync, setLastSync] = useState('');

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
    <div className="max-w-6xl mx-auto space-y-8">
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
        />


        {/* Recharge pill - moved further down to not overlap */}
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

      {/* Low balance alert */}
      {stats?.balance_yuan < 10 && stats?.balance_yuan > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <span className="text-amber-400 text-sm font-bold">!</span>
          </div>
          <div className="flex-1">
            <p className="text-[13px] text-amber-400/90 font-medium">Low Balance</p>
            <p className="text-[11px] text-white/40">Your balance is ¥{stats.balance_yuan?.toFixed(2)}. Consider recharging to avoid service interruption.</p>
          </div>
          <button onClick={openRecharge} className="px-4 py-2 rounded-xl bg-amber-500/15 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-all shrink-0">
            Recharge Now
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          icon={Activity}
          label={tr('dashboard.todayUsage')}
          value={`${todayUsageYuan.toFixed(4)}`}
          suffix={tr('dashboard.cny')}
        />
        <StatCard
          icon={TrendingUp}
          label={tr('dashboard.totalRecharged')}
          value={`${(stats?.total_recharged || 0).toFixed(2)}`}
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
          label="Today Requests"
          value={String(stats?.today_requests || '—')}
          suffix="API calls today"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Response"
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
                    background: '#16161E',
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
                  activeDot={{ r: 4, fill: '#10B981', stroke: '#0A0A0F', strokeWidth: 2 }}
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
            {MODELS.map((m) => {
              const isOnline = stats?.models?.[m.id] !== false;
              return (
                <div key={m.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.02]">
                  <div>
                    <p className="text-[13px] text-white/80">{m.label}</p>
                    <p className="text-[10px] text-white/30">{m.provider} · {m.cost}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-gray-500'}`} />
                    <span className={`text-[10px] ${isOnline ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {isOnline ? tr('dashboard.available') : 'Unavailable'}
                    </span>
                  </div>
                </div>
              );
            })}
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
