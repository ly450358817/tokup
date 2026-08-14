import { useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../utils/api';

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

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-white mb-1">对话存档查询</h1>
        <p className="text-[12px] text-white/40">
          仅管理员可见。按用户邮箱或 user_id 查询历史对话（请求 + 响应），数据来自 conversation_logs。
        </p>
      </div>

      <div className="flex gap-2 mb-4">
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
      <p className="text-[12px] text-white/30 mb-3">共 {total} 条</p>

      <div className="space-y-2">
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
