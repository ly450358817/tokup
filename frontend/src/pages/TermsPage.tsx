import { Fragment } from 'react';
import { X } from 'lucide-react';
import { TERMS_SECTIONS, TermsSection } from './termsContent';

function renderText(text: string) {
  // 解析 **加粗** 与换行
  const parts = text.split('**');
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-white/90">{part}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

function SectionBlock({ sec }: { sec: TermsSection }) {
  switch (sec.type) {
    case 'h1':
      return <h1 className="text-[22px] font-bold text-white mt-8 mb-3 leading-snug">{renderText(sec.text)}</h1>;
    case 'h2':
      return <h2 className="text-[16px] font-semibold text-white mt-6 mb-2 leading-snug">{renderText(sec.text)}</h2>;
    case 'h3':
      return <h3 className="text-[14px] font-semibold text-emerald-300 mt-4 mb-1 leading-snug">{renderText(sec.text)}</h3>;
    case 'note':
      return (
        <div className="text-[12px] text-white/40 border-l-2 border-emerald-500/30 pl-3 my-3 leading-relaxed whitespace-pre-line">
          {renderText(sec.text)}
        </div>
      );
    default:
      return <p className="text-[13px] text-white/60 leading-relaxed my-2">{renderText(sec.text)}</p>;
  }
}

export default function TermsPage() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] mb-3">
            📄 用户服务协议 · 隐私政策
          </div>
          <h1 className="text-[26px] font-bold text-white">TokUp · 脉充</h1>
        </div>
        <a
          href="/register"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/60 hover:bg-white/[0.06] text-[11px] transition-all"
        >
          <X size={14} />
          返回注册
        </a>
      </div>

      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 md:p-8">
        {TERMS_SECTIONS.map((sec, i) => (
          <SectionBlock key={i} sec={sec} />
        ))}
      </div>

      <p className="text-[11px] text-white/25 text-center mt-6">
        TokUp（脉充）· 版本 V1.0 · 生效日期 2026 年 8 月 17 日 · 联系邮箱 support@tokup.net
      </p>
    </div>
  );
}
