import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './how-it-works.css';
import {
  captures,
  capturesEn,
  landingPl,
  landingEn,
  navigation,
  navigationEn,
  legalDocuments,
  legalDocLabelsEn,
  type Locale,
} from './how-it-works-data';

function SectionHeading({
  label,
  title,
  id,
}: {
  label: string;
  title: string;
  id?: string;
}) {
  return (
    <div className="section-heading">
      <span className="eyebrow">{label}</span>
      <h2 id={id}>{title}</h2>
    </div>
  );
}

function ProductFigure({
  captureId,
  eager = false,
  locale = 'pl',
}: {
  captureId: string;
  eager?: boolean;
  locale?: Locale;
}) {
  const cap = locale === 'en' ? capturesEn[captureId] : captures[captureId];
  if (!cap) return null;
  const mobile = cap.mobile;
  const enlargeLabel = locale === 'en' ? `Enlarge view of ${cap.label}` : `Powiększ widok ${cap.label}`;

  return (
    <figure className="product-figure" data-capture={captureId}>
      <div className="product-frame">
        <picture>
          {mobile && (
            <source
              media="(max-width: 639px)"
              srcSet={mobile.src}
              width={mobile.width}
              height={mobile.height}
            />
          )}
          <img
            src={cap.src}
            alt={cap.alt}
            width={cap.width}
            height={cap.height}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            {...(eager ? { fetchPriority: 'high' as const } : {})}
          />
        </picture>
      </div>
      <figcaption>
        {cap.caption}
        <br />
        <a
          className={`enlarge ${mobile ? 'desktop-enlarge' : ''}`}
          href={cap.src}
          target="_blank"
          rel="noopener noreferrer"
        >
          {enlargeLabel}
        </a>
        {mobile && (
          <a
            className="enlarge mobile-enlarge"
            href={mobile.src}
            target="_blank"
            rel="noopener noreferrer"
          >
            {enlargeLabel}
          </a>
        )}
      </figcaption>
    </figure>
  );
}

export default function HowItWorksPage() {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState<Locale>(() => {
    return i18n.language && i18n.language.startsWith('en') ? 'en' : 'pl';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const content = locale === 'en' ? landingEn : landingPl;
  const navItems = locale === 'en' ? navigationEn : navigation;
  const navLabel = locale === 'en' ? 'Main navigation' : 'Główna nawigacja';
  const mobileNavLabel = locale === 'en' ? 'Main mobile navigation' : 'Główna nawigacja mobilna';
  const pilotLabel = locale === 'en' ? 'Ask about the pilot' : 'Udział w pilotażu';

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    if (i18n.changeLanguage) {
      i18n.changeLanguage(newLocale);
    }
  };

  useEffect(() => {
    document.title =
      locale === 'en'
        ? 'OmniNauka — How it works — AI study support with your own materials'
        : 'OmniNauka — Jak to działa — nauka z AI na Twoich materiałach';
  }, [locale]);

  // Handle hash scrolling on initial load or change
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      const elem = document.getElementById(id);
      if (elem) {
        setTimeout(() => {
          elem.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, []);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  // Close mobile menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isMobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMobileMenuOpen]);

  // Close mobile menu on desktop media query breakpoint
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 720px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsMobileMenuOpen(false);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const handleAnchorClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      setIsMobileMenuOpen(false);
      const id = href.slice(1);
      const elem = document.getElementById(id);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth' });
        elem.focus({ preventScroll: true });
        window.history.pushState(null, '', href);
      }
    }
  };

  return (
    <div className="how-it-works-root">
      <a
        href="#tresc"
        className="skip-link"
        onClick={(e) => handleAnchorClick(e, '#tresc')}
      >
        {locale === 'en' ? 'Skip to main content' : 'Przejdź do treści'}
      </a>

      {/* Header (Section 01) */}
      <div className="site-header-shell">
        <header className="container site-header" data-section="01">
          <Link
            to="/"
            className="brand"
            aria-label={
              locale === 'en'
                ? 'OmniNauka — app homepage'
                : 'OmniNauka — strona główna aplikacji'
            }
          >
            <img
              src="/brand/omninauka-symbol-dark.png"
              width="256"
              height="256"
              alt=""
              decoding="async"
            />
            <span>OmniNauka</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="desktop-nav" aria-label={navLabel}>
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleAnchorClick(e, item.href)}
              >
                {item.label}
              </a>
            ))}

            {/* Desktop Language Switcher */}
            <div
              className="lang-switcher lang-switcher-desktop"
              aria-label={locale === 'en' ? 'Language selector' : 'Wybór języka'}
            >
              <button
                type="button"
                className={`lang-btn ${locale === 'pl' ? 'active' : ''}`}
                onClick={() => changeLocale('pl')}
                aria-label="Polski"
                aria-current={locale === 'pl' ? 'page' : undefined}
              >
                PL
              </button>
              <span className="lang-divider" aria-hidden="true">
                |
              </span>
              <button
                type="button"
                className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
                onClick={() => changeLocale('en')}
                aria-label="English"
                aria-current={locale === 'en' ? 'page' : undefined}
              >
                EN
              </button>
            </div>

            {/* Back to App Login */}
            <Link to="/login" className="app-nav-link">
              {locale === 'en' ? 'Log in' : 'Zaloguj się'}
            </Link>
          </nav>

          {/* Mobile Menu */}
          <div
            className="mobile-menu"
            id="mobile-menu"
            ref={mobileMenuRef}
          >
            <button
              type="button"
              className="mobile-menu-toggle"
              aria-expanded={isMobileMenuOpen}
              aria-label={locale === 'en' ? 'Toggle menu' : 'Przełącz menu'}
              onClick={(e) => {
                e.stopPropagation();
                setIsMobileMenuOpen((prev) => !prev);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '2.75rem',
                minWidth: '3.5rem',
                padding: '.75rem',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                background: 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              Menu
            </button>
            {isMobileMenuOpen && (
              <nav aria-label={mobileNavLabel}>
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(e) => handleAnchorClick(e, item.href)}
                  >
                    {item.label}
                  </a>
                ))}
                <a
                  href="#pilotaz"
                  onClick={(e) => handleAnchorClick(e, '#pilotaz')}
                >
                  {pilotLabel}
                </a>

                <div className="mobile-app-links">
                  <Link
                    to="/"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {locale === 'en' ? 'App Home' : 'Strona główna aplikacji'}
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {locale === 'en' ? 'Log in' : 'Zaloguj się'}
                  </Link>
                </div>

                <div className="mobile-menu-lang">
                  <div
                    className="lang-switcher lang-switcher-mobile"
                    aria-label={
                      locale === 'en' ? 'Language selector' : 'Wybór języka'
                    }
                  >
                    <button
                      type="button"
                      className={`lang-btn ${locale === 'pl' ? 'active' : ''}`}
                      onClick={() => changeLocale('pl')}
                      aria-label="Polski"
                      aria-current={locale === 'pl' ? 'page' : undefined}
                    >
                      PL
                    </button>
                    <span className="lang-divider" aria-hidden="true">
                      |
                    </span>
                    <button
                      type="button"
                      className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
                      onClick={() => changeLocale('en')}
                      aria-label="English"
                      aria-current={locale === 'en' ? 'page' : undefined}
                    >
                      EN
                    </button>
                  </div>
                </div>
              </nav>
            )}
          </div>
        </header>
      </div>

      {/* Main Content Area */}
      <main id="tresc" tabIndex={-1}>
        {/* Hero Section (Section 02) */}
        <section
          className="hero-stage"
          aria-labelledby="hero-heading"
          data-section="02"
        >
          <div className="container hero">
            <div className="hero-copy">
              <span className="eyebrow">{content.hero.label}</span>
              <h1 id="hero-heading">
                {content.hero.headline[0]}
                <span>{content.hero.headline[1]}</span>
              </h1>
              <p>{content.hero.description}</p>
              <div className="actions">
                <a
                  className="action primary"
                  href="#jak-dziala"
                  onClick={(e) => handleAnchorClick(e, '#jak-dziala')}
                >
                  {content.cta.primary}
                </a>
                <a
                  className="action"
                  href="#pilotaz"
                  onClick={(e) => handleAnchorClick(e, '#pilotaz')}
                >
                  {content.cta.secondary}
                </a>
              </div>
              <p className="note">{content.hero.note}</p>
            </div>
            <div className="hero-proof" id="analiza" tabIndex={-1}>
              <ProductFigure
                captureId="analysis"
                eager
                locale={locale}
              />
            </div>
          </div>
        </section>

        {/* Principles / TrustStrip (Section 03) */}
        <div className="container" data-section="03">
          <ul
            className="principles"
            aria-label={
              locale === 'en' ? 'Product principles' : 'Zasada produktu'
            }
          >
            {content.principles.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>

        {/* HowItWorks 4 Steps (Section 04) */}
        <section
          className="container section"
          aria-labelledby="steps-heading"
          data-section="04"
        >
          <SectionHeading {...content.sections.how} id="steps-heading" />
          <ol className="steps">
            {content.steps.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ProductStory (Section 05) */}
        <section
          className="container story"
          id="jak-dziala"
          tabIndex={-1}
          aria-labelledby="story-heading"
          data-section="05"
        >
          <div className="story-grid">
            <SectionHeading {...content.sections.story} id="story-heading" />
            <div>
              <p>{content.sections.story.text}</p>
              <ol className="story-list">
                {content.story.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      onClick={(e) => handleAnchorClick(e, item.href)}
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* StudentBenefits (Section 06) */}
        <section
          className="container section"
          id="dla-ucznia"
          tabIndex={-1}
          aria-labelledby="student-heading"
          data-section="06"
        >
          <SectionHeading {...content.sections.student} id="student-heading" />
          <div className="benefits">
            {content.benefits.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* TutorSection (Section 07) */}
        <section
          className="section surface"
          id="ai-tutor"
          tabIndex={-1}
          aria-labelledby="tutor-heading"
          data-section="07"
        >
          <div className="container split">
            <div className="copy-stack">
              <SectionHeading {...content.sections.tutor} id="tutor-heading" />
              <p>{content.sections.tutor.text}</p>
              <p className="note">{content.sections.tutor.note}</p>
            </div>
            <ProductFigure captureId="tutor" locale={locale} />
          </div>
        </section>

        {/* ReviewLoop (Section 08) */}
        <section
          className="container section split reverse review"
          id="powtorka"
          tabIndex={-1}
          aria-labelledby="review-heading"
          data-section="08"
        >
          <div className="copy-stack">
            <SectionHeading {...content.sections.review} id="review-heading" />
            <p>{content.sections.review.text}</p>
            <ol
              className="review-loop"
              aria-label={locale === 'en' ? 'Learning loop' : 'Pętla nauki'}
            >
              {content.reviewLoop.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ol>
            <p className="note">{content.sections.review.note}</p>
          </div>
          <ProductFigure captureId="quiz" locale={locale} />
        </section>

        {/* ProgressSection (Section 09) */}
        <section
          className="container section history-grid"
          id="historia"
          tabIndex={-1}
          aria-labelledby="history-heading"
          data-section="09"
        >
          <div className="copy-stack">
            <SectionHeading
              {...content.sections.history}
              id="history-heading"
            />
            <p>{content.sections.history.text}</p>
          </div>
          <ProductFigure captureId="history" locale={locale} />
        </section>

        {/* ParentTrust (Section 10) */}
        <section
          className="section surface"
          id="dla-rodzica"
          tabIndex={-1}
          aria-labelledby="parent-heading"
          data-section="10"
        >
          <div className="container parent-grid">
            <div className="copy-stack">
              <SectionHeading
                {...content.sections.parent}
                id="parent-heading"
              />
              <p>{content.sections.parent.text}</p>
            </div>
            <div className="parent-points">
              {content.parentPoints.map((item) => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* AISafety (Section 11) */}
        <section
          className="container section safety-grid"
          id="bezpieczenstwo"
          tabIndex={-1}
          aria-labelledby="safety-heading"
          data-section="11"
        >
          <SectionHeading {...content.sections.safety} id="safety-heading" />
          <div className="safety-copy">
            {content.sections.safety.paragraphs.map((text, idx) => (
              <p key={idx}>{text}</p>
            ))}
          </div>
        </section>

        {/* PilotCTA (Section 12) */}
        <div className="container" data-section="12">
          <section
            className="pilot"
            id="pilotaz"
            tabIndex={-1}
            aria-labelledby="pilot-heading"
          >
            <SectionHeading {...content.sections.pilot} id="pilot-heading" />
            <p>{content.sections.pilot.text}</p>
            <div className="actions">
              <a
                className="action primary"
                href="#kontakt"
                onClick={(e) => handleAnchorClick(e, '#kontakt')}
              >
                {content.cta.secondary}
              </a>
              <a
                className="action"
                href="#jak-dziala"
                onClick={(e) => handleAnchorClick(e, '#jak-dziala')}
              >
                {content.cta.primary}
              </a>
            </div>
            <p className="note">{content.sections.pilot.note}</p>
          </section>
        </div>

        {/* FAQ (Section 13) */}
        <div className="container" data-section="13">
          <section
            className="section faq"
            id="faq"
            tabIndex={-1}
            aria-labelledby="faq-heading"
          >
            <SectionHeading {...content.sections.faq} id="faq-heading" />
            {content.faq.map((item, idx) => (
              <details key={idx}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </section>
        </div>
      </main>

      {/* Footer (Section 14) */}
      <footer
        className="container footer"
        id="kontakt"
        tabIndex={-1}
        data-section="14"
      >
        <div>
          <Link
            to="/"
            className="brand"
            aria-label={
              locale === 'en'
                ? 'OmniNauka — app homepage'
                : 'OmniNauka — strona główna aplikacji'
            }
          >
            <img
              src="/brand/omninauka-symbol-dark.png"
              width="256"
              height="256"
              alt=""
              decoding="async"
            />
            <span>OmniNauka</span>
          </Link>
          <p>
            {locale === 'en'
              ? 'Your materials. Questions. The next step in learning.'
              : 'Twoje materiały. Pytania. Kolejny krok w nauce.'}
          </p>
          <p>
            PFConsulting Piotr Fiszer
            <br />
            ul. Promienista 114, 60-142 Poznań
            <br />
            NIP: 7792017326
          </p>
        </div>

        <nav aria-label={locale === 'en' ? 'Footer navigation' : 'Nawigacja w stopce'}>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleAnchorClick(e, item.href)}
            >
              {item.label}
            </a>
          ))}
          <Link to="/">
            {locale === 'en' ? 'App Homepage' : 'Strona główna aplikacji'}
          </Link>
          <Link to="/login">
            {locale === 'en' ? 'Log in' : 'Zaloguj się'}
          </Link>
        </nav>

        <div>
          <h2 className="footer-heading">
            {locale === 'en' ? 'Contact & legal information' : 'Kontakt i zasady'}
          </h2>
          <p>
            <a
              className="contact-email"
              href="mailto:piotr.fiszer@pfconsulting.pl"
            >
              piotr.fiszer@pfconsulting.pl
            </a>
          </p>
          {locale === 'en' && (
            <p className="note">Legal documents are available in Polish only.</p>
          )}
          <ul
            className="legal-list"
            aria-label={
              locale === 'en'
                ? 'Legal documents (Polish only)'
                : 'Dokumenty i zasady'
            }
          >
            {legalDocuments.map((doc) => {
              const label =
                locale === 'en'
                  ? legalDocLabelsEn[doc.href] ?? doc.label
                  : doc.label;

              return (
                <li key={doc.href}>
                  {doc.isExternal ? (
                    <a
                      href={doc.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {label}
                    </a>
                  ) : (
                    <Link to={doc.href}>{label}</Link>
                  )}
                </li>
              );
            })}
          </ul>
          {locale === 'en' && (
            <p className="note">
              English marketing content is for informational purposes.
            </p>
          )}
          <p>
            {locale === 'en'
              ? 'Controlled pilot. Contact does not guarantee participation.'
              : 'Kontrolowany pilotaż. Kontakt nie gwarantuje udziału.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
