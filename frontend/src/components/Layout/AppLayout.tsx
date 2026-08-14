import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRecharge } from '../../contexts/RechargeContext';
import { useLang } from '../../contexts/LanguageContext';
import {
  LayoutDashboard,
  Key,
  LogOut,
  User,
  Menu,
  Zap,
  History,
  Settings,
  Coins,
  Code,
  BookOpen,
  Globe,
  Activity,
  Shield,
  BarChart3,
  Gift,
  Database,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', labelKey: 'nav.dashboard' as const, icon: LayoutDashboard, href: '/' },
  { id: 'transfer-station', labelKey: 'nav.transferStation', icon: Globe, href: '/transfer-station' },
  { id: 'recharge', labelKey: 'nav.recharge' as const, icon: Zap, href: '', accent: true },
  { id: 'pricing', labelKey: '订阅', icon: Coins, href: '/pricing' },
  { id: 'keys', labelKey: 'nav.apiKeys' as const, icon: Key, href: '/keys' },
  { id: 'transactions', labelKey: 'nav.transactions' as const, icon: History, href: '/transactions' },
  { id: 'integration', labelKey: 'nav.integration', icon: BookOpen, href: '/integration' },
  { id: 'docs', labelKey: 'nav.docs', icon: Code, href: '/docs' },
  { id: 'monitor', labelKey: 'nav.monitor', icon: Activity, href: '/monitor' },
  { id: 'settings', labelKey: 'nav.settings' as const, icon: Settings, href: '/settings' },
  { id: 'analytics', labelKey: 'nav.analytics', icon: Activity, href: '/analytics' },
  { id: 'usage', labelKey: '消费明细', icon: BarChart3, href: '/usage' },
  { id: 'compliance', labelKey: '合规声明', icon: Shield, href: '/compliance' },
  { id: 'invite', labelKey: '邀请好友', icon: Gift, href: '/invite' },
  { id: 'admin-conversations', labelKey: '对话存档', icon: Database, href: '/admin/conversations' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { openRecharge } = useRecharge();
  const { t } = useLang();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.keyCode === 27) { setSidebarOpen(false); e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('keydown', handleEsc, true);
    return () => document.removeEventListener('keydown', handleEsc, true);
  }, []);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const current = location.pathname || '/';

  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };

  const isNavActive = (item: typeof navItems[0]): boolean => {
    if (item.id === 'dashboard') return current === '/';
    if (item.accent) return false;
    return item.href === current;
  };

  const handleLogout = () => {
    setSidebarOpen(false);
    logout();
  };

  return (
    <div className="flex w-full h-screen bg-[#13131D] relative overflow-hidden">
      <div className="aurora-bg" />
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col bg-[#13131D] border-r border-white/[0.04] transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/[0.04]">
          <div className="relative w-9 h-9 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="16" stroke="url(#logo_grad)" strokeWidth="1.5" strokeLinecap="round"
                strokeDasharray="72" strokeDashoffset="18" className="ring-breathe" />
              <circle cx="18" cy="18" r="16" stroke="rgba(16,185,129,0.08)" strokeWidth="1.5" />
              <text x="18" y="22" textAnchor="middle" fill="#10B981" fontSize="13" fontWeight="700" fontFamily="Inter">T</text>
              <defs>
                <linearGradient id="logo_grad" x1="0" y1="0" x2="36" y2="36">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#34D399" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-xl" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-white tracking-tight">TokUp</h1>
            <p className="text-[10px] text-white/30 tracking-[0.1em]">脉充</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavActive(item);
            if (item.id === 'recharge') {
              return (
                <button
                  key={item.id}
                  onClick={(e) => { e.preventDefault(); openRecharge(); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all
                    text-white/40 hover:text-emerald-400 hover:bg-emerald-500/15`}
                >
                  <Zap size={18} />
                  {tr(item.labelKey)}
                </button>
              );
            }
            if (item.id === 'analytics' && !user?.is_admin) return null;
            if (item.id === 'admin-conversations' && !user?.is_admin) return null;
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => { e.preventDefault(); setSidebarOpen(false); navigate(item.href); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? 'bg-white/[0.10] border border-white/[0.08] text-white font-medium shadow-sm'
                    : 'text-white/40 hover:text-emerald-400 hover:bg-emerald-500/15'
                }`}
              >
                <Icon size={18} />
                {tr(item.labelKey)}
              </a>
            );
          })}

          {/* Separator */}
          <div className="pt-2"></div>

          {/* separator */}
          <div className="flex-1"></div>
        </nav>

        {/* User area */}
        <div className="border-t border-white/[0.04] px-4 py-4 space-y-1">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/[0.03] transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <User size={14} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] text-white/70 truncate">{user?.nickname || 'User'}</p>
                <p className="text-[10px] text-white/30 font-mono">¥{((user?.token_balance || 0) / 100).toFixed(2)}</p>
              </div>
            </button>

            {/* Profile popover */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#22222C] border border-white/[0.06] rounded-xl p-4 shadow-2xl animate-slide-up">
                <div className="space-y-3">
                  {/* Avatar & Name */}
                  <div className="flex items-center gap-3 pb-3 border-b border-white/[0.04]">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                      <span className="text-[16px] font-bold text-emerald-400">{user?.nickname?.[0]?.toUpperCase() || 'U'}</span>
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-white">{user?.nickname || 'User'}</p>
                      <p className="text-[10px] text-white/30">{user?.email || '-'}</p>
                    </div>
                  </div>
                  {/* Balance badge */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <span className="text-[11px] text-white/50">{tr('settings.balance') || 'Balance'}</span>
                    <span className="text-[14px] font-semibold text-emerald-400">¥{((user?.token_balance || 0) / 100).toFixed(2)}</span>
                  </div>
                  {/* Details */}
                  <div className="space-y-1.5 px-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-white/30">{tr('settings.nickname') || 'Nickname'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/60">{user?.nickname || '-'}</span>
                        <button
                          onClick={() => {
                            const name = prompt('输入新昵称:', user?.nickname || '');
                            if (name && name.trim()) {
                              fetch('/api/settings/profile/nickname', {
                                method: 'POST',
                                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('tokup_token'), 'Content-Type': 'application/json' },
                                body: JSON.stringify({ nickname: name.trim() })
                              }).then(r => r.json()).then(d => { if (d.success) window.location.reload(); });
                            }
                          }}
                          className="text-[10px] text-emerald-400/40 hover:text-emerald-400 transition-all"
                        >
                          编辑
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-white/30">ID</span>
                      <span className="text-[11px] text-white/60 font-mono">#{user?.id?.slice(-6) || '------'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-white/30">{tr('settings.account') || 'Account'}</span>
                      <span className="text-[11px] text-emerald-400/60">Active</span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="border-t border-white/[0.04] pt-2">
                    <button
                      onClick={() => { setShowUserMenu(false); logout(); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-[12px] text-red-400/60 hover:text-red-400 hover:bg-white/[0.04] transition-all"
                    >
                      {tr('nav.logout')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
          <button onClick={() => setSidebarOpen(true)} className="text-white/40 hover:text-white/70">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span className="text-[11px] text-white/30">{tr('dashboard.online')}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 lg:px-4 py-4 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
