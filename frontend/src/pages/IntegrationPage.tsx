import { useLang } from '../contexts/LanguageContext';
import { Copy, Check, Code, Terminal, ExternalLink, BookOpen, Zap } from 'lucide-react';
import { useState } from 'react';

const codeExamples = [
  {
    lang: 'curl',
    code: `curl https://api.tokup.io/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_TOKUP_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello, who are you?"}]
  }'`,
  },
  {
    lang: 'Python',
    code: `import openai

client = openai.OpenAI(
    api_key="YOUR_TOKUP_API_KEY",  # Your TokUp API key
    base_url="https://api.tokup.io/v1"  # TokUp proxy endpoint
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello, who are you?"}]
)

print(response.choices[0].message.content)`,
  },
  {
    lang: 'Node.js',
    code: `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'YOUR_TOKUP_API_KEY',  // Your TokUp API key
  baseURL: 'https://api.tokup.io/v1',  // TokUp proxy endpoint
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello, who are you?' }],
});

console.log(response.choices[0].message.content);`,
  },
];

const models = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', input: '¥20', output: '¥60', note: 'Best for most tasks' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', input: '¥1.5', output: '¥4.5', note: 'Fast & cheap' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', input: '¥30', output: '¥60', note: 'Legacy powerful' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', input: '¥15', output: '¥75', note: 'Best for reasoning' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'Anthropic', input: '¥60', output: '¥180', note: 'Most capable' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'Anthropic', input: '¥1.5', output: '¥6', note: 'Fastest Claude' },
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', input: '¥0.5', output: '¥1.0', note: 'Best value' },
  { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek', input: '¥0.5', output: '¥1.0', note: 'Code specialist' },
];

export default function IntegrationPage() {
  const { t } = useLang();
  const [copied, setCopied] = useState<string | null>(null);

  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };

  const handleCopy = (code: string, lang: string) => {
    navigator.clipboard.writeText(code);
    setCopied(lang);
    setTimeout(() => setCopied(null), 2000);
  };

  
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-semibold text-white">{tr('integration.title')}</h1>
        <p className="text-[12px] text-white/30 mt-1">{tr('integration.subtitle')}</p>
      </div>

      {/* Quick Start */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">
          <span className="flex items-center gap-2"><Zap size={14} className="text-emerald-400" /> Quick Start</span>
        </h3>
        <div className="space-y-3 text-[12px] text-white/50">
          <p>1. <strong className="text-white/70">{tr('integration.quickStart1')}</strong> — {tr('integration.quickStartDesc1')} <span className="text-emerald-400">API Key</span> page and create one</p>
          <p>2. <strong className="text-white/70">{tr('integration.quickStart2')}</strong> — {tr('integration.quickStartDesc2')} <code className="text-emerald-400 font-mono">https://api.tokup.io/v1</code></p>
          <p>3. <strong className="text-white/70">{tr('integration.quickStart3')}</strong> — {tr('integration.quickStartDesc3')}</p>
          <p>4. <strong className="text-white/70">{tr('integration.quickStart4')}</strong> — {tr('integration.quickStartDesc4')}</p>
        </div>
      </div>

      {/* Base URL */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-2">{tr('integration.baseUrlLabel')}</h3>
        <div className="bg-[#0A0A0F] rounded-xl px-4 py-3 font-mono text-[13px] text-emerald-400 select-all">https://api.tokup.io/v1</div>
      </div>

      {/* {tr('integration.codeExamples')} */}
      <div className="space-y-4">
        <h3 className="text-[13px] font-medium text-white/70">{tr('integration.codeExamples')}</h3>
        {codeExamples.map((ex) => (
          <div key={ex.lang} className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
              <span className="flex items-center gap-2 text-[12px] text-white/50 font-mono">
                {ex.lang === 'curl' ? <Terminal size={12} /> : <Code size={12} />}
                {ex.lang}
              </span>
              <button
                onClick={() => handleCopy(ex.code, ex.lang)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition-all"
              >
                {copied === ex.lang ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copied === ex.lang ? tr('integration.copied') : tr('integration.copy')}
              </button>
            </div>
            <pre className="p-5 text-[12px] text-white/60 font-mono leading-relaxed overflow-x-auto">{ex.code}</pre>
          </div>
        ))}
      </div>

      {/* {tr('integration.modelRef')} */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">
          <span className="flex items-center gap-2"><BookOpen size={14} /> {tr('integration.modelRef')}</span>
        </h3>
        <p className="text-[11px] text-white/40 mb-4">Use these model IDs in your API calls. {tr('integration.modelRefPrice')}.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left text-white/30 font-medium pb-3 pr-3">Model ID</th>
                <th className="text-left text-white/30 font-medium pb-3 pr-3">Name</th>
                <th className="text-left text-white/30 font-medium pb-3 pr-3">Provider</th>
                <th className="text-right text-white/30 font-medium pb-3 pr-3">Input</th>
                <th className="text-right text-white/30 font-medium pb-3 pr-3">Output</th>
                <th className="text-right text-white/30 font-medium pb-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-b border-white/[0.02] last:border-0">
                  <td className="py-3 pr-3 font-mono text-[11px] text-emerald-400">{m.id}</td>
                  <td className="py-3 pr-3 text-white/70">{m.name}</td>
                  <td className="py-3 pr-3 text-white/40">{m.provider}</td>
                  <td className="py-3 pr-3 text-right text-white/60">{m.input}/1M</td>
                  <td className="py-3 pr-3 text-right text-white/60">{m.output}/1M</td>
                  <td className="py-3 text-right text-white/30">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* {tr('integration.sdkCompat')} */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">
          <span className="flex items-center gap-2"><ExternalLink size={14} /> {tr('integration.sdkCompat')}</span>
        </h3>
        <div className="space-y-2 text-[12px] text-white/50">
          <p>{tr('integration.sdkCompatDesc')}</p>
          <ul className="list-disc list-inside space-y-1 pt-2">
            <li><span className="text-white/60">Python</span> — <code className="font-mono text-[11px] text-emerald-400">pip install openai</code></li>
            <li><span className="text-white/60">Node.js</span> — <code className="font-mono text-[11px] text-emerald-400">npm install openai</code></li>
            <li><span className="text-white/60">Go</span> — <code className="font-mono text-[11px] text-emerald-400">go get github.com/openai/openai-go</code></li>
            <li><span className="text-white/60">Any OpenAI-compatible client</span> — Just change the base URL</li>
          </ul>
        </div>
      </div>

      {/* Endpoints */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">API Endpoints</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">POST</span>
            <code className="text-[12px] text-white/60 font-mono">/v1/chat/completions</code>
            <span className="text-[11px] text-white/30 ml-auto">{tr('integration.endpointChat')}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono font-bold">GET</span>
            <code className="text-[12px] text-white/60 font-mono">/v1/models</code>
            <span className="text-[11px] text-white/30 ml-auto">{tr('integration.endpointModels')}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <span className="px-2 py-0.5 rounded bg-white/10 text-white/40 text-[10px] font-mono font-bold">GET</span>
            <code className="text-[12px] text-white/60 font-mono">/api/keys</code>
            <span className="text-[11px] text-white/30 ml-auto">{tr('integration.endpointKeys')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
