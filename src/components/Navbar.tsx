import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../lib/i18n';

export function Navbar() {
  const {
    view,
    setView,
    language,
    setLanguage,
    t,
    user,
    draftList,
    unreadCount,
    logout,
  } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardView =
    user?.activeRole === 'super_admin'
      ? 'admin-dashboard'
      : user?.activeRole === 'supplier'
        ? 'supplier-dashboard'
        : 'customer-dashboard';

  const navItems: Array<{ label: string; target: typeof view }> = [
    { label: t('navHome'), target: 'home' },
    { label: t('navElectrical'), target: 'electrical' },
    { label: t('navPlumbing'), target: 'plumbing' },
    { label: t('navFindShops'), target: 'find-suppliers' },
    { label: t('navHowItWorks'), target: 'how-it-works' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => setView('home')}
          className="font-display text-xl font-bold tracking-tight text-[#0F2942] whitespace-nowrap shrink-0 cursor-pointer"
        >
          Build<span className="text-[#EA580C]">Mate</span>
        </button>

        {/* Zone 2: Concise single-line nav links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          {navItems.map((item) => (
            <button
              key={item.target}
              type="button"
              onClick={() => setView(item.target)}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                view === item.target
                  ? 'border-[#EA580C] text-[#0F2942] font-semibold'
                  : 'border-transparent hover:text-[#0F2942] hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Language + Primary Action */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <label htmlFor="header-lang-select" className="sr-only">
            Language
          </label>
          <select
            id="header-lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2942]"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} disabled={!l.available}>
                {l.nativeLabel}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setView('builder')}
            className="px-3.5 py-2 text-xs font-semibold text-[#0F2942] bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            {t('navCreateList')} ({draftList.length})
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setView(dashboardView)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#163A5C] rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {t('navDashboard')}
                {unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
              <button
                type="button"
                onClick={logout}
                className="px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('logout')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setView('login')}
                className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-[#0F2942] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('navLogin')}
              </button>
              <button
                type="button"
                onClick={() => setView('register')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {t('navRegister')}
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setView('builder')}
            className="px-3 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-md whitespace-nowrap shrink-0"
          >
            List ({draftList.length})
          </button>
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
            className="p-2.5 text-[#0F2942] border border-slate-200 rounded-md"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => (
              <button
                key={item.target}
                type="button"
                onClick={() => {
                  setView(item.target);
                  setMobileOpen(false);
                }}
                className={`text-left px-3 py-2.5 rounded-md text-sm font-medium ${
                  view === item.target
                    ? 'bg-[#0F2942] text-white'
                    : 'bg-slate-50 text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
            <select
              aria-label="Select language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="text-sm bg-slate-50 border border-slate-200 rounded-md px-3 py-2"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} disabled={!l.available}>
                  {l.nativeLabel}
                </option>
              ))}
            </select>

            {user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setView(dashboardView);
                    setMobileOpen(false);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0F2942] rounded-md"
                >
                  {t('navDashboard')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileOpen(false);
                  }}
                  className="px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-md"
                >
                  {t('logout')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setMobileOpen(false);
                  }}
                  className="px-3 py-2 text-sm font-semibold text-[#0F2942] border border-slate-200 rounded-md"
                >
                  {t('navLogin')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView('register');
                    setMobileOpen(false);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#EA580C] rounded-md"
                >
                  {t('navRegister')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
