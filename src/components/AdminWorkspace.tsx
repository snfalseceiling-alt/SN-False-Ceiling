import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatINR } from '../lib/pricing';
import { MATERIAL_UNITS } from '../lib/catalogData';

type AdminTab =
  | 'overview'
  | 'suppliers'
  | 'users'
  | 'catalog'
  | 'orders'
  | 'complaints'
  | 'audit'
  | 'settings';

export function AdminWorkspace() {
  const { user, apiFetch, categories, brands, products, reloadCatalog, showNotice } = useApp();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [analytics, setAnalytics] = useState<any>({});
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');

  // New Product form
  const [newProd, setNewProd] = useState({
    domain: 'electrical',
    categoryId: categories[0]?.id || 1,
    brandId: brands[0]?.id || 1,
    name: '',
    sku: '',
    specification: '',
    unit: 'Nos',
    gstRate: 18,
    estimatedPrice: 500,
  });

  const [newCatName, setNewCatName] = useState('');
  const [newCatDomain, setNewCatDomain] = useState('electrical');
  const [newBrandName, setNewBrandName] = useState('');

  const loadAdmin = async () => {
    if (!user || !user.roles.includes('super_admin')) return;
    const [ov, sups, us, ords, qts, cmp, aud, setRes, intRes] = await Promise.all([
      apiFetch('/api/admin/overview'),
      apiFetch('/api/admin/suppliers'),
      apiFetch('/api/admin/users'),
      apiFetch('/api/admin/orders'),
      apiFetch('/api/admin/quotations'),
      apiFetch('/api/admin/complaints'),
      apiFetch('/api/admin/audit-logs'),
      apiFetch('/api/admin/settings'),
      fetch('/api/integrations/status'),
    ]);
    if (ov.ok) setAnalytics((await ov.json()).analytics || {});
    if (sups.ok) setSuppliers((await sups.json()).suppliers || []);
    if (us.ok) setUsers((await us.json()).users || []);
    if (ords.ok) setOrders((await ords.json()).orders || []);
    if (qts.ok) setQuotations((await qts.json()).quotations || []);
    if (cmp.ok) setComplaints((await cmp.json()).complaints || []);
    if (aud.ok) setAuditLogs((await aud.json()).logs || []);
    if (setRes.ok) setSettings((await setRes.json()).settings || []);
    if (intRes.ok) setIntegrations(await intRes.json());
  };

  useEffect(() => {
    loadAdmin();
  }, [user]);

  if (!user || !user.roles.includes('super_admin')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#0F2942]">Super Admin Access Required</h1>
        <p className="text-sm text-slate-600 mt-2">
          This area is restricted to authorized BuildMate Super Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="pb-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#EA580C]">
            Super Admin Console
          </p>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">
            BuildMate Platform Operations &amp; Governance
          </h1>
        </div>
        <input
          type="text"
          aria-label="Filter admin tables"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter records..."
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-md w-64"
        />
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
        {(
          [
            { id: 'overview', label: 'Analytics & Reports' },
            { id: 'suppliers', label: `Verify Suppliers (${suppliers.length})` },
            { id: 'users', label: `Users & Customers (${users.length})` },
            { id: 'catalog', label: `Catalogue, Categories & Brands (${products.length})` },
            { id: 'orders', label: `Quotations & Orders (${orders.length})` },
            { id: 'complaints', label: `Complaints (${complaints.length})` },
            { id: 'audit', label: 'Audit Logs' },
            { id: 'settings', label: 'Platform Settings' },
          ] as Array<{ id: AdminTab; label: string }>
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              tab === item.id
                ? 'bg-[#0F2942] text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Customers', val: analytics.totalCustomers ?? 0 },
                { label: 'Total Suppliers', val: analytics.totalSuppliers ?? 0 },
                { label: 'Verified Suppliers', val: analytics.verifiedSuppliers ?? 0 },
                { label: 'Total Products', val: analytics.totalProducts ?? 0 },
                { label: 'Total Projects', val: analytics.totalProjects ?? 0 },
                { label: 'Quotation Requests', val: analytics.totalRequests ?? 0 },
                { label: 'Submitted Quotations', val: analytics.totalQuotations ?? 0 },
                { label: 'Total Orders', val: analytics.totalOrders ?? 0 },
                { label: 'Open Complaints', val: analytics.openComplaints ?? 0 },
                { label: 'Platform Order GMV', val: formatINR(analytics.totalRevenue ?? 0) },
              ].map((m) => (
                <div key={m.label} className="bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-xs text-slate-500">{m.label}</p>
                  <p className="font-mono-num text-xl font-bold text-[#0F2942] mt-1">{m.val}</p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="font-display text-base font-bold text-[#0F2942] mb-3">
                Monthly Order Growth
              </h2>
              {(analytics.monthlyOrderGrowth || []).length === 0 ? (
                <p className="text-xs text-slate-500">Orders placed on the platform will populate monthly growth metrics here.</p>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                      <th className="py-2">Month</th>
                      <th className="py-2 text-right">Orders</th>
                      <th className="py-2 text-right">Order Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.monthlyOrderGrowth.map((m: any) => (
                      <tr key={m.month}>
                        <td className="py-2 font-mono-num">{m.month}</td>
                        <td className="py-2 text-right font-mono-num">{m.orders}</td>
                        <td className="py-2 text-right font-mono-num font-semibold">{formatINR(m.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === 'suppliers' && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                  <th className="py-2.5 px-4">Shop &amp; Owner</th>
                  <th className="py-2.5 px-3">Location &amp; GSTIN</th>
                  <th className="py-2.5 px-3">Documents</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers
                  .filter((s) =>
                    `${s.shopName} ${s.city} ${s.ownerName}`.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 px-4">
                        <p className="font-bold text-[#0F2942]">{s.shopName}</p>
                        <p className="text-[11px] text-slate-500">{s.ownerName} · {s.mobile} · {s.email}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p>{s.city}, {s.state} - {s.pinCode}</p>
                        <p className="font-mono-num text-[11px] text-slate-500">GSTIN: {s.gstin || 'N/A'}</p>
                      </td>
                      <td className="py-3 px-3">
                        {(s.documents || []).length === 0
                          ? 'No doc uploaded'
                          : s.documents.map((d: any) => `${d.docType} (${d.docNumber})`).join(', ')}
                      </td>
                      <td className="py-3 px-3 font-semibold capitalize">{s.verificationStatus}</td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/suppliers/${s.id}/verify`, {
                              method: 'PATCH',
                              body: JSON.stringify({ verificationStatus: 'verified' }),
                            });
                            showNotice('success', `Verified ${s.shopName}`);
                            loadAdmin();
                            reloadCatalog();
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-700 rounded cursor-pointer"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/suppliers/${s.id}/verify`, {
                              method: 'PATCH',
                              body: JSON.stringify({ verificationStatus: 'suspended' }),
                            });
                            showNotice('success', `Suspended ${s.shopName}`);
                            loadAdmin();
                            reloadCatalog();
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-red-700 border border-red-200 rounded cursor-pointer"
                        >
                          Suspend
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users
                  .filter((u) =>
                    `${u.fullName} ${u.email} ${u.activeRole}`.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-[#0F2942]">{u.fullName}</p>
                        <p className="text-[11px] text-slate-500">{u.email} · {u.mobile || 'No mobile'}</p>
                      </td>
                      <td className="py-2.5 px-3 capitalize">{u.activeRole}</td>
                      <td className="py-2.5 px-3">
                        {u.isSuspended ? 'Suspended' : u.isVerified ? 'Verified' : 'Active'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/users/${u.id}/status`, {
                              method: 'PATCH',
                              body: JSON.stringify({ isSuspended: !u.isSuspended }),
                            });
                            loadAdmin();
                          }}
                          className="px-2.5 py-1 text-[11px] border border-slate-300 rounded cursor-pointer"
                        >
                          {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'catalog' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await apiFetch('/api/admin/categories', {
                    method: 'POST',
                    body: JSON.stringify({ domain: newCatDomain, name: newCatName }),
                  });
                  if (res.ok) {
                    setNewCatName('');
                    showNotice('success', 'Category added.');
                    reloadCatalog();
                  }
                }}
                className="bg-white border border-slate-200 rounded-lg p-5 space-y-3"
              >
                <h2 className="font-display text-sm font-bold text-[#0F2942]">Add Material Category</h2>
                <div className="flex gap-2">
                  <select
                    value={newCatDomain}
                    onChange={(e) => setNewCatDomain(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-slate-200 rounded"
                  >
                    <option value="electrical">Electrical</option>
                    <option value="plumbing">Plumbing</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Category name"
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded"
                  />
                  <button type="submit" className="px-3 py-2 text-xs font-semibold text-white bg-[#0F2942] rounded cursor-pointer">
                    Add
                  </button>
                </div>
              </form>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await apiFetch('/api/admin/brands', {
                    method: 'POST',
                    body: JSON.stringify({ name: newBrandName, domain: 'both' }),
                  });
                  if (res.ok) {
                    setNewBrandName('');
                    showNotice('success', 'Brand added.');
                    reloadCatalog();
                  }
                }}
                className="bg-white border border-slate-200 rounded-lg p-5 space-y-3"
              >
                <h2 className="font-display text-sm font-bold text-[#0F2942]">Add Manufacturer Brand</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    placeholder="Brand name (e.g. Havells, Grundfos)"
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded"
                  />
                  <button type="submit" className="px-3 py-2 text-xs font-semibold text-white bg-[#0F2942] rounded cursor-pointer">
                    Add Brand
                  </button>
                </div>
              </form>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await apiFetch('/api/admin/products', {
                  method: 'POST',
                  body: JSON.stringify(newProd),
                });
                const data = await res.json();
                if (!res.ok) {
                  showNotice('error', data.error);
                  return;
                }
                showNotice('success', `Added catalogue product ${data.product.sku}`);
                setNewProd({ ...newProd, name: '', sku: '', specification: '' });
                reloadCatalog();
              }}
              className="bg-white border border-slate-200 rounded-lg p-5 space-y-3"
            >
              <h2 className="font-display text-sm font-bold text-[#0F2942]">Add Master Catalogue Product</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <select
                  value={newProd.domain}
                  onChange={(e) => setNewProd({ ...newProd, domain: e.target.value })}
                  className="px-2.5 py-2 text-xs border border-slate-200 rounded"
                >
                  <option value="electrical">Electrical</option>
                  <option value="plumbing">Plumbing</option>
                </select>
                <select
                  value={newProd.categoryId}
                  onChange={(e) => setNewProd({ ...newProd, categoryId: Number(e.target.value) })}
                  className="px-2.5 py-2 text-xs border border-slate-200 rounded"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={newProd.brandId}
                  onChange={(e) => setNewProd({ ...newProd, brandId: Number(e.target.value) })}
                  className="px-2.5 py-2 text-xs border border-slate-200 rounded"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={newProd.sku}
                  onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })}
                  placeholder="Unique SKU *"
                  className="px-2.5 py-2 text-xs font-mono-num border border-slate-200 rounded"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  required
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  placeholder="Product Name *"
                  className="sm:col-span-2 px-3 py-2 text-xs border border-slate-200 rounded"
                />
                <select
                  value={newProd.unit}
                  onChange={(e) => setNewProd({ ...newProd, unit: e.target.value })}
                  className="px-2.5 py-2 text-xs border border-slate-200 rounded"
                >
                  {MATERIAL_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <input
                  type="number"
                  required
                  value={newProd.estimatedPrice}
                  onChange={(e) => setNewProd({ ...newProd, estimatedPrice: Number(e.target.value) })}
                  placeholder="Est. Price (₹)"
                  className="px-3 py-2 text-xs font-mono-num border border-slate-200 rounded"
                />
              </div>
              <input
                type="text"
                value={newProd.specification}
                onChange={(e) => setNewProd({ ...newProd, specification: e.target.value })}
                placeholder="Technical Specification"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded"
              />
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] rounded cursor-pointer">
                Add Catalogue Product
              </button>
            </form>
          </div>
        )}

        {tab === 'orders' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="font-display text-sm font-bold text-[#0F2942] mb-3">
                Recent Orders ({orders.length})
              </h2>
              <div className="divide-y divide-slate-100 text-xs">
                {orders.map((o) => (
                  <div key={o.id} className="py-2.5 flex justify-between">
                    <div>
                      <p className="font-mono-num font-bold text-[#0F2942]">{o.orderNumber}</p>
                      <p className="text-slate-500">{o.city} · {o.status}</p>
                    </div>
                    <span className="font-mono-num font-semibold">{formatINR(o.grandTotal)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="font-display text-sm font-bold text-[#0F2942] mb-3">
                Supplier Quotations ({quotations.length})
              </h2>
              <div className="divide-y divide-slate-100 text-xs">
                {quotations.map((q) => (
                  <div key={q.id} className="py-2.5 flex justify-between">
                    <div>
                      <p className="font-mono-num font-bold text-[#0F2942]">{q.quotationNumber}</p>
                      <p className="text-slate-500">Status: {q.status}</p>
                    </div>
                    <span className="font-mono-num font-semibold">{formatINR(q.grandTotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'complaints' && (
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {complaints.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">No complaints filed.</p>
            ) : (
              complaints.map((c) => (
                <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-[#0F2942]">{c.subject} ({c.status})</p>
                    <p className="text-slate-600 mt-0.5">{c.description}</p>
                  </div>
                  {c.status !== 'Resolved' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/complaints/${c.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: 'Resolved', resolutionNotes: 'Resolved by BuildMate Admin' }),
                        });
                        loadAdmin();
                      }}
                      className="px-3 py-1.5 font-semibold text-white bg-emerald-700 rounded cursor-pointer"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 px-4 font-mono-num text-[11px] text-slate-500">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-3">{log.actorEmail}</td>
                    <td className="py-2 px-3 font-mono-num font-semibold text-[#0F2942]">{log.action}</td>
                    <td className="py-2 px-4 text-slate-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h2 className="font-display text-sm font-bold text-[#0F2942]">Platform Configuration</h2>
              {settings.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="font-mono-num text-slate-600">{s.key}</span>
                  <span className="font-semibold text-[#0F2942]">{s.value}</span>
                </div>
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
              <h2 className="font-display text-sm font-bold text-[#0F2942]">
                External Service Integrations (Environment Secrets)
              </h2>
              <p className="text-slate-600">
                Configure API credentials in server environment secrets (never in client code):
              </p>
              <ul className="space-y-2">
                <li>Gemini AI (`GEMINI_API_KEY`): <strong>{integrations.geminiConfigured ? 'Configured' : 'Not Configured'}</strong></li>
                <li>Razorpay (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`): <strong>{integrations.razorpayConfigured ? 'Configured' : 'Not Configured'}</strong></li>
                <li>WhatsApp Business Cloud API (`WHATSAPP_API_TOKEN`): <strong>{integrations.whatsappConfigured ? 'Configured' : 'Not Configured'}</strong></li>
                <li>Email Provider (`EMAIL_PROVIDER_API_KEY`): <strong>{integrations.emailConfigured ? 'Configured' : 'Not Configured'}</strong></li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
