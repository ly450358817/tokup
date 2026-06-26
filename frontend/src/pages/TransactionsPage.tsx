import { useState, useEffect } from 'react';
import { useLang } from '../contexts/LanguageContext';
import { dashboardApi } from '../utils/api';
import { Download, Search, Filter } from 'lucide-react';

export default function TransactionsPage() {
  const { t } = useLang();
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const loadTxns = () => {
    setLoading(true);
    dashboardApi.transactions(50, typeFilter, startDate, endDate, searchText)
      .then(setTxns)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };


  const exportCSV = () => {
    if (txns.length === 0) return;
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Status'];
    const rows = txns.map((tx: any) => [
      new Date(tx.created_at).toISOString().split('T')[0],
      tx.type,
      tx.description || '',
      (tx.type === 'recharge' ? '+' : '-') + Math.abs(tx.amount || tx.token_amount / 100).toFixed(2),
      tx.status,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tokup-transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => { loadTxns(); }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold text-white">{tr('nav.transactions')}</h1>
        <p className="text-[12px] text-white/30 mt-1">Transaction history</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            type="text"
            placeholder="Search descriptions..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="glass-input w-full pl-9 text-[12px]"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="glass-input text-[12px]"
        >
          <option value="">All types</option>
          <option value="recharge">Recharge</option>
          <option value="consume">Usage</option>
          <option value="refund">Refund</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="glass-input text-[12px]"
          title="Start date"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="glass-input text-[12px]"
          title="End date"
        />
        <button
          onClick={loadTxns}
          className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:text-white/70 hover:bg-white/[0.06] transition-all"
        >
          <Filter size={14} />
        </button>
      </div>

      {txns.length > 0 && (
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:text-white/70 hover:bg-white/[0.06] transition-all"
        >
          <Download size={14} />
          Export CSV
        </button>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : txns.length === 0 ? (
        <div className="text-center py-20 backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl">
          <p className="text-[13px] text-white/30">No transactions yet</p>
        </div>
      ) : (
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl divide-y divide-white/[0.04]">
          {txns.map((tx: any) => (
            <div key={tx.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-[13px] text-white/70">{tx.description || tx.type}</p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  {tx.type === 'recharge' ? 'Recharge' : tx.type === 'consume' ? 'Usage' : tx.type}
                  {' · '}{new Date(tx.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-[14px] font-medium ${
                tx.type === 'recharge' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {tx.type === 'recharge' ? '+' : '-'}¥{Math.abs(tx.amount || tx.token_amount / 100).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
