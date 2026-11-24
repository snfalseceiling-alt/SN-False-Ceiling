import { Router } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  deliveries,
  inventory,
  notifications,
  orderItems,
  orders,
  payments,
  profiles,
  quotationItems,
  quotationRequestSuppliers,
  quotationRequests,
  quotations,
  supplierDocuments,
  supplierProducts,
  supplierProfiles,
  userRoles,
} from '../../db/schema.ts';
import { AuthRequest, requireAuth } from '../auth.ts';
import { calculateQuotationTotals } from '../../lib/pricing.ts';

export const supplierRouter = Router();

async function getSupplierForProfile(profileId: number) {
  const rows = await db
    .select()
    .from(supplierProfiles)
    .where(eq(supplierProfiles.profileId, profileId))
    .limit(1);
  return rows[0] || null;
}

supplierRouter.get('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sup = await getSupplierForProfile(req.profile!.id);
    if (!sup) return res.json({ supplier: null, documents: [] });
    const docs = await db
      .select()
      .from(supplierDocuments)
      .where(eq(supplierDocuments.supplierId, sup.id));
    res.json({ supplier: sup, documents: docs });
  } catch (error) {
    console.error('Failed to load supplier profile:', error);
    res.status(500).json({ error: 'Unable to load supplier profile.' });
  }
});

supplierRouter.post('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.shopName || !b.ownerName || !b.mobile || !b.businessAddress || !b.city || !b.state || !b.pinCode) {
      return res.status(400).json({ error: 'Shop name, owner name, mobile, address, city, state, and PIN code are required.' });
    }

    const existing = await getSupplierForProfile(req.profile!.id);
    let supplierRecord;

    if (existing) {
      const [updated] = await db
        .update(supplierProfiles)
        .set({
          shopName: String(b.shopName).trim(),
          ownerName: String(b.ownerName).trim(),
          mobile: String(b.mobile).trim(),
          email: String(b.email || req.profile!.email).trim(),
          gstin: b.gstin ? String(b.gstin).trim().toUpperCase() : existing.gstin,
          businessAddress: String(b.businessAddress).trim(),
          city: String(b.city).trim(),
          state: String(b.state).trim(),
          pinCode: String(b.pinCode).trim(),
          serviceAreas: String(b.serviceAreas || `${b.city}, ${b.pinCode}`).trim(),
          productCategories: String(b.productCategories || 'electrical,plumbing').trim(),
          shopDescription: b.shopDescription ? String(b.shopDescription).trim() : existing.shopDescription,
        })
        .where(eq(supplierProfiles.id, existing.id))
        .returning();
      supplierRecord = updated;
    } else {
      const [created] = await db
        .insert(supplierProfiles)
        .values({
          profileId: req.profile!.id,
          shopName: String(b.shopName).trim(),
          ownerName: String(b.ownerName).trim(),
          mobile: String(b.mobile).trim(),
          email: String(b.email || req.profile!.email).trim(),
          gstin: b.gstin ? String(b.gstin).trim().toUpperCase() : null,
          businessAddress: String(b.businessAddress).trim(),
          city: String(b.city).trim(),
          state: String(b.state).trim(),
          pinCode: String(b.pinCode).trim(),
          serviceAreas: String(b.serviceAreas || `${b.city}, ${b.pinCode}`).trim(),
          productCategories: String(b.productCategories || 'electrical,plumbing').trim(),
          shopDescription: b.shopDescription ? String(b.shopDescription).trim() : '',
          verificationStatus: 'pending',
        })
        .returning();
      supplierRecord = created;

      // Ensure supplier role is attached
      const roleExists = await db
        .select()
        .from(userRoles)
        .where(
          and(
            eq(userRoles.profileId, req.profile!.id),
            eq(userRoles.role, 'supplier')
          )
        )
        .limit(1);
      if (!roleExists[0]) {
        await db.insert(userRoles).values({ profileId: req.profile!.id, role: 'supplier' });
      }
      await db
        .update(profiles)
        .set({ activeRole: 'supplier' })
        .where(eq(profiles.id, req.profile!.id));
    }

    if (b.docNumber && b.docType) {
      await db.insert(supplierDocuments).values({
        supplierId: supplierRecord.id,
        docType: String(b.docType),
        docNumber: String(b.docNumber).trim(),
        fileName: String(b.fileName || `${b.docType}-${b.docNumber}.pdf`),
        status: 'submitted',
      });
    }

    res.status(201).json({ supplier: supplierRecord });
  } catch (error) {
    console.error('Failed to save supplier profile:', error);
    res.status(500).json({ error: 'Unable to save shop profile.' });
  }
});

supplierRouter.get('/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sup = await getSupplierForProfile(req.profile!.id);
    if (!sup) {
      return res.json({
        supplier: null,
        metrics: {
          totalProducts: 0,
          activeProducts: 0,
          incomingRequests: 0,
          submittedQuotations: 0,
          pendingOrders: 0,
          completedOrders: 0,
          totalRevenue: 0,
        },
      });
    }

    const prods = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.supplierId, sup.id));
    const reqLinks = await db
      .select()
      .from(quotationRequestSuppliers)
      .where(eq(quotationRequestSuppliers.supplierId, sup.id));
    const quotes = await db
      .select()
      .from(quotations)
      .where(eq(quotations.supplierId, sup.id));
    const ordRows = await db
      .select()
      .from(orders)
      .where(eq(orders.supplierId, sup.id));

    const completed = ordRows.filter((o) => o.status === 'Delivered');
    const pending = ordRows.filter(
      (o) => o.status !== 'Delivered' && o.status !== 'Cancelled'
    );
    const totalRevenue = ordRows
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + o.grandTotal, 0);

    res.json({
      supplier: sup,
      metrics: {
        totalProducts: prods.length,
        activeProducts: prods.filter((p) => p.isAvailable).length,
        incomingRequests: reqLinks.length,
        submittedQuotations: quotes.filter((q) => q.status !== 'draft').length,
        pendingOrders: pending.length,
        completedOrders: completed.length,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error('Supplier dashboard error:', error);
    res.status(500).json({ error: 'Unable to load supplier dashboard.' });
  }
});

supplierRouter.get('/products', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sup = await getSupplierForProfile(req.profile!.id);
    if (!sup) return res.json({ products: [] });

    const prods = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.supplierId, sup.id))
      .orderBy(desc(supplierProducts.updatedAt));
    res.json({ products: prods });
  } catch (error) {
    console.error('Failed to load supplier products:', error);
    res.status(500).json({ error: 'Unable to load products.' });
  }
});

supplierRouter.post('/products', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sup = await getSupplierForProfile(req.profile!.id);
    if (!sup) return res.status(400).json({ error: 'Complete your shop profile first.' });

    const b = req.body || {};
    if (!b.customName || !b.brandName || !b.unit || !b.unitPrice) {
      return res.status(400).json({ error: 'Product name, brand, unit, and unit price are required.' });
    }

    const stockQty = Math.max(0, Number(b.stockQty) || 0);
    const [created] = await db
      .insert(supplierProducts)
      .values({
        supplierId: sup.id,
        productId: b.productId ? Number(b.productId) : null,
        domain: String(b.domain || 'electrical'),
        categoryName: String(b.categoryName || 'General'),
        customName: String(b.customName).trim(),
        brandName: String(b.brandName).trim(),
        specification: String(b.specification || 'Standard specification').trim(),
        unit: String(b.unit).trim(),
        unitPrice: Math.max(0, Number(b.unitPrice)),
        gstRate: Math.max(0, Math.min(28, Number(b.gstRate ?? 18))),
        stockQty,
        isAvailable: b.isAvailable !== false,
        imageUrl: b.imageUrl ? String(b.imageUrl) : null,
      })
      .returning();

    await db.insert(inventory).values({
      supplierProductId: created.id,
      quantityOnHand: stockQty,
      reorderLevel: 10,
    });

    res.status(201).json({ product: created });
  } catch (error) {
    console.error('Failed to add supplier product:', error);
    res.status(500).json({ error: 'Unable to add product.' });
  }
});

supplierRouter.put('/products/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sup = await getSupplierForProfile(req.profile!.id);
    if (!sup) return res.status(403).json({ error: 'Supplier profile required.' });

    const spId = Number(req.params.id);
    const existing = await db
      .select()
      .from(supplierProducts)
      .where(and(eq(supplierProducts.id, spId), eq(supplierProducts.supplierId, sup.id)))
      .limit(1);
    if (!existing[0]) return res.status(404).json({ error: 'Product not found.' });

    const b = req.body || {};
    const nextStock = b.stockQty !== undefined ? Math.max(0, Number(b.stockQty)) : existing[0].stockQty;
    const [updated] = await db
      .update(supplierProducts)
      .set({
        customName: b.customName ? String(b.customName).trim() : existing[0].customName,
        brandName: b.brandName ? String(b.brandName).trim() : existing[0].brandName,
        specification: b.specification !== undefined ? String(b.specification).trim() : existing[0].specification,
        unit: b.unit ? String(b.unit).trim() : existing[0].unit,
        unitPrice: b.unitPrice !== undefined ? Math.max(0, Number(b.unitPrice)) : existing[0].unitPrice,
        gstRate: b.gstRate !== undefined ? Math.max(0, Math.min(28, Number(b.gstRate))) : existing[0].gstRate,
        stockQty: nextStock,
        isAvailable: b.isAvailable !== undefined ? Boolean(b.isAvailable) : existing[0].isAvailable,
        updatedAt: new Date(),
      })
      .where(eq(supplierProducts.id, spId))
      .returning();

    await db
      .update(inventory)
      .set({ quantityOnHand: nextStock, lastRestockedAt: new Date() })
      .where(eq(inventory.supplierProductId, spId));

    res.json({ product: updated });
  } catch (error) {
    console.error('Failed to update supplier product:', error);
    res.status(500).json({ error: 'Unable to update product.' });
  }
});

supplierRouter.delete('/products/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sup = await getSupplierForProfile(req.profile!.id);
    if (!sup) return res.status(403).json({ error: 'Supplier profile required.' });
    const spId = Number(req.params.id);
    const deleted = await db
      .delete(supplierProducts)
      .where(and(eq(supplierProducts.id, spId), eq(supplierProducts.supplierId, sup.id)))
      .returning();
    if (!deleted[0]) return res.status(404).json({ error: 'Product not found.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete supplier product:', error);
    res.status(500).json({ error: 'Unable to delete product.' });
  }
});

// ---------- INCOMING QUOTE REQUESTS & SUBMITTING QUOTATIONS ----------
supplierRouter.get('/requests', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sup = await getSupplierForProfile(req.profile!.id);
    if (!sup) return res.json({ requests: [], verificationStatus: null });

    const links = await db
      .select()
      .from(quotationRequestSuppliers)
      .where(eq(quotationRequestSuppliers.supplierId, sup.id))
      .orderBy(desc(quotationRequestSuppliers.notifiedAt));

    if (links.length === 0) {
      return res.json({ requests: [], verificationStatus: sup.verificationStatus });
    }

    const reqIds = links.map((l) => l.requestId);
    const rfqs = await db
      .select()
      .from(quotationRequests)
      .where(inArray(quotationRequests.id, reqIds));

    // Only fetch THIS supplier's own quotations (never expose rival suppliers' quotes)
    const ownQuotes = await db
      .select()
      .from(quotations)
      .where(
        and(eq(quotations.supplierId, sup.id), inArray(quotations.requestId, reqIds))
      );

    const ownQuoteIds = ownQuotes.map((q) => q.id);
    const ownQuoteItems =
      ownQuoteIds.length > 0
        ? await db
            .select()
            .from(quotationItems)
            .where(inArray(quotationItems.quotationId, ownQuoteIds))
        : [];

    const customerIds = Array.from(new Set(rfqs.map((r) => r.customerId)));
    const custProfiles =
      customerIds.length > 0
        ? await db.select().from(profiles).where(inArray(profiles.id, customerIds))
        : [];
    const custMap = new Map(custProfiles.map((c) => [c.id, c]));

    const enriched = links
      .map((l) => {
        const rfq = rfqs.find((r) => r.id === l.requestId);
        if (!rfq) return null;
        const quote = ownQuotes.find((q) => q.requestId === rfq.id) || null;
        const cust = custMap.get(rfq.customerId);
        return {
          linkId: l.id,
          linkStatus: l.status,
          ...rfq,
          customerName: cust?.fullName || 'BuildMate Customer',
          customerCity: rfq.city,
          ownQuotation: quote
            ? {
                ...quote,
                items: ownQuoteItems.filter((qi) => qi.quotationId === quote.id),
              }
            : null,
        };
      })
      .filter(Boolean);

    res.json({ requests: enriched, verificationStatus: sup.verificationStatus });
  } catch (error) {
    console.error('Failed to load supplier requests:', error);
    res.status(500).json({ error: 'Unable to load incoming quote requests.' });
  }
});

supplierRouter.post('/quotations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sup = await getSupplierForProfile(req.profile!.id);
    if (!sup) return res.status(403).json({ error: 'Supplier profile required.' });
    if (sup.verificationStatus !== 'verified') {
      return res.status(403).json({
        error: 'Your shop must be verified by a BuildMate Administrator before submitting quotations.',
      });
    }

    const b = req.body || {};
    const requestId = Number(b.requestId);
    const status = b.status === 'draft' ? 'draft' : 'submitted';
    const items: any[] = Array.isArray(b.items) ? b.items : [];
    if (!requestId || items.length === 0) {
      return res.status(400).json({ error: 'Request ID and quotation items are required.' });
    }

    // Ensure supplier was invited to this RFQ
    const linkRows = await db
      .select()
      .from(quotationRequestSuppliers)
      .where(
        and(
          eq(quotationRequestSuppliers.requestId, requestId),
          eq(quotationRequestSuppliers.supplierId, sup.id)
        )
      )
      .limit(1);
    if (!linkRows[0]) {
      return res.status(403).json({ error: 'You are not assigned to this quotation request.' });
    }

    const rfqRows = await db
      .select()
      .from(quotationRequests)
      .where(eq(quotationRequests.id, requestId))
      .limit(1);
    const rfq = rfqRows[0];
    if (!rfq) return res.status(404).json({ error: 'Quotation request not found.' });

    const deliveryCharges = Math.max(0, Number(b.deliveryCharges) || 0);
    const totals = calculateQuotationTotals(
      items.map((i) => ({
        productName: String(i.productName),
        unit: String(i.unit || 'Nos'),
        quantity: Math.max(0, Number(i.availableQty) || 0),
        unitPrice: Math.max(0, Number(i.unitPrice) || 0),
        gstRate: Math.max(0, Math.min(28, Number(i.gstRate ?? 18))),
      })),
      deliveryCharges
    );

    const existingQuote = await db
      .select()
      .from(quotations)
      .where(
        and(eq(quotations.requestId, requestId), eq(quotations.supplierId, sup.id))
      )
      .limit(1);

    let savedQuote;
    if (existingQuote[0]) {
      const [updated] = await db
        .update(quotations)
        .set({
          status,
          deliveryCharges: totals.deliveryCharges,
          estimatedDeliveryDays: Math.max(1, Number(b.estimatedDeliveryDays) || 3),
          validUntil: String(b.validUntil || '14 days'),
          notes: b.notes ? String(b.notes) : '',
          terms: b.terms ? String(b.terms) : '',
          subtotal: totals.subtotal,
          gstTotal: totals.gstTotal,
          grandTotal: totals.grandTotal,
          updatedAt: new Date(),
        })
        .where(eq(quotations.id, existingQuote[0].id))
        .returning();
      savedQuote = updated;

      await db
        .delete(quotationItems)
        .where(eq(quotationItems.quotationId, savedQuote.id));
    } else {
      const quotationNumber = `BM-QT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;
      const [created] = await db
        .insert(quotations)
        .values({
          quotationNumber,
          requestId,
          supplierId: sup.id,
          status,
          deliveryCharges: totals.deliveryCharges,
          estimatedDeliveryDays: Math.max(1, Number(b.estimatedDeliveryDays) || 3),
          validUntil: String(b.validUntil || '14 days'),
          notes: b.notes ? String(b.notes) : '',
          terms: b.terms ? String(b.terms) : '',
          subtotal: totals.subtotal,
          gstTotal: totals.gstTotal,
          grandTotal: totals.grandTotal,
        })
        .returning();
      savedQuote = created;
    }

    await db.insert(quotationItems).values(
      items.map((item, idx) => ({
        quotationId: savedQuote.id,
        requestItemIndex: idx,
        productName: String(item.productName),
        categoryName: String(item.categoryName || 'General'),
        brandOffered: String(item.brandOffered || 'Standard'),
        specification: String(item.specification || ''),
        availableQty: Math.max(0, Number(item.availableQty) || 0),
        requestedQty: Math.max(0, Number(item.requestedQty) || 0),
        unit: String(item.unit || 'Nos'),
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        gstRate: Math.max(0, Math.min(28, Number(item.gstRate ?? 18))),
        lineSubtotal: totals.items[idx]?.lineSubtotal ?? 0,
        lineGst: totals.items[idx]?.lineGst ?? 0,
        lineTotal: totals.items[idx]?.lineTotal ?? 0,
        isAlternative: Boolean(item.isAlternative),
        alternativeDetails: item.alternativeDetails ? String(item.alternativeDetails) : null,
      }))
    );

    if (status === 'submitted') {
      await db
        .update(quotationRequestSuppliers)
        .set({ status: 'quoted', viewedAt: new Date() })
        .where(eq(quotationRequestSuppliers.id, linkRows[0].id));

      await db
        .update(quotationRequests)
        .set({ status: 'Quotation Received' })
        .where(eq(quotationRequests.id, requestId));

      await db.insert(notifications).values({
        profileId: rfq.customerId,
        type: 'quotation_received',
        title: `Quotation Received from ${sup.shopName}`,
        message: `${sup.shopName} submitted quotation ${savedQuote.quotationNumber} for INR ${totals.grandTotal.toFixed(2)}.`,
        linkView: 'compare-quotations',
      });
    }

    res.status(201).json({ quotation: savedQuote });
  } catch (error) {
    console.error('Failed to submit quotation:', error);
    res.status(500).json({ error: 'Unable to save quotation.' });
  }
});

// ---------- SUPPLIER ORDERS, DELIVERIES & PAYMENT CONFIRMATION ----------
supplierRouter.get('/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sup = await getSupplierForProfile(req.profile!.id);
    if (!sup) return res.json({ orders: [] });

    const ordRows = await db
      .select()
      .from(orders)
      .where(eq(orders.supplierId, sup.id))
      .orderBy(desc(orders.createdAt));

    if (ordRows.length === 0) return res.json({ orders: [] });

    const orderIds = ordRows.map((o) => o.id);
    const items = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));
    const delivs = await db
      .select()
      .from(deliveries)
      .where(inArray(deliveries.orderId, orderIds));
    const pays = await db
      .select()
      .from(payments)
      .where(inArray(payments.orderId, orderIds));

    const custIds = Array.from(new Set(ordRows.map((o) => o.customerId)));
    const custs = await db
      .select()
      .from(profiles)
      .where(inArray(profiles.id, custIds));
    const custMap = new Map(custs.map((c) => [c.id, c]));

    res.json({
      orders: ordRows.map((o) => ({
        ...o,
        customerName: custMap.get(o.customerId)?.fullName || 'Customer',
        customerMobile: custMap.get(o.customerId)?.mobile || 'On file',
        items: items.filter((i) => i.orderId === o.id),
        delivery: delivs.find((d) => d.orderId === o.id) || null,
        payments: pays.filter((p) => p.orderId === o.id),
      })),
    });
  } catch (error) {
    console.error('Failed to load supplier orders:', error);
    res.status(500).json({ error: 'Unable to load orders.' });
  }
});

supplierRouter.patch('/orders/:id/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sup = await getSupplierForProfile(req.profile!.id);
    if (!sup) return res.status(403).json({ error: 'Supplier profile required.' });

    const orderId = Number(req.params.id);
    const { status, carrierName, trackingNumber, driverPhone, estimatedDate, note } = req.body || {};

    const oRows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.supplierId, sup.id)))
      .limit(1);
    if (!oRows[0]) return res.status(404).json({ error: 'Order not found.' });

    const existingHistory = Array.isArray(oRows[0].historyJson)
      ? (oRows[0].historyJson as any[])
      : [];

    const nextHistory = [
      ...existingHistory,
      {
        status: String(status || oRows[0].status),
        at: new Date().toISOString(),
        note: note ? String(note) : `Updated by ${sup.shopName}`,
      },
    ];

    const [updated] = await db
      .update(orders)
      .set({
        status: String(status || oRows[0].status),
        historyJson: nextHistory,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    await db
      .update(deliveries)
      .set({
        status: String(status || 'Preparing'),
        carrierName: carrierName !== undefined ? String(carrierName) : undefined,
        trackingNumber: trackingNumber !== undefined ? String(trackingNumber) : undefined,
        driverPhone: driverPhone !== undefined ? String(driverPhone) : undefined,
        estimatedDate: estimatedDate !== undefined ? String(estimatedDate) : undefined,
        deliveredAt: status === 'Delivered' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.orderId, orderId));

    await db.insert(notifications).values({
      profileId: oRows[0].customerId,
      type: 'delivery_status',
      title: `Order ${oRows[0].orderNumber}: ${updated.status}`,
      message: `${sup.shopName} updated your order status to ${updated.status}.`,
      linkView: 'customer-orders',
    });

    res.json({ order: updated });
  } catch (error) {
    console.error('Failed to update order status:', error);
    res.status(500).json({ error: 'Unable to update order status.' });
  }
});

supplierRouter.patch('/payments/:id/confirm', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sup = await getSupplierForProfile(req.profile!.id);
    if (!sup && !req.profile!.roles.includes('super_admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const paymentId = Number(req.params.id);
    const pRows = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!pRows[0]) return res.status(404).json({ error: 'Payment record not found.' });

    const oRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, pRows[0].orderId))
      .limit(1);
    if (!oRows[0]) return res.status(404).json({ error: 'Order not found.' });

    if (sup && oRows[0].supplierId !== sup.id && !req.profile!.roles.includes('super_admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [updatedPayment] = await db
      .update(payments)
      .set({
        status: 'verified',
        confirmedBy: req.profile!.id,
        confirmedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
      .returning();

    await db
      .update(orders)
      .set({ paymentStatus: 'Paid', updatedAt: new Date() })
      .where(eq(orders.id, oRows[0].id));

    await db.insert(notifications).values({
      profileId: oRows[0].customerId,
      type: 'payment_confirmed',
      title: `Payment Confirmed for ${oRows[0].orderNumber}`,
      message: `Your ${pRows[0].method} payment of INR ${pRows[0].amount.toFixed(2)} has been verified.`,
      linkView: 'customer-orders',
    });

    res.json({ payment: updatedPayment });
  } catch (error) {
    console.error('Failed to confirm payment:', error);
    res.status(500).json({ error: 'Unable to confirm payment.' });
  }
});
