import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, AreaChart, Activity, Zap, Gauge, DollarSign, SlidersHorizontal,
  Filter, RefreshCw, Server, Route, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart as ReAreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const DAY_OPTIONS = [1, 3, 7, 30, 90];

const COLORS = ['#10B981', '#38BDF8', '#A78BFA', '#F59E0B', '#F472B6', '#34D399', '#818CF8', '#FB7185'];

const fmtInt = (n: number) => (n ?? 0).toLocaleString('en-US');
const fmtTokens = (n: number) => {
  const v = n ?? 0;
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(1) + '万';
  return v.toLocaleString('en-US');
};
const fmtTpm = (n: number) => {
  const v = n ?? 0;
  if (v >= 1e4) return (v / 1e4).toFixed(1) + '万';
  return v.toLocaleString('en-US');
};

export default function ModelAnalyticsPage() {
  const [tab, setTab] = useState<'analysis' | 'routes'>('analysis');
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [days, setDays] = useState(7);
  const [data, setData] = useState<any>(null);
  const [routesData, setRoutesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [error, setError] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const loadOverview = () => {
    setLoading(true);
    const token = localStorage.getItem('tokup_token');
    if (!token) { setLoading(false); return; }
    fetch(`/api/analytics/overview?days=${days}`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { setData(d); setError(''); setLoading(false); })
      .catch(() => { setError('加载失败，请重试'); setLoading(false); });
  };

  const loadRoutes = () => {
    setLoadingRoutes(true);
    const token = localStorage.getItem('tokup_token');
    if (!token) { setLoadingRoutes(false); return; }
    fetch(`/api/analytics/routes?days=${days}`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { setRoutesData(d); setLoadingRoutes(false); })
      .catch(() => setLoadingRoutes(false));
  };

  useEffect(() => { loadOverview(); }, [days]);
  useEffect(() => { if (tab === 'routes') loadRoutes(); }, [tab, days]);

  const chartModels = useMemo(() => {
    if (!data?.models) return [];
    return data.models.slice(0, 8);
  }, [data]);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-white">模型调用分析</h1>
          <p className="text-[12px] text-white/30 mt-1">基于真实调用记录 · 按模型 / 时间统计</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
              showFilter ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400' : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70'
            }`}
          >
            <Filter size={14} /> 筛选
          </button>
          <button
            onClick={() => (tab === 'analysis' ? loadOverview() : loadRoutes())}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:text-white/70 transition-all"
          >
            <RefreshCw size={14} /> 刷新
          </button>
        </div>
      </div>

      {/* Tabs: 模型调用分析 / 分流 */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('analysis')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition-all ${
            tab === 'analysis' ? 'bg-white/[0.10] text-white font-medium' : 'text-white/40 hover:text-white/60'
          }`}
        >
          <BarChart3 size={15} /> 模型调用分析
        </button>
        <button
          onClick={() => setTab('routes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition-all ${
            tab === 'routes' ? 'bg-white/[0.10] text-white font-medium' : 'text-white/40 hover:text-white/60'
          }`}
        >
          <Route size={15} /> 分流
        </button>
      </div>

      {tab === 'analysis' ? (
        <>
          {/* Filter bar */}
          {showFilter && (
            <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 flex flex-wrap items-center gap-3 animate-slide-up">
              <span className="text-[11px] text-white/30">时间范围</span>
              <div className="flex items-center gap-1">
                {DAY_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                      days === d ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    {d}天
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={13} className="text-emerald-400" />
                <span className="text-[10px] text-white/30 uppercase">总数</span>
              </div>
              <p className="text-[24px] font-bold text-white">{loading ? '—' : fmtInt(data?.total_calls)}</p>
              <p className="text-[10px] text-white/20 mt-1">调用次数</p>
            </div>
            <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={13} className="text-blue-400" />
                <span className="text-[10px] text-white/30 uppercase">总TOKEN数</span>
              </div>
              <p className="text-[24px] font-bold text-white">{loading ? '—' : fmtTokens(data?.total_tokens)}</p>
              <p className="text-[10px] text-white/20 mt-1">输入 + 输出</p>
            </div>
            <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gauge size={13} className="text-purple-400" />
                <span className="text-[10px] text-white/30 uppercase">平均TPM</span>
              </div>
              <p className="text-[24px] font-bold text-white">{loading ? '—' : fmtTpm(data?.avg_tpm)}</p>
              <p className="text-[10px] text-white/20 mt-1">Token / 分钟</p>
            </div>
            <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={13} className="text-amber-400" />
                <span className="text-[10px] text-white/30 uppercase">总额度</span>
              </div>
              <p className="text-[24px] font-bold text-white">{loading ? '—' : '¥' + (data?.total_cost ?? 0).toFixed(2)}</p>
              <p className="text-[10px] text-white/20 mt-1">近 {days} 天消耗</p>
            </div>
            <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={13} className="text-emerald-400" />
                <span className="text-[10px] text-white/30 uppercase">平均RPM</span>
              </div>
              <p className="text-[24px] font-bold text-white">{loading ? '—' : (data?.avg_rpm ?? 0).toFixed(2)}</p>
              <p className="text-[10px] text-white/20 mt-1">请求 / 分钟</p>
            </div>
          </div>

          {/* Consumption Distribution Chart */}
          <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-medium text-white/70">
                <span className="flex items-center gap-2"><BarChart3 size={14} /> 消耗分布</span>
              </h3>
              <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
                <button
                  onClick={() => setChartType('bar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                    chartType === 'bar' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/30 hover:text-white/50'
                  }`}
                >
                  <BarChart3 size={13} /> 柱状图
                </button>
                <button
                  onClick={() => setChartType('area')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                    chartType === 'area' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/30 hover:text-white/50'
                  }`}
                >
                  <AreaChart size={13} /> 面积图
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-56">
                <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-56 text-white/30 text-xs">{error}</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={data?.series || []} stackOffset="sign">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="bucket" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtTokens(v)} />
                      <Tooltip
                        contentStyle={{ background: '#22222C', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', fontSize: '12px' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                        formatter={(value: any, name: any) => [fmtTokens(Number(value)), String(name)]}
                      />
                      <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }} />
                      {chartModels.map((m: any, i: number) => (
                        <Bar key={m.model} dataKey={m.model} name={m.label} stackId="a" fill={COLORS[i % COLORS.length]} />
                      ))}
                    </BarChart>
                  ) : (
                    <ReAreaChart data={data?.series || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="bucket" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtTokens(v)} />
                      <Tooltip
                        contentStyle={{ background: '#22222C', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', fontSize: '12px' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                        formatter={(value: any, name: any) => [fmtTokens(Number(value)), String(name)]}
                      />
                      <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }} />
                      {chartModels.map((m: any, i: number) => (
                        <Area key={m.model} type="monotone" dataKey={m.model} name={m.label} stackId="1" stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.25} />
                      ))}
                    </ReAreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* Model legend breakdown */}
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
              {chartModels.map((m: any, i: number) => (
                <div key={m.model} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-[11px] text-white/60 truncate">{m.label}</span>
                  </div>
                  <span className="text-[10px] text-white/30 shrink-0 ml-2">{fmtTokens(m.tokens)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* ── 分流 tab ── */
        <div className="space-y-6">
          {/* Channel summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {(routesData?.channels || []).map((ch: any) => (
              <div key={ch.provider} className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2 text-[12px] text-white/60">
                    <Server size={14} className="text-emerald-400" /> {ch.label}
                  </span>
                  <span className="text-[10px] text-white/30">{ch.calls} 次调用</span>
                </div>
                <p className="text-[22px] font-bold text-white">{fmtTokens(ch.tokens)}</p>
                <p className="text-[10px] text-white/20 mt-1">Token · ¥{ch.cost.toFixed(2)}</p>
              </div>
            ))}
            {(routesData?.channels || []).length === 0 && !loadingRoutes && (
              <div className="col-span-3 text-center text-white/30 text-xs py-10">暂无分流数据</div>
            )}
          </div>

          {/* Routing table */}
          <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
            <h3 className="text-[13px] font-medium text-white/70 mb-4">
              <span className="flex items-center gap-2"><Route size={14} /> 模型 → 上游路由</span>
            </h3>
            {loadingRoutes ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      <th className="text-left text-white/30 font-medium pb-3 pr-4">模型</th>
                      <th className="text-left text-white/30 font-medium pb-3 px-4">上游渠道</th>
                      <th className="text-left text-white/30 font-medium pb-3 px-4">上游模型名</th>
                      <th className="text-right text-white/30 font-medium pb-3 px-4">调用次数</th>
                      <th className="text-right text-white/30 font-medium pb-3 px-4">Token</th>
                      <th className="text-right text-white/30 font-medium pb-3 pl-4">费用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(routesData?.routes || []).map((r: any) => (
                      <tr key={r.model} className="border-b border-white/[0.02] last:border-0">
                        <td className="py-3 pr-4">
                          <p className="text-white/70 font-medium">{r.label}</p>
                          <p className="text-[10px] text-white/20">{r.model}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/80 text-[10px]">{r.provider_label}</span>
                        </td>
                        <td className="py-3 px-4 text-white/40 font-mono text-[10px]">{r.upstream_model}</td>
                        <td className="py-3 px-4 text-right text-white/60">{r.usage.calls.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-white/60">{fmtTokens(r.usage.tokens)}</td>
                        <td className="py-3 pl-4 text-right text-emerald-400/70">¥{r.usage.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-white/20">
        <span>数据来源：usage_records · 每 {days} 天窗口</span>
        <span>更新于 {data?.updated_at ? new Date(data.updated_at).toLocaleTimeString() : '-'}</span>
      </div>
    </div>
  );
}
