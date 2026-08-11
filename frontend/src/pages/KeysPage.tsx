 import { useState, useEffect } from 'react';
 import { keysApi } from '../utils/api';
import { useLang } from '../contexts/LanguageContext';
 import { Key, Copy, Trash2, Plus, Check, Eye, EyeOff } from 'lucide-react';
 
 interface ApiKeyItem {
   id: string;
   key: string;
   name: string;
   is_active: boolean;
   rate_limit: number;
  monthly_cap: number;
  daily_cap: number;
   created_at: string;
 }
 
 export default function KeysPage() {
  const { t } = useLang();
   const [keys, setKeys] = useState<ApiKeyItem[]>([]);
   const [loading, setLoading] = useState(true);
   const [newName, setNewName] = useState('');
   const [creating, setCreating] = useState(false);
   const [copiedId, setCopiedId] = useState('');
   const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newMonthlyCap, setNewMonthlyCap] = useState<string>("");
  const [newDailyCap, setNewDailyCap] = useState<string>("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState('');
    const [showQuickstart, setShowQuickstart] = useState(false);
 
   useEffect(() => {
     loadKeys();
   }, []);
 
   const loadKeys = async () => {
     try {
       const data = await keysApi.list();
       setKeys(data);
     } catch (err) {
       console.error('Failed to load keys', err);
     } finally {
       setLoading(false);
     }
   };
 
   const handleCreate = async () => {
     setCreating(true);
     try {
      const result = await keysApi.create(newName, Number(newMonthlyCap) || 0, Number(newDailyCap) || 0);
        setNewlyCreatedKey(result.key);
        setShowQuickstart(true);
      setNewName('');
      setNewMonthlyCap('');
      setNewDailyCap('');
       await loadKeys();
     } catch (err) {
       console.error('Failed to create key', err);
     } finally {
       setCreating(false);
     }
   };
 
   const handleDelete = async (id: string) => {
     if (!confirm('确定删除此密钥？此操作不可撤销。')) return;
     try {
       await keysApi.delete(id);
       await loadKeys();
     } catch (err) {
       console.error('Failed to delete key', err);
     }
   };
 
   const copyToClipboard = (key: string, id: string) => {
     navigator.clipboard.writeText(key);
     setCopiedId(id);
     setTimeout(() => setCopiedId(''), 2000);
   };
 
   if (loading) {
     return (
       <div className="flex items-center justify-center h-full">
         <div className="flex flex-col items-center gap-3">
           <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
           <span className="text-[12px] text-white/30">{t.keys.loading}</span>
         </div>
       </div>
     );
   }
 
   return (
     <div className="w-full page-container space-y-8">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-[20px] font-semibold text-white">{t.keys.title}</h1>
           <p className="text-[12px] text-white/30 mt-1">{t.keys.desc}</p>
         </div>
       </div>
 
       {/* Create key */}
       <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
         <h3 className="text-[13px] font-medium text-white/70 mb-4">{t.keys.createNew}</h3>
         <div className="flex gap-3 items-start">
           <div className="flex-1 space-y-2">
             <input
               type="text"
               placeholder="密钥名称（选填）"
               value={newName}
               onChange={(e) => setNewName(e.target.value)}
               className="glass-input w-full"
               onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
             />
             <div className="flex gap-2">
               <input
                 type="number"
                 placeholder="月配额（Token，0=不限）"
                 value={newMonthlyCap}
                 onChange={(e) => setNewMonthlyCap(e.target.value)}
                 className="glass-input w-1/2 text-[11px]"
               />
               <input
                 type="number"
                 placeholder="日配额（Token，0=不限）"
                 value={newDailyCap}
                 onChange={(e) => setNewDailyCap(e.target.value)}
                 className="glass-input w-1/2 text-[11px]"
               />
             </div>
           </div>
           <button
             onClick={handleCreate}
             disabled={creating}
             className="glass-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-emerald-400 shrink-0"
           >
             <Plus size={16} />
             {creating ? '创建中...' : '创建'}
           </button>
         </div>
       </div>
 
        {showQuickstart && newlyCreatedKey && (
          <div className="backdrop-blur-xl bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-medium text-emerald-400">快速开始 — 配置你的客户端</h3>
              <button onClick={() => setShowQuickstart(false)} className="text-white/30 hover:text-white/70 text-[11px] transition-all">关闭 ×</button>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-white/40 w-16 shrink-0">接入地址：</span>
                <code className="font-mono text-emerald-400 bg-black/20 px-2 py-1 rounded flex-1">https://tokup.net/api/v1</code>
                <button onClick={() => { navigator.clipboard.writeText('https://tokup.net/api/v1'); }} className="text-white/30 hover:text-emerald-400 shrink-0 transition-all px-2 py-1 rounded bg-white/5">复制</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/40 w-16 shrink-0">API 密钥：</span>
                <code className="font-mono text-emerald-400 bg-black/20 px-2 py-1 rounded flex-1 truncate">{newlyCreatedKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(newlyCreatedKey); }} className="text-white/30 hover:text-emerald-400 shrink-0 transition-all px-2 py-1 rounded bg-white/5">复制</button>
              </div>
            </div>
            <div className="text-[11px] text-white/40 space-y-1">
              <p>配置方法：</p>
              <p className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">❶</span> Codex / CC Switch：供应商地址填上述地址，API Key 填上述密钥</p>
              <p className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">❷</span> OpenAI SDK：设置 <code className="font-mono text-white/60 bg-black/20 px-1 rounded">base_url</code> 和 <code className="font-mono text-white/60 bg-black/20 px-1 rounded">api_key</code></p>
              <p className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">❸</span> 其他客户端：直接填入上述地址和密钥即可</p>
            </div>
            <p className="text-[10px] text-white/20">提示：密钥只显示一次，建议立即复制保存</p>
          </div>
        )}
       {/* Batch toolbar */}
       {selectedKeys.size > 0 && (
         <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
           <span className="text-[12px] text-emerald-400">{selectedKeys.size} selected</span>
           <button
             onClick={async () => {
               if (!confirm('确定删除选中的 ' + selectedKeys.size + ' 个密钥？此操作不可撤销。')) return;
               try {
                 await keysApi.batchDelete(Array.from(selectedKeys));
                 setSelectedKeys(new Set());
                 setSelectAll(false);
                 await loadKeys();
               } catch (err) {
                 console.error('Failed to batch delete keys', err);
               }
             }}
             className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] hover:bg-red-500/20 transition-all"
           >
             删除选中
           </button>
         </div>
       )}

       {/* Keys list */}
       <div className="space-y-3">
         {keys.length === 0 ? (
           <div className="text-center py-16">
             <Key size={32} className="mx-auto text-white/10 mb-3" />
             <p className="text-[13px] text-white/30">{t.keys.noKeys}</p>
             <p className="text-[11px] text-white/20 mt-1">{t.keys.noKeysDesc}</p>
           </div>
         ) : (
           keys.map((k) => {
             const visible = showKeys[k.id];
             const truncated = k.key.slice(0, 16) + '...' + k.key.slice(-8);
             return (
               <div
                 key={k.id}
                 className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 transition-all hover:bg-white/[0.04]"
               >
                 <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                       <Key size={14} className="text-emerald-400" />
                     </div>
                     <div>
                       <p className="text-[13px] font-medium text-white">{k.name}</p>
                       <p className="text-[10px] text-white/30">
                         创建于 {new Date(k.created_at).toLocaleDateString()}
                       </p>
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => setShowKeys({ ...showKeys, [k.id]: !visible })}
                       className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/70 transition-all"
                       title={visible ? '隐藏密钥' : '显示密钥'}
                     >
                       {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                     </button>
                     <button
                       onClick={() => copyToClipboard(k.key, k.id)}
                       className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-emerald-400 transition-all"
                       title="复制密钥"
                     >
                       {copiedId === k.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                     </button>
                     <button
                       onClick={() => handleDelete(k.id)}
                       className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-red-400 transition-all"
                       title="删除密钥"
                     >
                       <Trash2 size={14} />
                     </button>
                   </div>
                 </div>
 
                 {/* Key display */}
                 <div className="bg-[#13131D] rounded-xl px-4 py-3 font-mono text-[12px]">
                   <code className="text-white/60">
                     {visible ? k.key : truncated}
                   </code>
                 </div>
 
                 <div className="flex items-center gap-4 mt-3 text-[10px] text-white/20">
                   <span>速率限制：{k.rate_limit} 次/分钟</span>
                   {(k.monthly_cap || 0) > 0 && <span className="text-white/30">月：{(k.monthly_cap || 0).toLocaleString()} Token</span>}
                   {(k.daily_cap || 0) > 0 && <span className="text-white/30">日：{(k.daily_cap || 0).toLocaleString()} Token</span>}
                   <span>|</span>
                   <span className={k.is_active ? 'text-emerald-400' : 'text-red-400'}>
                     {k.is_active ? '正常' : '停用'}
                   </span>
                 </div>
               </div>
             );
           })
         )}
       </div>
 
 
     </div>
   );
 }
