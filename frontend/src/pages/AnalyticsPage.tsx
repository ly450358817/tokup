import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Users, DollarSign, Key, RefreshCw } from 'lucide-react';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = () => {
    setLoading(true);
    const token = localStorage.getItem('tokup_token');
    if (!token) { setLoading(false); setError('Not logged in'); return; }
    fetch('/api/admin/stats', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  };

  useEffect(() => {
    if (user && !user.is_admin) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => { loadData(); }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;
  if (error) return <div className="flex items-center justify-center h-full"><div className="text-red-400 text-sm">{error}</div></div>;
  if (!stats) return <div className="flex items-center justify-center h-full"><div className="text-white/30 text-sm">No data</div></div>;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-white">管理面板</h1>
          <p className="text-[12px] text-white/30 mt-1">管理员专用</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 text-xs hover:text-white/70 transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Users size={14} className="text-emerald-400" /><span className="text-[10px] text-white/30 uppercase">注册用户</span></div>
          <p className="text-[28px] font-bold text-white">{stats.total_users?.toLocaleString() || 0}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><DollarSign size={14} className="text-blue-400" /><span className="text-[10px] text-white/30 uppercase">累计充值 (¥)</span></div>
          <p className="text-[28px] font-bold text-white">¥{(stats.total_recharged || 0).toFixed(2)}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Activity size={14} className="text-purple-400" /><span className="text-[10px] text-white/30 uppercase">消耗 Token</span></div>
          <p className="text-[28px] font-bold text-white">{stats.total_consumed?.toLocaleString() || 0}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Key size={14} className="text-emerald-400" /><span className="text-[10px] text-white/30 uppercase">API Key</span></div>
          <p className="text-[28px] font-bold text-white">{stats.total_keys || 0}<span className="text-[14px] text-white/30 ml-1">/ {stats.active_keys || 0} active</span></p>
        </div>
      </div>
    </div>
  );
}
