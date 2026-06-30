import { useState, useEffect } from 'react';
import { Activity, Users } from 'lucide-react';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('tokup_token');
    if (!token) { setLoading(false); return; }
    fetch('/api/analytics/stats', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => { setError('加载失败'); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="text-white/30 text-sm">Loading...</div></div>;
  if (error) return <div className="flex items-center justify-center h-full"><div className="text-red-400 text-sm">{error}</div></div>;
  if (!stats) return <div className="flex items-center justify-center h-full"><div className="text-white/30 text-sm">No data</div></div>;

  return (
    <div className="w-full page-container space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold text-white">数据分析</h1>
        <p className="text-[12px] text-white/30 mt-1">网站访问统计</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><Activity size={14} className="text-emerald-400" /><span className="text-[10px] text-white/30 uppercase">总请求</span></div>
          <p className="text-[24px] font-bold text-white">{stats.total_requests?.toLocaleString() || 0}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><Activity size={14} className="text-blue-400" /><span className="text-[10px] text-white/30 uppercase">今日请求</span></div>
          <p className="text-[24px] font-bold text-white">{stats.today_requests?.toLocaleString() || 0}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><Users size={14} className="text-purple-400" /><span className="text-[10px] text-white/30 uppercase">累计独立IP</span></div>
          <p className="text-[24px] font-bold text-white">{stats.unique_ips?.toLocaleString() || 0}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><Users size={14} className="text-emerald-400" /><span className="text-[10px] text-white/30 uppercase">今日独立IP</span></div>
          <p className="text-[24px] font-bold text-white">{stats.today_unique_ips?.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Top Pages */}
      {stats.top_pages && stats.top_pages.length > 0 && (
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-[13px] font-medium text-white/70 mb-4">热门页面</h3>
          <div className="space-y-2">
            {stats.top_pages.slice(0, 10).map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
                <span className="text-[12px] text-white/60 font-mono">{p.path}</span>
                <span className="text-[11px] text-emerald-400/60">{p.count} 次</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Codes */}
      {stats.status_codes && (
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-[13px] font-medium text-white/70 mb-4">状态码分布</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.status_codes).map(([code, count]: [string, any]) => (
              <div key={code} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[12px] text-white/60">{code}</span>
                <span className="text-[11px] text-white/30 ml-2">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
