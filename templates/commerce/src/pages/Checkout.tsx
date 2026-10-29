import { rememberOrderAccess } from '../components/OrderTracking';
import { Input, Textarea } from '../components/ui';
import { ArrowLeft, ArrowRight, Check, CreditCard, MapPin, Package, ShoppingBag, Truck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Customer, PaymentMethod, Quote, Order } from '../shared/contracts';
import { useCommerce } from '../lib/store';
import { api, ApiError } from '../lib/api';
import { money } from '../lib/format';
import { Button, EmptyState, Field, InlineError, PageMotion, ProductImage } from '../components/ui';

import { readAttempt, saveAttempt, type CheckoutAttempt } from '../lib/checkoutAttempt';

export function Checkout() {
  const { data, cart, clearCart, navigate, notify, refresh } = useCommerce();
  const [saved] = useState<CheckoutAttempt | null>(readAttempt);
  const [customer, setCustomer] = useState<Customer>(saved?.payload.customer || { name: '', phone: '', email: '', address: '', city: '', postalCode: '' });
  const [shippingId, setShippingId] = useState(saved?.payload.shippingMethodId || data?.shippingMethods[0]?.id || '');
  const [payment, setPayment] = useState<PaymentMethod>(saved?.payload.paymentMethod || data?.paymentMethods.find(method => method.available)?.id || 'manual');
  const [coupon, setCoupon] = useState(saved?.payload.couponCode || '');
  const [appliedCoupon, setAppliedCoupon] = useState(saved?.payload.couponCode || '');
  const [note, setNote] = useState(saved?.payload.note || '');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [couponError, setCouponError] = useState('');
  const [uncertain, setUncertain] = useState(Boolean(saved));
  const sequence = useRef(0);
  const idempotencyKey = useRef(saved?.key || crypto.randomUUID());
  const attempted = useRef<string | null>(saved?.fingerprint || null);
  const shipping = data?.shippingMethods.find(method => method.id === shippingId);
  useEffect(() => {
    if (!cart.length || !data?.capabilities.checkout) return;
    const seq = ++sequence.current; setQuoting(true); setError('');
    api.quote({ items: cart, shippingMethodId: shippingId, couponCode: appliedCoupon || undefined })
      .then(value => { if (seq === sequence.current) setQuote(value); })
      .catch(cause => { if (seq === sequence.current) { setQuote(null); setError(cause instanceof Error ? cause.message : 'Total belum dapat dihitung.'); } })
      .finally(() => { if (seq === sequence.current) setQuoting(false); });
  }, [cart, shippingId, appliedCoupon, data?.capabilities.checkout]);
  if (!data) return null;
  if (!data.capabilities.checkout) return <EmptyState title="Checkout belum tersedia" description="Paket ini memakai percakapan langsung dengan toko." action={<Button onClick={() => navigate('shop')}>Kembali ke koleksi</Button>} />;
  if (!cart.length) return <EmptyState icon={<ShoppingBag size={34} />} title="Pilih produk lebih dulu" description="Keranjangmu masih kosong." action={<Button onClick={() => navigate('shop')}>Lihat koleksi</Button>} />;
  const changeCustomer = (field: keyof Customer, value: string) => setCustomer(previous => ({ ...previous, [field]: value }));
  const applyCoupon = async () => {
    const seq = ++sequence.current; setCouponError(''); setQuoting(true);
    try { const value = await api.quote({ items: cart, shippingMethodId: shippingId, couponCode: coupon.trim() || undefined }); if (seq === sequence.current) { setQuote(value); setAppliedCoupon(coupon.trim()); notify(coupon.trim() ? 'Kode promo diterapkan.' : 'Kode promo dihapus.'); } }
    catch (cause) { if (seq === sequence.current) setCouponError(cause instanceof Error ? cause.message : 'Kode promo tidak dapat digunakan.'); }
    finally { if (seq === sequence.current) setQuoting(false); }
  };
  const complete = (order: Order) => {
    rememberOrderAccess(order);
    try { sessionStorage.setItem('tampiloka-last-order', order.id); } catch { /* The order remains in history. */ }
    const previous = readAttempt();
    saveAttempt(null); attempted.current = null; setUncertain(false);
    if (!previous || JSON.stringify(previous.payload.items) === JSON.stringify(cart)) clearCart();
    navigate('orders'); notify(`Pesanan ${order.number} berhasil dibuat.`);
    void refresh().catch(() => {});
  };
  const retryPrevious = async () => {
    const previous = readAttempt(); if (!previous || submitting) return;
    setSubmitting(true); setError('');
    try {
      const found = await api.orderAttempt(previous.key);
      const order = found.order || await api.order({ ...previous.payload, idempotencyKey: previous.key });
      complete(order);
    } catch (cause) {
      const definite = cause instanceof ApiError && cause.status < 500 && cause.code !== 'IDEMPOTENCY_CONFLICT';
      if (definite) { saveAttempt(null); attempted.current = null; idempotencyKey.current = crypto.randomUUID(); setUncertain(false); }
      setError(cause instanceof Error ? cause.message : 'Permintaan belum dapat diperiksa. Coba lagi setelah koneksi pulih.');
    } finally { setSubmitting(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!quote || quoting || submitting || !data.paymentMethods.some(method => method.id === payment && method.available)) return;
    const payload = { items: cart, shippingMethodId: shippingId, couponCode: appliedCoupon || undefined, customer, paymentMethod: payment, expectedTotal: quote.total, note };
    const fingerprint = JSON.stringify(payload);
    if (attempted.current && attempted.current !== fingerprint) { setError('Permintaan sebelumnya belum pasti. Periksa Pesanan saya sebelum mengubah pesanan dan mencoba lagi.'); setUncertain(true); return; }
    setSubmitting(true); setError(''); attempted.current = fingerprint;
    saveAttempt({ key: idempotencyKey.current, fingerprint, payload });
    try {
      const order = await api.order({ ...payload, idempotencyKey: idempotencyKey.current });
      complete(order);
    } catch (cause) {
      const definiteRejection = cause instanceof ApiError && cause.status < 500 && cause.code !== 'IDEMPOTENCY_CONFLICT';
      if (definiteRejection) { saveAttempt(null); attempted.current = null; idempotencyKey.current = crypto.randomUUID(); }
      setUncertain(!definiteRejection);
      setError(cause instanceof Error ? cause.message : 'Status pesanan belum pasti. Cek Pesanan saya atau coba ulang dengan data yang sama.');
    } finally { setSubmitting(false); }
  };
  return <PageMotion className="checkout-page page-container"><Button variant="quiet" compact onClick={() => navigate('shop')}><ArrowLeft size={16} />Kembali belanja</Button><div className="page-heading"><h1>Selesaikan pesanan</h1><p>Lengkapi data, pilih pengiriman, lalu periksa totalnya.</p></div><form onSubmit={submit} className="checkout-layout"><div className="checkout-form"><section className="form-section"><h2><span>1</span>Data penerima</h2><div className="form-grid"><Field label="Nama lengkap"><Input autoComplete="name" required value={customer.name} onChange={event => changeCustomer('name', event.target.value)} maxLength={100} /></Field><Field label="Nomor WhatsApp"><Input type="tel" autoComplete="tel" required pattern="[+0-9 ()\-]{8,20}" placeholder="08xxxxxxxxxx" value={customer.phone} onChange={event => changeCustomer('phone', event.target.value)} /></Field><Field label="Email (opsional)" className="span-two"><Input type="email" autoComplete="email" value={customer.email} onChange={event => changeCustomer('email', event.target.value)} maxLength={160} /></Field></div></section><section className="form-section"><h2><span>2</span>Pengiriman</h2><div className="radio-options">{data.shippingMethods.map(method => <label key={method.id} className={`radio-option ${shippingId === method.id ? 'selected' : ''}`}><Input type="radio" name="shipping" value={method.id} checked={shippingId === method.id} onChange={() => setShippingId(method.id)} /><div><strong>{method.name}</strong><small>{method.description} · {method.estimatedDays}</small></div><b>{method.fee === 0 ? 'Gratis' : money(method.fee)}</b></label>)}</div>{shipping?.requiresAddress ? <div className="form-grid address-fields"><Field label="Alamat lengkap" className="span-two"><Textarea required autoComplete="street-address" rows={3} value={customer.address} onChange={event => changeCustomer('address', event.target.value)} maxLength={500} placeholder="Jalan, nomor rumah, RT/RW, kelurahan, kecamatan" /></Field><Field label="Kota / kabupaten"><Input required autoComplete="address-level2" value={customer.city} onChange={event => changeCustomer('city', event.target.value)} maxLength={80} /></Field><Field label="Kode pos"><Input required inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}" value={customer.postalCode} onChange={event => changeCustomer('postalCode', event.target.value)} /></Field></div> : <p className="pickup-note"><MapPin size={18} />{data.config.brand.address}</p>}</section><section className="form-section"><h2><span>3</span>Pembayaran</h2><div className="radio-options">{data.paymentMethods.map(method => <label key={method.id} className={`radio-option ${payment === method.id ? 'selected' : ''} ${!method.available ? 'disabled' : ''}`}><Input type="radio" name="payment" value={method.id} checked={payment === method.id} disabled={!method.available} onChange={() => setPayment(method.id)} /><div><strong>{method.name}{method.demo && <span className="inline-note">Simulasi</span>}</strong><small>{method.description}</small></div>{method.id === 'midtrans' ? <CreditCard size={21} /> : <Package size={21} />}</label>)}</div>{data.demo && <p className="help-text">Demo ini tidak menarik uang. Gunakan data contoh saat mencoba checkout.</p>}</section><section className="form-section"><Field label="Catatan untuk toko (opsional)"><Textarea rows={2} value={note} onChange={event => setNote(event.target.value)} maxLength={500} placeholder="Contoh: titipkan paket ke petugas keamanan." /></Field></section></div><aside className="checkout-summary"><h2>Ringkasan pesanan</h2><div className="summary-products">{cart.map(line => { const product = data.products.find(p => p.variants.some(v => v.id === line.variantId)); const variant = product?.variants.find(v => v.id === line.variantId); return <div className="summary-product" key={line.variantId}><ProductImage src={product?.images[0]} alt={product?.name || ''} /><div><strong>{product?.name || 'Produk tidak tersedia'}</strong><small>{variant?.name} · {line.quantity} buah</small></div><b>{money((variant?.price || 0) * line.quantity)}</b></div>; })}</div>{data.capabilities.coupons && <div className="coupon-field"><label className="sr-only" htmlFor="coupon">Kode promo</label><Input id="coupon" placeholder="Kode promo" value={coupon} onChange={event => setCoupon(event.target.value.toUpperCase())} /><Button variant="secondary" compact onClick={() => void applyCoupon()} loading={quoting}>Pakai</Button><InlineError>{couponError}</InlineError></div>}<div className={`price-breakdown ${quoting ? 'is-loading' : ''}`} aria-live="polite"><div><span>Subtotal</span><span>{quote ? money(quote.subtotal) : 'Menghitung...'}</span></div><div><span>Ongkir</span><span>{quote ? money(quote.shippingFee) : ''}</span></div>{Boolean(quote?.discount) && <div className="discount-line"><span>Potongan {quote?.couponCode}</span><span>−{money(quote!.discount)}</span></div>}<div className="grand-total"><strong>Total</strong><strong>{quote ? money(quote.total) : '...'}</strong></div></div><InlineError>{error || (!data.paymentMethods.some(method => method.available) ? 'Toko belum menyiapkan metode pembayaran. Hubungi toko untuk bantuan.' : '')}</InlineError>{uncertain && <div className="checkout-recovery"><p>Permintaan sebelumnya mungkin sudah tersimpan. Cek riwayat pesanan sebelum memesan lagi.</p><Button variant="secondary" className="full-width" onClick={() => navigate('orders')}>Lihat pesanan</Button><Button variant="quiet" className="full-width" loading={submitting} onClick={() => void retryPrevious()}>Periksa dan lanjutkan permintaan sebelumnya</Button></div>}<Button type="submit" className="full-width" loading={submitting} disabled={!quote || quoting || !data.paymentMethods.some(method => method.id === payment && method.available)}>Buat pesanan<ArrowRight size={17} /></Button><p className="help-text">Harga dan stok diperiksa kembali saat pesanan dibuat. Simpan nomor pesanan untuk mengecek statusnya.</p></aside></form></PageMotion>;
}
