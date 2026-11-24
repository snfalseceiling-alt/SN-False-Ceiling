import { Router } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  auditLogs,
  deliveries,
  materialListItems,
  materialLists,
  materialTemplates,
  notifications,
  orderItems,
  orders,
  payments,
  projects,
  quotationItems,
  quotationRequestSuppliers,
  quotationRequests,
  quotations,
  reviews,
  supplierProfiles,
} from '../../db/schema.ts';
import { AuthRequest, requireAuth } from '../auth.ts';
import { calculateQuotationTotals } from '../../lib/pricing.ts';
import { generateQuotationPdfBuffer } from '../pdf.ts';

export const customerRouter = Router();

// ---------- PROJECTS ----------
customerRouter.get('/projects', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, req.profile!.id))
      .orderBy(desc(projects.updatedAt));
    res.json({ projects: rows });
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    res.status(500).json({ error: 'Unable to load projects.' });
  }
});

customerRouter.post('/projects', requireAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.projectName || !b.city || !b.state || !b.pinCode || !b.siteAddress) {
      return res.status(400).json({ error: 'Project name, site address, city, state, and PIN code are required.' });
    }
    const [created] = await db
      .insert(projects)
      .values({
        ownerId: req.profile!.id,
        projectName: String(b.projectName).trim(),
        customerName: String(b.customerName || req.profile!.fullName).trim(),
        contactNumber: String(b.contactNumber || req.profile!.mobile || '').trim(),
        siteAddress: String(b.siteAddress).trim(),
        city: String(b.city).trim(),
        state: String(b.state).trim(),
        pinCode: String(b.pinCode).trim(),
        buildingType: String(b.buildingType || 'New House Construction').trim(),
        numFloors: Math.max(1, Number(b.numFloors) || 1),
        approxAreaSqft: Math.max(100, Number(b.approxAreaSqft) || 1000),
        description: b.description ? String(b.description).trim() : '',
        status: String(b.status || 'Planning').trim(),
      })
      .returning();

    res.status(201).json({ project: created });
  } catch (error) {
    console.error('Failed to create project:', error);
    res.status(500).json({ error: 'Unable to create project.' });
  }
});

customerRouter.put('/projects/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const b = req.body || {};
    const existing = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, req.profile!.id)))
      .limit(1);
    if (!existing[0]) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const [updated] = await db
      .update(projects)
      .set({
        projectName: b.projectName ? String(b.projectName).trim() : existing[0].projectName,
        customerName: b.customerName ? String(b.customerName).trim() : existing[0].customerName,
        contactNumber: b.contactNumber !== undefined ? String(b.contactNumber).trim() : existing[0].contactNumber,
        siteAddress: b.siteAddress ? String(b.siteAddress).trim() : existing[0].siteAddress,
        city: b.city ? String(b.city).trim() : existing[0].city,
        state: b.state ? String(b.state).trim() : existing[0].state,
        pinCode: b.pinCode ? String(b.pinCode).trim() : existing[0].pinCode,
        buildingType: b.buildingType ? String(b.buildingType).trim() : existing[0].buildingType,
        numFloors: b.numFloors ? Math.max(1, Number(b.numFloors)) : existing[0].numFloors,
        approxAreaSqft: b.approxAreaSqft ? Math.max(100, Number(b.approxAreaSqft)) : existing[0].approxAreaSqft,
        description: b.description !== undefined ? String(b.description) : existing[0].description,
        status: b.status ? String(b.status) : existing[0].status,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    res.json({ project: updated });
  } catch (error) {
    console.error('Failed to update project:', error);
    res.status(500).json({ error: 'Unable to update project.' });
  }
});

customerRouter.post('/projects/:id/duplicate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const existing = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, req.profile!.id)))
      .limit(1);
    if (!existing[0]) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    const src = existing[0];
    const [copy] = await db
      .insert(projects)
      .values({
        ownerId: req.profile!.id,
        projectName: `${src.projectName} (Copy)`,
        customerName: src.customerName,
        contactNumber: src.contactNumber,
        siteAddress: src.siteAddress,
        city: src.city,
        state: src.state,
        pinCode: src.pinCode,
        buildingType: src.buildingType,
        numFloors: src.numFloors,
        approxAreaSqft: src.approxAreaSqft,
        description: src.description,
        status: 'Planning',
      })
      .returning();
    res.status(201).json({ project: copy });
  } catch (error) {
    console.error('Failed to duplicate project:', error);
    res.status(500).json({ error: 'Unable to duplicate project.' });
  }
});

customerRouter.delete('/projects/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const deleted = await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, req.profile!.id)))
      .returning();
    if (!deleted[0]) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    res.status(500).json({ error: 'Unable to delete project.' });
  }
});

// ---------- MATERIAL LISTS & TEMPLATES ----------
customerRouter.get('/material-lists', requireAuth, async (req: AuthRequest, res) => {
  try {
    const lists = await db
      .select()
      .from(materialLists)
      .where(eq(materialLists.ownerId, req.profile!.id))
      .orderBy(desc(materialLists.updatedAt));

    if (lists.length === 0) {
      return res.json({ lists: [] });
    }

    const listIds = lists.map((l) => l.id);
    const items = await db
      .select()
      .from(materialListItems)
      .where(inArray(materialListItems.materialListId, listIds));

    const enriched = lists.map((l) => {
      const listItems = items.filter((i) => i.materialListId === l.id);
      const totals = calculateQuotationTotals(
        listItems.map((i) => ({
          productName: i.productName,
          unit: i.unit,
          quantity: i.quantity,
          unitPrice: i.estimatedUnitPrice,
          gstRate: i.gstRate,
        })),
        l.deliveryEstimate
      );
      return {
        ...l,
        items: listItems,
        totals,
      };
    });

    res.json({ lists: enriched });
  } catch (error) {
    console.error('Failed to load material lists:', error);
    res.status(500).json({ error: 'Unable to load material lists.' });
  }
});

customerRouter.post('/material-lists', requireAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !Array.isArray(b.items) || b.items.length === 0) {
      return res.status(400).json({ error: 'Material list name and at least one item are required.' });
    }

    const [createdList] = await db
      .insert(materialLists)
      .values({
        ownerId: req.profile!.id,
        projectId: b.projectId ? Number(b.projectId) : null,
        name: String(b.name).trim(),
        status: String(b.status || 'saved'),
        deliveryEstimate: Math.max(0, Number(b.deliveryEstimate) || 0),
        notes: b.notes ? String(b.notes) : '',
      })
      .returning();

    const itemValues = b.items.map((item: any) => ({
      materialListId: createdList.id,
      productId: item.productId ? Number(item.productId) : null,
      isCustom: Boolean(item.isCustom),
      domain: String(item.domain || 'electrical'),
      categoryName: String(item.categoryName || 'General'),
      productName: String(item.productName || 'Unnamed Material').trim(),
      brand: String(item.brand || 'Any Brand').trim(),
      specification: String(item.specification || 'Standard').trim(),
      unit: String(item.unit || 'Nos').trim(),
      quantity: Math.max(0.01, Number(item.quantity) || 1),
      estimatedUnitPrice: Math.max(0, Number(item.estimatedUnitPrice) || 0),
      gstRate: Math.max(0, Math.min(28, Number(item.gstRate ?? 18))),
      notes: item.notes ? String(item.notes) : '',
    }));

    const insertedItems = await db
      .insert(materialListItems)
      .values(itemValues)
      .returning();

    res.status(201).json({ list: { ...createdList, items: insertedItems } });
  } catch (error) {
    console.error('Failed to save material list:', error);
    res.status(500).json({ error: 'Unable to save material list.' });
  }
});

customerRouter.delete('/material-lists/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listId = Number(req.params.id);
    const deleted = await db
      .delete(materialLists)
      .where(and(eq(materialLists.id, listId), eq(materialLists.ownerId, req.profile!.id)))
      .returning();
    if (!deleted[0]) {
      return res.status(404).json({ error: 'Material list not found.' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete material list:', error);
    res.status(500).json({ error: 'Unable to delete material list.' });
  }
});

customerRouter.post('/templates', requireAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !Array.isArray(b.items) || b.items.length === 0) {
      return res.status(400).json({ error: 'Template name and items are required.' });
    }
    const [tpl] = await db
      .insert(materialTemplates)
      .values({
        ownerId: req.profile!.id,
        name: String(b.name).trim(),
        domain: String(b.domain || 'both'),
        description: b.description ? String(b.description) : '',
        itemsJson: b.items,
        isPublic: false,
      })
      .returning();
    res.status(201).json({ template: tpl });
  } catch (error) {
    console.error('Failed to save template:', error);
    res.status(500).json({ error: 'Unable to save template.' });
  }
});

// ---------- PDF GENERATION FOR CUSTOMER PLANNING LIST ----------
customerRouter.post('/quotations/estimate-pdf', async (req, res) => {
  try {
    const b = req.body || {};
    const rawItems = Array.isArray(b.items) ? b.items : [];
    if (rawItems.length === 0) {
      return res.status(400).json({ error: 'Add at least one material item to generate a PDF.' });
    }

    const deliveryCharges = Math.max(0, Number(b.deliveryCharges) || 0);
    const totals = calculateQuotationTotals(
      rawItems.map((i: any) => ({
        productName: String(i.productName || 'Material'),
        categoryName: String(i.categoryName || 'General'),
        brand: String(i.brand || 'Standard'),
        specification: String(i.specification || ''),
        unit: String(i.unit || 'Nos'),
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.estimatedUnitPrice ?? i.unitPrice ?? 0),
        gstRate: Number(i.gstRate ?? 18),
      })),
      deliveryCharges
    );

    const quoteNum =
      String(b.quotationNumber || '') ||
      `BM-EST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const pdfBuffer = await generateQuotationPdfBuffer({
      quotationNumber: quoteNum,
      quotationDate: new Date().toLocaleDateString('en-IN'),
      priceClassification: 'ESTIMATED CATALOGUE PLANNING QUOTE',
      customerName: String(b.customerName || 'BuildMate Customer'),
      contactNumber: String(b.contactNumber || 'Provided on request'),
      projectName: String(b.projectName || 'Material Planning List'),
      projectAddress: String(b.projectAddress || 'India'),
      items: totals.items.map((i) => ({
        categoryName: i.categoryName || 'General',
        productName: i.productName,
        brand: i.brand || 'Standard',
        specification: i.specification || '',
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: i.unitPrice,
        gstRate: i.gstRate,
        lineTotal: i.lineTotal,
      })),
      subtotal: totals.subtotal,
      gstTotal: totals.gstTotal,
      deliveryCharges: totals.deliveryCharges,
      grandTotal: totals.grandTotal,
      notes: b.notes ? String(b.notes) : undefined,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quoteNum}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation failed:', error);
    res.status(500).json({ error: 'Unable to generate PDF quotation.' });
  }
});

// ---------- MULTI-SHOP QUOTATION REQUESTS ----------
customerRouter.get('/quotation-requests', requireAuth, async (req: AuthRequest, res) => {
  try {
    const reqs = await db
      .select()
      .from(quotationRequests)
      .where(eq(quotationRequests.customerId, req.profile!.id))
      .orderBy(desc(quotationRequests.createdAt));

    if (reqs.length === 0) return res.json({ requests: [] });

    const reqIds = reqs.map((r) => r.id);
    const links = await db
      .select()
      .from(quotationRequestSuppliers)
      .where(inArray(quotationRequestSuppliers.requestId, reqIds));

    const allSuppliers = await db.select().from(supplierProfiles);
    const supMap = new Map(allSuppliers.map((s) => [s.id, s]));

    const quoteRows = await db
      .select()
      .from(quotations)
      .where(inArray(quotations.requestId, reqIds));

    const quoteIds = quoteRows.map((q) => q.id);
    const qItems =
      quoteIds.length > 0
        ? await db
            .select()
            .from(quotationItems)
            .where(inArray(quotationItems.quotationId, quoteIds))
        : [];

    const enriched = reqs.map((r) => {
      const targetSuppliers = links
        .filter((l) => l.requestId === r.id)
        .map((l) => ({
          ...l,
          shopName: supMap.get(l.supplierId)?.shopName || 'Verified Shop',
          city: supMap.get(l.supplierId)?.city || '',
          state: supMap.get(l.supplierId)?.state || '',
        }));

      const receivedQuotes = quoteRows
        .filter((q) => q.requestId === r.id && q.status !== 'draft')
        .map((q) => ({
          ...q,
          supplierName: supMap.get(q.supplierId)?.shopName || 'Verified Supplier',
          supplierCity: supMap.get(q.supplierId)?.city || '',
          supplierGstin: supMap.get(q.supplierId)?.gstin || '',
          items: qItems.filter((qi) => qi.quotationId === q.id),
        }));

      return {
        ...r,
        suppliers: targetSuppliers,
        quotations: receivedQuotes,
      };
    });

    res.json({ requests: enriched });
  } catch (error) {
    console.error('Failed to fetch quotation requests:', error);
    res.status(500).json({ error: 'Unable to load quotation requests.' });
  }
});

customerRouter.post('/quotation-requests', requireAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    const supplierIds: number[] = Array.isArray(b.supplierIds)
      ? b.supplierIds.map(Number).filter(Number.isFinite)
      : [];
    const items: any[] = Array.isArray(b.items) ? b.items : [];

    if (supplierIds.length === 0) {
      return res.status(400).json({ error: 'Please select at least one verified supplier.' });
    }
    if (items.length === 0) {
      return res.status(400).json({ error: 'Material list cannot be empty.' });
    }
    if (!b.deliveryAddress || !b.city || !b.state || !b.pinCode) {
      return res.status(400).json({ error: 'Delivery address, city, state, and PIN code are required.' });
    }

    // Verify all selected suppliers are verified
    const selectedSuppliers = await db
      .select()
      .from(supplierProfiles)
      .where(
        and(
          inArray(supplierProfiles.id, supplierIds),
          eq(supplierProfiles.verificationStatus, 'verified')
        )
      );

    if (selectedSuppliers.length === 0) {
      return res.status(400).json({ error: 'No verified suppliers matched your selection.' });
    }

    const requestNumber = `BM-RFQ-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;

    const [createdReq] = await db
      .insert(quotationRequests)
      .values({
        requestNumber,
        customerId: req.profile!.id,
        projectId: b.projectId ? Number(b.projectId) : null,
        materialListId: b.materialListId ? Number(b.materialListId) : null,
        title: String(b.title || 'Electrical & Plumbing Material Request').trim(),
        deliveryAddress: String(b.deliveryAddress).trim(),
        city: String(b.city).trim(),
        state: String(b.state).trim(),
        pinCode: String(b.pinCode).trim(),
        requiredByDate: b.requiredByDate ? String(b.requiredByDate) : null,
        notes: b.notes ? String(b.notes) : '',
        itemsSnapshotJson: items,
        status: 'Request Submitted',
      })
      .returning();

    for (const sup of selectedSuppliers) {
      await db.insert(quotationRequestSuppliers).values({
        requestId: createdReq.id,
        supplierId: sup.id,
        status: 'pending',
      });

      await db.insert(notifications).values({
        profileId: sup.profileId,
        type: 'quote_request',
        title: `New Quote Request ${requestNumber}`,
        message: `${req.profile!.fullName} requested pricing for ${items.length} items in ${createdReq.city} (${createdReq.pinCode}).`,
        linkView: 'supplier-requests',
      });
    }

    await db.insert(auditLogs).values({
      actorId: req.profile!.id,
      actorEmail: req.profile!.email,
      action: 'CREATE_QUOTATION_REQUEST',
      entityType: 'quotation_request',
      entityId: String(createdReq.id),
      details: `Sent ${requestNumber} to ${selectedSuppliers.length} suppliers`,
    });

    res.status(201).json({ request: createdReq, notifiedCount: selectedSuppliers.length });
  } catch (error) {
    console.error('Failed to send quotation request:', error);
    res.status(500).json({ error: 'Unable to submit quotation request.' });
  }
});

// ---------- QUOTATION PDF (SUPPLIER CONFIRMED) ----------
customerRouter.get('/quotations/:id/pdf', requireAuth, async (req: AuthRequest, res) => {
  try {
    const quotationId = Number(req.params.id);
    const qRows = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, quotationId))
      .limit(1);
    if (!qRows[0]) return res.status(404).json({ error: 'Quotation not found.' });
    const quote = qRows[0];

    const reqRows = await db
      .select()
      .from(quotationRequests)
      .where(eq(quotationRequests.id, quote.requestId))
      .limit(1);
    const rfq = reqRows[0];
    if (!rfq) return res.status(404).json({ error: 'Parent request not found.' });

    // Enforce strict access: only owning customer, owning supplier, or super_admin
    const isCustomer = rfq.customerId === req.profile!.id;
    const isSupplier = req.profile!.supplierId === quote.supplierId;
    const isAdmin = req.profile!.roles.includes('super_admin');
    if (!isCustomer && !isSupplier && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const supRows = await db
      .select()
      .from(supplierProfiles)
      .where(eq(supplierProfiles.id, quote.supplierId))
      .limit(1);
    const sup = supRows[0];

    const items = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, quote.id));

    const pdfBuffer = await generateQuotationPdfBuffer({
      quotationNumber: quote.quotationNumber,
      quotationDate: new Date(quote.createdAt).toLocaleDateString('en-IN'),
      priceClassification: 'SUPPLIER-CONFIRMED QUOTATION',
      customerName: req.profile!.fullName,
      contactNumber: req.profile!.mobile || 'On file',
      projectName: rfq.title,
      projectAddress: `${rfq.deliveryAddress}, ${rfq.city}, ${rfq.state} - ${rfq.pinCode}`,
      supplierName: sup?.shopName,
      supplierGstin: sup?.gstin || 'Unregistered / Applied',
      supplierAddress: sup ? `${sup.businessAddress}, ${sup.city}` : undefined,
      estimatedDeliveryDays: quote.estimatedDeliveryDays,
      validUntil: quote.validUntil,
      items: items.map((i) => ({
        categoryName: i.categoryName,
        productName: i.productName,
        brand: i.brandOffered,
        specification: i.specification,
        quantity: i.availableQty,
        unit: i.unit,
        unitPrice: i.unitPrice,
        gstRate: i.gstRate,
        lineTotal: i.lineTotal,
      })),
      subtotal: quote.subtotal,
      gstTotal: quote.gstTotal,
      deliveryCharges: quote.deliveryCharges,
      grandTotal: quote.grandTotal,
      notes: quote.notes || undefined,
      terms: quote.terms || undefined,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quotationNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Supplier quotation PDF failed:', error);
    res.status(500).json({ error: 'Unable to generate quotation PDF.' });
  }
});

// ---------- CUSTOMER QUOTATION DECISION (ACCEPT / REJECT / CLARIFY) ----------
customerRouter.patch('/quotations/:id/customer-action', requireAuth, async (req: AuthRequest, res) => {
  try {
    const quotationId = Number(req.params.id);
    const { action, clarificationNote } = req.body || {};

    const qRows = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, quotationId))
      .limit(1);
    if (!qRows[0]) return res.status(404).json({ error: 'Quotation not found.' });
    const quote = qRows[0];

    const reqRows = await db
      .select()
      .from(quotationRequests)
      .where(eq(quotationRequests.id, quote.requestId))
      .limit(1);
    if (!reqRows[0] || reqRows[0].customerId !== req.profile!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let nextStatus = quote.status;
    if (action === 'accept') nextStatus = 'accepted';
    else if (action === 'reject') nextStatus = 'rejected';
    else if (action === 'clarify') nextStatus = 'clarification_requested';
    else return res.status(400).json({ error: 'Invalid action.' });

    const [updated] = await db
      .update(quotations)
      .set({
        status: nextStatus,
        clarificationNote: clarificationNote ? String(clarificationNote) : quote.clarificationNote,
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, quotationId))
      .returning();

    if (action === 'accept') {
      await db
        .update(quotationRequests)
        .set({ status: 'Quotation Accepted' })
        .where(eq(quotationRequests.id, quote.requestId));
    }

    const supRows = await db
      .select()
      .from(supplierProfiles)
      .where(eq(supplierProfiles.id, quote.supplierId))
      .limit(1);

    if (supRows[0]) {
      await db.insert(notifications).values({
        profileId: supRows[0].profileId,
        type: 'quotation_update',
        title: `Quotation ${quote.quotationNumber}: ${nextStatus.replace('_', ' ')}`,
        message:
          action === 'clarify'
            ? `Customer requested clarification: ${clarificationNote || 'Please review details.'}`
            : `Customer ${action}ed your quotation ${quote.quotationNumber}.`,
        linkView: 'supplier-requests',
      });
    }

    res.json({ quotation: updated });
  } catch (error) {
    console.error('Quotation action failed:', error);
    res.status(500).json({ error: 'Unable to update quotation.' });
  }
});

// ---------- ORDERS & PAYMENTS ----------
customerRouter.get('/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, req.profile!.id))
      .orderBy(desc(orders.createdAt));

    if (rows.length === 0) return res.json({ orders: [] });

    const orderIds = rows.map((o) => o.id);
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
    const sups = await db.select().from(supplierProfiles);
    const supMap = new Map(sups.map((s) => [s.id, s]));

    const enriched = rows.map((o) => ({
      ...o,
      supplierName: supMap.get(o.supplierId)?.shopName || 'Verified Shop',
      supplierCity: supMap.get(o.supplierId)?.city || '',
      supplierMobile: supMap.get(o.supplierId)?.mobile || '',
      items: items.filter((i) => i.orderId === o.id),
      delivery: delivs.find((d) => d.orderId === o.id) || null,
      payments: pays.filter((p) => p.orderId === o.id),
    }));

    res.json({ orders: enriched });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    res.status(500).json({ error: 'Unable to load orders.' });
  }
});

customerRouter.post('/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    const quotationId = b.quotationId ? Number(b.quotationId) : null;
    const allocations: Array<{
      quotationId: number;
      itemIds?: number[];
    }> = Array.isArray(b.allocations)
      ? b.allocations
      : quotationId
        ? [{ quotationId }]
        : [];

    if (allocations.length === 0) {
      return res.status(400).json({ error: 'Select a quotation to place an order.' });
    }

    const createdOrders = [];
    for (const alloc of allocations) {
      const qRows = await db
        .select()
        .from(quotations)
        .where(eq(quotations.id, Number(alloc.quotationId)))
        .limit(1);
      const quote = qRows[0];
      if (!quote) continue;

      const reqRows = await db
        .select()
        .from(quotationRequests)
        .where(eq(quotationRequests.id, quote.requestId))
        .limit(1);
      const rfq = reqRows[0];
      if (!rfq || rfq.customerId !== req.profile!.id) continue;

      const allQItems = await db
        .select()
        .from(quotationItems)
        .where(eq(quotationItems.quotationId, quote.id));

      const chosenItems =
        Array.isArray(alloc.itemIds) && alloc.itemIds.length > 0
          ? allQItems.filter((qi) => alloc.itemIds!.includes(qi.id))
          : allQItems;

      if (chosenItems.length === 0) continue;

      const totals = calculateQuotationTotals(
        chosenItems.map((ci) => ({
          productName: ci.productName,
          unit: ci.unit,
          quantity: ci.availableQty,
          unitPrice: ci.unitPrice,
          gstRate: ci.gstRate,
        })),
        quote.deliveryCharges
      );

      const orderNumber = `BM-ORD-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;
      const paymentMethod = String(b.paymentMethod || 'Cash on Delivery');

      const [order] = await db
        .insert(orders)
        .values({
          orderNumber,
          customerId: req.profile!.id,
          supplierId: quote.supplierId,
          projectId: rfq.projectId,
          quotationId: quote.id,
          status: 'Order Confirmed',
          subtotal: totals.subtotal,
          gstTotal: totals.gstTotal,
          deliveryCharges: totals.deliveryCharges,
          grandTotal: totals.grandTotal,
          paymentMethod,
          paymentStatus:
            paymentMethod === 'Cash on Delivery' ? 'COD Pending' : 'Awaiting Payment',
          deliveryAddress: String(b.deliveryAddress || rfq.deliveryAddress),
          city: String(b.city || rfq.city),
          state: String(b.state || rfq.state),
          pinCode: String(b.pinCode || rfq.pinCode),
          notes: b.notes ? String(b.notes) : '',
          historyJson: [
            {
              status: 'Request Submitted',
              at: new Date(rfq.createdAt).toISOString(),
              note: `RFQ ${rfq.requestNumber} created`,
            },
            {
              status: 'Quotation Accepted',
              at: new Date().toISOString(),
              note: `Accepted ${quote.quotationNumber}`,
            },
            {
              status: 'Order Confirmed',
              at: new Date().toISOString(),
              note: `Order ${orderNumber} placed (${paymentMethod})`,
            },
          ],
        })
        .returning();

      await db.insert(orderItems).values(
        totals.items.map((ti, idx) => ({
          orderId: order.id,
          productName: ti.productName,
          brand: chosenItems[idx]?.brandOffered || 'Standard',
          specification: chosenItems[idx]?.specification || '',
          unit: ti.unit,
          quantity: ti.quantity,
          unitPrice: ti.unitPrice,
          gstRate: ti.gstRate,
          lineTotal: ti.lineTotal,
        }))
      );

      await db.insert(deliveries).values({
        orderId: order.id,
        status: 'Preparing',
        estimatedDate: `${quote.estimatedDeliveryDays} days from confirmation`,
      });

      await db.insert(payments).values({
        orderId: order.id,
        customerId: req.profile!.id,
        method: paymentMethod,
        amount: totals.grandTotal,
        currency: 'INR',
        status: 'pending',
      });

      await db
        .update(quotations)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(quotations.id, quote.id));

      const supRows = await db
        .select()
        .from(supplierProfiles)
        .where(eq(supplierProfiles.id, quote.supplierId))
        .limit(1);

      if (supRows[0]) {
        await db.insert(notifications).values({
          profileId: supRows[0].profileId,
          type: 'order_confirmed',
          title: `New Order ${orderNumber}`,
          message: `Customer placed order ${orderNumber} worth INR ${totals.grandTotal.toFixed(2)}.`,
          linkView: 'supplier-orders',
        });
      }

      createdOrders.push(order);
    }

    if (createdOrders.length === 0) {
      return res.status(400).json({ error: 'Unable to place order from selected quotation.' });
    }

    res.status(201).json({ orders: createdOrders });
  } catch (error) {
    console.error('Order creation failed:', error);
    res.status(500).json({ error: 'Unable to create order.' });
  }
});

customerRouter.post('/payments/create-razorpay-order', requireAuth, async (req: AuthRequest, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res.status(503).json({
      configured: false,
      error:
        'Razorpay gateway credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured on the server. Use UPI / Bank Transfer Reference or Cash on Delivery, or configure Razorpay secrets.',
    });
  }
  try {
    const { orderId } = req.body || {};
    const oRows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, Number(orderId)), eq(orders.customerId, req.profile!.id)))
      .limit(1);
    if (!oRows[0]) return res.status(404).json({ error: 'Order not found.' });

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(oRows[0].grandTotal * 100),
        currency: 'INR',
        receipt: oRows[0].orderNumber,
      }),
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      return res.status(502).json({ error: `Razorpay order creation failed: ${errText}` });
    }

    const rzpOrder = await rzpRes.json();
    res.json({ configured: true, keyId, razorpayOrder: rzpOrder });
  } catch (error) {
    console.error('Razorpay error:', error);
    res.status(500).json({ error: 'Payment gateway communication failed.' });
  }
});

customerRouter.post('/payments/submit-manual', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { orderId, method, referenceNumber } = req.body || {};
    if (!orderId || !method || !referenceNumber) {
      return res.status(400).json({ error: 'Order ID, payment method, and UTR/UPI reference are required.' });
    }

    const oRows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, Number(orderId)), eq(orders.customerId, req.profile!.id)))
      .limit(1);
    if (!oRows[0]) return res.status(404).json({ error: 'Order not found.' });

    const [payment] = await db
      .insert(payments)
      .values({
        orderId: oRows[0].id,
        customerId: req.profile!.id,
        method: String(method),
        amount: oRows[0].grandTotal,
        currency: 'INR',
        status: 'awaiting_confirmation',
        referenceNumber: String(referenceNumber).trim(),
      })
      .returning();

    await db
      .update(orders)
      .set({
        paymentMethod: String(method),
        paymentStatus: 'Awaiting Confirmation',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, oRows[0].id));

    res.status(201).json({
      payment,
      message: 'Payment reference recorded. Payment will be marked Paid once verified by the supplier or admin.',
    });
  } catch (error) {
    console.error('Manual payment submission failed:', error);
    res.status(500).json({ error: 'Unable to submit payment reference.' });
  }
});

customerRouter.post('/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { orderId, rating, comment } = req.body || {};
    const oRows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, Number(orderId)), eq(orders.customerId, req.profile!.id)))
      .limit(1);
    if (!oRows[0]) return res.status(404).json({ error: 'Order not found.' });

    const [rev] = await db
      .insert(reviews)
      .values({
        orderId: oRows[0].id,
        customerId: req.profile!.id,
        supplierId: oRows[0].supplierId,
        rating: Math.max(1, Math.min(5, Number(rating) || 5)),
        comment: comment ? String(comment) : '',
      })
      .returning();
    res.status(201).json({ review: rev });
  } catch (error) {
    console.error('Failed to submit review:', error);
    res.status(500).json({ error: 'Unable to submit review.' });
  }
});
