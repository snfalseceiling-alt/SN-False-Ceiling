import PDFDocument from 'pdfkit';
import { formatINR } from '../lib/pricing.ts';

export interface PdfLineItem {
  categoryName: string;
  productName: string;
  brand: string;
  specification: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstRate: number;
  lineTotal: number;
}

export interface PdfQuotationPayload {
  quotationNumber: string;
  quotationDate: string;
  priceClassification: 'ESTIMATED CATALOGUE PLANNING QUOTE' | 'SUPPLIER-CONFIRMED QUOTATION';
  customerName: string;
  contactNumber: string;
  projectName: string;
  projectAddress: string;
  supplierName?: string;
  supplierGstin?: string;
  supplierAddress?: string;
  estimatedDeliveryDays?: number;
  validUntil?: string;
  items: PdfLineItem[];
  subtotal: number;
  gstTotal: number;
  deliveryCharges: number;
  grandTotal: number;
  notes?: string;
  terms?: string;
}

export function generateQuotationPdfBuffer(data: PdfQuotationPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const navy = '#0F2942';
    const orange = '#EA580C';
    const slate = '#334155';
    const lightBg = '#F4F6F8';

    // Header banner
    doc.rect(0, 0, doc.page.width, 84).fill(navy);
    doc
      .fillColor('#FFFFFF')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('BuildMate', 40, 22);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#CBD5E1')
      .text('Smart Material Planning. Easy Quotations. Better Buying.', 40, 48);

    doc
      .fillColor('#FFFFFF')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(data.quotationNumber, 360, 24, { align: 'right', width: 195 });
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#FDBA74')
      .text(data.priceClassification, 320, 44, { align: 'right', width: 235 });
    doc
      .fillColor('#CBD5E1')
      .text(`Date: ${data.quotationDate}`, 360, 58, { align: 'right', width: 195 });

    // Customer & Project / Supplier Info
    let y = 104;
    doc.rect(40, y, 250, 92).fill(lightBg);
    doc
      .fillColor(navy)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('CUSTOMER & PROJECT DETAILS', 50, y + 10);
    doc
      .fillColor(slate)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(data.customerName || 'Customer', 50, y + 25, { width: 230 });
    doc
      .font('Helvetica')
      .text(`Contact: ${data.contactNumber || 'On file'}`, 50, y + 39, { width: 230 })
      .text(`Project: ${data.projectName || 'General Material List'}`, 50, y + 52, {
        width: 230,
      })
      .text(`Site: ${data.projectAddress || 'India'}`, 50, y + 65, {
        width: 230,
        height: 24,
      });

    doc.rect(305, y, 250, 92).fill(lightBg);
    doc
      .fillColor(navy)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(data.supplierName ? 'SUPPLIER DETAILS' : 'QUOTATION SUMMARY', 315, y + 10);
    if (data.supplierName) {
      doc
        .fillColor(slate)
        .font('Helvetica-Bold')
        .text(data.supplierName, 315, y + 25, { width: 230 })
        .font('Helvetica')
        .text(`GSTIN: ${data.supplierGstin || 'N/A'}`, 315, y + 39, { width: 230 })
        .text(`Address: ${data.supplierAddress || 'Verified Shop'}`, 315, y + 52, {
          width: 230,
        })
        .text(
          `Est. Delivery: ${data.estimatedDeliveryDays ?? 3} days · Valid: ${data.validUntil || '14 days'}`,
          315,
          y + 66,
          { width: 230 }
        );
    } else {
      doc
        .fillColor(slate)
        .font('Helvetica')
        .text('Type: Reference Catalogue Estimate', 315, y + 25, { width: 230 })
        .text('Prices shown are indicative catalogue', 315, y + 39, { width: 230 })
        .text('estimates. Request supplier quotes', 315, y + 52, { width: 230 })
        .text('for confirmed market pricing.', 315, y + 65, { width: 230 });
    }

    y += 110;

    // Table Header
    const drawTableHeader = (topY: number) => {
      doc.rect(40, topY, 515, 22).fill(navy);
      doc
        .fillColor('#FFFFFF')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('#', 46, topY + 7, { width: 18 })
        .text('Material / Brand / Spec', 64, topY + 7, { width: 210 })
        .text('Qty / Unit', 278, topY + 7, { width: 65 })
        .text('Rate', 346, topY + 7, { width: 65, align: 'right' })
        .text('GST%', 415, topY + 7, { width: 35, align: 'right' })
        .text('Total', 455, topY + 7, { width: 92, align: 'right' });
      return topY + 24;
    };

    y = drawTableHeader(y);

    data.items.forEach((item, idx) => {
      if (y > 700) {
        doc.addPage();
        y = drawTableHeader(40);
      }

      const rowHeight = 32;
      if (idx % 2 === 1) {
        doc.rect(40, y, 515, rowHeight).fill('#F8FAFC');
      }

      doc
        .fillColor(slate)
        .fontSize(8)
        .font('Helvetica')
        .text(String(idx + 1), 46, y + 6, { width: 18 });

      doc
        .font('Helvetica-Bold')
        .fillColor('#0F172A')
        .text(item.productName, 64, y + 4, { width: 210, ellipsis: true });
      doc
        .font('Helvetica')
        .fillColor('#64748B')
        .fontSize(7)
        .text(`${item.categoryName} · ${item.brand} · ${item.specification}`, 64, y + 16, {
          width: 210,
          ellipsis: true,
        });

      doc
        .fillColor(slate)
        .fontSize(8)
        .text(`${item.quantity} ${item.unit}`, 278, y + 10, { width: 65 })
        .text(formatINR(item.unitPrice), 346, y + 10, { width: 65, align: 'right' })
        .text(`${item.gstRate}%`, 415, y + 10, { width: 35, align: 'right' })
        .font('Helvetica-Bold')
        .text(formatINR(item.lineTotal), 455, y + 10, { width: 92, align: 'right' });

      y += rowHeight;
    });

    if (y > 650) {
      doc.addPage();
      y = 40;
    }

    y += 12;
    doc.rect(325, y, 230, 82).fill(lightBg);
    doc
      .fillColor(slate)
      .fontSize(9)
      .font('Helvetica')
      .text('Subtotal (Excl. GST):', 335, y + 10)
      .text(formatINR(data.subtotal), 445, y + 10, { width: 100, align: 'right' })
      .text('Total GST:', 335, y + 26)
      .text(formatINR(data.gstTotal), 445, y + 26, { width: 100, align: 'right' })
      .text('Delivery Charges:', 335, y + 42)
      .text(formatINR(data.deliveryCharges), 445, y + 42, { width: 100, align: 'right' });

    doc.rect(325, y + 58, 230, 24).fill(orange);
    doc
      .fillColor('#FFFFFF')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('GRAND TOTAL:', 335, y + 65)
      .text(formatINR(data.grandTotal), 435, y + 65, { width: 110, align: 'right' });

    y += 98;
    if (data.notes) {
      doc
        .fillColor(navy)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('Notes:', 40, y);
      doc
        .fillColor(slate)
        .fontSize(8)
        .font('Helvetica')
        .text(data.notes, 40, y + 12, { width: 515 });
      y += 34;
    }

    doc
      .fillColor(navy)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('Terms & Conditions:', 40, y);
    doc
      .fillColor('#64748B')
      .fontSize(7.5)
      .font('Helvetica')
      .text(
        data.terms ||
          '1. Prices are in INR. Catalogue estimates are indicative only and require verified supplier confirmation.\n2. Material quantities should be verified against approved architectural/MEP drawings prior to dispatch.\n3. Goods supplied with GST invoice as per Indian GST regulations.',
        40,
        y + 11,
        { width: 515 }
      );

    doc.end();
  });
}
