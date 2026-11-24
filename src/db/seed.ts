import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  brands,
  categories,
  inventory,
  materialTemplates,
  platformSettings,
  productImages,
  products,
  profiles,
  supplierProducts,
  supplierProfiles,
  userRoles,
} from './schema.ts';
import {
  ELECTRICAL_CATEGORIES,
  PLUMBING_CATEGORIES,
  SEED_BRANDS,
  SEED_PRODUCTS,
  SEED_SUPPLIERS,
} from '../lib/catalogData.ts';

let seedPromise: Promise<void> | null = null;

function slugify(domain: string, name: string): string {
  return `${domain}-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error('Database seed failed:', err);
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const existingCat = await db.select({ value: count() }).from(categories);
  if ((existingCat[0]?.value ?? 0) > 0) {
    return;
  }

  // 1. Seed 20 Electrical + 20 Plumbing Categories
  const categoryMap = new Map<string, number>();

  for (let i = 0; i < ELECTRICAL_CATEGORIES.length; i++) {
    const name = ELECTRICAL_CATEGORIES[i];
    const [inserted] = await db
      .insert(categories)
      .values({
        domain: 'electrical',
        name,
        slug: slugify('electrical', name),
        sortOrder: i + 1,
        description: `Standard Indian electrical category for ${name}.`,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      categoryMap.set(`electrical:${name}`, inserted.id);
    }
  }

  for (let i = 0; i < PLUMBING_CATEGORIES.length; i++) {
    const name = PLUMBING_CATEGORIES[i];
    const [inserted] = await db
      .insert(categories)
      .values({
        domain: 'plumbing',
        name,
        slug: slugify('plumbing', name),
        sortOrder: i + 1,
        description: `Standard Indian plumbing category for ${name}.`,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      categoryMap.set(`plumbing:${name}`, inserted.id);
    }
  }

  // Ensure Precision brand exists too
  const allBrands = [
    ...SEED_BRANDS,
    { name: 'Precision', domain: 'electrical' as const },
  ];
  const brandMap = new Map<string, number>();

  for (const b of allBrands) {
    const [inserted] = await db
      .insert(brands)
      .values({
        name: b.name,
        domain: b.domain,
        country: 'India',
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      brandMap.set(b.name, inserted.id);
    } else {
      const existing = await db
        .select()
        .from(brands)
        .where(eq(brands.name, b.name))
        .limit(1);
      if (existing[0]) brandMap.set(b.name, existing[0].id);
    }
  }

  // 3. Seed Products
  const insertedProducts: Array<{
    id: number;
    domain: string;
    categoryName: string;
    brandName: string;
    name: string;
    specification: string;
    unit: string;
    gstRate: number;
    estimatedPrice: number;
    imageUrl: string;
  }> = [];

  for (const p of SEED_PRODUCTS) {
    const categoryId = categoryMap.get(`${p.domain}:${p.categoryName}`);
    const brandId = brandMap.get(p.brandName);
    if (!categoryId || !brandId) continue;

    const [inserted] = await db
      .insert(products)
      .values({
        domain: p.domain,
        categoryId,
        brandId,
        name: p.name,
        imageUrl: p.imageUrl,
        description: p.description,
        specification: p.specification,
        size: p.size,
        diameter: p.diameter,
        unit: p.unit,
        sku: p.sku,
        gstRate: p.gstRate,
        estimatedPrice: p.estimatedPrice,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      await db.insert(productImages).values({
        productId: inserted.id,
        imageUrl: p.imageUrl,
        isPrimary: true,
      });
      insertedProducts.push({
        id: inserted.id,
        domain: p.domain,
        categoryName: p.categoryName,
        brandName: p.brandName,
        name: p.name,
        specification: p.specification,
        unit: p.unit,
        gstRate: p.gstRate,
        estimatedPrice: p.estimatedPrice,
        imageUrl: p.imageUrl,
      });
    }
  }

  // 4. Seed Reference Suppliers (clearly marked as development seed suppliers)
  let firstOwnerId: number | null = null;
  for (let idx = 0; idx < SEED_SUPPLIERS.length; idx++) {
    const s = SEED_SUPPLIERS[idx];
    const [prof] = await db
      .insert(profiles)
      .values({
        uid: s.uid,
        email: s.email,
        mobile: s.mobile,
        fullName: s.fullName,
        preferredLanguage: idx === 0 ? 'ta' : 'en',
        activeRole: 'supplier',
        isVerified: true,
      })
      .onConflictDoNothing()
      .returning();

    if (!prof) continue;
    if (!firstOwnerId) firstOwnerId = prof.id;

    await db.insert(userRoles).values({ profileId: prof.id, role: 'supplier' });

    const [sup] = await db
      .insert(supplierProfiles)
      .values({
        profileId: prof.id,
        shopName: s.shopName,
        ownerName: s.ownerName,
        mobile: s.mobile,
        email: s.email,
        gstin: s.gstin,
        businessAddress: s.businessAddress,
        city: s.city,
        state: s.state,
        pinCode: s.pinCode,
        serviceAreas: s.serviceAreas,
        productCategories: s.productCategories,
        shopDescription: s.shopDescription,
        shopImageUrl: s.shopImageUrl,
        latitude: s.latitude,
        longitude: s.longitude,
        verificationStatus: 'verified',
        verifiedAt: new Date(),
      })
      .returning();

    // Populate supplier inventory for matching catalogue products
    for (let pIdx = 0; pIdx < insertedProducts.length; pIdx++) {
      if (pIdx % 2 !== idx % 2 && pIdx > 15) continue;
      const prod = insertedProducts[pIdx];
      const [sp] = await db
        .insert(supplierProducts)
        .values({
          supplierId: sup.id,
          productId: prod.id,
          domain: prod.domain,
          categoryName: prod.categoryName,
          customName: prod.name,
          brandName: prod.brandName,
          specification: prod.specification,
          unit: prod.unit,
          unitPrice: prod.estimatedPrice,
          gstRate: prod.gstRate,
          stockQty: 40 + ((pIdx * 7) % 60),
          isAvailable: true,
          imageUrl: prod.imageUrl,
        })
        .returning();

      await db.insert(inventory).values({
        supplierProductId: sp.id,
        quantityOnHand: sp.stockQty,
        reorderLevel: 10,
      });
    }
  }

  // 5. Seed Public Reusable Material List Templates
  if (firstOwnerId && insertedProducts.length >= 6) {
    await db.insert(materialTemplates).values([
      {
        ownerId: firstOwnerId,
        name: '2BHK Standard House — Electrical Rough-In & Wiring Starter',
        domain: 'electrical',
        description:
          'Reference starter template for a 2BHK residential unit. Verify exact coil and conduit counts against electrical drawings.',
        isPublic: true,
        itemsJson: insertedProducts
          .filter((p) => p.domain === 'electrical')
          .slice(0, 6)
          .map((p) => ({
            productId: p.id,
            domain: p.domain,
            categoryName: p.categoryName,
            productName: p.name,
            brand: p.brandName,
            specification: p.specification,
            unit: p.unit,
            quantity: 4,
            estimatedUnitPrice: p.estimatedPrice,
            gstRate: p.gstRate,
          })),
      },
      {
        ownerId: firstOwnerId,
        name: '2-Bathroom Residential Plumbing & CPVC Starter',
        domain: 'plumbing',
        description:
          'Reference starter template for 2 bathrooms + 1 kitchen supply & drainage. Verify lengths on site.',
        isPublic: true,
        itemsJson: insertedProducts
          .filter((p) => p.domain === 'plumbing')
          .slice(0, 6)
          .map((p) => ({
            productId: p.id,
            domain: p.domain,
            categoryName: p.categoryName,
            productName: p.name,
            brand: p.brandName,
            specification: p.specification,
            unit: p.unit,
            quantity: 6,
            estimatedUnitPrice: p.estimatedPrice,
            gstRate: p.gstRate,
          })),
      },
    ]);
  }

  // 6. Platform settings
  await db
    .insert(platformSettings)
    .values([
      { key: 'platform_name', value: 'BuildMate' },
      { key: 'default_gst_rate', value: '18' },
      { key: 'support_email', value: 'support@buildmate.in' },
      { key: 'support_phone', value: '+91-44-4000-8800' },
    ])
    .onConflictDoNothing();
}
