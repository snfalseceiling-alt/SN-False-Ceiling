import { Router } from 'express';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { ensureSeeded } from '../../db/seed.ts';
import {
  brands,
  categories,
  materialTemplates,
  products,
  supplierProducts,
  supplierProfiles,
} from '../../db/schema.ts';
import { resolveAuthFromRequest } from '../auth.ts';

export const catalogRouter = Router();

catalogRouter.get('/catalog', async (req, res) => {
  try {
    await ensureSeeded();
    const domain = typeof req.query.domain === 'string' ? req.query.domain : undefined;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const catRows = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(categories.domain, categories.sortOrder);

    const brandRows = await db
      .select()
      .from(brands)
      .where(eq(brands.isActive, true))
      .orderBy(brands.name);

    const conditions = [eq(products.isActive, true)];
    if (domain === 'electrical' || domain === 'plumbing') {
      conditions.push(eq(products.domain, domain));
    }
    if (categoryId && Number.isFinite(categoryId)) {
      conditions.push(eq(products.categoryId, categoryId));
    }
    if (brandId && Number.isFinite(brandId)) {
      conditions.push(eq(products.brandId, brandId));
    }
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(products.name, pattern),
          ilike(products.description, pattern),
          ilike(products.specification, pattern),
          ilike(products.sku, pattern)
        )!
      );
    }

    const catMap = new Map(catRows.map((c) => [c.id, c.name]));
    const brandMap = new Map(brandRows.map((b) => [b.id, b.name]));

    const prodRows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(products.domain, products.id);

    const enrichedProducts = prodRows.map((p) => ({
      ...p,
      categoryName: catMap.get(p.categoryId) || 'General',
      brandName: brandMap.get(p.brandId) || 'Standard',
    }));

    res.json({
      categories: catRows,
      brands: brandRows,
      products: enrichedProducts,
    });
  } catch (error) {
    console.error('Failed to load catalog:', error);
    res.status(500).json({ error: 'Unable to load material catalogue right now.' });
  }
});

catalogRouter.get('/suppliers', async (req, res) => {
  try {
    await ensureSeeded();
    const pinCode = typeof req.query.pinCode === 'string' ? req.query.pinCode.trim() : '';
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const state = typeof req.query.state === 'string' ? req.query.state.trim() : '';
    const domain = typeof req.query.domain === 'string' ? req.query.domain.trim() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const verifiedOnly = req.query.verified !== 'false';

    const conditions = [];
    if (verifiedOnly) {
      conditions.push(eq(supplierProfiles.verificationStatus, 'verified'));
    }
    if (pinCode) {
      const p = `%${pinCode}%`;
      conditions.push(
        or(
          ilike(supplierProfiles.pinCode, p),
          ilike(supplierProfiles.serviceAreas, p)
        )!
      );
    }
    if (city) {
      const c = `%${city}%`;
      conditions.push(
        or(ilike(supplierProfiles.city, c), ilike(supplierProfiles.serviceAreas, c))!
      );
    }
    if (state) {
      conditions.push(ilike(supplierProfiles.state, `%${state}%`));
    }
    if (domain === 'electrical' || domain === 'plumbing') {
      conditions.push(ilike(supplierProfiles.productCategories, `%${domain}%`));
    }
    if (q) {
      const pat = `%${q}%`;
      conditions.push(
        or(
          ilike(supplierProfiles.shopName, pat),
          ilike(supplierProfiles.city, pat),
          ilike(supplierProfiles.serviceAreas, pat),
          ilike(supplierProfiles.shopDescription, pat)
        )!
      );
    }

    const rows =
      conditions.length > 0
        ? await db
            .select()
            .from(supplierProfiles)
            .where(and(...conditions))
            .orderBy(supplierProfiles.shopName)
        : await db.select().from(supplierProfiles).orderBy(supplierProfiles.shopName);

    // Expose only public-safe shop directory details (never private doc records)
    const publicSuppliers = rows.map((s) => ({
      id: s.id,
      shopName: s.shopName,
      city: s.city,
      state: s.state,
      pinCode: s.pinCode,
      businessAddress: s.businessAddress,
      serviceAreas: s.serviceAreas,
      productCategories: s.productCategories,
      shopDescription: s.shopDescription,
      shopImageUrl: s.shopImageUrl,
      verificationStatus: s.verificationStatus,
      latitude: s.latitude,
      longitude: s.longitude,
      gstinMasked: s.gstin ? `${s.gstin.slice(0, 4)}••••${s.gstin.slice(-3)}` : null,
    }));

    res.json({ suppliers: publicSuppliers });
  } catch (error) {
    console.error('Failed to search suppliers:', error);
    res.status(500).json({ error: 'Unable to load suppliers.' });
  }
});

catalogRouter.get('/suppliers/:id/products', async (req, res) => {
  try {
    await ensureSeeded();
    const supplierId = Number(req.params.id);
    if (!Number.isFinite(supplierId)) {
      return res.status(400).json({ error: 'Invalid supplier ID' });
    }
    const items = await db
      .select()
      .from(supplierProducts)
      .where(
        and(
          eq(supplierProducts.supplierId, supplierId),
          eq(supplierProducts.isAvailable, true)
        )
      )
      .orderBy(supplierProducts.domain, supplierProducts.customName);

    res.json({ products: items });
  } catch (error) {
    console.error('Failed to load supplier products:', error);
    res.status(500).json({ error: 'Unable to load supplier products.' });
  }
});

catalogRouter.get('/templates', async (req, res) => {
  try {
    await ensureSeeded();
    const profile = await resolveAuthFromRequest(req);
    const allTemplates = await db
      .select()
      .from(materialTemplates)
      .orderBy(desc(materialTemplates.createdAt));

    const visible = allTemplates.filter(
      (tpl) => tpl.isPublic || (profile && tpl.ownerId === profile.id)
    );
    res.json({ templates: visible });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    res.status(500).json({ error: 'Unable to load templates.' });
  }
});
