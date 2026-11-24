import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Printer,
  Share2,
  Plus,
  Trash2,
  Send,
  Sparkles,
  Bookmark,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ELECTRICAL_CATEGORIES,
  INDIAN_STATES,
  MATERIAL_UNITS,
  PLUMBING_CATEGORIES,
  PROJECT_TYPES,
} from '../lib/catalogData';
import { calculateQuotationTotals, formatINR } from '../lib/pricing';
import type { Project, SupplierDirectoryItem } from '../types';

export function MaterialListBuilder() {
  const {
    t,
    user,
    apiFetch,
    products,
    categories,
    suppliers,
    draftList,
    draftListName,
    setDraftListName,
    selectedProjectId,
    setSelectedProjectId,
    addCatalogItemToDraft,
    addCustomItemToDraft,
    updateDraftItem,
    removeDraftItem,
    loadItemsIntoDraft,
    setView,
    showNotice,
  } = useApp();

  const [entryTab, setEntryTab] = useState<'catalogue' | 'manual' | 'ai' | 'templates'>('catalogue');
  const [catDomain, setCatDomain] = useState<'electrical' | 'plumbing'>('electrical');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [catSearch, setCatSearch] = useState('');

  // Manual entry form
  const [customDomain, setCustomDomain] = useState<'electrical' | 'plumbing'>('electrical');
  const [customCategory, setCustomCategory] = useState<string>('Electrical Wires and Cables');
  const [customName, setCustomName] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [customSpec, setCustomSpec] = useState('');
  const [customUnit, setCustomUnit] = useState<string>('Nos');
  const [customQty, setCustomQty] = useState<number>(1);
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customGst, setCustomGst] = useState<number>(18);
  const [customNotes, setCustomNotes] = useState('');

  // Customer / Project / Delivery details
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [deliveryEstimate, setDeliveryEstimate] = useState<number>(0);
  const [listNotes, setListNotes] = useState('');
  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [contactNumber, setContactNumber] = useState(user?.mobile || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('Chennai');
  const [stateName, setStateName] = useState('Tamil Nadu');
  const [pinCode, setPinCode] = useState('600001');

  // Supplier discovery & multi-select modal
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [supSearch, setSupSearch] = useState('');
  const [supDomain, setSupDomain] = useState<'all' | 'electrical' | 'plumbing'>('all');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [sendingRfq, setSendingRfq] = useState(false);

  // AI Draft Assistant
  const [aiProjectType, setAiProjectType] = useState<string>('New House Construction');
  const [aiArea, setAiArea] = useState<number>(1500);
  const [aiFloors, setAiFloors] = useState<number>(2);
  const [aiDomain, setAiDomain] = useState<'both' | 'electrical' | 'plumbing'>('both');
  const [aiNotes, setAiNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraftResult, setAiDraftResult] = useState<{
    disclaimer: string;
    items: any[];
  } | null>(null);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [savingList, setSavingList] = useState(false);

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      setCustomerName((prev) => prev || user.fullName);
      setContactNumber((prev) => prev || user.mobile || '');
      apiFetch('/api/projects')
        .then((r) => (r.ok ? r.json() : { projects: [] }))
        .then((d) => setProjects(d.projects || []))
        .catch(() => {});
    }
  }, [user, apiFetch]);

  const handleProjectSelect = (projIdStr: string) => {
    const id = projIdStr ? Number(projIdStr) : null;
    setSelectedProjectId(id);
    const proj = projects.find((p) => p.id === id);
    if (proj) {
      setCustomerName(proj.customerName);
      setContactNumber(proj.contactNumber);
      setDeliveryAddress(proj.siteAddress);
      setCity(proj.city);
      setStateName(proj.state);
      setPinCode(proj.pinCode);
      setDraftListName(`${proj.projectName} — Material List`);
    }
  };

  const filteredCatalog = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (p.domain !== catDomain) return false;
      if (catFilter !== 'all' && p.categoryName !== catFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.brandName} ${p.specification} ${p.sku}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, catDomain, catFilter, catSearch]);

  const totals = useMemo(() => {
    return calculateQuotationTotals(
      draftList.map((i) => ({
        id: i.localId,
        productName: i.productName,
        categoryName: i.categoryName,
        brand: i.brand,
        specification: i.specification,
        unit: i.unit,
        quantity: i.quantity,
        unitPrice: i.estimatedUnitPrice,
        gstRate: i.gstRate,
      })),
      deliveryEstimate
    );
  }, [draftList, deliveryEstimate]);

  const handleAddCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      showNotice('error', 'Enter a product name for the custom material.');
      return;
    }
    addCustomItemToDraft({
      productId: null,
      isCustom: true,
      domain: customDomain,
      categoryName: customCategory,
      productName: customName.trim(),
      brand: customBrand.trim() || 'Any Approved Brand',
      specification: customSpec.trim() || 'Standard site specification',
      unit: customUnit,
      quantity: Math.max(0.1, Number(customQty) || 1),
      estimatedUnitPrice: Math.max(0, Number(customPrice) || 0),
      gstRate: Math.max(0, Math.min(28, Number(customGst) || 18)),
      notes: customNotes.trim(),
    });
    setCustomName('');
    setCustomBrand('');
    setCustomSpec('');
    setCustomPrice(0);
    setCustomNotes('');
  };

  const handleDownloadPdf = async () => {
    if (draftList.length === 0) {
      showNotice('error', 'Add at least one item before generating a PDF quotation.');
      return;
    }
    setPdfLoading(true);
    try {
      const res = await fetch('/api/quotations/estimate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName || 'BuildMate Customer',
          contactNumber: contactNumber || 'On file',
          projectName: draftListName,
          projectAddress: deliveryAddress
            ? `${deliveryAddress}, ${city}, ${stateName} - ${pinCode}`
            : `${city}, ${stateName} - ${pinCode}`,
          deliveryCharges: deliveryEstimate,
          notes: listNotes,
          items: draftList,
        }),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BuildMate-Estimate-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showNotice('success', 'Downloaded estimated PDF quotation.');
    } catch {
      showNotice('error', 'Could not generate PDF quotation.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleShareQuote = async () => {
    if (draftList.length === 0) return;
    const summary = `BuildMate Material Estimate: ${draftListName}\nItems: ${draftList.length}\nEstimated Grand Total (incl. GST): ${formatINR(totals.grandTotal)}\nNote: Indicative catalogue estimate — verify quantities on site.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: draftListName, text: summary });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(summary);
    showNotice('success', 'Quotation summary copied to clipboard for sharing.');
  };

  const handleSaveList = async () => {
    if (!user) {
      showNotice('error', 'Please sign in to save your material list.');
      setView('login');
      return;
    }
    if (draftList.length === 0) {
      showNotice('error', 'Add at least one item before saving.');
      return;
    }
    setSavingList(true);
    try {
      const res = await apiFetch('/api/material-lists', {
        method: 'POST',
        body: JSON.stringify({
          name: draftListName,
          projectId: selectedProjectId,
          deliveryEstimate,
          notes: listNotes,
          items: draftList,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showNotice('success', 'Material list saved to your account.');
    } catch (e: any) {
      showNotice('error', e.message || 'Unable to save material list.');
    } finally {
      setSavingList(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!user) {
      showNotice('error', 'Sign in to save reusable templates.');
      return;
    }
    if (draftList.length === 0) return;
    try {
      const res = await apiFetch('/api/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: `${draftListName} (Template)`,
          domain: 'both',
          items: draftList,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      showNotice('success', 'Saved as a reusable template.');
      const tRes = await fetch('/api/templates');
      const tData = await tRes.json();
      setTemplates(tData.templates || []);
    } catch {
      showNotice('error', 'Could not save template.');
    }
  };

  const handleGenerateAiChecklist = async () => {
    setAiLoading(true);
    setAiDraftResult(null);
    try {
      const res = await fetch('/api/ai/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectType: aiProjectType,
          approxAreaSqft: aiArea,
          numFloors: aiFloors,
          domain: aiDomain,
          notes: aiNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI generation failed');
      setAiDraftResult(data);
    } catch (e: any) {
      showNotice('error', e.message || 'Unable to generate AI checklist.');
    } finally {
      setAiLoading(false);
    }
  };

  const filteredSuppliersForModal = useMemo(() => {
    const q = supSearch.trim().toLowerCase();
    return suppliers.filter((s: SupplierDirectoryItem) => {
      if (supDomain !== 'all' && !s.productCategories.includes(supDomain)) return false;
      if (q) {
        const hay = `${s.shopName} ${s.city} ${s.state} ${s.pinCode} ${s.serviceAreas}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [suppliers, supSearch, supDomain]);

  const handleSendRfq = async () => {
    if (!user) {
      showNotice('error', 'Please sign in to send quotation requests to suppliers.');
      setView('login');
      return;
    }
    if (selectedSupplierIds.length === 0) {
      showNotice('error', 'Select at least one verified supplier.');
      return;
    }
    if (!deliveryAddress.trim() || !city.trim() || !pinCode.trim()) {
      showNotice('error', 'Enter site delivery address, city, and PIN code.');
      return;
    }

    setSendingRfq(true);
    try {
      const res = await apiFetch('/api/quotation-requests', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          title: draftListName,
          deliveryAddress,
          city,
          state: stateName,
          pinCode,
          notes: listNotes,
          supplierIds: selectedSupplierIds,
          items: draftList,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSendModalOpen(false);
      showNotice(
        'success',
        `Quotation request ${data.request.requestNumber} sent to ${data.notifiedCount} verified suppliers!`
      );
      setView('compare-quotations');
    } catch (e: any) {
      showNotice('error', e.message || 'Unable to send quotation request.');
    } finally {
      setSendingRfq(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">
            Smart Material List Builder
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Select catalogue products or add custom materials, review GST totals, download PDFs, and request multi-shop quotations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleSaveList}
            disabled={savingList}
            className="px-3.5 py-2 text-xs font-semibold text-[#0F2942] bg-white border border-slate-300 hover:border-[#0F2942] rounded-md cursor-pointer"
          >
            {savingList ? 'Saving...' : t('saveList')}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="px-3.5 py-2 text-xs font-semibold text-[#0F2942] bg-white border border-slate-300 hover:border-[#0F2942] rounded-md inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {pdfLoading ? 'Generating...' : t('downloadPdf')}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            {t('printPdf')}
          </button>
          <button
            type="button"
            onClick={handleShareQuote}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            {t('sharePdf')}
          </button>
        </div>
      </div>

      {/* Two-Column Workspace */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Material Selection / Manual Entry / AI Draft / Templates */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 no-print">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-md mb-5">
            {(
              [
                { id: 'catalogue', label: 'A. Catalogue' },
                { id: 'manual', label: 'B. Manual' },
                { id: 'ai', label: 'AI Draft' },
                { id: 'templates', label: 'Templates' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setEntryTab(tab.id)}
                className={`py-2 px-2 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  entryTab === tab.id
                    ? 'bg-white text-[#0F2942] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {entryTab === 'catalogue' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCatDomain('electrical');
                    setCatFilter('all');
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded border cursor-pointer ${
                    catDomain === 'electrical'
                      ? 'bg-[#0F2942] text-white border-[#0F2942]'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Electrical (20)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCatDomain('plumbing');
                    setCatFilter('all');
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded border cursor-pointer ${
                    catDomain === 'plumbing'
                      ? 'bg-[#0F2942] text-white border-[#0F2942]'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Plumbing (20)
                </button>
              </div>

              <input
                type="text"
                aria-label="Filter catalogue products"
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder="Search catalogue items..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
              />

              <select
                aria-label="Select category"
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-slate-50"
              >
                <option value="all">All {catDomain} categories</option>
                {categories
                  .filter((c) => c.domain === catDomain)
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </select>

              <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-md">
                {filteredCatalog.map((prod) => {
                  const existing = draftList.find((d) => d.productId === prod.id);
                  return (
                    <label
                      key={prod.id}
                      className="flex items-start gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(existing)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            addCatalogItemToDraft(prod, 1);
                          } else if (existing) {
                            removeDraftItem(existing.localId);
                          }
                        }}
                        className="mt-1 h-4 w-4 accent-[#EA580C]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#0F2942] truncate">
                          {prod.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {prod.brandName} · {prod.categoryName} · {prod.unit}
                        </p>
                        <p className="font-mono-num text-xs font-semibold text-slate-700 mt-0.5">
                          Est. {formatINR(prod.estimatedPrice)} (GST {prod.gstRate}%)
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {entryTab === 'manual' && (
            <form onSubmit={handleAddCustomSubmit} className="space-y-3">
              <p className="text-xs text-slate-600">
                Add materials not listed in the standard catalogue with custom brand, specs, and estimated price.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="custom-domain" className="block text-xs font-medium text-slate-700 mb-1">
                    Domain
                  </label>
                  <select
                    id="custom-domain"
                    value={customDomain}
                    onChange={(e) => {
                      const d = e.target.value as 'electrical' | 'plumbing';
                      setCustomDomain(d);
                      setCustomCategory(
                        d === 'electrical' ? ELECTRICAL_CATEGORIES[0] : PLUMBING_CATEGORIES[0]
                      );
                    }}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-md"
                  >
                    <option value="electrical">Electrical</option>
                    <option value="plumbing">Plumbing</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="custom-category" className="block text-xs font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    id="custom-category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-md"
                  >
                    {(customDomain === 'electrical'
                      ? ELECTRICAL_CATEGORIES
                      : PLUMBING_CATEGORIES
                    ).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="custom-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  id="custom-name"
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Heavy Duty 3-Phase Sub-Panel 12-Way"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="custom-brand" className="block text-xs font-medium text-slate-700 mb-1">
                    Preferred Brand
                  </label>
                  <input
                    id="custom-brand"
                    type="text"
                    value={customBrand}
                    onChange={(e) => setCustomBrand(e.target.value)}
                    placeholder="e.g. Legrand / Any"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="custom-unit" className="block text-xs font-medium text-slate-700 mb-1">
                    Unit
                  </label>
                  <select
                    id="custom-unit"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-md"
                  >
                    {MATERIAL_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="custom-spec" className="block text-xs font-medium text-slate-700 mb-1">
                  Technical Specification / Size
                </label>
                <input
                  id="custom-spec"
                  type="text"
                  value={customSpec}
                  onChange={(e) => setCustomSpec(e.target.value)}
                  placeholder="e.g. 63A IP43 Metal Enclosure"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="custom-qty" className="block text-xs font-medium text-slate-700 mb-1">
                    Quantity
                  </label>
                  <input
                    id="custom-qty"
                    type="number"
                    min={0.1}
                    step="any"
                    value={customQty}
                    onChange={(e) => setCustomQty(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="custom-price" className="block text-xs font-medium text-slate-700 mb-1">
                    Est. Rate (₹)
                  </label>
                  <input
                    id="custom-price"
                    type="number"
                    min={0}
                    step="any"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="custom-gst" className="block text-xs font-medium text-slate-700 mb-1">
                    GST %
                  </label>
                  <input
                    id="custom-gst"
                    type="number"
                    min={0}
                    max={28}
                    value={customGst}
                    onChange={(e) => setCustomGst(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="custom-notes" className="block text-xs font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <input
                  id="custom-notes"
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Optional site instructions"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-md inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {t('addCustomMaterial')}
              </button>
            </form>
          )}

          {entryTab === 'ai' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                <span>
                  AI-suggested quantities are rough planning drafts only. Never order without verifying approved MEP drawings and consulting qualified electricians/plumbers.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Project Type</label>
                  <select
                    value={aiProjectType}
                    onChange={(e) => setAiProjectType(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-md"
                  >
                    {PROJECT_TYPES.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Domain Focus</label>
                  <select
                    value={aiDomain}
                    onChange={(e) => setAiDomain(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-md"
                  >
                    <option value="both">Electrical &amp; Plumbing</option>
                    <option value="electrical">Electrical Only</option>
                    <option value="plumbing">Plumbing Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Approx. Area (sq.ft)</label>
                  <input
                    type="number"
                    value={aiArea}
                    onChange={(e) => setAiArea(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Number of Floors</label>
                  <input
                    type="number"
                    min={1}
                    value={aiFloors}
                    onChange={(e) => setAiFloors(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <textarea
                rows={2}
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                placeholder="Describe rooms, bathrooms, AC points, or pump needs..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
              />

              <button
                type="button"
                disabled={aiLoading}
                onClick={handleGenerateAiChecklist}
                className="w-full py-2.5 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#163A5C] rounded-md inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#EA580C]" />
                {aiLoading ? 'Generating Draft Checklist...' : 'Generate AI Draft Checklist'}
              </button>

              {aiDraftResult && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 p-2 rounded">
                    {aiDraftResult.disclaimer}
                  </p>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {aiDraftResult.items.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="font-semibold text-[#0F2942]">{item.productName}</span>
                          <span className="font-mono-num shrink-0">
                            Est. {item.estimatedQuantity} {item.unit}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.rationale}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      for (const item of aiDraftResult.items) {
                        const matched = products.find((p) => p.sku === item.sku);
                        if (matched) {
                          addCatalogItemToDraft(matched, Math.max(1, Number(item.estimatedQuantity) || 1));
                        } else {
                          addCustomItemToDraft({
                            productId: null,
                            isCustom: true,
                            domain: item.domain === 'plumbing' ? 'plumbing' : 'electrical',
                            categoryName: item.categoryName || 'General',
                            productName: item.productName,
                            brand: item.brand || 'Standard',
                            specification: item.specification || '',
                            unit: item.unit || 'Nos',
                            quantity: Math.max(1, Number(item.estimatedQuantity) || 1),
                            estimatedUnitPrice: 0,
                            gstRate: 18,
                            notes: 'AI Draft Estimate — Verify on site',
                          });
                        }
                      }
                    }}
                    className="w-full py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
                  >
                    Add All Draft Items to Material List
                  </button>
                </div>
              )}
            </div>
          )}

          {entryTab === 'templates' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">Load a starter template or save your current list.</p>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="text-xs font-semibold text-[#EA580C] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {t('saveTemplate')}
                </button>
              </div>
              <div className="space-y-2.5">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="p-3 border border-slate-200 rounded-md bg-[#F4F6F8]">
                    <p className="text-xs font-bold text-[#0F2942]">{tpl.name}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">{tpl.description}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const items = Array.isArray(tpl.itemsJson) ? tpl.itemsJson : [];
                        loadItemsIntoDraft(
                          items.map((i: any) => ({
                            productId: i.productId || null,
                            isCustom: Boolean(i.isCustom),
                            domain: i.domain || 'electrical',
                            categoryName: i.categoryName || 'General',
                            productName: i.productName,
                            brand: i.brand || 'Standard',
                            specification: i.specification || '',
                            unit: i.unit || 'Nos',
                            quantity: Number(i.quantity) || 1,
                            estimatedUnitPrice: Number(i.estimatedUnitPrice) || 0,
                            gstRate: Number(i.gstRate) || 18,
                          })),
                          tpl.name
                        );
                        showNotice('success', `Loaded template "${tpl.name}"`);
                      }}
                      className="mt-2.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F2942] rounded cursor-pointer"
                    >
                      Load Into Builder ({Array.isArray(tpl.itemsJson) ? tpl.itemsJson.length : 0} items)
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Active Material List + Project Info + Automatic Calculations */}
        <div className="lg:col-span-7 space-y-6">
          {/* Project & Delivery Metadata */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="list-title-input" className="block text-xs font-medium text-slate-700 mb-1">
                  Material List Title
                </label>
                <input
                  id="list-title-input"
                  type="text"
                  value={draftListName}
                  onChange={(e) => setDraftListName(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold text-[#0F2942] border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="link-project-select" className="block text-xs font-medium text-slate-700 mb-1">
                  Link to Saved Project (Optional)
                </label>
                <select
                  id="link-project-select"
                  value={selectedProjectId ?? ''}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-slate-50"
                >
                  <option value="">-- Standalone Material List --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName} ({p.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                aria-label="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer / Contractor Name"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <input
                type="text"
                aria-label="Contact number"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="Mobile Number"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <input
                type="text"
                aria-label="Site PIN code"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="Site PIN Code"
                className="px-3 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                aria-label="Site address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Site Delivery Address (Street / Plot)"
                className="sm:col-span-2 px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="w-1/2 px-2.5 py-2 text-xs border border-slate-200 rounded-md"
                />
                <select
                  aria-label="State"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-1/2 px-2 py-2 text-xs border border-slate-200 rounded-md"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Itemized Material Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-[#0F2942]">
                  Selected Materials ({draftList.length})
                </h2>
                <p className="text-[11px] text-amber-800 font-medium">
                  {t('estimatedBadge')} — Final rates will be confirmed by selected suppliers.
                </p>
              </div>
            </div>

            {draftList.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Your material list is empty. Tick products from the left panel or add a custom material.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      <th className="py-2.5 px-4">Material &amp; Spec</th>
                      <th className="py-2.5 px-2">Qty</th>
                      <th className="py-2.5 px-2">Unit</th>
                      <th className="py-2.5 px-2 text-right">Est. Rate</th>
                      <th className="py-2.5 px-2 text-right">GST%</th>
                      <th className="py-2.5 px-4 text-right">Line Total</th>
                      <th className="py-2.5 px-2 no-print">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {draftList.map((item, idx) => {
                      const calc = totals.items[idx];
                      return (
                        <tr key={item.localId} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-[#0F2942]">
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {item.categoryName} · {item.brand} {item.isCustom ? '· Custom' : ''}
                            </p>
                            {item.specification && (
                              <p className="text-[11px] text-slate-500">{item.specification}</p>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              min={0.1}
                              step="any"
                              aria-label={`Quantity for ${item.productName}`}
                              value={item.quantity}
                              onChange={(e) =>
                                updateDraftItem(item.localId, {
                                  quantity: Math.max(0.1, Number(e.target.value) || 1),
                                })
                              }
                              className="w-16 px-2 py-1 text-xs font-mono-num border border-slate-200 rounded"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <select
                              aria-label={`Unit for ${item.productName}`}
                              value={item.unit}
                              onChange={(e) =>
                                updateDraftItem(item.localId, { unit: e.target.value })
                              }
                              className="px-1.5 py-1 text-xs border border-slate-200 rounded bg-white"
                            >
                              {!MATERIAL_UNITS.includes(item.unit as any) && (
                                <option value={item.unit}>{item.unit}</option>
                              )}
                              {MATERIAL_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              aria-label={`Estimated rate for ${item.productName}`}
                              value={item.estimatedUnitPrice}
                              onChange={(e) =>
                                updateDraftItem(item.localId, {
                                  estimatedUnitPrice: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className="w-20 px-2 py-1 text-xs font-mono-num text-right border border-slate-200 rounded"
                            />
                          </td>
                          <td className="py-3 px-2 text-right font-mono-num">
                            {item.gstRate}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num font-semibold text-[#0F2942]">
                            {formatINR(calc?.lineTotal ?? 0)}
                          </td>
                          <td className="py-3 px-2 text-right no-print">
                            <button
                              type="button"
                              aria-label={`Remove ${item.productName}`}
                              onClick={() => removeDraftItem(item.localId)}
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary Totals & Send RFQ */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <div className="space-y-2">
                <label htmlFor="list-notes-input" className="block text-xs font-medium text-slate-700">
                  Additional Notes for Suppliers
                </label>
                <textarea
                  id="list-notes-input"
                  rows={2}
                  value={listNotes}
                  onChange={(e) => setListNotes(e.target.value)}
                  placeholder="Preferred brand alternatives, unloading instructions, required delivery date..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-md"
                />
                <div className="flex items-center gap-2">
                  <label htmlFor="delivery-est-input" className="text-xs text-slate-600">
                    Est. Delivery Charge (₹):
                  </label>
                  <input
                    id="delivery-est-input"
                    type="number"
                    min={0}
                    value={deliveryEstimate}
                    onChange={(e) => setDeliveryEstimate(Math.max(0, Number(e.target.value) || 0))}
                    className="w-24 px-2 py-1 text-xs font-mono-num bg-white border border-slate-200 rounded"
                  />
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{t('subtotal')} (Excl. GST)</span>
                  <span className="font-mono-num font-medium">{formatINR(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{t('gst')} Total</span>
                  <span className="font-mono-num font-medium">{formatINR(totals.gstTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{t('deliveryCharges')} (Est.)</span>
                  <span className="font-mono-num font-medium">{formatINR(totals.deliveryCharges)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-[#0F2942]">
                  <span>Estimated Grand Total</span>
                  <span className="font-mono-num">{formatINR(totals.grandTotal)}</span>
                </div>

                <button
                  type="button"
                  disabled={draftList.length === 0}
                  onClick={() => setSendModalOpen(true)}
                  className="mt-3 w-full py-3 px-4 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 rounded-md inline-flex items-center justify-center gap-2 no-print cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {t('sendToSuppliers')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Supplier Selection Modal */}
      {sendModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select Verified Suppliers for Quotation Request"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0F2942]">
                  Send Quotation Request to Multiple Shops
                </h3>
                <p className="text-xs text-slate-600">
                  Every selected verified shop receives the exact same {draftList.length}-item requirement. Suppliers cannot see each other&apos;s bids.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSendModalOpen(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-2">
              <input
                type="text"
                aria-label="Filter suppliers by PIN code, city, state, or shop name"
                value={supSearch}
                onChange={(e) => setSupSearch(e.target.value)}
                placeholder="Search by PIN Code (e.g., 600001), City, State, or Shop Name..."
                className="flex-1 min-w-[220px] px-3 py-2 text-xs bg-white border border-slate-200 rounded-md"
              />
              <select
                aria-label="Filter suppliers by category"
                value={supDomain}
                onChange={(e) => setSupDomain(e.target.value as any)}
                className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-md"
              >
                <option value="all">Electrical &amp; Plumbing</option>
                <option value="electrical">Electrical Shops</option>
                <option value="plumbing">Plumbing Shops</option>
              </select>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {filteredSuppliersForModal.map((sup) => {
                const checked = selectedSupplierIds.includes(sup.id);
                return (
                  <label
                    key={sup.id}
                    className={`flex items-start gap-3 p-3.5 border rounded-md cursor-pointer ${
                      checked ? 'border-[#EA580C] bg-[#EA580C]/5' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSupplierIds((prev) => [...prev, sup.id]);
                        } else {
                          setSelectedSupplierIds((prev) => prev.filter((id) => id !== sup.id));
                        }
                      }}
                      className="mt-1 h-4 w-4 accent-[#EA580C]"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold text-[#0F2942]">
                          {sup.shopName}
                        </span>
                        <span className="text-xs font-medium text-emerald-700">
                          Verified · {sup.city}, {sup.state} ({sup.pinCode})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{sup.businessAddress}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Service Coverage: {sup.serviceAreas}
                      </p>
                    </div>
                  </label>
                );
              })}

              {filteredSuppliersForModal.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-8">
                  No verified suppliers match your PIN or city filter. Try clearing filters.
                </p>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-700">
                {selectedSupplierIds.length} supplier(s) selected · Delivery to {city} ({pinCode})
              </span>
              <button
                type="button"
                disabled={sendingRfq || selectedSupplierIds.length === 0}
                onClick={handleSendRfq}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 rounded-md cursor-pointer"
              >
                {sendingRfq ? 'Sending Request...' : 'Confirm & Send Quotation Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
