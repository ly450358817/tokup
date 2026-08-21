import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Users, DollarSign, Key, RefreshCw, ChevronLeft, ChevronRight, CalendarDays, CalendarRange } from 'lucide-react';

type DayStat = {
  date: string;
  registrations: number;
  recharge_amount: number;
  recharge_count: number;
  consumed_tokens: number;
  api_keys_created: number;
};

const WEEK_HEADERS = ['一', '二', '三', '四', '五', '六', '日'];

const fmt = (n: number) => (n ?? 0).toLocaleString('en-US');
const fmtTokens = (n: number) => {
  const v = n ?? 0;
  return v >= 10000 ? (v / 10000).toFixed(2) + '万' : v.toLocaleString('en-US');
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 日历状态
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-11
  const [selectedDate, setSelectedDate] = useState(toISODate(now));
  const [daily, setDaily] = useState<Record<string, DayStat>>({});
  const [loadingDaily, setLoadingDaily] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    const token = localStorage.getItem('tokup_token');
    if (!token) { setLoading(false); setError('Not logged in'); return; }
    fetch('/api/admin/stats', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  }, []);

  const loadDaily = useCallback(() => {
    setLoadingDaily(true);
    const token = localStorage.getItem('tokup_token');
    if (!token) { setLoadingDaily(false); return; }
    const first = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const last = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    fetch(`/api/admin/stats/daily?start=${first}&end=${last}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(d => {
        const map: Record<string, DayStat> = {};
        (d.daily || []).forEach((row: DayStat) => { map[row.date] = row; });
        setDaily(map);
        setLoadingDaily(false);
      })
      .catch(() => { setDaily({}); setLoadingDaily(false); });
  }, [viewYear, viewMonth]);

  useEffect(() => {
    if (user && !user.is_admin) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadDaily(); }, [loadDaily]);

  // 日历格子
  const cells = useMemo(() => {
    const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // 周一起始
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const list: (string | null)[] = [];
    for (let i = 0; i < firstDow; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return list;
  }, [viewYear, viewMonth]);

  const monthLabel = `${viewYear}年${viewMonth + 1}月`;
  const todayISO = toISODate(new Date());
  const selected = daily[selectedDate];

  const prevMonth = () => {
    const m = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(m.getFullYear()); setViewMonth(m.getMonth());
  };
  const nextMonth = () => {
    const m = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(m.getFullYear()); setViewMonth(m.getMonth());
  };
  const goToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear()); setViewMonth(t.getMonth());
    setSelectedDate(toISODate(t));
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;
  if (error) return <div className="flex items-center justify-center h-full"><div className="text-red-400 text-sm">{error}</div></div>;
  if (!stats) return <div className="flex items-center justify-center h-full"><div className="text-white/30 text-sm">No data</div></div>;

  return (
    <div className="w-full space-y-6">
      {/* 标题 + 刷新 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-white">管理面板</h1>
          <p className="text-[12px] text-white/30 mt-1">管理员专用 · 数据按北京时间（UTC+8）统计</p>
        </div>
        <button onClick={() => { loadData(); loadDaily(); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:text-white/70 transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Users size={14} className="text-emerald-400" /><span className="text-[10px] text-white/30 uppercase">注册用户</span></div>
          <p className="text-[28px] font-bold text-white">{fmt(stats.total_users)}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><DollarSign size={14} className="text-blue-400" /><span className="text-[10px] text-white/30 uppercase">累计充值 (¥)</span></div>
          <p className="text-[28px] font-bold text-white">¥{(stats.total_recharged || 0).toFixed(2)}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Activity size={14} className="text-purple-400" /><span className="text-[10px] text-white/30 uppercase">消耗 Token</span></div>
          <p className="text-[28px] font-bold text-white">{fmt(stats.total_consumed)}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Key size={14} className="text-teal-400" /><span className="text-[10px] text-white/30 uppercase">API Key</span></div>
          <p className="text-[28px] font-bold text-white">{fmt(stats.total_keys)}<span className="text-[14px] text-white/30 ml-1">/ {fmt(stats.active_keys)} active</span></p>
        </div>
      </div>

      {/* 每日日历查询 */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-emerald-400" />
            <h3 className="text-[13px] font-medium text-white/70">按日查询</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/50 hover:text-white/80 flex items-center justify-center transition-all" title="上个月"><ChevronLeft size={15} /></button>
            <span className="text-[13px] text-white/80 w-24 text-center">{monthLabel}</span>
            <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/50 hover:text-white/80 flex items-center justify-center transition-all" title="下个月"><ChevronRight size={15} /></button>
            <button onClick={goToday} className="px-3 py-1.5 text-[11px] rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all">今天</button>
            <div className="flex items-center gap-1.5 ml-1 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <CalendarRange size={13} className="text-white/30" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
                className="bg-transparent text-[11px] text-white/70 outline-none [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* 星期表头 */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEK_HEADERS.map(h => (
            <div key={h} className="text-center text-[10px] text-white/30 py-1">{h}</div>
          ))}
        </div>

        {/* 日历格子 */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`blank-${i}`} className="h-[92px] rounded-xl border border-transparent" />;
            const d = daily[iso];
            const hasData = d && (d.registrations > 0 || d.recharge_amount > 0 || d.consumed_tokens > 0 || d.api_keys_created > 0);
            const isToday = iso === todayISO;
            const isSelected = iso === selectedDate;
            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(iso)}
                className={`h-[92px] overflow-hidden rounded-xl p-2 text-left transition-all border ${
                  isSelected
                    ? 'bg-emerald-500/[0.12] border-emerald-500/40'
                    : isToday
                      ? 'bg-white/[0.05] border-white/15'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-medium ${isToday ? 'text-emerald-400' : 'text-white/50'}`}>{Number(iso.slice(8))}</span>
                  {loadingDaily && <span className="w-1.5 h-1.5 rounded-full bg-white/10 animate-pulse" />}
                </div>
                <div className="mt-1.5 space-y-0.5">
                  {hasData ? (
                    <>
                      {d!.registrations > 0 && <div className="text-[9px] leading-tight text-emerald-400/90">注册 {fmt(d!.registrations)}</div>}
                      {d!.recharge_amount > 0 && <div className="text-[9px] leading-tight text-blue-400/90">充值 ¥{d!.recharge_amount.toFixed(2)}</div>}
                      {d!.consumed_tokens > 0 && <div className="text-[9px] leading-tight text-purple-400/90">消耗 {fmtTokens(d!.consumed_tokens)}</div>}
                      {d!.api_keys_created > 0 && <div className="text-[9px] leading-tight text-teal-400/90">Key {fmt(d!.api_keys_created)}</div>}
                    </>
                  ) : (
                    <div className="text-[9px] text-white/15">—</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 选中日期明细 */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
          <div className="col-span-2 lg:col-span-1 flex items-center">
            <div>
              <div className="text-[10px] text-white/30 uppercase mb-1">选中日期</div>
              <div className="text-[16px] font-semibold text-white">{selectedDate || '—'}</div>
              {selectedDate === todayISO && <div className="text-[10px] text-emerald-400 mt-0.5">今天（进行中）</div>}
            </div>
          </div>
          {[
            { label: '注册人数', value: selected ? fmt(selected.registrations) : '0', color: 'text-emerald-400' },
            { label: '充值金额 (¥)', value: selected ? '¥' + selected.recharge_amount.toFixed(2) : '¥0.00', color: 'text-blue-400' },
            { label: '消耗 Token', value: selected ? fmt(selected.consumed_tokens) : '0', color: 'text-purple-400' },
            { label: '新增 API Key', value: selected ? fmt(selected.api_keys_created) : '0', color: 'text-teal-400' },
          ].map(m => (
            <div key={m.label} className="rounded-lg bg-white/[0.02] px-3 py-2">
              <div className="text-[9px] text-white/30 uppercase mb-1">{m.label}</div>
              <div className={`text-[16px] font-semibold ${m.color}`}>{m.value}</div>
              {m.label === '充值金额 (¥)' && selected && (
                <div className="text-[9px] text-white/25 mt-0.5">{selected.recharge_count} 笔</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
