import React, { useEffect, useState } from 'react';
import { MapPin, Search, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { INDIAN_STATES } from '../lib/catalogData';
import { formatINR } from '../lib/pricing';
import type { SupplierDirectoryItem } from '../types';

export function SuppliersDirectoryPage() {
  const { setView } = useApp();
  const [suppliers, setSuppliers] = useState<SupplierDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinCode, setPinCode] = useState('');
  const [city, setCity] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [q, setQ] = useState('');

  const [activeShop, setActiveShop] = useState<SupplierDirectoryItem | null>(null);
  const [shopProducts, setShopProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (pinCode.trim()) params.set('pinCode', pinCode.trim());
      if (city.trim()) params.set('city', city.trim());
      if (stateFilter) params.set('state', stateFilter);
      if (domainFilter) params.set('domain', domainFilter);
      if (q.trim()) params.set('q', q.trim());

      const res = await fetch(`/api/suppliers?${params.toString()}`);
      const data = await res.json();
      setSuppliers(data.suppliers || []);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openShopInventory = async (sup: SupplierDirectoryItem) => {
    setActiveShop(sup);
    setLoadingProducts(true);
    try {
      const res = await fetch(`/api/suppliers/${sup.id}/products`);
      const data = await res.json();
      setShopProducts(data.products || []);
    } catch {
      setShopProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="pb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">
            Find Verified Electrical &amp; Plumbing Suppliers
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Search verified Indian shops by PIN code, city, state, or material category. Delivery coverage depends on each supplier&apos;s verified service area.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView('builder')}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-md whitespace-nowrap shrink-0 self-start cursor-pointer"
        >
          Create List &amp; Request Quotes
        </button>
      </div>

      {/* Discovery Filter Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          fetchSuppliers();
        }}
        className="mt-6 bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
      >
        <input
          type="text"
          aria-label="Search by shop name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Shop name or keyword..."
          className="px-3 py-2 text-xs border border-slate-200 rounded-md"
        />
        <input
          type="text"
          aria-label="Search by PIN code"
          value={pinCode}
          onChange={(e) => setPinCode(e.target.value)}
          placeholder="PIN Code (e.g. 600001)"
          className="px-3 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
        />
        <input
          type="text"
          aria-label="Search by city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City (e.g. Chennai)"
          className="px-3 py-2 text-xs border border-slate-200 rounded-md"
        />
        <select
          aria-label="Filter by state"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-md bg-slate-50"
        >
          <option value="">All States</option>
          {INDIAN_STATES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by domain"
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-md bg-slate-50"
        >
          <option value="">Electrical &amp; Plumbing</option>
          <option value="electrical">Electrical Materials</option>
          <option value="plumbing">Plumbing Materials</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#163A5C] rounded-md inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          Search Shops
        </button>
      </form>

      {/* Supplier Cards */}
      {loading ? (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-44 bg-white border border-slate-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {suppliers.map((sup) => (
            <article
              key={sup.id}
              className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verified BuildMate Supplier</span>
                      {sup.gstinMasked && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num text-slate-500">
                            GSTIN {sup.gstinMasked}
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="font-display text-lg font-bold text-[#0F2942] mt-1">
                      {sup.shopName}
                    </h2>
                  </div>
                  <span className="text-xs font-medium text-slate-600 capitalize">
                    {sup.productCategories.replace(',', ' & ')}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {sup.shopDescription}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                  <p className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#EA580C]" />
                    <span>
                      {sup.businessAddress}, {sup.city}, {sup.state} -{' '}
                      <span className="font-mono-num">{sup.pinCode}</span>
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Delivery Service Coverage: {sup.serviceAreas}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openShopInventory(sup)}
                  className="px-4 py-2 text-xs font-semibold text-[#0F2942] border border-slate-300 hover:border-[#0F2942] rounded-md cursor-pointer"
                >
                  View Shop Stock
                </button>
                <button
                  type="button"
                  onClick={() => setView('builder')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#EA580C] rounded-md cursor-pointer"
                >
                  Build List &amp; Request Quote
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && suppliers.length === 0 && (
        <div className="mt-8 bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-600">
          No verified suppliers matched those location filters. Clear filters to view all verified shops across India.
        </div>
      )}

      {/* Shop Stock Drawer/Modal */}
      {activeShop && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeShop.shopName}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0F2942]">
                  {activeShop.shopName} — Available Inventory
                </h3>
                <p className="text-xs text-slate-500">
                  {activeShop.city}, {activeShop.state} · Coverage: {activeShop.serviceAreas}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close shop inventory"
                onClick={() => setActiveShop(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {loadingProducts ? (
                <p className="text-xs text-slate-500">Loading shop inventory...</p>
              ) : shopProducts.length === 0 ? (
                <p className="text-xs text-slate-500">
                  This shop quotes custom requirements on request. Use the Material List Builder to send an RFQ.
                </p>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                      <th className="py-2 pr-3">Product &amp; Brand</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3 text-right">Stock</th>
                      <th className="py-2 pl-3 text-right">Listed Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shopProducts.map((sp) => (
                      <tr key={sp.id}>
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-[#0F2942]">{sp.customName}</p>
                          <p className="text-[11px] text-slate-500">
                            {sp.brandName} · {sp.specification}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{sp.categoryName}</td>
                        <td className="py-2.5 px-3 text-right font-mono-num">
                          {sp.stockQty} {sp.unit}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono-num font-semibold text-[#0F2942]">
                          {formatINR(sp.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
