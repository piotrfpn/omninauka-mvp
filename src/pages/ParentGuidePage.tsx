import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import OmniNaukaLogo from '../components/brand/OmniNaukaLogo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { fullParentGuide, quickParentGuide } from '../lib/parent-guide-content';

const focusStyle = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4F7CFF] dark:focus-visible:outline-[#8EAAFF]';
const markdownStyle = 'space-y-4 leading-relaxed [overflow-wrap:anywhere] [&_h2]:pt-7 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:pt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-2 [&_li>p]:my-3 [&_strong]:font-bold [&_blockquote]:my-5 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-4 [&_blockquote]:border-[#4F7CFF] [&_blockquote]:bg-[#4F7CFF]/5 [&_blockquote]:p-4 [&_th]:bg-slate-100 [&_th]:p-3 dark:[&_th]:bg-slate-800 [&_td]:border-t [&_td]:border-slate-200 [&_td]:p-3 dark:[&_td]:border-slate-700 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:text-sm dark:[&_code]:bg-slate-800 [&_a]:underline [&_a]:underline-offset-4';

function GuideTable({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div role="region" aria-label={t('parentGuide.tableLabel')} tabIndex={0} className={`overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 ${focusStyle}`}>
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

const guideComponents: Components = { table: GuideTable };

export default function ParentGuidePage() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] text-[var(--omni-text)]">
      <nav aria-label={t('parentGuide.navigationLabel')} className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0B1220]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Link to="/" className={`inline-flex min-h-11 items-center rounded-lg ${focusStyle}`}>
            <OmniNaukaLogo size={36} />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <Link to="/login" className={`inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold underline-offset-4 hover:underline ${focusStyle}`}>
              {t('auth.login.submit')}
            </Link>
          </div>
        </div>
      </nav>

      <header className="omninauka-login-bg relative isolate border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 -z-10 bg-white/35 dark:bg-[#0B1220]/30" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
          <div className="max-w-2xl rounded-3xl border border-white/80 bg-white/95 p-6 shadow-sm dark:border-slate-700 dark:bg-[#0B1220]/95 sm:p-10">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#345CC5] dark:text-[#A9BEFF]">
              {t('parentGuide.eyebrow')}
            </p>
            <h1 lang="pl" className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{fullParentGuide.title}</h1>
            <p className="mt-5 leading-relaxed text-[var(--omni-text-muted)]">{t('parentGuide.intro')}</p>
            {i18n.resolvedLanguage !== 'pl' && (
              <p className="mt-5 rounded-xl border border-[#4F7CFF]/30 bg-[#4F7CFF]/5 p-4 text-sm">{t('parentGuide.languageNote')}</p>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href="#piec-etapow" className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-[#142955] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1C396F] ${focusStyle}`}>
                {t('parentGuide.quickLink')}
              </a>
              <a href="#pelna-instrukcja" className={`inline-flex min-h-12 items-center justify-center rounded-xl border border-[#4F7CFF] bg-white px-5 py-3 text-sm font-semibold text-[#142955] hover:bg-[#F0F4FF] dark:bg-[#0B1220] dark:text-white dark:hover:bg-[#142955] ${focusStyle}`}>
                {t('parentGuide.fullLink')}
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-5 py-10 sm:px-8 sm:py-16">
        <section id="piec-etapow" lang="pl" aria-labelledby="quick-guide-title" className="scroll-mt-6 lg:grid lg:grid-cols-[1fr_2fr] lg:items-start lg:gap-12">
          <div className="mb-7 lg:sticky lg:top-8 lg:mb-0">
            <h2 id="quick-guide-title" className="text-2xl font-bold leading-tight sm:text-3xl">{quickParentGuide.title}</h2>
            <div className={`mt-4 text-[var(--omni-text-muted)] ${markdownStyle}`}>
              <ReactMarkdown>{quickParentGuide.introduction}</ReactMarkdown>
            </div>
          </div>
          <ol className="space-y-5">
            {quickParentGuide.steps.map((step) => (
              <li key={step.number} data-guide-step={step.number} className={`min-w-0 rounded-2xl border border-l-4 bg-white p-5 shadow-sm dark:bg-[#101B2E] sm:p-7 ${step.role === 'parent' ? 'border-slate-200 border-l-[#4F7CFF] dark:border-slate-700 dark:border-l-[#8EAAFF]' : 'border-slate-200 border-l-[#16A679] dark:border-slate-700 dark:border-l-[#2EE6A6]'}`}>
                <div className="mb-4 flex items-center gap-3">
                  <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${step.role === 'parent' ? 'bg-[#EDF2FF] text-[#254BA7] dark:bg-[#203762] dark:text-[#C7D5FF]' : 'bg-[#E3F8EF] text-[#14694E] dark:bg-[#123D34] dark:text-[#88F1CC]'}`}>{step.number}</span>
                  <div>
                    <p className={`mb-1 text-xs font-bold uppercase tracking-wider ${step.role === 'parent' ? 'text-[#345CC5] dark:text-[#A9BEFF]' : 'text-[#14694E] dark:text-[#88F1CC]'}`}>{step.roleLabel} · {step.number}/5</p>
                    <h3 className="text-lg font-bold leading-snug first-letter:uppercase">{step.title}</h3>
                  </div>
                </div>
                <div className={`text-sm sm:text-base ${markdownStyle}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.body}</ReactMarkdown>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="pelna-instrukcja" aria-labelledby="full-guide-title" className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#101B2E] sm:p-10">
          <div className="mb-8 border-b border-slate-200 pb-6 dark:border-slate-700">
            <h2 id="full-guide-title" className="text-2xl font-bold sm:text-3xl">{t('parentGuide.fullTitle')}</h2>
            <p className="mt-3 text-sm text-[var(--omni-text-muted)] sm:hidden">{t('parentGuide.tableHint')}</p>
          </div>
          <article lang="pl" className={markdownStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={guideComponents}>{fullParentGuide.body}</ReactMarkdown>
          </article>
        </section>

        <div className="text-center">
          <Link to="/" className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold underline underline-offset-4 ${focusStyle}`}>{t('auth.backToHome')}</Link>
        </div>
      </main>
    </div>
  );
}
