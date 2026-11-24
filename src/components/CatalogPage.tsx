import React, { useMemo, useState } from 'react';
import { Search, Sparkles, Plus, Check, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatINR } from '../lib/pricing';
import type { Product } from '../types';

export function CatalogPage({ initialDomain }: { initialDomain: 'electrical' | 'plumbing' | 'all' }) {
  const {
    t,
    categories,
    brands,
    products,
    draftList,
    addCatalogItemToDraft,
    setView,
    catalogSearchQuery,
    setCatalogSearchQuery,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
  } = useApp();

  const [domainFilter, setDomainFilter] = useState<'all' | 'electrical' | 'plumbing'>(
    initialDomain
  );
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [qtyByProduct, setQtyByProduct] = useState<Record<number, number>>({});
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiSkuOrder, setAiSkuOrder] = useState<string[] | null>(null);

  const domainCategories = useMemo(() => {
    if (domainFilter === 'all') return categories;
    return categories.filter((c) => c.domain === domainFilter);
  }, [categories, domainFilter]);

  const filteredProducts = useMemo(() => {
    const q = catalogSearchQuery.trim().toLowerCase();
    const matched = products.filter((p) => {
      if (domainFilter !== 'all' && p.domain !== domainFilter) return false;
      if (selectedCategoryFilter !== 'all' && p.categoryName !== selectedCategoryFilter) {
        return false;
      }
      if (brandFilter !== 'all' && p.brandName !== brandFilter) return false;
      if (aiSkuOrder && aiSkuOrder.length > 0 && !aiSkuOrder.includes(p.sku)) {
        return false;
      }
      if (q && !aiSkuOrder) {
        const hay = `${p.name} ${p.categoryName} ${p.brandName} ${p.specification} ${p.sku} ${p.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return matched;
  }, [
    products,
    domainFilter,
    selectedCategoryFilter,
    brandFilter,
    catalogSearchQuery,
    aiSkuOrder,
  ]);

  const handleAiSearch = async () => {
    if (!catalogSearchQuery.trim()) return;
    setAiLoading(true);
    setAiNotice(null);
    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: catalogSearchQuery }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiNotice(data.error || 'AI search unavailable; using keyword search.');
        setAiSkuOrder(null);
      } else {
        setAiSkuOrder(data.skus || []);
        setAiNotice(data.explanation || 'Filtered using AI natural-language product search.');
      }
    } catch {
      setAiNotice('AI search failed; showing standard keyword matches.');
      setAiSkuOrder(null);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">
            {domainFilter === 'electrical'
              ? t('catElectricalTitle')
              : domainFilter === 'plumbing'
                ? t('catPlumbingTitle')
                : 'Electrical & Plumbing Material Catalogue'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Indicative catalogue pricing for planning. Select items and open the Material List Builder to request confirmed shop quotes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setView('builder')}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-md whitespace-nowrap shrink-0 self-start cursor-pointer"
        >
          Open Material List ({draftList.length} items)
        </button>
      </div>

      {/* Filters Bar */}
      <div className="mt-6 bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Domain Segmented Tabs */}
          <div className="inline-flex p-1 bg-slate-100 rounded-md shrink-0">
            {(['all', 'electrical', 'plumbing'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDomainFilter(d);
                  setSelectedCategoryFilter('all');
                }}
                className={`px-3.5 py-2 text-xs font-semibold rounded capitalize transition-colors cursor-pointer ${
                  domainFilter === d
                    ? 'bg-white text-[#0F2942] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d === 'all' ? 'All Materials' : d}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search materials by name, SKU, or specification"
                value={catalogSearchQuery}
                onChange={(e) => {
                  setCatalogSearchQuery(e.target.value);
                  setAiSkuOrder(null);
                  setAiNotice(null);
                }}
                placeholder="Search by product, brand, size, SKU (e.g., '2.5 sq.mm copper wire' or '1 inch CPVC')..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F2942]"
              />
            </div>
            <button
              type="button"
              disabled={aiLoading || !catalogSearchQuery.trim()}
              onClick={handleAiSearch}
              className="px-3.5 py-2 text-xs font-semibold text-[#0F2942] bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
              {aiLoading ? 'Searching...' : 'AI Search'}
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            aria-label="Filter by category"
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-md"
          >
            <option value="all">All Categories ({domainCategories.length})</option>
            {domainCategories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Brand Dropdown */}
          <select
            aria-label="Filter by brand"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-md"
          >
            <option value="all">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {aiNotice && (
          <div className="flex items-center justify-between gap-3 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-700">
            <span>{aiNotice}</span>
            {aiSkuOrder && (
              <button
                type="button"
                onClick={() => {
                  setAiSkuOrder(null);
                  setAiNotice(null);
                }}
                className="font-semibold text-[#EA580C] hover:underline cursor-pointer"
              >
                Clear AI filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Product Grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((prod) => {
          const inList = draftList.find((d) => d.productId === prod.id);
          const qty = qtyByProduct[prod.id] ?? 1;
          return (
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
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {prod.categoryName} · {prod.brandName}
                    </span>
                    <span className="font-mono-num">{prod.sku}</span>
                  </div>
                  <h2 className="font-display text-base font-semibold text-[#0F2942] mt-1.5">
                    {prod.name}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">{prod.specification}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Unit: {prod.unit} · GST {prod.gstRate}%
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-[11px] text-slate-500">{t('estimatedBadge')}</p>
                      <p className="font-mono-num text-base font-bold text-[#0F2942]">
                        {formatINR(prod.estimatedPrice)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailProduct(prod)}
                      className="text-xs font-medium text-slate-600 hover:text-[#0F2942] underline cursor-pointer"
                    >
                      Specifications
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label htmlFor={`qty-${prod.id}`} className="sr-only">
                      Quantity for {prod.name}
                    </label>
                    <input
                      id={`qty-${prod.id}`}
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) =>
                        setQtyByProduct((prev) => ({
                          ...prev,
                          [prod.id]: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      className="w-20 px-2.5 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => addCatalogItemToDraft(prod, qty)}
                      className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        inList
                          ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                          : 'bg-[#0F2942] text-white hover:bg-[#EA580C]'
                      }`}
                    >
                      {inList ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Added ({inList.quantity})
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          {t('addToList')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="mt-8 bg-white border border-slate-200 rounded-lg p-10 text-center">
          <p className="text-sm text-slate-600">{t('noResults')}</p>
          <button
            type="button"
            onClick={() => setView('builder')}
            className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
          >
            Add as Custom Manual Material in Builder
          </button>
        </div>
      )}

      {/* Specification Modal */}
      {detailProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={detailProduct.name}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#0F2942]">
                {detailProduct.name}
              </h3>
              <button
                type="button"
                aria-label="Close product details"
                onClick={() => setDetailProduct(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <p className="text-slate-600">{detailProduct.description}</p>
              <dl className="grid grid-cols-2 gap-3 bg-[#F4F6F8] p-4 rounded-md text-xs">
                <div>
                  <dt className="text-slate-500">Category</dt>
                  <dd className="font-semibold text-slate-900">{detailProduct.categoryName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Brand</dt>
                  <dd className="font-semibold text-slate-900">{detailProduct.brandName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">SKU</dt>
                  <dd className="font-mono-num font-semibold text-slate-900">{detailProduct.sku}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Size / Diameter</dt>
                  <dd className="font-semibold text-slate-900">
                    {detailProduct.size || detailProduct.diameter || 'Standard'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-500">Technical Specification</dt>
                  <dd className="font-semibold text-slate-900">{detailProduct.specification}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Estimated Catalogue Rate</dt>
                  <dd className="font-mono-num font-bold text-[#0F2942]">
                    {formatINR(detailProduct.estimatedPrice)} / {detailProduct.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">GST Rate</dt>
                  <dd className="font-mono-num font-semibold text-slate-900">
                    {detailProduct.gstRate}%
                  </dd>
                </div>
              </dl>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  addCatalogItemToDraft(detailProduct, 1);
                  setDetailProduct(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
              >
                {t('addToList')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
