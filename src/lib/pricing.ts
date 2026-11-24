export interface PricedLineItem {
  id?: number | string;
  productName: string;
  categoryName?: string;
  brand?: string;
  specification?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

export interface CalculatedLineItem extends PricedLineItem {
  lineSubtotal: number;
  lineGst: number;
  lineTotal: number;
}

export interface QuotationTotals {
  items: CalculatedLineItem[];
  subtotal: number;
  gstTotal: number;
  deliveryCharges: number;
  grandTotal: number;
}

export interface ComparableQuotation {
  id: number;
  quotationNumber: string;
  supplierId: number;
  supplierName: string;
  grandTotal: number;
  subtotal: number;
  gstTotal: number;
  deliveryCharges: number;
  estimatedDeliveryDays: number;
  itemCount: number;
  allItemsAvailable: boolean;
}

export function roundINR(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function calculateLineItem(item: PricedLineItem): CalculatedLineItem {
  const qty = Math.max(0, Number(item.quantity) || 0);
  const price = Math.max(0, Number(item.unitPrice) || 0);
  const gst = Math.max(0, Math.min(28, Number(item.gstRate) || 0));

  const lineSubtotal = roundINR(qty * price);
  const lineGst = roundINR((lineSubtotal * gst) / 100);
  const lineTotal = roundINR(lineSubtotal + lineGst);

  return {
    ...item,
    quantity: qty,
    unitPrice: price,
    gstRate: gst,
    lineSubtotal,
    lineGst,
    lineTotal,
  };
}

export function calculateQuotationTotals(
  items: PricedLineItem[],
  deliveryCharges = 0
): QuotationTotals {
  const calculated = items.map(calculateLineItem);
  const subtotal = roundINR(calculated.reduce((sum, i) => sum + i.lineSubtotal, 0));
  const gstTotal = roundINR(calculated.reduce((sum, i) => sum + i.lineGst, 0));
  const delivery = Math.max(0, roundINR(Number(deliveryCharges) || 0));
  const grandTotal = roundINR(subtotal + gstTotal + delivery);

  return {
    items: calculated,
    subtotal,
    gstTotal,
    deliveryCharges: delivery,
    grandTotal,
  };
}

/**
 * Identifies the lowest comparable total price among quotations that fulfill
 * the requested line items completely. Does NOT auto-recommend a supplier—
 * returns neutral factual comparison metadata only.
 */
export function findLowestComparableQuotationId(
  quotations: ComparableQuotation[],
  expectedItemCount: number
): number | null {
  const comparable = quotations.filter(
    (q) => q.allItemsAvailable && q.itemCount >= expectedItemCount && q.grandTotal > 0
  );
  if (comparable.length === 0) return null;
  let lowest = comparable[0];
  for (const q of comparable) {
    if (q.grandTotal < lowest.grandTotal) {
      lowest = q;
    }
  }
  return lowest.id;
}

export interface SplitAllocation {
  supplierId: number;
  supplierName: string;
  quotationId: number;
  items: CalculatedLineItem[];
  deliveryCharges: number;
}

export function calculateSplitOrderSummary(allocations: SplitAllocation[]) {
  const groups = allocations
    .filter((a) => a.items.length > 0)
    .map((a) => ({
      supplierId: a.supplierId,
      supplierName: a.supplierName,
      quotationId: a.quotationId,
      ...calculateQuotationTotals(a.items, a.deliveryCharges),
    }));

  const combinedGrandTotal = roundINR(
    groups.reduce((sum, g) => sum + g.grandTotal, 0)
  );
  const combinedSubtotal = roundINR(groups.reduce((sum, g) => sum + g.subtotal, 0));
  const combinedGst = roundINR(groups.reduce((sum, g) => sum + g.gstTotal, 0));
  const combinedDelivery = roundINR(
    groups.reduce((sum, g) => sum + g.deliveryCharges, 0)
  );

  return {
    groups,
    combinedSubtotal,
    combinedGst,
    combinedDelivery,
    combinedGrandTotal,
  };
}
