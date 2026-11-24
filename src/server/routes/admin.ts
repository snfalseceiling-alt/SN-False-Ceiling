import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  auditLogs,
  brands,
  categories,
  complaints,
  notifications,
  orders,
  platformSettings,
  products,
  profiles,
  projects,
  quotationRequests,
  quotations,
  supplierDocuments,
  supplierProfiles,
} from '../../db/schema.ts';
import { AuthRequest, requireAuth, requireRole } from '../auth.ts';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(['super_admin']));

adminRouter.get('/overview', async (_req, res) => {
  try {
    const [
      allProfiles,
      allSuppliers,
      allProducts,
      allProjects,
      allRequests,
      allQuotations,
      allOrders,
      allComplaints,
    ] = await Promise.all([
      db.select().from(profiles),
      db.select().from(supplierProfiles),
      db.select().from(products),
      db.select().from(projects),
      db.select().from(quotationRequests),
      db.select().from(quotations),
      db.select().from(orders),
      db.select().from(complaints),
    ]);

    const verifiedSuppliers = allSuppliers.filter(
      (s) => s.verificationStatus === 'verified'
    ).length;
    const totalRevenue = allOrders
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + o.grandTotal, 0);

    // Group orders by month
    const monthlyMap = new Map<string, { month: string; orders: number; revenue: number }>();
    for (const o of allOrders) {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyMap.get(key) || { month: key, orders: 0, revenue: 0 };
      existing.orders += 1;
      if (o.status !== 'Cancelled') existing.revenue += o.grandTotal;
      monthlyMap.set(key, existing);
    }

    res.json({
      analytics: {
        totalCustomers: allProfiles.filter((p) => p.activeRole !== 'supplier').length,
        totalSuppliers: allSuppliers.length,
        verifiedSuppliers,
        pendingSuppliers: allSuppliers.filter((s) => s.verificationStatus === 'pending').length,
        totalProducts: allProducts.length,
        totalProjects: allProjects.length,
        totalRequests: allRequests.length,
        totalQuotations: allQuotations.length,
        totalOrders: allOrders.length,
        openComplaints: allComplaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed').length,
        totalRevenue,
        monthlyOrderGrowth: Array.from(monthlyMap.values()).sort((a, b) =>
          a.month.localeCompare(b.month)
        ),
      },
    });
  } catch (error) {
    console.error('Admin overview failed:', error);
    res.status(500).json({ error: 'Unable to load admin analytics.' });
  }
});

adminRouter.get('/users', async (_req, res) => {
  try {
    const rows = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
    res.json({
      users: rows.map((u) => ({
        id: u.id,
        uid: u.uid,
        email: u.email,
        mobile: u.mobile,
        fullName: u.fullName,
        activeRole: u.activeRole,
        preferredLanguage: u.preferredLanguage,
        isVerified: u.isVerified,
        isSuspended: u.isSuspended,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error('Failed to list users:', error);
    res.status(500).json({ error: 'Unable to fetch users.' });
  }
});

adminRouter.patch('/users/:id/status', async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { isSuspended, isVerified } = req.body || {};
    const [updated] = await db
      .update(profiles)
      .set({
        isSuspended: isSuspended !== undefined ? Boolean(isSuspended) : undefined,
        isVerified: isVerified !== undefined ? Boolean(isVerified) : undefined,
      })
      .where(eq(profiles.id, userId))
      .returning();
    if (!updated) return res.status(404).json({ error: 'User not found.' });

    await db.insert(auditLogs).values({
      actorId: req.profile!.id,
      actorEmail: req.profile!.email,
      action: 'UPDATE_USER_STATUS',
      entityType: 'profile',
      entityId: String(userId),
      details: `isSuspended=${updated.isSuspended}, isVerified=${updated.isVerified}`,
    });

    res.json({ user: updated });
  } catch (error) {
    console.error('Failed to update user:', error);
    res.status(500).json({ error: 'Unable to update user status.' });
  }
});

adminRouter.get('/suppliers', async (_req, res) => {
  try {
    const sups = await db
      .select()
      .from(supplierProfiles)
      .orderBy(desc(supplierProfiles.createdAt));
    const docs = await db.select().from(supplierDocuments);

    res.json({
      suppliers: sups.map((s) => ({
        ...s,
        documents: docs.filter((d) => d.supplierId === s.id),
      })),
    });
  } catch (error) {
    console.error('Failed to load suppliers for admin:', error);
    res.status(500).json({ error: 'Unable to load suppliers.' });
  }
});

adminRouter.patch('/suppliers/:id/verify', async (req: AuthRequest, res) => {
  try {
    const supplierId = Number(req.params.id);
    const { verificationStatus } = req.body || {};
    if (!['verified', 'rejected', 'suspended', 'pending'].includes(verificationStatus)) {
      return res.status(400).json({ error: 'Invalid verification status.' });
    }

    const [updated] = await db
      .update(supplierProfiles)
      .set({
        verificationStatus,
        verifiedAt: verificationStatus === 'verified' ? new Date() : null,
        verifiedBy: req.profile!.id,
      })
      .where(eq(supplierProfiles.id, supplierId))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Supplier not found.' });

    await db.insert(notifications).values({
      profileId: updated.profileId,
      type: 'supplier_verification',
      title: `Shop Verification: ${verificationStatus.toUpperCase()}`,
      message:
        verificationStatus === 'verified'
          ? `Congratulations! ${updated.shopName} is now verified to receive quotation requests.`
          : `Your shop verification status was updated to ${verificationStatus}.`,
      linkView: 'supplier-dashboard',
    });

    await db.insert(auditLogs).values({
      actorId: req.profile!.id,
      actorEmail: req.profile!.email,
      action: 'VERIFY_SUPPLIER',
      entityType: 'supplier_profile',
      entityId: String(supplierId),
      details: `${updated.shopName} -> ${verificationStatus}`,
    });

    res.json({ supplier: updated });
  } catch (error) {
    console.error('Failed to verify supplier:', error);
    res.status(500).json({ error: 'Unable to update supplier verification.' });
  }
});

adminRouter.post('/categories', async (req: AuthRequest, res) => {
  try {
    const { domain, name, description } = req.body || {};
    if (!domain || !name) return res.status(400).json({ error: 'Domain and name required.' });
    const slug = `${domain}-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const [cat] = await db
      .insert(categories)
      .values({ domain, name: String(name).trim(), slug, description: description || '' })
      .returning();
    res.status(201).json({ category: cat });
  } catch (error) {
    console.error('Create category failed:', error);
    res.status(500).json({ error: 'Unable to create category.' });
  }
});

adminRouter.post('/brands', async (req: AuthRequest, res) => {
  try {
    const { name, domain, country } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Brand name required.' });
    const [brand] = await db
      .insert(brands)
      .values({ name: String(name).trim(), domain: domain || 'both', country: country || 'India' })
      .returning();
    res.status(201).json({ brand });
  } catch (error) {
    console.error('Create brand failed:', error);
    res.status(500).json({ error: 'Unable to create brand.' });
  }
});

adminRouter.post('/products', async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !b.categoryId || !b.brandId || !b.unit || !b.sku || !b.estimatedPrice) {
      return res.status(400).json({ error: 'Product name, category, brand, unit, SKU, and estimated price are required.' });
    }
    const [prod] = await db
      .insert(products)
      .values({
        domain: String(b.domain || 'electrical'),
        categoryId: Number(b.categoryId),
        brandId: Number(b.brandId),
        name: String(b.name).trim(),
        imageUrl: String(b.imageUrl || '/src/assets/images/cat_electrical_gear_1795494379339.jpg'),
        description: String(b.description || ''),
        specification: String(b.specification || ''),
        size: b.size ? String(b.size) : '',
        diameter: b.diameter ? String(b.diameter) : '',
        unit: String(b.unit),
        sku: String(b.sku).trim(),
        gstRate: Number(b.gstRate ?? 18),
        estimatedPrice: Number(b.estimatedPrice),
        isActive: true,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorId: req.profile!.id,
      actorEmail: req.profile!.email,
      action: 'CREATE_CATALOG_PRODUCT',
      entityType: 'product',
      entityId: String(prod.id),
      details: `${prod.sku} - ${prod.name}`,
    });

    res.status(201).json({ product: prod });
  } catch (error) {
    console.error('Create product failed:', error);
    res.status(500).json({ error: 'Unable to create product. Ensure SKU is unique.' });
  }
});

adminRouter.put('/products/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const [updated] = await db
      .update(products)
      .set({
        name: b.name ? String(b.name).trim() : undefined,
        specification: b.specification !== undefined ? String(b.specification) : undefined,
        estimatedPrice: b.estimatedPrice !== undefined ? Number(b.estimatedPrice) : undefined,
        gstRate: b.gstRate !== undefined ? Number(b.gstRate) : undefined,
        isActive: b.isActive !== undefined ? Boolean(b.isActive) : undefined,
      })
      .where(eq(products.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: updated });
  } catch (error) {
    console.error('Update product failed:', error);
    res.status(500).json({ error: 'Unable to update product.' });
  }
});

adminRouter.delete('/products/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.update(products).set({ isActive: false }).where(eq(products.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Deactivate product failed:', error);
    res.status(500).json({ error: 'Unable to remove product.' });
  }
});

adminRouter.get('/quotations', async (_req, res) => {
  try {
    const reqs = await db
      .select()
      .from(quotationRequests)
      .orderBy(desc(quotationRequests.createdAt));
    const quotes = await db
      .select()
      .from(quotations)
      .orderBy(desc(quotations.createdAt));
    res.json({ requests: reqs, quotations: quotes });
  } catch (error) {
    console.error('Failed to fetch admin quotations:', error);
    res.status(500).json({ error: 'Unable to load quotations.' });
  }
});

adminRouter.get('/orders', async (_req, res) => {
  try {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    res.json({ orders: allOrders });
  } catch (error) {
    console.error('Failed to fetch admin orders:', error);
    res.status(500).json({ error: 'Unable to load orders.' });
  }
});

adminRouter.get('/complaints', async (_req, res) => {
  try {
    const rows = await db.select().from(complaints).orderBy(desc(complaints.createdAt));
    res.json({ complaints: rows });
  } catch (error) {
    console.error('Failed to fetch complaints:', error);
    res.status(500).json({ error: 'Unable to load complaints.' });
  }
});

adminRouter.patch('/complaints/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, resolutionNotes } = req.body || {};
    const [updated] = await db
      .update(complaints)
      .set({
        status: status ? String(status) : undefined,
        resolutionNotes: resolutionNotes !== undefined ? String(resolutionNotes) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(complaints.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Complaint not found.' });

    await db.insert(auditLogs).values({
      actorId: req.profile!.id,
      actorEmail: req.profile!.email,
      action: 'RESOLVE_COMPLAINT',
      entityType: 'complaint',
      entityId: String(id),
      details: `status=${updated.status}`,
    });

    res.json({ complaint: updated });
  } catch (error) {
    console.error('Failed to update complaint:', error);
    res.status(500).json({ error: 'Unable to update complaint.' });
  }
});

adminRouter.get('/audit-logs', async (_req, res) => {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
    res.json({ logs });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    res.status(500).json({ error: 'Unable to load audit logs.' });
  }
});

adminRouter.get('/settings', async (_req, res) => {
  try {
    const rows = await db.select().from(platformSettings);
    res.json({ settings: rows });
  } catch (error) {
    console.error('Failed to load settings:', error);
    res.status(500).json({ error: 'Unable to load platform settings.' });
  }
});

adminRouter.put('/settings', async (req: AuthRequest, res) => {
  try {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ error: 'Setting key required.' });
    const [saved] = await db
      .insert(platformSettings)
      .values({ key: String(key), value: String(value ?? ''), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: String(value ?? ''), updatedAt: new Date() },
      })
      .returning();

    await db.insert(auditLogs).values({
      actorId: req.profile!.id,
      actorEmail: req.profile!.email,
      action: 'UPDATE_PLATFORM_SETTING',
      entityType: 'platform_settings',
      entityId: String(key),
      details: `${key}=${value}`,
    });

    res.json({ setting: saved });
  } catch (error) {
    console.error('Failed to update setting:', error);
    res.status(500).json({ error: 'Unable to save platform setting.' });
  }
});
