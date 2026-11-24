import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ELECTRICAL_CATEGORIES,
  INDIAN_STATES,
  MATERIAL_UNITS,
  ORDER_STATUSES,
  PLUMBING_CATEGORIES,
} from '../lib/catalogData';
import { calculateQuotationTotals, formatINR } from '../lib/pricing';
import type { AppView } from '../types';

export function SupplierWorkspace({ activeTab }: { activeTab: AppView }) {
  const { user, apiFetch, setView, showNotice } = useApp();

  const [supplier, setSupplier] = useState<any | null>(null);
  const [metrics, setMetrics] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Shop Profile Form
  const [shopForm, setShopForm] = useState({
    shopName: '',
    ownerName: user?.fullName || '',
    mobile: user?.mobile || '',
    email: user?.email || '',
    gstin: '',
    businessAddress: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pinCode: '600001',
    serviceAreas: 'Chennai, 600001',
    productCategories: 'electrical,plumbing',
    shopDescription: '',
    docType: 'GST Certificate',
    docNumber: '',
  });

  // Add Product Form
  const [prodForm, setProdForm] = useState({
    domain: 'electrical',
    categoryName: ELECTRICAL_CATEGORIES[0] as string,
    customName: '',
    brandName: '',
    specification: '',
    unit: 'Nos',
    unitPrice: 100,
    gstRate: 18,
    stockQty: 50,
  });

  // Active Quotation Response Modal
  const [quotingReq, setQuotingReq] = useState<any | null>(null);
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [quoteDeliveryCharges, setQuoteDeliveryCharges] = useState(250);
  const [quoteDeliveryDays, setQuoteDeliveryDays] = useState(2);
  const [quoteValidUntil, setQuoteValidUntil] = useState('14 days');
  const [quoteNotes, setQuoteNotes] = useState('');

  const loadSupplierData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [dRes, pRes, rRes, oRes] = await Promise.all([
        apiFetch('/api/supplier/dashboard'),
        apiFetch('/api/supplier/products'),
        apiFetch('/api/supplier/requests'),
        apiFetch('/api/supplier/orders'),
      ]);
      if (dRes.ok) {
        const dData = await dRes.json();
        setSupplier(dData.supplier);
        setMetrics(dData.metrics || {});
        if (dData.supplier) {
          setShopForm((prev) => ({
            ...prev,
            shopName: dData.supplier.shopName,
            ownerName: dData.supplier.ownerName,
            mobile: dData.supplier.mobile,
            email: dData.supplier.email,
            gstin: dData.supplier.gstin || '',
            businessAddress: dData.supplier.businessAddress,
            city: dData.supplier.city,
            state: dData.supplier.state,
            pinCode: dData.supplier.pinCode,
            serviceAreas: dData.supplier.serviceAreas,
            productCategories: dData.supplier.productCategories,
            shopDescription: dData.supplier.shopDescription || '',
          }));
        }
      }
      if (pRes.ok) setProducts((await pRes.json()).products || []);
      if (rRes.ok) setRequests((await rRes.json()).requests || []);
      if (oRes.ok) setOrders((await oRes.json()).orders || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupplierData();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#0F2942]">Supplier Sign In Required</h1>
        <button
          type="button"
          onClick={() => setView('login')}
          className="mt-4 px-5 py-2.5 text-sm font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handleSaveShopProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch('/api/supplier/profile', {
      method: 'POST',
      body: JSON.stringify(shopForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error);
      return;
    }
    showNotice('success', 'Shop profile saved and submitted for verification.');
    loadSupplierData();
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch('/api/supplier/products', {
      method: 'POST',
      body: JSON.stringify(prodForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error);
      return;
    }
    showNotice('success', 'Product added to shop inventory.');
    setProdForm({ ...prodForm, customName: '', brandName: '', specification: '' });
    loadSupplierData();
  };

  const openQuoteEditor = (rfq: any) => {
    setQuotingReq(rfq);
    if (rfq.ownQuotation && rfq.ownQuotation.items?.length > 0) {
      setQuoteItems(
        rfq.ownQuotation.items.map((qi: any) => ({
          productName: qi.productName,
          categoryName: qi.categoryName,
          brandOffered: qi.brandOffered,
          specification: qi.specification,
          requestedQty: qi.requestedQty,
          availableQty: qi.availableQty,
          unit: qi.unit,
          unitPrice: qi.unitPrice,
          gstRate: qi.gstRate,
          isAlternative: qi.isAlternative,
          alternativeDetails: qi.alternativeDetails || '',
        }))
      );
      setQuoteDeliveryCharges(rfq.ownQuotation.deliveryCharges);
      setQuoteDeliveryDays(rfq.ownQuotation.estimatedDeliveryDays);
      setQuoteValidUntil(rfq.ownQuotation.validUntil);
      setQuoteNotes(rfq.ownQuotation.notes || '');
    } else {
      const snap = Array.isArray(rfq.itemsSnapshotJson) ? rfq.itemsSnapshotJson : [];
      setQuoteItems(
        snap.map((it: any) => ({
          productName: it.productName,
          categoryName: it.categoryName || 'General',
          brandOffered: it.brand || 'Standard',
          specification: it.specification || '',
          requestedQty: Number(it.quantity) || 1,
          availableQty: Number(it.quantity) || 1,
          unit: it.unit || 'Nos',
          unitPrice: Number(it.estimatedUnitPrice) || 0,
          gstRate: Number(it.gstRate) || 18,
          isAlternative: false,
          alternativeDetails: '',
        }))
      );
    }
  };

  const handleSubmitQuote = async (status: 'draft' | 'submitted') => {
    if (!quotingReq) return;
    const res = await apiFetch('/api/supplier/quotations', {
      method: 'POST',
      body: JSON.stringify({
        requestId: quotingReq.id,
        status,
        deliveryCharges: quoteDeliveryCharges,
        estimatedDeliveryDays: quoteDeliveryDays,
        validUntil: quoteValidUntil,
        notes: quoteNotes,
        items: quoteItems,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error);
      return;
    }
    showNotice(
      'success',
      status === 'draft'
        ? 'Quotation draft saved.'
        : `Quotation ${data.quotation.quotationNumber} submitted to customer!`
    );
    setQuotingReq(null);
    loadSupplierData();
  };

  const quoteTotals = calculateQuotationTotals(
    quoteItems.map((i) => ({
      productName: i.productName,
      unit: i.unit,
      quantity: i.availableQty,
      unitPrice: i.unitPrice,
      gstRate: i.gstRate,
    })),
    quoteDeliveryCharges
  );

  const tabs: Array<{ id: AppView; label: string }> = [
    { id: 'supplier-dashboard', label: 'Overview' },
    { id: 'supplier-profile', label: 'Shop Profile & Verification' },
    { id: 'supplier-products', label: `Products & Inventory (${products.length})` },
    { id: 'supplier-requests', label: `Incoming RFQs (${requests.length})` },
    { id: 'supplier-orders', label: `Orders & Deliveries (${orders.length})` },
    { id: 'supplier-reports', label: 'Sales Reports' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#EA580C]">
            Supplier Portal · {supplier?.verificationStatus ? `Verification: ${supplier.verificationStatus.toUpperCase()}` : 'Shop Setup Needed'}
          </p>
          <h1 className="font-display text-2xl font-bold text-[#0F2942] mt-0.5">
            {supplier?.shopName || `${user.fullName} — Shop Dashboard`}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setView('customer-dashboard')}
          className="px-3.5 py-2 text-xs font-semibold text-[#0F2942] bg-white border border-slate-300 rounded-md self-start cursor-pointer"
        >
          Switch to Buyer View
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#0F2942] text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading && <p className="text-xs text-slate-500">Loading supplier workspace...</p>}

        {supplier && supplier.verificationStatus !== 'verified' && (
          <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            Your shop verification status is <strong>{supplier.verificationStatus}</strong>. Admin approval is required before your shop appears in customer discovery and can submit quotations.
          </div>
        )}

        {/* SUPPLIER DASHBOARD */}
        {activeTab === 'supplier-dashboard' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Products', val: metrics.totalProducts ?? 0 },
              { label: 'Active Products', val: metrics.activeProducts ?? 0 },
              { label: 'Incoming Requests', val: metrics.incomingRequests ?? 0 },
              { label: 'Submitted Quotes', val: metrics.submittedQuotations ?? 0 },
              { label: 'Pending Orders', val: metrics.pendingOrders ?? 0 },
              { label: 'Completed Orders', val: metrics.completedOrders ?? 0 },
            ].map((k) => (
              <div key={k.label} className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500">{k.label}</p>
                <p className="font-mono-num text-2xl font-bold text-[#0F2942] mt-1">{k.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* SHOP PROFILE & DOCUMENTS */}
        {activeTab === 'supplier-profile' && (
          <form
            onSubmit={handleSaveShopProfile}
            className="bg-white border border-slate-200 rounded-lg p-6 max-w-2xl space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-[#0F2942]">
              Shop Profile &amp; Verification Documents
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={shopForm.shopName}
                onChange={(e) => setShopForm({ ...shopForm, shopName: e.target.value })}
                placeholder="Shop Name *"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <input
                type="text"
                required
                value={shopForm.ownerName}
                onChange={(e) => setShopForm({ ...shopForm, ownerName: e.target.value })}
                placeholder="Owner Name *"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={shopForm.mobile}
                onChange={(e) => setShopForm({ ...shopForm, mobile: e.target.value })}
                placeholder="Mobile *"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <input
                type="email"
                required
                value={shopForm.email}
                onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })}
                placeholder="Email *"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <input
                type="text"
                value={shopForm.gstin}
                onChange={(e) => setShopForm({ ...shopForm, gstin: e.target.value })}
                placeholder="GSTIN (Optional)"
                className="px-3 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
              />
            </div>
            <input
              type="text"
              required
              value={shopForm.businessAddress}
              onChange={(e) => setShopForm({ ...shopForm, businessAddress: e.target.value })}
              placeholder="Business Address *"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={shopForm.city}
                onChange={(e) => setShopForm({ ...shopForm, city: e.target.value })}
                placeholder="City *"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <select
                value={shopForm.state}
                onChange={(e) => setShopForm({ ...shopForm, state: e.target.value })}
                className="px-2 py-2 text-xs border border-slate-200 rounded-md"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="text"
                required
                value={shopForm.pinCode}
                onChange={(e) => setShopForm({ ...shopForm, pinCode: e.target.value })}
                placeholder="PIN Code *"
                className="px-3 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
              />
            </div>
            <input
              type="text"
              value={shopForm.serviceAreas}
              onChange={(e) => setShopForm({ ...shopForm, serviceAreas: e.target.value })}
              placeholder="Service Coverage Cities & PIN Codes (comma separated)"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
            />
            <textarea
              rows={2}
              value={shopForm.shopDescription}
              onChange={(e) => setShopForm({ ...shopForm, shopDescription: e.target.value })}
              placeholder="Shop description & key authorized brands..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
            />
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <select
                value={shopForm.docType}
                onChange={(e) => setShopForm({ ...shopForm, docType: e.target.value })}
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              >
                <option value="GST Certificate">GST Certificate</option>
                <option value="Udyam MSME Registration">Udyam MSME Registration</option>
                <option value="Shop & Establishment License">Shop &amp; Establishment License</option>
              </select>
              <input
                type="text"
                value={shopForm.docNumber}
                onChange={(e) => setShopForm({ ...shopForm, docNumber: e.target.value })}
                placeholder="Document Registration Number"
                className="px-3 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#163A5C] rounded-md cursor-pointer"
            >
              Save Shop Profile
            </button>
          </form>
        )}

        {/* PRODUCTS & INVENTORY */}
        {activeTab === 'supplier-products' && (
          <div className="space-y-6">
            <form
              onSubmit={handleAddProduct}
              className="bg-white border border-slate-200 rounded-lg p-5 space-y-3"
            >
              <h2 className="font-display text-base font-bold text-[#0F2942]">
                Add Product to Shop Inventory
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={prodForm.domain}
                  onChange={(e) => {
                    const d = e.target.value;
                    setProdForm({
                      ...prodForm,
                      domain: d,
                      categoryName:
                        d === 'electrical' ? ELECTRICAL_CATEGORIES[0] : PLUMBING_CATEGORIES[0],
                    });
                  }}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-md"
                >
                  <option value="electrical">Electrical</option>
                  <option value="plumbing">Plumbing</option>
                </select>
                <select
                  value={prodForm.categoryName}
                  onChange={(e) => setProdForm({ ...prodForm, categoryName: e.target.value })}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-md"
                >
                  {(prodForm.domain === 'electrical'
                    ? ELECTRICAL_CATEGORIES
                    : PLUMBING_CATEGORIES
                  ).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={prodForm.customName}
                  onChange={(e) => setProdForm({ ...prodForm, customName: e.target.value })}
                  placeholder="Product Name *"
                  className="px-3 py-2 text-xs border border-slate-200 rounded-md"
                />
                <input
                  type="text"
                  required
                  value={prodForm.brandName}
                  onChange={(e) => setProdForm({ ...prodForm, brandName: e.target.value })}
                  placeholder="Brand *"
                  className="px-3 py-2 text-xs border border-slate-200 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="col-span-2 sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Specification / Size
                  </label>
                  <input
                    type="text"
                    value={prodForm.specification}
                    onChange={(e) => setProdForm({ ...prodForm, specification: e.target.value })}
                    placeholder="e.g. 1.5 sq.mm FR-LSH"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Unit</label>
                  <select
                    value={prodForm.unit}
                    onChange={(e) => setProdForm({ ...prodForm, unit: e.target.value })}
                    className="w-full px-2 py-2 text-xs border border-slate-200 rounded-md"
                  >
                    {MATERIAL_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={prodForm.unitPrice}
                    onChange={(e) => setProdForm({ ...prodForm, unitPrice: Number(e.target.value) })}
                    placeholder="Price (₹)"
                    className="w-full px-3 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Stock Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={prodForm.stockQty}
                    onChange={(e) => setProdForm({ ...prodForm, stockQty: Number(e.target.value) })}
                    placeholder="Stock Qty"
                    className="w-full px-3 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-md inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product
              </button>
            </form>

            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                    <th className="py-2.5 px-4">Product</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Price (₹)</th>
                    <th className="py-2.5 px-3 text-right">Stock</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-[#0F2942]">{p.customName}</p>
                        <p className="text-[11px] text-slate-500">{p.brandName} · {p.specification}</p>
                      </td>
                      <td className="py-2.5 px-3">{p.categoryName}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num">{formatINR(p.unitPrice)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num">{p.stockQty} {p.unit}</td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/supplier/products/${p.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ isAvailable: !p.isAvailable }),
                            });
                            loadSupplierData();
                          }}
                          className={`text-xs font-semibold cursor-pointer ${
                            p.isAvailable ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {p.isAvailable ? 'In Stock' : 'Hidden'}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          aria-label={`Delete ${p.customName}`}
                          onClick={async () => {
                            await apiFetch(`/api/supplier/products/${p.id}`, { method: 'DELETE' });
                            loadSupplierData();
                          }}
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INCOMING QUOTE REQUESTS */}
        {activeTab === 'supplier-requests' && (
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-500">
                No incoming customer quotation requests yet.
              </div>
            ) : (
              requests.map((rfq) => (
                <div key={rfq.id} className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono-num font-bold text-[#0F2942]">{rfq.requestNumber}</span>
                      <span>·</span>
                      <span>{rfq.customerCity} ({rfq.pinCode})</span>
                      <span>·</span>
                      <span>{rfq.itemsSnapshotJson?.length || 0} items</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[#0F2942] mt-1">
                      {rfq.title}
                    </h3>
                    {rfq.ownQuotation && (
                      <p className="text-xs text-emerald-700 font-semibold mt-1">
                        Your Quotation: {rfq.ownQuotation.quotationNumber} ({rfq.ownQuotation.status}) — {formatINR(rfq.ownQuotation.grandTotal)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openQuoteEditor(rfq)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-md cursor-pointer"
                  >
                    {rfq.ownQuotation ? 'Edit / View Quotation' : 'Prepare & Submit Quotation'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* SUPPLIER ORDERS & DELIVERIES */}
        {activeTab === 'supplier-orders' && (
          <div className="space-y-4">
            {orders.map((ord) => (
              <div key={ord.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
                <div className="flex flex-wrap justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <p className="font-mono-num text-sm font-bold text-[#0F2942]">{ord.orderNumber}</p>
                    <p className="text-xs text-slate-600">
                      Customer: {ord.customerName} ({ord.customerMobile})
                    </p>
                    <p className="text-xs text-slate-500">
                      Site: {ord.deliveryAddress}, {ord.city} - {ord.pinCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-num text-base font-bold text-[#0F2942]">{formatINR(ord.grandTotal)}</p>
                    <p className="text-xs text-slate-600">Payment: {ord.paymentStatus} ({ord.paymentMethod})</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <label className="font-medium text-slate-700">Order Status:</label>
                    <select
                      value={ord.status}
                      onChange={async (e) => {
                        await apiFetch(`/api/supplier/orders/${ord.id}/status`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: e.target.value }),
                        });
                        showNotice('success', `Order ${ord.orderNumber} updated to ${e.target.value}`);
                        loadSupplierData();
                      }}
                      className="px-2.5 py-1.5 border border-slate-200 rounded bg-slate-50"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  {ord.paymentStatus !== 'Paid' && (ord.payments || []).length > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        const payId = ord.payments[ord.payments.length - 1].id;
                        const res = await apiFetch(`/api/supplier/payments/${payId}/confirm`, {
                          method: 'PATCH',
                        });
                        if (res.ok) {
                          showNotice('success', 'Payment manually verified and marked Paid.');
                          loadSupplierData();
                        }
                      }}
                      className="px-3 py-1.5 font-semibold text-white bg-emerald-700 rounded cursor-pointer"
                    >
                      Verify &amp; Confirm Payment Received
                    </button>
                  )}
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg p-8 text-center">
                No confirmed orders yet.
              </p>
            )}
          </div>
        )}

        {/* SALES REPORTS */}
        {activeTab === 'supplier-reports' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0F2942]">
              Supplier Sales &amp; Conversion Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#F4F6F8] rounded-md">
                <p className="text-slate-500">Total Confirmed Revenue</p>
                <p className="font-mono-num text-xl font-bold text-[#0F2942] mt-1">
                  {formatINR(metrics.totalRevenue ?? 0)}
                </p>
              </div>
              <div className="p-4 bg-[#F4F6F8] rounded-md">
                <p className="text-slate-500">Quotes Submitted</p>
                <p className="font-mono-num text-xl font-bold text-[#0F2942] mt-1">
                  {metrics.submittedQuotations ?? 0}
                </p>
              </div>
              <div className="p-4 bg-[#F4F6F8] rounded-md">
                <p className="text-slate-500">Total Orders Fulfilled</p>
                <p className="font-mono-num text-xl font-bold text-[#0F2942] mt-1">
                  {(metrics.pendingOrders ?? 0) + (metrics.completedOrders ?? 0)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quotation Response Modal */}
      {quotingReq && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0F2942]">
                  Respond to {quotingReq.requestNumber} — {quotingReq.title}
                </h3>
                <p className="text-xs text-slate-600">
                  Deliver to {quotingReq.city} ({quotingReq.pinCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuotingReq(null)}
                className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                      <th className="py-2 pr-2">Requested Item</th>
                      <th className="py-2 px-2">Brand Offered</th>
                      <th className="py-2 px-2">Avail Qty</th>
                      <th className="py-2 px-2">Unit Price (₹)</th>
                      <th className="py-2 px-2">GST%</th>
                      <th className="py-2 pl-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quoteItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 pr-2">
                          <p className="font-semibold text-[#0F2942]">{item.productName}</p>
                          <p className="text-[11px] text-slate-500">
                            Req: {item.requestedQty} {item.unit}
                          </p>
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            value={item.brandOffered}
                            onChange={(e) =>
                              setQuoteItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, brandOffered: e.target.value } : it
                                )
                              )
                            }
                            className="w-28 px-2 py-1 border border-slate-200 rounded"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min={0}
                            value={item.availableQty}
                            onChange={(e) =>
                              setQuoteItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, availableQty: Number(e.target.value) } : it
                                )
                              )
                            }
                            className="w-16 px-2 py-1 font-mono-num border border-slate-200 rounded"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(e) =>
                              setQuoteItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, unitPrice: Number(e.target.value) } : it
                                )
                              )
                            }
                            className="w-24 px-2 py-1 font-mono-num border border-slate-200 rounded"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min={0}
                            max={28}
                            value={item.gstRate}
                            onChange={(e) =>
                              setQuoteItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, gstRate: Number(e.target.value) } : it
                                )
                              )
                            }
                            className="w-14 px-2 py-1 font-mono-num border border-slate-200 rounded"
                          />
                        </td>
                        <td className="py-2.5 pl-2 text-right font-mono-num font-semibold text-[#0F2942]">
                          {formatINR(quoteTotals.items[idx]?.lineTotal ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Delivery Charges (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={quoteDeliveryCharges}
                    onChange={(e) => setQuoteDeliveryCharges(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono-num border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Est. Delivery Days</label>
                  <input
                    type="number"
                    min={1}
                    value={quoteDeliveryDays}
                    onChange={(e) => setQuoteDeliveryDays(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono-num border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Quotation Validity</label>
                  <input
                    type="text"
                    value={quoteValidUntil}
                    onChange={(e) => setQuoteValidUntil(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded"
                  />
                </div>
              </div>

              <textarea
                rows={2}
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder="Alternative brand notes, payment terms, unloading instructions..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded"
              />
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-bold text-[#0F2942]">
                Grand Total (incl. GST &amp; Delivery):{' '}
                <span className="font-mono-num">{formatINR(quoteTotals.grandTotal)}</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmitQuote('draft')}
                  className="px-4 py-2 text-xs font-semibold text-[#0F2942] border border-slate-300 bg-white rounded-md cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitQuote('submitted')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
                >
                  Submit Final Quotation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
