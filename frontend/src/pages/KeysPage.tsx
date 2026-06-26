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
      await keysApi.create(newName, Number(newMonthlyCap) || 0, Number(newDailyCap) || 0);
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
     if (!confirm('Delete this API key? This action cannot be undone.')) return;
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
     <div className="max-w-4xl mx-auto space-y-8">
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
               placeholder="Key name (optional)"
               value={newName}
               onChange={(e) => setNewName(e.target.value)}
               className="glass-input w-full"
               onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
             />
             <div className="flex gap-2">
               <input
                 type="number"
                 placeholder="Monthly cap (tokens, 0=unlimited)"
                 value={newMonthlyCap}
                 onChange={(e) => setNewMonthlyCap(e.target.value)}
                 className="glass-input w-1/2 text-[11px]"
               />
               <input
                 type="number"
                 placeholder="Daily cap (tokens, 0=unlimited)"
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
             {creating ? 'Creating...' : 'Create'}
           </button>
         </div>
       </div>
 
       {/* Batch toolbar */}
       {selectedKeys.size > 0 && (
         <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
           <span className="text-[12px] text-emerald-400">{selectedKeys.size} selected</span>
           <button
             onClick={() => {
               if (confirm('Delete ' + selectedKeys.size + ' keys?')) {
                 // TODO: call batch delete API
                 setSelectedKeys(new Set());
                 setSelectAll(false);
               }
             }}
             className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] hover:bg-red-500/20 transition-all"
           >
             Delete selected
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
                         Created {new Date(k.created_at).toLocaleDateString()}
                       </p>
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => setShowKeys({ ...showKeys, [k.id]: !visible })}
                       className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/70 transition-all"
                       title={visible ? 'Hide key' : 'Show key'}
                     >
                       {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                     </button>
                     <button
                       onClick={() => copyToClipboard(k.key, k.id)}
                       className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-emerald-400 transition-all"
                       title="Copy key"
                     >
                       {copiedId === k.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                     </button>
                     <button
                       onClick={() => handleDelete(k.id)}
                       className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-red-400 transition-all"
                       title="Delete key"
                     >
                       <Trash2 size={14} />
                     </button>
                   </div>
                 </div>
 
                 {/* Key display */}
                 <div className="bg-[#0A0A0F] rounded-xl px-4 py-3 font-mono text-[12px]">
                   <code className="text-white/60">
                     {visible ? k.key : truncated}
                   </code>
                 </div>
 
                 <div className="flex items-center gap-4 mt-3 text-[10px] text-white/20">
                   <span>Rate limit: {k.rate_limit} req/min</span>
                   {(k.monthly_cap || 0) > 0 && <span className="text-white/30">Month: {(k.monthly_cap || 0).toLocaleString()} tok</span>}
                   {(k.daily_cap || 0) > 0 && <span className="text-white/30">Day: {(k.daily_cap || 0).toLocaleString()} tok</span>}
                   <span>|</span>
                   <span className={k.is_active ? 'text-emerald-400' : 'text-red-400'}>
                     {k.is_active ? 'Active' : 'Inactive'}
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
