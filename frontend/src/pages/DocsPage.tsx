import { useLang } from '../contexts/LanguageContext';

export default function DocsPage() {
  const { t } = useLang();
  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-[20px] font-semibold text-white">{tr('docs.title')}</h1>
        <p className="text-[12px] text-white/30 mt-1">{tr('docs.subtitle')}</p>
      </div>

      {/* {tr('docs.baseUrl')} */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-2">{tr('docs.baseUrl')}</h3>
        <div className="bg-[#0A0A0F] rounded-xl px-4 py-3 font-mono text-[13px] text-emerald-400">https://api.tokup.io/v1</div>
      </div>

      {/* {tr('docs.endpoints')} */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">{tr('docs.endpoints')}</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">POST</span>
            <code className="text-[12px] text-white/60 font-mono">/v1/chat/completions</code>
            <span className="text-[11px] text-white/30 ml-auto">{tr('docs.chatCompletions')}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono font-bold">GET</span>
            <code className="text-[12px] text-white/60 font-mono">/v1/models</code>
            <span className="text-[11px] text-white/30 ml-auto">{tr('docs.listModels')}</span>
          </div>
        </div>
      </div>

      {/* Auth */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-3">{tr('docs.auth')}</h3>
        <p className="text-[12px] text-white/50 mb-3">{tr('docs.authDesc')}</p>
        <div className="bg-[#0A0A0F] rounded-xl px-4 py-3 font-mono text-[12px]">
          <code className="text-white/60">Authorization: Bearer {'<your-api-key>'}</code>
        </div>
      </div>
    </div>
  );
}
