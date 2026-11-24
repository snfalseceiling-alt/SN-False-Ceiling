import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLineItem,
  calculateQuotationTotals,
  findLowestComparableQuotationId,
  calculateSplitOrderSummary,
} from './pricing';
import { getAllEnglishKeys, getAllTamilKeys, t } from './i18n';
import { ELECTRICAL_CATEGORIES, PLUMBING_CATEGORIES } from './catalogData';

test('calculateLineItem computes subtotal, GST, and line total accurately', () => {
  const result = calculateLineItem({
    productName: 'Polycab 1.5 sq.mm Wire',
    unit: 'Coil (90m)',
    quantity: 5,
    unitPrice: 1800,
    gstRate: 18,
  });

  assert.equal(result.lineSubtotal, 9000);
  assert.equal(result.lineGst, 1620);
  assert.equal(result.lineTotal, 10620);
});

test('calculateQuotationTotals aggregates items and delivery charges accurately', () => {
  const result = calculateQuotationTotals(
    [
      { productName: 'Wire', unit: 'Coil', quantity: 2, unitPrice: 1500, gstRate: 18 },
      { productName: 'CPVC Pipe', unit: 'Length', quantity: 10, unitPrice: 350, gstRate: 18 },
    ],
    450
  );

  assert.equal(result.subtotal, 6500);
  assert.equal(result.gstTotal, 1170);
  assert.equal(result.deliveryCharges, 450);
  assert.equal(result.grandTotal, 8120);
});

test('findLowestComparableQuotationId skips incomplete quotes and finds lowest full quote', () => {
  const lowestId = findLowestComparableQuotationId(
    [
      {
        id: 1,
        quotationNumber: 'Q-1',
        supplierId: 10,
        supplierName: 'Partial Shop',
        grandTotal: 4000,
        subtotal: 3200,
        gstTotal: 576,
        deliveryCharges: 224,
        estimatedDeliveryDays: 2,
        itemCount: 1,
        allItemsAvailable: false,
      },
      {
        id: 2,
        quotationNumber: 'Q-2',
        supplierId: 11,
        supplierName: 'Complete Shop A',
        grandTotal: 8500,
        subtotal: 7000,
        gstTotal: 1260,
        deliveryCharges: 240,
        estimatedDeliveryDays: 2,
        itemCount: 3,
        allItemsAvailable: true,
      },
      {
        id: 3,
        quotationNumber: 'Q-3',
        supplierId: 12,
        supplierName: 'Complete Shop B',
        grandTotal: 7900,
        subtotal: 6500,
        gstTotal: 1170,
        deliveryCharges: 230,
        estimatedDeliveryDays: 3,
        itemCount: 3,
        allItemsAvailable: true,
      },
    ],
    3
  );

  assert.equal(lowestId, 3);
});

test('calculateSplitOrderSummary sums split supplier allocations accurately', () => {
  const summary = calculateSplitOrderSummary([
    {
      supplierId: 1,
      supplierName: 'Shop A',
      quotationId: 101,
      deliveryCharges: 200,
      items: [calculateLineItem({ productName: 'Wire', unit: 'Coil', quantity: 2, unitPrice: 1000, gstRate: 18 })],
    },
    {
      supplierId: 2,
      supplierName: 'Shop B',
      quotationId: 102,
      deliveryCharges: 150,
      items: [calculateLineItem({ productName: 'Pipe', unit: 'Length', quantity: 4, unitPrice: 500, gstRate: 18 })],
    },
  ]);

  assert.equal(summary.groups.length, 2);
  assert.equal(summary.combinedSubtotal, 4000);
  assert.equal(summary.combinedGst, 720);
  assert.equal(summary.combinedDelivery, 350);
  assert.equal(summary.combinedGrandTotal, 5070);
});

test('catalog contains 20 electrical and 20 plumbing categories', () => {
  assert.equal(ELECTRICAL_CATEGORIES.length, 20);
  assert.equal(PLUMBING_CATEGORIES.length, 20);
});

test('i18n covers all keys in both English and Tamil', () => {
  const enKeys = getAllEnglishKeys();
  const taKeys = getAllTamilKeys();
  for (const key of enKeys) {
    assert.ok(taKeys.includes(key), `Missing Tamil translation for key: ${key}`);
    assert.ok(t('ta', key).length > 0);
  }
});
