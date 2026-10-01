import PDFDocument from "pdfkit";

export type InvoiceLine = {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type InvoiceInput = {
  orderNumber: string;
  placedAt: Date;
  currency: string;
  customerName: string;
  email?: string;
  shippingLines: string[];
  items: InvoiceLine[];
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  total: number;
};

const amount = (value: number, currency: string): string =>
  `${currency} ${value.toFixed(2)}`;

export const generateInvoicePdf = (order: InvoiceInput): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    doc.fontSize(20).text("Invoice", { align: "left" });
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor("#333333");
    doc.text(`Order ${order.orderNumber}`);
    doc.text(`Date ${order.placedAt.toISOString().slice(0, 10)}`);
    doc.moveDown();

    doc.fontSize(12).fillColor("#000000").text("Bill to");
    doc.fontSize(11).fillColor("#333333").text(order.customerName);
    if (order.email) {
      doc.text(order.email);
    }
    for (const line of order.shippingLines) {
      doc.text(line);
    }

    doc.moveDown();
    doc.fontSize(12).fillColor("#000000").text("Items");
    doc.moveDown(0.3);

    for (const item of order.items) {
      doc
        .fontSize(11)
        .fillColor("#111111")
        .text(`${item.name}  ·  ${item.sku}`);
      doc
        .fontSize(10)
        .fillColor("#444444")
        .text(
          `${item.quantity} × ${amount(item.unitPrice, order.currency)}    ${amount(item.lineTotal, order.currency)}`,
        );
      doc.moveDown(0.4);
    }

    doc.moveDown(0.6);
    const totals: Array<[string, number]> = [
      ["Subtotal", order.subtotal],
      ["Discount", order.discountAmount],
      ["Shipping", order.shippingAmount],
      ["Tax", order.taxAmount],
      ["Total", order.total],
    ];

    for (const [label, value] of totals) {
      doc.fontSize(label === "Total" ? 13 : 11).fillColor("#000000");
      doc.text(`${label}: ${amount(value, order.currency)}`, { align: "right" });
    }

    doc.end();
  });
};
