import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminApi, supportApi } from '../utils/api';

interface ConvItem {
  id: string;
  user_id: string;
  model: string;
  endpoint: string;
  request_json: string;
  response_json: string;
  input_tokens: number;
  output_tokens: number;
  cost_cny: number;
  status: string;
  created_at: string;
}

export default function AdminConversationsPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ConvItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!user?.is_admin) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-12 text-white/50 text-center">
        无权限访问（仅管理员）
      </div>
    );
  }

  const search = async () => {
    setLoading(true);
    setError('');
    setRows([]);
    setExpanded({});
    try {
      const q = query.trim();
      const params: Record<string, any> = { limit: 50 };
      if (q) {
        if (q.includes('@')) params.email = q;
        else params.user_id = q;
      }
      const data = await adminApi.conversations(params);
      setRows(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.response?.data?.detail || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => setExpanded((m) => ({ ...m, [id]: !m[id] }));

  // ── 客服工单 ──
  const [tab, setTab] = useState<'conv' | 'tickets'>('conv');
  const [tickets, setTickets] = useState<any[]>([]);
  const [tLoading, setTLoading] = useState(false);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [tStatus, setTStatus] = useState<Record<string, string>>({});
  const loadTickets = async () => {
    setTLoading(true);
    try {
      const d = await supportApi.list();
      setTickets(d?.items || []);
    } catch { /* ignore */ } finally { setTLoading(false); }
  };
  useEffect(() => { loadTickets(); }, []);
  const saveReply = async (t: any) => {
    await supportApi.reply(t.id, { reply: replies[t.id] || '', status: tStatus[t.id] || t.status || 'processing' });
    loadTickets();
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-white mb-1">管理后台</h1>
        <p className="text-[12px] text-white/40">仅管理员可见。对话存档 + 客服工单（退款/投诉/问题）。</p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setTab('conv')}
            className={`px-4 py-2 rounded-xl text-[13px] transition-all ${tab === 'conv' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/[0.03] text-white/50 border border-white/[0.06]'}`}
          >对话存档</button>
          <button
            onClick={() => setTab('tickets')}
            className={`px-4 py-2 rounded-xl text-[13px] transition-all ${tab === 'tickets' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/[0.03] text-white/50 border border-white/[0.06]'}`}
          >
            客服工单{tickets.filter((x: any) => x.status === 'new').length > 0 ? `（${tickets.filter((x: any) => x.status === 'new').length} 新）` : ''}
          </button>
        </div>
      </div>

      {tab === 'tickets' && (
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-white/40">共 {tickets.length} 条工单（新单优先处理）</p>
            <button onClick={loadTickets} className="text-[11px] text-emerald-400 hover:text-emerald-300">刷新</button>
          </div>
          {tLoading && <p className="text-[12px] text-white/30">加载中...</p>}
          {tickets.length === 0 && !tLoading && <p className="text-[12px] text-white/30">暂无工单</p>}
          {tickets.map((t: any) => (
            <div key={t.id} className={`backdrop-blur-xl rounded-xl border p-4 ${t.status === 'new' ? 'bg-amber-500/[0.04] border-amber-500/20' : 'bg-white/[0.02] border-white/[0.06]'}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${t.status === 'new' ? 'bg-amber-500/15 text-amber-400' : t.status === 'processing' ? 'bg-blue-500/15 text-blue-400' : 'bg-white/[0.06] text-white/40'}`}>
                    {t.status === 'new' ? '待处理' : t.status === 'processing' ? '处理中' : '已关闭'}
                  </span>
                  <span className="text-[12px] text-white/80">{t.category_label || t.category}</span>
                  <span className="text-[11px] text-white/40">{t.email || t.user_id}</span>
                </div>
                <span className="text-[10px] text-white/25">{t.created_at ? t.created_at.replace('T', ' ').slice(0, 19) : '-'}</span>
              </div>
              {t.order_id && <p className="text-[11px] text-white/40 mt-2">关联订单：<span className="font-mono">{t.order_id}</span></p>}
              {t.subject && <p className="text-[13px] text-white/80 mt-2">{t.subject}</p>}
              <p className="text-[12px] text-white/50 mt-1 whitespace-pre-wrap">{t.message}</p>
              {t.admin_reply && <p className="text-[12px] text-emerald-300/80 mt-2">已回复：{t.admin_reply}</p>}
              <div className="flex gap-2 mt-3">
                <input
                  value={replies[t.id] || ''}
                  onChange={(e) => setReplies((m) => ({ ...m, [t.id]: e.target.value }))}
                  placeholder="回复内容（选填）"
                  className="flex-1 bg-[#13131D] border border-white/[0.08] rounded-xl px-3 py-2 text-[12px] text-white/60 outline-none"
                />
                <select
                  value={tStatus[t.id] || t.status || 'processing'}
                  onChange={(e) => setTStatus((m) => ({ ...m, [t.id]: e.target.value }))}
                  className="bg-[#13131D] border border-white/[0.08] rounded-xl px-2 py-2 text-[12px] text-white/60 outline-none"
                >
                  <option value="new">待处理</option>
                  <option value="processing">处理中</option>
                  <option value="closed">已关闭</option>
                </select>
                <button onClick={() => saveReply(t)} className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] hover:bg-emerald-500/20 transition-all">保存</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-4" style={{ display: tab === 'conv' ? 'flex' : 'none' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="输入用户邮箱（如 xxx@qq.com）或 user_id，留空查全部"
          className="flex-1 glass-input px-4 py-2.5 rounded-xl text-[13px] text-white placeholder-white/25"
        />
        <button
          onClick={search}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] hover:bg-emerald-500/20 transition-all disabled:opacity-50"
        >
          <Search size={14} />
          {loading ? '查询中...' : '查询'}
        </button>
      </div>

      {error && <p className="text-[12px] text-red-400 mb-3">{error}</p>}
      <p className="text-[12px] text-white/30 mb-3" style={{ display: tab === 'conv' ? undefined : 'none' }}>共 {total} 条</p>

      <div className="space-y-2" style={{ display: tab === 'conv' ? undefined : 'none' }}>
        {rows.map((r) => {
          const open = !!expanded[r.id];
          return (
            <div key={r.id} className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <button
                onClick={() => toggle(r.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className="text-emerald-400 shrink-0">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                <span className="text-[12px] text-white/60 w-[150px] shrink-0 font-mono">
                  {r.created_at ? r.created_at.replace('T', ' ').slice(0, 19) : '-'}
                </span>
                <span className="text-[12px] text-white/80 w-[200px] truncate shrink-0">{r.model}</span>
                <span className="text-[11px] text-white/40 w-[70px] shrink-0">{r.endpoint}</span>
                <span className="text-[11px] text-white/40 shrink-0">{r.input_tokens}/{r.output_tokens} tok</span>
                <span className={`text-[11px] shrink-0 ${r.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{r.status}</span>
              </button>
              {open && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <div className="text-[11px] text-white/30 mb-1">请求（request_json）</div>
                    <pre className="text-[11px] text-white/70 bg-black/30 border border-white/[0.06] rounded-lg p-3 whitespace-pre-wrap break-all max-h-64 overflow-auto font-mono leading-relaxed">
                      {r.request_json || '(空)'}
                    </pre>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/30 mb-1">响应（response_json）</div>
                    <pre className="text-[11px] text-white/70 bg-black/30 border border-white/[0.06] rounded-lg p-3 whitespace-pre-wrap break-all max-h-64 overflow-auto font-mono leading-relaxed">
                      {r.response_json || '(空)'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!loading && rows.length === 0 && (
          <p className="text-[12px] text-white/25 text-center py-8">暂无记录</p>
        )}
      </div>
    </div>
  );
}
