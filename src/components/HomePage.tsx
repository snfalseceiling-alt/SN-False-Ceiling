import React, { useState } from 'react';
import { Search, ArrowRight, ChevronDown, MapPin, ShieldCheck, FileText, Layers } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ELECTRICAL_CATEGORIES, IMAGES, PLUMBING_CATEGORIES } from '../lib/catalogData';
import { formatINR } from '../lib/pricing';

export function HomePage() {
  const {
    t,
    setView,
    products,
    suppliers,
    catalogLoading,
    addCatalogItemToDraft,
    setCatalogSearchQuery,
    setSelectedCategoryFilter,
    setAiDrawerOpen,
  } = useApp();

  const [heroSearch, setHeroSearch] = useState('');
  const [catDomain, setCatDomain] = useState<'electrical' | 'plumbing'>('electrical');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogSearchQuery(heroSearch);
    setSelectedCategoryFilter('all');
    setView('electrical');
  };

  const popularProducts = products.slice(0, 6);
  const activeCategories =
    catDomain === 'electrical' ? ELECTRICAL_CATEGORIES : PLUMBING_CATEGORIES;

  const faqs = [
    {
      q: 'Are catalogue prices final market prices?',
      a: 'No. BuildMate catalogue prices are indicative reference estimates for planning only. Once you send your material list to verified shops, suppliers respond with confirmed brands, stock availability, GST, delivery charges, and final market prices.',
    },
    {
      q: 'Can electricians and plumbers send one list to multiple shops?',
      a: 'Yes. Build your material list once—combining catalogue items and manual entries—then select multiple verified suppliers in your city or PIN code to receive side-by-side comparable quotations.',
    },
    {
      q: 'Can I download a professional PDF quotation?',
      a: 'Yes. You can generate, download, print, and share Indian B2B GST PDF quotations both from your planning Material List and from any Supplier-Confirmed Quotation.',
    },
    {
      q: 'Can I split an order across different electrical and plumbing shops?',
      a: 'Yes. In the Compare Quotations view, you can accept a single supplier or allocate specific items across multiple suppliers based on brand availability, pricing, and delivery timelines.',
    },
  ];

  return (
    <div className="bg-[#F4F6F8]">
      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#EA580C] mb-3">
              {t('tagline')}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-[#0F2942] leading-[1.12] tracking-tight text-balance">
              {t('heroHeadline')}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              {t('heroSubheadline')}
            </p>

            {/* Search Bar */}
            <form
              onSubmit={handleHeroSearchSubmit}
              className="mt-7 flex flex-col sm:flex-row gap-2.5 max-w-2xl"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <label htmlFor="hero-material-search" className="sr-only">
                  {t('heroSearchPlaceholder')}
                </label>
                <input
                  id="hero-material-search"
                  type="text"
                  value={heroSearch}
                  onChange={(e) => setHeroSearch(e.target.value)}
                  placeholder={t('heroSearchPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 text-sm bg-[#F4F6F8] border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-500 focus:outline-none focus:bg-white focus:border-[#0F2942]"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3 text-sm font-semibold text-white bg-[#0F2942] hover:bg-[#163A5C] rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                Search Catalogue
              </button>
            </form>

            {/* Primary & Secondary CTA */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setView('builder')}
                className="px-6 py-3 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-md inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {t('heroPrimaryCta')}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('electrical')}
                className="px-6 py-3 text-sm font-semibold text-[#0F2942] bg-white border border-slate-300 hover:border-[#0F2942] rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {t('heroSecondaryCta')}
              </button>
              <button
                type="button"
                onClick={() => setAiDrawerOpen(true)}
                className="px-4 py-3 text-sm font-medium text-slate-700 hover:text-[#0F2942] underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ask AI Material Assistant
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
              <span>40 Specialized Categories</span>
              <span aria-hidden="true">·</span>
              <span>GST-Ready PDF Quotations</span>
              <span aria-hidden="true">·</span>
              <span>Verified Indian Suppliers</span>
              <span aria-hidden="true">·</span>
              <span>English &amp; தமிழ்</span>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="h-full min-h-[260px] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              {!heroImgFailed ? (
                <img
                  src={IMAGES.hero}
                  alt="Electrical copper wires, modular switches, MCB breakers, CPVC pipes, and brass valves"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#0F2942] to-[#1E3A5F] text-white">
                  <Layers className="w-10 h-10 mb-3 text-[#EA580C]" />
                  <p className="font-display font-semibold text-lg">BuildMate Procurement Suite</p>
                  <p className="text-xs text-slate-300 mt-1">Electrical &amp; Plumbing Materials</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Two Main Categories: Electrical & Plumbing */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col sm:flex-row">
            <div className="sm:w-48 h-48 sm:h-auto shrink-0 bg-slate-100">
              <img
                src={IMAGES.electricalGear}
                alt="Electrical wires, modular switches, and circuit breakers"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6 flex flex-col justify-between flex-1">
              <div>
                <p className="text-xs font-medium text-slate-500">20 Categories · Wires, Switchgear, Lighting</p>
                <h2 className="font-display text-xl font-bold text-[#0F2942] mt-1">
                  {t('catElectricalTitle')}
                </h2>
                <p className="text-sm text-slate-600 mt-2">{t('catElectricalDesc')}</p>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryFilter('all');
                    setView('electrical');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#163A5C] rounded-md cursor-pointer"
                >
                  Explore Electrical
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col sm:flex-row">
            <div className="sm:w-48 h-48 sm:h-auto shrink-0 bg-slate-100">
              <img
                src={IMAGES.plumbingPipes}
                alt="CPVC pipes, UPVC fittings, and brass isolation valves"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6 flex flex-col justify-between flex-1">
              <div>
                <p className="text-xs font-medium text-slate-500">20 Categories · Pipes, Valves, Sanitaryware</p>
                <h2 className="font-display text-xl font-bold text-[#0F2942] mt-1">
                  {t('catPlumbingTitle')}
                </h2>
                <p className="text-sm text-slate-600 mt-2">{t('catPlumbingDesc')}</p>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryFilter('all');
                    setView('plumbing');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#163A5C] rounded-md cursor-pointer"
                >
                  Explore Plumbing
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How BuildMate Works */}
      <section className="bg-white border-y border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#0F2942]">
                {t('howItWorksTitle')}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Built to replace manual shop visits with structured multi-supplier procurement.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setView('how-it-works')}
              className="text-xs font-semibold text-[#EA580C] hover:underline self-start sm:self-auto cursor-pointer"
            >
              Read full workflow →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01. Plan Material List',
                desc: 'Tick electrical and plumbing items from our 40-category catalogue or enter custom specs manually.',
                icon: Layers,
              },
              {
                step: '02. Generate Estimate PDF',
                desc: 'Review automatic subtotal & GST calculations and export a clean Indian B2B planning PDF.',
                icon: FileText,
              },
              {
                step: '03. Request Multi-Shop Quotes',
                desc: 'Send the exact same requirement to multiple verified suppliers filtered by city or PIN code.',
                icon: ShieldCheck,
              },
              {
                step: '04. Compare & Place Order',
                desc: 'Compare brands, confirmed rates, and delivery lead times side-by-side—then order or split.',
                icon: MapPin,
              },
            ].map((item) => (
              <div
                key={item.step}
                className="p-5 bg-[#F4F6F8] border border-slate-200 rounded-lg"
              >
                <item.icon className="w-5 h-5 text-[#EA580C] mb-3" />
                <h3 className="font-display text-base font-bold text-[#0F2942]">
                  {item.step}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Materials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#0F2942]">
              {t('popularMaterialsTitle')}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {t('estimatedBadge')} · Always request supplier quotations for confirmed market rates.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView('electrical')}
            className="text-xs font-semibold text-[#0F2942] hover:text-[#EA580C] cursor-pointer"
          >
            {catalogLoading && products.length === 0
              ? 'Loading catalogue...'
              : `View full catalogue (${products.length} items) →`}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalogLoading && popularProducts.length === 0
            ? [1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-white border border-slate-200 rounded-lg overflow-hidden h-80 animate-pulse"
                >
                  <div className="h-44 bg-slate-200" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/3" />
                  </div>
                </div>
              ))
            : popularProducts.map((prod) => (
            <article
              key={prod.id}
              className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                <img
                  src={prod.imageUrl}
                  alt={prod.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-5 flex flex-col flex-1 justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>{prod.categoryName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{prod.brandName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{prod.unit}</span>
                  </div>
                  <h3 className="font-display text-base font-semibold text-[#0F2942] mt-1.5 leading-snug">
                    {prod.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {prod.specification}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-slate-500">{t('estimatedBadge')}</p>
                    <p className="font-mono-num text-base font-bold text-[#0F2942]">
                      {formatINR(prod.estimatedPrice)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addCatalogItemToDraft(prod, 1)}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#EA580C] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {t('addToList')}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Browse All 40 Categories */}
      <section className="bg-white border-y border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="font-display text-2xl font-bold text-[#0F2942]">
              {t('browseCategoriesTitle')}
            </h2>
            <div className="inline-flex p-1 bg-slate-100 rounded-md self-start">
              <button
                type="button"
                onClick={() => setCatDomain('electrical')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  catDomain === 'electrical'
                    ? 'bg-white text-[#0F2942] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Electrical (20)
              </button>
              <button
                type="button"
                onClick={() => setCatDomain('plumbing')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  catDomain === 'plumbing'
                    ? 'bg-white text-[#0F2942] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Plumbing (20)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {activeCategories.map((catName) => (
              <button
                key={catName}
                type="button"
                onClick={() => {
                  setSelectedCategoryFilter(catName);
                  setCatalogSearchQuery('');
                  setView(catDomain);
                }}
                className="text-left px-3.5 py-3 bg-[#F4F6F8] hover:bg-[#0F2942] hover:text-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 transition-colors cursor-pointer"
              >
                {catName}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Verified Nearby Suppliers + Benefits */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#0F2942]">
                {t('findSuppliersTitle')}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Verified regional electrical &amp; plumbing distributors with explicit city and PIN coverage.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setView('find-suppliers')}
              className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
            >
              Search all suppliers by PIN Code →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {suppliers.slice(0, 4).map((sup) => (
              <div
                key={sup.id}
                className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between"
              >
                <div>
                  <p className="text-xs font-medium text-emerald-700">
                    Verified Shop · {sup.city}, {sup.state}
                  </p>
                  <h3 className="font-display text-base font-bold text-[#0F2942] mt-1">
                    {sup.shopName}
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                    {sup.shopDescription}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-3">
                    Service PINs: {sup.serviceAreas}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView('find-suppliers')}
                  className="mt-4 w-full py-2 text-xs font-semibold text-[#0F2942] border border-slate-200 hover:border-[#0F2942] rounded-md cursor-pointer"
                >
                  View Shop &amp; Coverage
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0F2942] text-white rounded-lg p-7">
            <h2 className="font-display text-xl font-bold">
              {t('benefitsContractorsTitle')}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-200">
              <li>· Prepare standardized house or commercial material lists in minutes</li>
              <li>· Reuse saved 2BHK, 3BHK, or commercial MEP templates across projects</li>
              <li>· Send a single quotation request to multiple verified local shops</li>
              <li>· Compare brands, GST, delivery lead time, and split orders cleanly</li>
            </ul>
            <button
              type="button"
              onClick={() => setView('register')}
              className="mt-6 px-5 py-2.5 text-xs font-semibold bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-md cursor-pointer"
            >
              Register as Contractor / Electrician / Plumber
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-7">
            <h2 className="font-display text-xl font-bold text-[#0F2942]">
              {t('benefitsSuppliersTitle')}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li>· Receive structured quotation requests with clear SKUs, sizes, and quantities</li>
              <li>· Submit itemized GST quotes, alternative brands, and delivery charges</li>
              <li>· Manage live stock inventory and verified service PIN code coverage</li>
              <li>· Track order fulfillment, dispatch, and payment confirmation in one place</li>
            </ul>
            <button
              type="button"
              onClick={() => setView('register')}
              className="mt-6 px-5 py-2.5 text-xs font-semibold bg-[#0F2942] hover:bg-[#163A5C] text-white rounded-md cursor-pointer"
            >
              Register Your Electrical / Plumbing Shop
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold text-[#0F2942] mb-6">
            {t('faqTitle')}
          </h2>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {faqs.map((item, idx) => (
              <div key={item.q} className="p-4 sm:p-5">
                <button
                  type="button"
                  aria-expanded={openFaq === idx}
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left font-display text-sm font-semibold text-[#0F2942] cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      openFaq === idx ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F2942] text-slate-300 py-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <p className="font-display text-lg font-bold text-white">
              Build<span className="text-[#EA580C]">Mate</span>
            </p>
            <p className="text-xs text-slate-300 mt-2 max-w-md leading-relaxed">
              {t('tagline')} India-wide electrical and plumbing procurement platform connecting builders, electricians, plumbers, and verified local material suppliers.
            </p>
            <p className="text-[11px] text-slate-400 mt-4">
              {t('estimateDisclaimer')}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white mb-3">
              Marketplace
            </p>
            <ul className="space-y-2 text-xs">
              <li><button type="button" onClick={() => setView('electrical')} className="hover:text-white cursor-pointer">{t('navElectrical')}</button></li>
              <li><button type="button" onClick={() => setView('plumbing')} className="hover:text-white cursor-pointer">{t('navPlumbing')}</button></li>
              <li><button type="button" onClick={() => setView('builder')} className="hover:text-white cursor-pointer">{t('navCreateList')}</button></li>
              <li><button type="button" onClick={() => setView('find-suppliers')} className="hover:text-white cursor-pointer">{t('navFindShops')}</button></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white mb-3">
              Company &amp; Support
            </p>
            <ul className="space-y-2 text-xs">
              <li><button type="button" onClick={() => setView('about')} className="hover:text-white cursor-pointer">{t('footerAbout')}</button></li>
              <li><button type="button" onClick={() => setView('contact')} className="hover:text-white cursor-pointer">{t('footerContact')}</button></li>
              <li><button type="button" onClick={() => setView('help')} className="hover:text-white cursor-pointer">{t('footerHelp')}</button></li>
              <li><button type="button" onClick={() => setView('privacy')} className="hover:text-white cursor-pointer">{t('footerPrivacy')}</button></li>
              <li><button type="button" onClick={() => setView('terms')} className="hover:text-white cursor-pointer">{t('footerTerms')}</button></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pt-6 border-t border-white/10 text-xs text-slate-400 flex flex-wrap justify-between gap-4">
          <span>© {new Date().getFullYear()} BuildMate India. All rights reserved.</span>
          <span>English · தமிழ் (More Indian languages coming soon)</span>
        </div>
      </footer>
    </div>
  );
}
