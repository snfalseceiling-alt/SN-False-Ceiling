import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Copy,
  Download,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { INDIAN_STATES, PROJECT_TYPES } from '../lib/catalogData';
import {
  calculateSplitOrderSummary,
  findLowestComparableQuotationId,
  formatINR,
} from '../lib/pricing';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../lib/i18n';
import type { AppView, Project } from '../types';

export function CustomerWorkspace({ activeTab }: { activeTab: AppView }) {
  const {
    t,
    user,
    apiFetch,
    setView,
    language,
    setLanguage,
    refreshProfile,
    loadItemsIntoDraft,
    notifications,
    reloadNotifications,
    showNotice,
  } = useApp();

  const [projects, setProjects] = useState<Project[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminBootstrapAvailable, setAdminBootstrapAvailable] = useState(false);

  // Project form state
  const [projModalOpen, setProjModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projForm, setProjForm] = useState({
    projectName: '',
    customerName: user?.fullName || '',
    contactNumber: user?.mobile || '',
    siteAddress: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pinCode: '600001',
    buildingType: 'New House Construction',
    numFloors: 2,
    approxAreaSqft: 1400,
    description: '',
    status: 'Planning',
  });

  // Comparison / Split Order state
  const [selectedRfqId, setSelectedRfqId] = useState<number | null>(null);
  const [splitMode, setSplitMode] = useState(false);
  const [splitSelections, setSplitSelections] = useState<Record<number, number>>({}); // requestItemIndex -> quotationId
  const [paymentMethodChoice, setPaymentMethodChoice] = useState('Cash on Delivery');
  const [aiCompareAnswer, setAiCompareAnswer] = useState<string | null>(null);
  const [aiCompareLoading, setAiCompareLoading] = useState(false);

  // Payment reference modal for orders
  const [payModalOrder, setPayModalOrder] = useState<any | null>(null);
  const [payMethod, setPayMethod] = useState('UPI');
  const [payRef, setPayRef] = useState('');

  // Profile form
  const [profName, setProfName] = useState(user?.fullName || '');
  const [profMobile, setProfMobile] = useState(user?.mobile || '');

  // Complaint state
  const [complaintOrderId, setComplaintOrderId] = useState<number | null>(null);
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDesc, setComplaintDesc] = useState('');

  const loadWorkspaceData = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const [pRes, lRes, rRes, oRes, aRes] = await Promise.all([
        apiFetch('/api/projects'),
        apiFetch('/api/material-lists'),
        apiFetch('/api/quotation-requests'),
        apiFetch('/api/orders'),
        fetch('/api/auth/admin-bootstrap-status'),
      ]);
      if (pRes.ok) setProjects((await pRes.json()).projects || []);
      if (lRes.ok) setLists((await lRes.json()).lists || []);
      if (rRes.ok) {
        const rData = await rRes.json();
        const reqList = rData.requests || [];
        setRequests(reqList);
        if (reqList.length > 0 && !selectedRfqId) {
          setSelectedRfqId(reqList[0].id);
        }
      }
      if (oRes.ok) setOrders((await oRes.json()).orders || []);
      if (aRes.ok) {
        const aData = await aRes.json();
        setAdminBootstrapAvailable(!aData.adminExists);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [user]);

  useEffect(() => {
    if (user) {
      setProfName(user.fullName);
      setProfMobile(user.mobile || '');
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#0F2942]">Sign In Required</h1>
        <p className="text-sm text-slate-600 mt-2">
          Sign in to manage your projects, saved material lists, supplier quotations, and orders.
        </p>
        <button
          type="button"
          onClick={() => setView('login')}
          className="mt-5 px-5 py-2.5 text-sm font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingProjectId ? `/api/projects/${editingProjectId}` : '/api/projects';
    const method = editingProjectId ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(projForm) });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'Could not save project');
      return;
    }
    setProjModalOpen(false);
    setEditingProjectId(null);
    showNotice('success', editingProjectId ? 'Project updated.' : 'Project created.');
    loadWorkspaceData();
  };

  const handleDuplicateProject = async (id: number) => {
    const res = await apiFetch(`/api/projects/${id}/duplicate`, { method: 'POST' });
    if (res.ok) {
      showNotice('success', 'Project duplicated.');
      loadWorkspaceData();
    }
  };

  const handleDeleteProject = async (id: number) => {
    const res = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showNotice('success', 'Project deleted.');
      loadWorkspaceData();
    }
  };

  const activeRfq = useMemo(
    () => requests.find((r) => r.id === selectedRfqId) || requests[0] || null,
    [requests, selectedRfqId]
  );

  const lowestComparableId = useMemo(() => {
    if (!activeRfq || !Array.isArray(activeRfq.quotations)) return null;
    const expectedCount = Array.isArray(activeRfq.itemsSnapshotJson)
      ? activeRfq.itemsSnapshotJson.length
      : 0;
    return findLowestComparableQuotationId(
      activeRfq.quotations.map((q: any) => ({
        id: q.id,
        quotationNumber: q.quotationNumber,
        supplierId: q.supplierId,
        supplierName: q.supplierName,
        grandTotal: q.grandTotal,
        subtotal: q.subtotal,
        gstTotal: q.gstTotal,
        deliveryCharges: q.deliveryCharges,
        estimatedDeliveryDays: q.estimatedDeliveryDays,
        itemCount: (q.items || []).length,
        allItemsAvailable: (q.items || []).every(
          (i: any) => i.availableQty >= i.requestedQty
        ),
      })),
      expectedCount
    );
  }, [activeRfq]);

  const handleDownloadSupplierQuotePdf = async (quotationId: number, qNum: string) => {
    const res = await apiFetch(`/api/quotations/${quotationId}/pdf`);
    if (!res.ok) {
      showNotice('error', 'Failed to download quotation PDF.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${qNum}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleQuoteAction = async (
    quotationId: number,
    action: 'accept' | 'reject' | 'clarify',
    clarificationNote?: string
  ) => {
    const res = await apiFetch(`/api/quotations/${quotationId}/customer-action`, {
      method: 'PATCH',
      body: JSON.stringify({ action, clarificationNote }),
    });
    if (!res.ok) {
      showNotice('error', 'Unable to update quotation status.');
      return;
    }
    showNotice('success', `Quotation ${action} action recorded.`);
    loadWorkspaceData();
  };

  const handlePlaceOrderFromQuote = async (quotationId: number) => {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        quotationId,
        paymentMethod: paymentMethodChoice,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'Could not place order.');
      return;
    }
    showNotice('success', `Order placed successfully! (${data.orders[0]?.orderNumber})`);
    setOrders((prev) => [...(data.orders || []), ...prev]);
    setView('customer-orders');
    loadWorkspaceData(true);
  };

  const handlePlaceSplitOrder = async () => {
    if (!activeRfq) return;
    const byQuote = new Map<number, number[]>();
    Object.entries(splitSelections).forEach(([reqIdxStr, qId]) => {
      const reqIdx = Number(reqIdxStr);
      const quote = activeRfq.quotations.find((q: any) => q.id === qId);
      const qItem = quote?.items?.find((qi: any) => qi.requestItemIndex === reqIdx);
      if (qItem) {
        const list = byQuote.get(qId) || [];
        list.push(qItem.id);
        byQuote.set(qId, list);
      }
    });
    const allocations = Array.from(byQuote.entries()).map(([quotationId, itemIds]) => ({
      quotationId,
      itemIds,
    }));
    if (allocations.length === 0) {
      showNotice('error', 'Select at least one supplier item in split mode.');
      return;
    }
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ allocations, paymentMethod: paymentMethodChoice }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'Split order placement failed.');
      return;
    }
    showNotice('success', `Created ${data.orders.length} split supplier order(s).`);
    setSplitMode(false);
    setOrders((prev) => [...(data.orders || []), ...prev]);
    setView('customer-orders');
    loadWorkspaceData(true);
  };

  const splitSummary = useMemo(() => {
    if (!activeRfq || !splitMode) return null;
    const groups = new Map<number, any>();
    Object.entries(splitSelections).forEach(([reqIdxStr, qId]) => {
      const reqIdx = Number(reqIdxStr);
      const quote = activeRfq.quotations.find((q: any) => q.id === qId);
      const qItem = quote?.items?.find((qi: any) => qi.requestItemIndex === reqIdx);
      if (!quote || !qItem) return;
      const g = groups.get(qId) || {
        supplierId: quote.supplierId,
        supplierName: quote.supplierName,
        quotationId: quote.id,
        deliveryCharges: quote.deliveryCharges,
        items: [],
      };
      g.items.push({
        productName: qItem.productName,
        unit: qItem.unit,
        quantity: qItem.availableQty,
        unitPrice: qItem.unitPrice,
        gstRate: qItem.gstRate,
      });
      groups.set(qId, g);
    });
    return calculateSplitOrderSummary(Array.from(groups.values()));
  }, [activeRfq, splitMode, splitSelections]);

  const handleAiCompare = async () => {
    if (!activeRfq) return;
    setAiCompareLoading(true);
    setAiCompareAnswer(null);
    try {
      const res = await apiFetch('/api/ai/compare-quotes', {
        method: 'POST',
        body: JSON.stringify({ requestId: activeRfq.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiCompareAnswer(`${data.answer}\n\nNote: ${data.disclaimer}`);
    } catch (e: any) {
      showNotice('error', e.message || 'AI quotation comparison unavailable.');
    } finally {
      setAiCompareLoading(false);
    }
  };

  const handleSubmitManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalOrder) return;
    const res = await apiFetch('/api/payments/submit-manual', {
      method: 'POST',
      body: JSON.stringify({
        orderId: payModalOrder.id,
        method: payMethod,
        referenceNumber: payRef,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error);
      return;
    }
    showNotice('success', data.message);
    setPayModalOrder(null);
    setPayRef('');
    loadWorkspaceData();
  };

  const handleCheckRazorpay = async (orderId: number) => {
    const res = await apiFetch('/api/payments/create-razorpay-order', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error);
      return;
    }
    showNotice('success', `Razorpay Order Ready: ${data.razorpayOrder?.id}`);
  };

  const navTabs: Array<{ id: AppView; label: string }> = [
    { id: 'customer-dashboard', label: 'Overview' },
    { id: 'customer-projects', label: `${t('projects')} (${projects.length})` },
    { id: 'customer-lists', label: `${t('materialLists')} (${lists.length})` },
    { id: 'compare-quotations', label: `${t('compareQuotations')} (${requests.length})` },
    { id: 'customer-orders', label: `${t('orders')} (${orders.length})` },
    { id: 'customer-notifications', label: t('notifications') },
    { id: 'customer-profile', label: t('profileSettings') },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Workspace Header + Subnav */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-[#EA580C] uppercase tracking-wider">
            {user.activeRole} Workspace
          </p>
          <h1 className="font-display text-2xl font-bold text-[#0F2942] mt-0.5">
            Welcome, {user.fullName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user.roles.includes('super_admin') && (
            <button
              type="button"
              onClick={() => setView('admin-dashboard')}
              className="px-3.5 py-2 text-xs font-semibold text-[#0F2942] bg-white border border-slate-300 rounded-md cursor-pointer"
            >
              Open Admin Console
            </button>
          )}
          {user.roles.includes('supplier') && (
            <button
              type="button"
              onClick={() => setView('supplier-dashboard')}
              className="px-3.5 py-2 text-xs font-semibold text-[#0F2942] bg-white border border-slate-300 rounded-md cursor-pointer"
            >
              Open Supplier Dashboard
            </button>
          )}
          <button
            type="button"
            onClick={() => setView('builder')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-md cursor-pointer"
          >
            + Create Material List
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="mt-4 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === tab.id ||
              (activeTab === 'customer-quotations' && tab.id === 'compare-quotations')
                ? 'bg-[#0F2942] text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {loading && <p className="text-xs text-slate-500">{t('loading')}</p>}

        {/* DASHBOARD OVERVIEW */}
        {activeTab === 'customer-dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Active Projects', value: projects.length, target: 'customer-projects' as AppView },
                { label: 'Saved Material Lists', value: lists.length, target: 'customer-lists' as AppView },
                { label: 'Quote Requests Sent', value: requests.length, target: 'compare-quotations' as AppView },
                { label: 'Confirmed Orders', value: orders.length, target: 'customer-orders' as AppView },
              ].map((stat) => (
                <button
                  key={stat.label}
                  type="button"
                  onClick={() => setView(stat.target)}
                  className="text-left bg-white border border-slate-200 rounded-lg p-5 hover:border-[#0F2942] transition-colors cursor-pointer"
                >
                  <p className="text-xs text-slate-500">{stat.label}</p>
                  <p className="font-mono-num text-2xl font-bold text-[#0F2942] mt-1">
                    {stat.value}
                  </p>
                </button>
              ))}
            </div>

            {adminBootstrapAvailable && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-sm font-bold text-[#0F2942]">
                    First-Run Platform Setup: Claim Super Admin Role
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    No Super Admin has been initialized yet. Claim Super Admin privileges to verify shops and manage the catalogue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await apiFetch('/api/auth/claim-admin', { method: 'POST' });
                    if (res.ok) {
                      await refreshProfile();
                      showNotice('success', 'Super Admin access enabled.');
                      setView('admin-dashboard');
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2942] rounded-md shrink-0 cursor-pointer"
                >
                  Claim Super Admin
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-base font-bold text-[#0F2942]">
                    Recent Projects
                  </h2>
                  <button
                    type="button"
                    onClick={() => setView('customer-projects')}
                    className="text-xs font-semibold text-[#EA580C] cursor-pointer"
                  >
                    Manage All →
                  </button>
                </div>
                {projects.length === 0 ? (
                  <p className="text-xs text-slate-500">No projects yet. Create your first construction or renovation project.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {projects.slice(0, 4).map((p) => (
                      <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-[#0F2942]">{p.projectName}</p>
                          <p className="text-slate-500">
                            {p.buildingType} · {p.city}, {p.state}
                          </p>
                        </div>
                        <span className="font-medium text-slate-700">{p.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-base font-bold text-[#0F2942]">
                    Recent Orders
                  </h2>
                  <button
                    type="button"
                    onClick={() => setView('customer-orders')}
                    className="text-xs font-semibold text-[#EA580C] cursor-pointer"
                  >
                    Track Orders →
                  </button>
                </div>
                {orders.length === 0 ? (
                  <p className="text-xs text-slate-500">No orders placed yet. Request quotes from verified shops to get started.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {orders.slice(0, 4).map((o) => (
                      <div key={o.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-mono-num font-semibold text-[#0F2942]">
                            {o.orderNumber}
                          </p>
                          <p className="text-slate-500">{o.supplierName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono-num font-bold text-[#0F2942]">
                            {formatINR(o.grandTotal)}
                          </p>
                          <p className="text-slate-500">{o.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PROJECTS CRUD */}
        {activeTab === 'customer-projects' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#0F2942]">
                My Construction &amp; MEP Projects
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingProjectId(null);
                  setProjForm({
                    projectName: '',
                    customerName: user.fullName,
                    contactNumber: user.mobile || '',
                    siteAddress: '',
                    city: 'Chennai',
                    state: 'Tamil Nadu',
                    pinCode: '600001',
                    buildingType: 'New House Construction',
                    numFloors: 2,
                    approxAreaSqft: 1400,
                    description: '',
                    status: 'Planning',
                  });
                  setProjModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#163A5C] rounded-md inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create Project
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {projects.map((p) => (
                <div key={p.id} className="bg-white border border-slate-200 rounded-lg p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500">
                        {p.buildingType} · {p.numFloors} Floor(s) · {p.approxAreaSqft} sq.ft
                      </p>
                      <h3 className="font-display text-base font-bold text-[#0F2942] mt-1">
                        {p.projectName}
                      </h3>
                    </div>
                    <span className="text-xs font-semibold text-[#EA580C]">{p.status}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    {p.siteAddress}, {p.city}, {p.state} - {p.pinCode}
                  </p>
                  {p.description && (
                    <p className="text-xs text-slate-500 mt-1">{p.description}</p>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProjectId(p.id);
                        setProjForm({
                          projectName: p.projectName,
                          customerName: p.customerName,
                          contactNumber: p.contactNumber,
                          siteAddress: p.siteAddress,
                          city: p.city,
                          state: p.state,
                          pinCode: p.pinCode,
                          buildingType: p.buildingType,
                          numFloors: p.numFloors,
                          approxAreaSqft: p.approxAreaSqft,
                          description: p.description || '',
                          status: p.status,
                        });
                        setProjModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateProject(p.id)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(p.id)}
                      className="px-2.5 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MATERIAL LISTS */}
        {activeTab === 'customer-lists' && (
          <div className="space-y-4">
            {lists.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
                <p className="text-sm text-slate-600">No saved material lists yet.</p>
                <button
                  type="button"
                  onClick={() => setView('builder')}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
                >
                  Open Material List Builder
                </button>
              </div>
            ) : (
              lists.map((l) => (
                <div
                  key={l.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="font-display text-base font-bold text-[#0F2942]">
                      {l.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {l.items.length} items · Est. Grand Total:{' '}
                      <span className="font-mono-num font-bold text-[#0F2942]">
                        {formatINR(l.totals.grandTotal)}
                      </span>{' '}
                      (Estimated Catalogue Price)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      loadItemsIntoDraft(l.items, l.name);
                      setView('builder');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2942] rounded-md cursor-pointer"
                  >
                    Open in Builder
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* QUOTATION COMPARISON & SUPPLIER QUOTES */}
        {(activeTab === 'compare-quotations' || activeTab === 'customer-quotations') && (
          <div className="space-y-6">
            {requests.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
                <p className="text-sm text-slate-600">
                  You haven&apos;t sent any quotation requests to suppliers yet.
                </p>
                <button
                  type="button"
                  onClick={() => setView('builder')}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
                >
                  Build List &amp; Send to Shops
                </button>
              </div>
            ) : (
              <>
                <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <label htmlFor="rfq-select" className="text-xs font-semibold text-[#0F2942]">
                      Select Request:
                    </label>
                    <select
                      id="rfq-select"
                      value={activeRfq?.id ?? ''}
                      onChange={(e) => setSelectedRfqId(Number(e.target.value))}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-md bg-slate-50"
                    >
                      {requests.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.requestNumber} — {r.title} ({r.quotations.length} quote(s))
                        </option>
                      ))}
                    </select>
                  </div>

                  {activeRfq && activeRfq.quotations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAiCompare}
                        disabled={aiCompareLoading}
                        className="px-3.5 py-2 text-xs font-semibold text-[#0F2942] bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
                        {aiCompareLoading ? 'Analyzing...' : 'AI Explain Quote Differences'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSplitMode((m) => !m)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer ${
                          splitMode
                            ? 'bg-[#EA580C] text-white'
                            : 'bg-white border border-slate-300 text-[#0F2942]'
                        }`}
                      >
                        {splitMode ? 'Exit Split Order Mode' : 'Split Order Across Suppliers'}
                      </button>
                    </div>
                  )}
                </div>

                {aiCompareAnswer && (
                  <div className="bg-white border border-slate-200 rounded-lg p-5 text-xs text-slate-700 whitespace-pre-line">
                    <p className="font-display font-bold text-[#0F2942] mb-2">
                      AI Quotation Comparison Analysis
                    </p>
                    {aiCompareAnswer}
                  </div>
                )}

                {activeRfq && (
                  <div className="space-y-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-600 flex flex-wrap gap-x-6 gap-y-2">
                      <span>
                        RFQ: <strong className="font-mono-num text-[#0F2942]">{activeRfq.requestNumber}</strong>
                      </span>
                      <span>
                        Delivery: {activeRfq.deliveryAddress}, {activeRfq.city} - {activeRfq.pinCode}
                      </span>
                      <span>
                        Invited Shops: {activeRfq.suppliers.map((s: any) => s.shopName).join(', ')}
                      </span>
                    </div>

                    {activeRfq.quotations.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-600">
                        Waiting for verified suppliers to submit their confirmed quotations.
                      </div>
                    ) : (
                      <>
                        {/* Side-by-Side Comparison Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {activeRfq.quotations.map((q: any) => {
                            const isLowestComparable = q.id === lowestComparableId;
                            return (
                              <div
                                key={q.id}
                                className={`bg-white border rounded-lg p-5 flex flex-col justify-between ${
                                  isLowestComparable ? 'border-emerald-600 ring-1 ring-emerald-600/20' : 'border-slate-200'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="font-mono-num text-slate-500">
                                      {q.quotationNumber}
                                    </span>
                                    <span className="font-semibold capitalize text-[#0F2942]">
                                      {q.status.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <h3 className="font-display text-lg font-bold text-[#0F2942] mt-1">
                                    {q.supplierName}
                                  </h3>
                                  <p className="text-xs text-slate-500">{q.supplierCity}</p>

                                  {isLowestComparable && (
                                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                                      Lowest Comparable Total (verify brands &amp; delivery terms before selecting)
                                    </p>
                                  )}

                                  <dl className="mt-4 space-y-1.5 text-xs border-t border-slate-100 pt-3">
                                    <div className="flex justify-between">
                                      <dt className="text-slate-500">Subtotal</dt>
                                      <dd className="font-mono-num">{formatINR(q.subtotal)}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                      <dt className="text-slate-500">GST</dt>
                                      <dd className="font-mono-num">{formatINR(q.gstTotal)}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                      <dt className="text-slate-500">Delivery</dt>
                                      <dd className="font-mono-num">{formatINR(q.deliveryCharges)}</dd>
                                    </div>
                                    <div className="flex justify-between font-bold text-sm text-[#0F2942] pt-1.5 border-t border-slate-100">
                                      <dt>Confirmed Total</dt>
                                      <dd className="font-mono-num">{formatINR(q.grandTotal)}</dd>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                                      <dt>Delivery Lead Time</dt>
                                      <dd>{q.estimatedDeliveryDays} days</dd>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-slate-500">
                                      <dt>Valid Until</dt>
                                      <dd>{q.validUntil}</dd>
                                    </div>
                                  </dl>

                                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                                    <p className="text-[11px] font-semibold text-slate-600 uppercase">
                                      Itemized Breakdown
                                    </p>
                                    {(q.items || []).map((qi: any) => (
                                      <div key={qi.id} className="text-[11px] flex justify-between gap-2">
                                        <span className="text-slate-700 truncate">
                                          {qi.productName} ({qi.brandOffered}) · {qi.availableQty}/{qi.requestedQty} {qi.unit}
                                        </span>
                                        <span className="font-mono-num shrink-0 font-medium">
                                          {formatINR(qi.lineTotal)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <label className="text-[11px] text-slate-600">Payment:</label>
                                    <select
                                      value={paymentMethodChoice}
                                      onChange={(e) => setPaymentMethodChoice(e.target.value)}
                                      className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50"
                                    >
                                      <option value="Cash on Delivery">Cash on Delivery</option>
                                      <option value="UPI">UPI</option>
                                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                                      <option value="Razorpay">Online Payment (Razorpay)</option>
                                    </select>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={q.status === 'rejected'}
                                    onClick={() => handlePlaceOrderFromQuote(q.id)}
                                    className="w-full py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 rounded-md cursor-pointer"
                                  >
                                    Accept &amp; Place Order
                                  </button>

                                  <div className="grid grid-cols-3 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadSupplierQuotePdf(q.id, q.quotationNumber)}
                                      className="py-1.5 text-[11px] font-medium text-[#0F2942] border border-slate-200 rounded inline-flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <Download className="w-3 h-3" /> PDF
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleQuoteAction(
                                          q.id,
                                          'clarify',
                                          'Please confirm exact brand warranty and GST invoice timing.'
                                        )
                                      }
                                      className="py-1.5 text-[11px] font-medium text-slate-700 border border-slate-200 rounded inline-flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <MessageSquare className="w-3 h-3" /> Clarify
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuoteAction(q.id, 'reject')}
                                      className="py-1.5 text-[11px] font-medium text-red-700 border border-red-200 rounded cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Split Material Order Table */}
                        {splitMode && (
                          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                            <h3 className="font-display text-base font-bold text-[#0F2942]">
                              Split Order Allocation by Line Item
                            </h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                                    <th className="py-2 pr-3">Requested Material</th>
                                    {activeRfq.quotations.map((q: any) => (
                                      <th key={q.id} className="py-2 px-3">
                                        {q.supplierName}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {(activeRfq.itemsSnapshotJson || []).map((reqItem: any, idx: number) => (
                                    <tr key={idx}>
                                      <td className="py-2.5 pr-3 font-medium text-[#0F2942]">
                                        {reqItem.productName} ({reqItem.quantity} {reqItem.unit})
                                      </td>
                                      {activeRfq.quotations.map((q: any) => {
                                        const qi = (q.items || []).find(
                                          (item: any) => item.requestItemIndex === idx
                                        );
                                        return (
                                          <td key={q.id} className="py-2.5 px-3">
                                            {qi ? (
                                              <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  name={`split-${idx}`}
                                                  checked={splitSelections[idx] === q.id}
                                                  onChange={() =>
                                                    setSplitSelections((prev) => ({
                                                      ...prev,
                                                      [idx]: q.id,
                                                    }))
                                                  }
                                                />
                                                <span className="font-mono-num">
                                                  {formatINR(qi.lineTotal)} ({qi.brandOffered})
                                                </span>
                                              </label>
                                            ) : (
                                              <span className="text-slate-400">N/A</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {splitSummary && (
                              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200">
                                <span className="text-xs text-slate-700">
                                  Allocated across {splitSummary.groups.length} shop(s) · Combined Total (incl. GST &amp; delivery):{' '}
                                  <strong className="font-mono-num text-[#0F2942]">
                                    {formatINR(splitSummary.combinedGrandTotal)}
                                  </strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={handlePlaceSplitOrder}
                                  className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
                                >
                                  Confirm Split Orders
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ORDERS & PAYMENTS */}
        {activeTab === 'customer-orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-600">
                No orders yet. Accept a supplier quotation to place an order.
              </div>
            ) : (
              orders.map((ord) => (
                <div key={ord.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-100">
                    <div>
                      <p className="font-mono-num text-sm font-bold text-[#0F2942]">
                        {ord.orderNumber}
                      </p>
                      <p className="text-xs text-slate-600">
                        Supplier: {ord.supplierName} ({ord.supplierCity}) · {ord.supplierMobile}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Deliver to: {ord.deliveryAddress}, {ord.city}, {ord.state} - {ord.pinCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-num text-lg font-bold text-[#0F2942]">
                        {formatINR(ord.grandTotal)}
                      </p>
                      <p className="text-xs font-semibold text-[#EA580C]">
                        Status: {ord.status} · Payment: {ord.paymentStatus} ({ord.paymentMethod})
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="text-xs divide-y divide-slate-100">
                    {(ord.items || []).map((it: any) => (
                      <div key={it.id} className="py-1.5 flex justify-between gap-3">
                        <span>
                          {it.productName} ({it.brand}) × {it.quantity} {it.unit}
                        </span>
                        <span className="font-mono-num font-medium">{formatINR(it.lineTotal)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Delivery & Payment Actions */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-slate-600">
                      {ord.delivery && (
                        <span>
                          Delivery: {ord.delivery.status}
                          {ord.delivery.carrierName ? ` · Carrier: ${ord.delivery.carrierName}` : ''}
                          {ord.delivery.trackingNumber ? ` · Tracking: ${ord.delivery.trackingNumber}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ord.paymentStatus !== 'Paid' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setPayModalOrder(ord)}
                            className="px-3 py-1.5 font-semibold text-white bg-[#0F2942] rounded cursor-pointer"
                          >
                            Submit UPI / Bank Ref
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCheckRazorpay(ord.id)}
                            className="px-3 py-1.5 font-semibold text-[#0F2942] border border-slate-300 rounded cursor-pointer"
                          >
                            Pay via Razorpay
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setComplaintOrderId(ord.id)}
                        className="px-3 py-1.5 text-slate-600 border border-slate-200 rounded cursor-pointer"
                      >
                        Report Issue
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* NOTIFICATIONS */}
        {activeTab === 'customer-notifications' && (
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 flex items-start justify-between gap-4 ${
                    n.isRead ? 'bg-white' : 'bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold text-[#0F2942]">{n.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
                        reloadNotifications();
                      }}
                      className="text-xs font-semibold text-[#EA580C] cursor-pointer"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* PROFILE SETTINGS */}
        {activeTab === 'customer-profile' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-lg space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0F2942]">
              {t('profileSettings')}
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={profName}
                onChange={(e) => setProfName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number</label>
              <input
                type="text"
                value={profMobile}
                onChange={(e) => setProfMobile(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} disabled={!l.available}>
                    {l.nativeLabel}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={async () => {
                const res = await apiFetch('/api/auth/profile', {
                  method: 'PATCH',
                  body: JSON.stringify({ fullName: profName, mobile: profMobile, preferredLanguage: language }),
                });
                if (res.ok) {
                  await refreshProfile();
                  showNotice('success', 'Profile preferences saved.');
                }
              }}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F2942] rounded-md cursor-pointer"
            >
              Save Profile Settings
            </button>
          </div>
        )}
      </div>

      {/* Project Create/Edit Modal */}
      {projModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingProjectId ? 'Edit Project' : 'Create Project'}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveProject}
            className="bg-white rounded-lg max-w-xl w-full p-6 border border-slate-200 space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="font-display text-lg font-bold text-[#0F2942]">
              {editingProjectId ? 'Edit Project' : 'Create New Project'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={projForm.projectName}
                onChange={(e) => setProjForm({ ...projForm, projectName: e.target.value })}
                placeholder="Project Name *"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <select
                value={projForm.buildingType}
                onChange={(e) => setProjForm({ ...projForm, buildingType: e.target.value })}
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              >
                {PROJECT_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={projForm.customerName}
                onChange={(e) => setProjForm({ ...projForm, customerName: e.target.value })}
                placeholder="Customer / Owner Name"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <input
                type="text"
                required
                value={projForm.contactNumber}
                onChange={(e) => setProjForm({ ...projForm, contactNumber: e.target.value })}
                placeholder="Contact Number"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
            </div>
            <input
              type="text"
              required
              value={projForm.siteAddress}
              onChange={(e) => setProjForm({ ...projForm, siteAddress: e.target.value })}
              placeholder="Site Address *"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={projForm.city}
                onChange={(e) => setProjForm({ ...projForm, city: e.target.value })}
                placeholder="City"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <select
                value={projForm.state}
                onChange={(e) => setProjForm({ ...projForm, state: e.target.value })}
                className="px-2 py-2 text-xs border border-slate-200 rounded-md"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                value={projForm.pinCode}
                onChange={(e) => setProjForm({ ...projForm, pinCode: e.target.value })}
                placeholder="PIN Code"
                className="px-3 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={1}
                value={projForm.numFloors}
                onChange={(e) => setProjForm({ ...projForm, numFloors: Number(e.target.value) })}
                placeholder="Floors"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <input
                type="number"
                min={100}
                value={projForm.approxAreaSqft}
                onChange={(e) => setProjForm({ ...projForm, approxAreaSqft: Number(e.target.value) })}
                placeholder="Approx Sq.ft"
                className="px-3 py-2 text-xs border border-slate-200 rounded-md"
              />
              <select
                value={projForm.status}
                onChange={(e) => setProjForm({ ...projForm, status: e.target.value })}
                className="px-2 py-2 text-xs border border-slate-200 rounded-md"
              >
                <option value="Planning">Planning</option>
                <option value="Quoting">Quoting</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <textarea
              rows={2}
              value={projForm.description}
              onChange={(e) => setProjForm({ ...projForm, description: e.target.value })}
              placeholder="Project notes..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProjModalOpen(false)}
                className="px-4 py-2 text-xs border border-slate-300 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
              >
                Save Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manual Payment Reference Modal */}
      {payModalOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSubmitManualPayment}
            className="bg-white rounded-lg max-w-md w-full p-6 border border-slate-200 space-y-4"
          >
            <h3 className="font-display text-base font-bold text-[#0F2942]">
              Submit Payment Reference — {payModalOrder.orderNumber}
            </h3>
            <p className="text-xs text-slate-600">
              Amount: <strong className="font-mono-num">{formatINR(payModalOrder.grandTotal)}</strong>. Your payment status remains Awaiting Confirmation until verified by the supplier or admin.
            </p>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
            >
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
            </select>
            <input
              type="text"
              required
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="Enter UTR / UPI Transaction Reference ID *"
              className="w-full px-3 py-2 text-xs font-mono-num border border-slate-200 rounded-md"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayModalOrder(null)}
                className="px-4 py-2 text-xs border border-slate-300 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2942] rounded-md cursor-pointer"
              >
                Submit Reference
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Complaint Modal */}
      {complaintOrderId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await apiFetch('/api/complaints', {
                method: 'POST',
                body: JSON.stringify({
                  orderId: complaintOrderId,
                  subject: complaintSubject,
                  description: complaintDesc,
                }),
              });
              if (res.ok) {
                showNotice('success', 'Complaint submitted to BuildMate support.');
                setComplaintOrderId(null);
                setComplaintSubject('');
                setComplaintDesc('');
              }
            }}
            className="bg-white rounded-lg max-w-md w-full p-6 border border-slate-200 space-y-3"
          >
            <h3 className="font-display text-base font-bold text-[#0F2942]">Report Order Issue</h3>
            <input
              type="text"
              required
              value={complaintSubject}
              onChange={(e) => setComplaintSubject(e.target.value)}
              placeholder="Subject *"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
            />
            <textarea
              rows={3}
              required
              value={complaintDesc}
              onChange={(e) => setComplaintDesc(e.target.value)}
              placeholder="Describe the quantity, brand, or delivery issue..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComplaintOrderId(null)}
                className="px-4 py-2 text-xs border border-slate-300 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded-md cursor-pointer"
              >
                Submit Complaint
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
