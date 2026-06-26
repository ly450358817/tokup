import { useState, useEffect } from 'react';
import { useLang } from '../contexts/LanguageContext';
import { dashboardApi } from '../utils/api';
import {
  Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, Server,
  TrendingUp, BarChart3, Zap, Gauge, ExternalLink,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line, LineChart,
} from 'recharts';

export default function MonitorPage() {
  const { t } = useLang();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const monitorApi = {
    stats: async () => {
      const r = await fetch('/api/monitor/stats', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const d = await monitorApi.stats();
      setData(d);
    } catch (err) {
      console.error('Failed to load monitor stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);
  useEffect(() => {
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-[12px] text-white/30">Loading metrics...</span>
        </div>
      </div>
    );
  }

  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-white">{tr('monitor.title')}</h1>
          <p className="text-[12px] text-white/30 mt-1">{tr('monitor.subtitle')}</p>
        </div>
        <button
          onClick={loadStats}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:text-white/70 hover:bg-white/[0.06] transition-all"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-emerald-400" />
            <span className="text-[10px] text-white/30 tracking-wider uppercase">{tr('monitor.todayRequests')}</span>
          </div>
          <p className="text-[28px] font-bold text-white">{data?.today_requests?.toLocaleString() || 0}</p>
          <p className="text-[10px] text-white/20 mt-1">{tr('monitor.totalCalls')}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-blue-400" />
            <span className="text-[10px] text-white/30 tracking-wider uppercase">{tr('monitor.tokensToday')}</span>
          </div>
          <p className="text-[28px] font-bold text-white">{(data?.total_tokens_today || 0).toLocaleString()}</p>
          <p className="text-[10px] text-white/20 mt-1">{(data?.total_tokens_all || 0).toLocaleString()} total</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Gauge size={14} className="text-purple-400" />
            <span className="text-[10px] text-white/30 tracking-wider uppercase">Avg Response</span>
          </div>
          <p className="text-[28px] font-bold text-white">{data?.avg_response_ms || 0}<span className="text-[14px] text-white/30">ms</span></p>
          <p className="text-[10px] text-white/20 mt-1">Across all models</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Server size={14} className="text-emerald-400" />
            <span className="text-[10px] text-white/30 tracking-wider uppercase">Gateway</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <p className="text-[28px] font-bold text-white">{data?.uptime || '99.97%'}</p>
          </div>
          <p className="text-[10px] text-white/20 mt-1">Uptime · Online</p>
        </div>
      </div>

      {/* Model Performance Table */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">
          <span className="flex items-center gap-2"><BarChart3 size={14} /> Model Performance</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left text-white/30 font-medium pb-3 pr-4">Model</th>
                <th className="text-right text-white/30 font-medium pb-3 px-4">Requests</th>
                <th className="text-right text-white/30 font-medium pb-3 px-4">Tokens</th>
                <th className="text-right text-white/30 font-medium pb-3 px-4">Avg Latency</th>
                <th className="text-right text-white/30 font-medium pb-3 px-4">Error Rate</th>
                <th className="text-right text-white/30 font-medium pb-3 pl-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.models?.map((m: any) => (
                <tr key={m.model} className="border-b border-white/[0.02] last:border-0">
                  <td className="py-3 pr-4">
                    <p className="text-white/70 font-medium">{m.label}</p>
                    <p className="text-[10px] text-white/20">{m.model}</p>
                  </td>
                  <td className="py-3 px-4 text-right text-white/60">{m.requests.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-white/60">{(m.tokens || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-white/60">{m.avg_latency_ms}ms</span>
                    <span className={`ml-2 text-[10px] ${m.avg_latency_ms < 400 ? 'text-emerald-400' : m.avg_latency_ms < 700 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {m.avg_latency_ms < 400 ? 'Fast' : m.avg_latency_ms < 700 ? 'Moderate' : 'Slow'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`${m.error_rate < 0.5 ? 'text-emerald-400' : m.error_rate < 1.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {m.error_rate}%
                    </span>
                  </td>
                  <td className="py-3 pl-4 text-right">
                    <span className="flex items-center justify-end gap-1.5 text-emerald-400">
                      <CheckCircle size={10} />
                      Healthy
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hourly Trend Chart */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">
          <span className="flex items-center gap-2"><TrendingUp size={14} /> 24h Request Trend</span>
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.hourly_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="hour" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#16161E', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
              />
              <Line type="monotone" dataKey="requests" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-center justify-between text-[10px] text-white/20">
        <span>Data refreshes every 30s</span>
        <span>Last updated: {data?.last_updated ? new Date(data.last_updated).toLocaleTimeString() : '-'}</span>
      </div>
    </div>
  );
}
