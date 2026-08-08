import { useState, useEffect } from 'react';
import { BarChart3, Download, Filter, Search } from 'lucide-react';

export default function UsagePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const loadData = () => {
    setLoading(true);
    const token = localStorage.getItem('tokup_token');
    if (!token) return;
    Promise.all([
      fetch(`/api/usage/records?days=${days}&limit=200`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch(`/api/usage/summary?days=${days}`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    ]).then(([recordsData, summaryData]) => {
      setRecords(recordsData.records || []);
      setSummary(summaryData);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [days]);

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-white">消费明细</h1>
          <p className="text-[12px] text-white/30 mt-1">每笔 API 调用记录 · 合规审计用</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-2 py-1.5">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-lg text-xs transition-all ${days === d ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/30 hover:text-white/50'}`}>
                {d}天
              </button>
            ))}
          </div>
          {summary && (
            <button onClick={() => { const t = localStorage.getItem("tokup_token"); if (!t) return; const a = document.createElement("a"); a.href = `/api/usage/export?days=${days}`; fetch(a.href, { headers: { Authorization: "Bearer " + t } }).then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const d = document.createElement("a"); d.href = u; d.download = "tokup-usage-export.csv"; d.click(); URL.revokeObjectURL(u); }); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:text-white/70 transition-all">
              <Download size={14} /> CSV导出
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && !loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
            <p className="text-[10px] text-white/30 uppercase mb-1">调用次数</p>
            <p className="text-[22px] font-bold text-white">{summary.total_calls}</p>
          </div>
          <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
            <p className="text-[10px] text-white/30 uppercase mb-1">消耗 Token</p>
            <p className="text-[22px] font-bold text-white">{summary.total_tokens?.toLocaleString() || 0}</p>
          </div>
          <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
            <p className="text-[10px] text-white/30 uppercase mb-1">总费用 (¥)</p>
            <p className="text-[22px] font-bold text-white">¥{(summary.total_cost || 0).toFixed(4)}</p>
          </div>
        </div>
      )}

      {/* Model Breakdown */}
      {summary?.models && !loading && (
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-[13px] font-medium text-white/70 mb-4">按模型汇总</h3>
          <div className="space-y-2">
            {Object.entries(summary.models).map(([model, data]: [string, any]) => (
              <div key={model} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-white/70 font-medium">{model}</span>
                  <span className="text-[10px] text-white/30">{data.calls} 次调用</span>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-white/40">{data.input_tokens} in / {data.output_tokens} out</span>
                  <span className="text-emerald-400/70">¥{data.cost.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Records */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">逐笔记录</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
        ) : records.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-8">暂无消费记录</p>
        ) : (
          <div className="space-y-1">
            {records.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] text-[11px]">
                <div className="flex items-center gap-3">
                  <span className="text-white/70 w-32 truncate">{r.model}</span>
                  <span className="text-white/30">{r.input_tokens}→{r.output_tokens}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/30">{new Date(r.created_at).toLocaleString('zh-CN')}</span>
                  <span className="text-emerald-400/70 w-16 text-right">¥{r.cost_cny?.toFixed(4) || '0'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
