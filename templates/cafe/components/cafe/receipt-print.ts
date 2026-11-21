import { billLocation, billOwnerName, groupBillUnits } from './bill-display.ts';

export function printBillReceipt(bill: any, snapshot: any, language: 'id' | 'en', timeZone: string) {
  const receiptWindow = window.open('', '_blank', 'width=440,height=760');
  if (!receiptWindow) throw new Error(language === 'id' ? 'Izinkan jendela cetak di browser, lalu coba lagi.' : 'Allow the print window in your browser, then try again.');
  receiptWindow.opener = null;
  const doc = receiptWindow.document;
  const t = (id: string, en: string) => language === 'id' ? id : en;
  doc.title = `${t('Struk', 'Receipt')} ${bill.id.slice(-8).toUpperCase()}`;
  const tokens = window.getComputedStyle(document.documentElement);
  for (const name of ['--foreground', '--surface', '--border-strong']) doc.documentElement.style.setProperty(name, tokens.getPropertyValue(name));
  const style = doc.createElement('style');
  style.textContent = 'body{font:14px/1.5 system-ui;margin:24px auto;padding:0 16px;max-width:360px;color:var(--foreground);background:var(--surface)}h1{font-size:20px}p{margin:6px 0;overflow-wrap:anywhere}.row{display:flex;justify-content:space-between;gap:16px}.row span:last-child{white-space:nowrap}hr{border:0;border-top:1px dashed var(--border-strong);margin:16px 0}@media print{body{margin:0;max-width:none}button{display:none}}';
  doc.head.append(style);
  const text = (value: string, tag = 'p') => { const el = doc.createElement(tag); el.textContent = value; doc.body.append(el); };
  const methodLabel = (method: string) => ({ CASH: t('Tunai', 'Cash'), QRIS: 'QRIS', VIRTUAL_ACCOUNT: 'Virtual Account', MANUAL_TRANSFER: t('Transfer bank', 'Bank transfer'), EXTERNAL_COUNTER: t('Kasir', 'Counter') }[method] || method);
  const row = (label: string, amount: number) => { const normalized = Number.isFinite(Number(amount)) ? Number(amount) || 0 : 0; const el = doc.createElement('p'); el.className = 'row'; const name = doc.createElement('span'), value = doc.createElement('span'); name.textContent = label; value.textContent = new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(normalized); el.append(name,value); doc.body.append(el); };
  text(snapshot.outlet?.name || 'Cafe', 'h1'); text(snapshot.outlet?.address || '');
  text(`#${bill.id.slice(-8).toUpperCase()} · ${billOwnerName(bill)}`);
  text(billLocation(bill, snapshot.visits || [], t)); doc.body.append(doc.createElement('hr'));
  for (const group of groupBillUnits(bill.allocatedUnits || [])) {
    row(`${group.quantity}× ${group.unit.itemNameSnapshot || group.unit.itemName}${group.unit.fulfillmentStatus === 'CANCELLED' ? t(' (dibatalkan)',' (cancelled)') : ''}`,group.grossIdr);
    const unit = group.unit;
    const details = [unit.variantNameSnapshot || unit.variantName, unit.modifiersSummary, unit.note].filter(Boolean).join(' · ');
    if (details) text(details);
  }
  doc.body.append(doc.createElement('hr'));
  row(t('Subtotal menu','Menu subtotal'),bill.subtotalIdr);
  if (Number(bill.discountIdr) > 0) row(t('Diskon','Discount'),-Number(bill.discountIdr));
  row(t('Layanan','Service charge'),bill.serviceIdr); row('PB1',bill.taxIdr); row(t('Total tagihan','Bill total'),bill.originalTotalIdr ?? bill.totalIdr);
  if (bill.debitAdjustmentsIdr) row(t('Tambahan koreksi','Debit adjustments'),bill.debitAdjustmentsIdr);
  if (bill.creditAdjustmentsIdr) row(t('Koreksi pembatalan','Cancellation credit'),-Number(bill.creditAdjustmentsIdr));
  row(t('Sudah dibayar','Payments received'),Number(bill.verifiedReceiptsIdr) ? -Number(bill.verifiedReceiptsIdr) : 0);
  if (bill.refundedIdr) row(t('Sudah dikembalikan','Refunded'),bill.refundedIdr);
  row(t('Sisa tagihan','Balance due'),bill.balanceIdr);
  for (const receipt of bill.receipts || []) text([methodLabel(receipt.method), new Date(receipt.receivedAt || receipt.createdAt).toLocaleString(language === 'id' ? 'id-ID' : 'en-GB', { timeZone }), receipt.referenceCode].filter(Boolean).join(' · '));
  if (snapshot.runtime?.demo) text(t('Struk demo · tidak ada pembayaran nyata','Demo receipt · no real payment'));
  const button = doc.createElement('button'); button.textContent = t('Cetak / Simpan PDF','Print / Save PDF'); button.onclick = () => receiptWindow.print(); doc.body.append(button);
  receiptWindow.focus(); receiptWindow.print();
}
