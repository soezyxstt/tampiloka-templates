'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import Image from 'next/image';
import styles from './customer-app.module.css';
import { cafeConfig, isModuleEnabled } from '@/src/config/cafe';
import { BrandMark } from './brand';
import { summarizeOrderBilling } from '@/src/domain/order-billing';
import { MotionPanel, MotionItem } from '@/components/ui/motion';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Button,
  PageHeader,
  ChoiceStrip,
  FilterToggle,
  Input,
  Textarea,
  Label,
  SelectField,
  AnimatedSegmentedControl,
  ImageCarousel,
  ThumbnailImageSlider,
  StatusLabel,
  SearchField,
  QuantityControl,
  PaymentBreakdown,
  EmptyState,
  InlineError,
  DialogModal,
  Money,
  formatIdr,
  formatOutletChargePolicy,
} from './ui-primitives';
import {
  ShoppingCart,
  Heart,
  User,
  MapPin,
  Wifi,
  Copy,
  Check,
  Utensils,
  Bell,
  Star,
  QrCode,
  Share2,
  Clock,
  Receipt,
  Award,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Lock,
  Coffee,
  Plus,
  Pencil,
  X,
  Download,
  BookOpenText,
  ShoppingBag,
  ClipboardList,
  HandHelping,
} from 'lucide-react';

const paymentLabel = (state: string) => ({ SETTLED: 'Lunas', PARTIALLY_PAID: 'Dibayar sebagian', REFUND_DUE: 'Menunggu pengembalian', NO_BILL: 'Menunggu tagihan' }[state] || 'Belum dibayar');
const paymentMethodLabel = (method: string) => ({ CASH: 'Tunai', QRIS: 'QRIS', VIRTUAL_ACCOUNT: 'Virtual account', MANUAL_TRANSFER: 'Transfer', EXTERNAL_COUNTER: 'Kasir eksternal' }[method] || method);

export interface CartLineDraft {
  cartLineId: string;
  menuItemId: string;
  variantId: string;
  itemName: string;
  variantName: string;
  unitPriceIdr: number;
  modifierOptionIds: string[];
  modifierNames: string[];
  note: string;
  quantity: number;
}

export type CustomerScreenView =
  | 'menu'
  | 'keranjang'
  | 'pesanan'
  | 'pembayaran'
  | 'bantuan'
  | 'wifi'
  | 'member'
  | 'antrean';

export function CustomerApp({
  snapshot,
  onCommand,
  busy,
  onOpenStaffPortal,
  onRefresh,
  initialTableId,
  initialBillId,
  onContextChange,
}: {
  snapshot: any;
  onCommand: (command: string, payload: any) => Promise<any>;
  busy: boolean;
  onOpenStaffPortal?: () => void;
  onRefresh?: () => Promise<void>;
  initialTableId?: string;
  initialBillId?: string;
  onContextChange?: (tableId: string, principalId: string) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const canOrder = isModuleEnabled('ordering');
  const canPayOnline = isModuleEnabled('payments');
  const canUseTables = isModuleEnabled('tables');
  const canUseLoyalty = isModuleEnabled('loyalty');
  const canUsePromos = isModuleEnabled('marketing');
  const storageKey = `cafe:${cafeConfig.venue.tenantSlug}:${cafeConfig.venue.outletSlug}`;
  const [customerPrincipalId, setCustomerPrincipalId] = useState('');
  const screenEnabled = (screen: CustomerScreenView) => {
    if (['keranjang', 'pesanan', 'pembayaran'].includes(screen)) return canOrder;
    if (['bantuan', 'antrean'].includes(screen)) return canUseTables;
    if (screen === 'member') return canUseLoyalty || canUsePromos;
    return true;
  };

  // Navigation & Drawer state
  const [activeScreen, setActiveScreen] = useState<CustomerScreenView>(initialBillId && canOrder ? 'pembayaran' : 'menu');
  const [profileDrawerOpen, setProfileDrawerOpen] = useState<boolean>(false);
  const [tableModalOpen, setTableModalOpen] = useState<boolean>(false);

  // Table & Order Mode context
  const [orderMode, setOrderMode] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState<string>(initialTableId || snapshot?.tables?.[0]?.id || '');

  // Menu Filtering (Shadcn SelectField Category + Search + Favorites filter)
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);

  // Item configuration modal + Multi-photo carousel index
  const [configuringItem, setConfiguringItem] = useState<any | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedModOptionIds, setSelectedModOptionIds] = useState<string[]>([]);
  const [itemNote, setItemNote] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [modalError, setModalError] = useState<string>('');

  // Cart state
  const [cart, setCart] = useState<CartLineDraft[]>([]);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [localFavoriteIds, setLocalFavoriteIds] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareQr, setShareQr] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [paymentQrImage, setPaymentQrImage] = useState({ payload: '', url: '' });
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);


  // Customer identity & OTP state (C03 / C04)
  const [identityMode, setIdentityMode] = useState<'GUEST' | 'MEMBER'>('GUEST');
  const [guestName, setGuestName] = useState<string>('');
  const [memberContact, setMemberContact] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [loggedInMemberId, setLoggedInMemberId] = useState<string>('');
  const [otpStatusMessage, setOtpStatusMessage] = useState<string>('');

  // Presence check state (C05 / B07)
  const [presenceVerified, setPresenceVerified] = useState<boolean>(false);
  const [presenceStatusText, setPresenceStatusText] = useState<string>(
    ''
  );
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');

  // Promo & Quote state (C06)
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [activeQuote, setActiveQuote] = useState<any | null>(null);
  const [checkoutError, setCheckoutError] = useState<string>('');
  const [checkoutSuccessMsg, setCheckoutSuccessMsg] = useState<string>('');

  // Payment screen state (C08 / C09)
  const [selectedBillId, setSelectedBillId] = useState<string>(initialBillId || '');
  const paymentSubmissionRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'QRIS' | 'VIRTUAL_ACCOUNT'>(
    'QRIS'
  );
  const [paymentFeedback, setPaymentFeedback] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string>('');
  const copyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Table Help / Service Request state (C10)
  const [helpType, setHelpType] = useState<
    'CALL_WAITER' | 'REQUEST_BILL' | 'CUTLERY_NAPKIN' | 'PACK_LEFTOVER' | 'ORDER_ISSUE'
  >('CALL_WAITER');
  const [helpNotes, setHelpNotes] = useState<string>('');
  const [helpFeedback, setHelpFeedback] = useState<string>('');

  // Feedback / Review state (C11)
  const [overallRating, setOverallRating] = useState<number>(5);
  const [tasteRating, setTasteRating] = useState<number>(5);
  const [serviceRating, setServiceRating] = useState<number>(5);
  const [commentText, setCommentText] = useState<string>('');
  const [reviewSubmittedMsg, setReviewSubmittedMsg] = useState<string>('');

  // Waitlist state (C13)
  const [waitlistName, setWaitlistName] = useState<string>('');
  const [waitlistPartySize, setWaitlistPartySize] = useState<number>(2);
  const [waitlistArea, setWaitlistArea] = useState<string>('Ruang Utama (Indoor)');
  const [waitlistPhone, setWaitlistPhone] = useState<string>('');
  const [waitlistNotes, setWaitlistNotes] = useState<string>('');
  const [waitlistNotice, setWaitlistNotice] = useState<string>('');
  const [waitlistError, setWaitlistError] = useState('');
  const [waitlistTicket, setWaitlistTicket] = useState<any | null>(null);
  const rememberWaitlist = (ticket: any) => { setWaitlistTicket(ticket); try { if (ticket) localStorage.setItem(`${storageKey}:waitlist`, JSON.stringify(ticket)); else localStorage.removeItem(`${storageKey}:waitlist`); } catch { /* The current tab can still track its queue without storage. */ } };
  const refreshWaitlist = async () => {
    if (!waitlistTicket?.privateToken || busy) return;
    setWaitlistError('');
    try { const response = await onCommand('WAITLIST_ACTION', { action: 'GET_STATUS', privateToken: waitlistTicket.privateToken }); rememberWaitlist({ ...waitlistTicket, ...(response?.result || response) }); }
    catch (caught) { setWaitlistError(caught instanceof Error ? caught.message : 'Antrean belum dapat diperbarui.'); }
  };

  const selectedTable = useMemo(() => {
    return (
      snapshot?.tables?.find((t: any) => t.id === selectedTableId) ||
      snapshot?.tables?.[0] || { id: '', label: '', areaName: '' }
    );
  }, [snapshot, selectedTableId]);

  const hasTableQrContext = Boolean(initialTableId && selectedTableId === initialTableId && orderMode === 'DINE_IN' && selectedTable.qrToken);

  const currentMember = useMemo(() => {
    return snapshot?.members?.find((m: any) => m.id === loggedInMemberId) || null;
  }, [snapshot, loggedInMemberId]);

  const favoriteIds = useMemo(() => {
    return new Set<string>([...((currentMember?.favoriteMenuIdsJson as string[]) || []), ...localFavoriteIds]);
  }, [currentMember, localFavoriteIds]);

  // Hydrate browser-owned storage after SSR. The initial server and client render
  // must agree; the cart stays unwritable until this one-time synchronization ends.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`${storageKey}:cart`) || '{}');
      if (Array.isArray(stored.cart)) setCart(stored.cart.filter((line: CartLineDraft) => line && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 20 && typeof line.menuItemId === 'string' && typeof line.variantId === 'string' && typeof line.cartLineId === 'string' && typeof line.itemName === 'string' && typeof line.variantName === 'string' && typeof line.note === 'string' && Number.isFinite(line.unitPriceIdr) && line.unitPriceIdr >= 0 && Array.isArray(line.modifierOptionIds) && line.modifierOptionIds.every((id) => typeof id === 'string') && Array.isArray(line.modifierNames) && line.modifierNames.every((name) => typeof name === 'string')));
      if (typeof stored.name === 'string') setGuestName(stored.name);
      if (Array.isArray(stored.favorites)) setLocalFavoriteIds(stored.favorites.filter((id: unknown) => typeof id === 'string'));
    } catch { /* A damaged local cart starts empty. */ }
    try {
      const ticket = JSON.parse(localStorage.getItem(`${storageKey}:waitlist`) || 'null');
      if (ticket && typeof ticket.privateToken === 'string' && typeof ticket.id === 'string') setWaitlistTicket(ticket);
    } catch { /* Ignore a malformed local queue ticket. */ }
    let principal = '';
    try { principal = localStorage.getItem(`${storageKey}:guest`) || ''; } catch { /* Private storage. */ }
    if (!/^guest_[a-z0-9-]+$/i.test(principal)) principal = `guest_${crypto.randomUUID()}`;
    setCustomerPrincipalId(principal);
    try { localStorage.setItem(`${storageKey}:guest`, principal); } catch { /* In-memory session still works. */ }
    setCartLoaded(true);
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (customerPrincipalId) onContextChange?.(selectedTableId, customerPrincipalId);
  }, [selectedTableId, customerPrincipalId, onContextChange]);

  useEffect(() => {
    if (cartLoaded) {
      try { localStorage.setItem(`${storageKey}:cart`, JSON.stringify({ cart, name: guestName, favorites: localFavoriteIds })); } catch { /* Storage may be unavailable in private browsing. */ }
    }
  }, [cart, guestName, localFavoriteIds, cartLoaded, storageKey]);

  useEffect(() => {
    if (!shareOpen) return;
    let active = true;
    const path = selectedTable.qrToken ? `/t/${cafeConfig.venue.tenantSlug}/${cafeConfig.venue.outletSlug}/m/${encodeURIComponent(selectedTable.qrToken)}` : '/';
    const url = new URL(path, window.location.origin).toString();
    QRCode.toDataURL(url, { width: 320, margin: 2, color: { dark: '#30231f', light: '#ffffff' } })
      .then((image) => { if (active) { setShareUrl(url); setShareQr(image); } })
      .catch(() => { if (active) setShareQr(''); });
    return () => { active = false; };
  }, [shareOpen, selectedTable.qrToken, snapshot?.outlet?.slug]);

  const tableMatches = (record: any) => orderMode === 'TAKEAWAY'
    ? record.mode === 'TAKEAWAY' && Boolean(guestName.trim()) && record.customerName === guestName.trim()
    : record.tableId === selectedTableId || record.tableLabel === selectedTable.label || record.tableLabelSnapshot === selectedTable.label;
  const currentVisit = (snapshot?.visits || []).find((visit: any) => visit.status === 'OPEN' && (visit.primaryTableId === selectedTableId || visit.tableLabelsJson?.includes(selectedTable.label)));
  const customerOrders = (snapshot?.orders || []).filter((order: any) => tableMatches(order) || (order.mode === orderMode && order.visitId === currentVisit?.id));
  const customerRequests = (snapshot?.orderRequests || []).filter(tableMatches);
  const customerBills = (snapshot?.bills || []).filter((bill: any) => bill.lifecycle !== 'VOID' && (tableMatches(bill) || customerOrders.some((order: any) => order.visitId === bill.visitId)));
  const tableUnavailable = orderMode === 'DINE_IN' && ['NEEDS_CLEANING', 'OUT_OF_SERVICE'].includes(selectedTable.physicalState);

  useEffect(() => () => {
    if (copyFeedbackTimer.current) clearTimeout(copyFeedbackTimer.current);
  }, []);

  const categoriesWithCounts = useMemo(() => {
    const catalog = snapshot?.catalog || [];
    const cats = (snapshot?.categories || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      count: catalog.filter((item: any) => item.categoryId === c.id).length,
    }));
    return [{ id: 'ALL', name: 'Semua Kategori', count: catalog.length }, ...cats];
  }, [snapshot]);

  const filteredCatalog = useMemo(() => {
    const catalog = snapshot?.catalog || [];
    return catalog.filter((item: any) => {
      if (activeCategoryId !== 'ALL' && item.categoryId !== activeCategoryId) {
        return false;
      }
      if (onlyFavorites && !favoriteIds.has(item.id)) {
        return false;
      }
      if (onlyAvailable && !item.isAvailable) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = item.name.toLowerCase().includes(q);
        const inDesc = (item.description || '').toLowerCase().includes(q);
        const inTags = Array.isArray(item.tagsJson)
          ? item.tagsJson.some((t: string) => t.toLowerCase().includes(q))
          : false;
        return inName || inDesc || inTags;
      }
      return true;
    });
  }, [snapshot, activeCategoryId, onlyFavorites, onlyAvailable, favoriteIds, searchQuery]);

  // Cart live pricing calculation (respecting configurable outlet tax & service charge)
  const cartSummary = useMemo(() => {
    const subtotal = cart.reduce((sum, c) => sum + c.unitPriceIdr * c.quantity, 0);
    const totalQty = cart.reduce((sum, c) => sum + c.quantity, 0);
    const taxInclusive = Boolean(snapshot?.outlet?.taxInclusiveDisplay);
    const serviceBps = taxInclusive ? 0 : (snapshot?.outlet?.serviceChargeBps ?? 500);
    const taxBps = taxInclusive ? 0 : (snapshot?.outlet?.taxBps ?? 1000);
    const serviceInTaxBase = snapshot?.outlet?.serviceInTaxBase ?? true;

    const serviceIdr = Math.round((subtotal * serviceBps) / 10000);
    const taxBase = serviceInTaxBase ? subtotal + serviceIdr : subtotal;
    const taxIdr = Math.round((taxBase * taxBps) / 10000);
    return {
      totalQty,
      subtotalIdr: subtotal,
      discountIdr: 0,
      serviceIdr,
      taxIdr,
      totalIdr: subtotal + serviceIdr + taxIdr,
      serviceChargeBps: serviceBps,
      taxBps,
      taxInclusiveDisplay: taxInclusive,
    };
  }, [cart, snapshot]);

  // Active table orders & bills for quick status banner
  const activeOrdersCount = customerRequests.filter((r: any) => r.state === 'REQUESTED').length + customerOrders.filter((order: any) => (snapshot?.orderUnits || []).some((unit: any) => unit.orderId === order.id && !['CANCELLED', 'DELIVERED', 'PICKED_UP', 'SERVED'].includes(unit.fulfillmentStatus))).length;
  const unpaidBills = customerBills.filter((bill: any) => bill.lifecycle !== 'VOID' && bill.balanceIdr > 0);

  const updateCart = (next: CartLineDraft[]) => {
    setCart(next);
    setActiveQuote(null);
  };

  const openItemModal = (item: any) => {
    const defaultVar = item.variants?.find((v: any) => v.isDefault) || item.variants?.[0];
    setEditingLineId(null);
    setConfiguringItem(item);
    setActivePhotoIndex(0);
    setSelectedVariantId(defaultVar?.id || '');
    setSelectedModOptionIds([]);
    setItemNote('');
    setItemQuantity(1);
    setModalError('');
  };

  const handleQuickAddOrConfigure = (item: any) => openItemModal(item);

  const editCartLine = (line: CartLineDraft) => {
    const item = snapshot?.catalog?.find((entry: any) => entry.id === line.menuItemId);
    if (!item) return;
    openItemModal(item);
    setEditingLineId(line.cartLineId);
    setSelectedVariantId(line.variantId);
    setSelectedModOptionIds(line.modifierOptionIds);
    setItemNote(line.note);
    setItemQuantity(line.quantity);
  };

  const handleConfirmModalAdd = () => {
    if (!configuringItem) return;
    if (!configuringItem.isAvailable) { setModalError('Menu sedang habis.'); return; }
    const variant = configuringItem.variants?.find((v: any) => v.id === selectedVariantId);
    if (!variant) {
      setModalError('Pilih salah satu varian ukuran/sajian terlebih dahulu.');
      return;
    }
    if (variant.availableToSell < itemQuantity) {
      setModalError(
        `Stok varian ${variant.name} hanya tersisa ${variant.availableToSell} porsi.`
      );
      return;
    }

    const groups = configuringItem.modifierGroups || [];
    const allOptions = groups.flatMap((g: any) => g.options || []);
    const chosenOptions = allOptions.filter((o: any) => selectedModOptionIds.includes(o.id));

    for (const grp of groups) {
      const countInGrp = chosenOptions.filter((o: any) => o.groupId === grp.id).length;
      if (grp.required && countInGrp < grp.minSelect) {
        setModalError(`Pilihan wajib "${grp.name}" harus dipilih minimal ${grp.minSelect}.`);
        return;
      }
      if (countInGrp > grp.maxSelect) {
        setModalError(`Pilihan "${grp.name}" maksimal ${grp.maxSelect} opsi.`);
        return;
      }
    }

    const modPrice = chosenOptions.reduce((s: number, o: any) => s + o.priceIdr, 0);
    const unitPriceIdr = variant.priceIdr + modPrice;

    updateCart([
      ...cart.filter((line) => line.cartLineId !== editingLineId),
      {
        cartLineId: editingLineId || `cl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        menuItemId: configuringItem.id,
        variantId: variant.id,
        itemName: configuringItem.name,
        variantName: variant.name,
        unitPriceIdr,
        modifierOptionIds: chosenOptions.map((o: any) => o.id),
        modifierNames: chosenOptions.map((o: any) => o.name),
        note: itemNote.trim().slice(0, 200),
        quantity: itemQuantity,
      },
    ]);

    setConfiguringItem(null);
  };

  const handleVerifyOtp = () => {
    setOtpStatusMessage('Login member belum tersedia. Gunakan nama pemesan.');
  };

  const handleCheckGpsPresence = async () => {
    setCheckoutError('');
    if (!navigator.geolocation) { setCheckoutError('GPS tidak tersedia. Gunakan kode meja.'); return; }
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const res = await onCommand('VERIFY_PRESENCE', {
          principalId: identityMode === 'MEMBER' ? loggedInMemberId : customerPrincipalId,
          lat: position.coords.latitude, lng: position.coords.longitude, accuracyMeters: position.coords.accuracy,
        });
        const check = res?.result || res;
        setPresenceVerified(Boolean(check?.eligible));
        setPresenceStatusText(check?.message || '');
        if (!check?.eligible) setCheckoutError(check?.message || 'Lokasi belum terverifikasi.');
      } catch (err: any) { setCheckoutError(err.message); }
    }, () => setCheckoutError('Lokasi belum terbaca. Gunakan kode meja dari staf.'), { enableHighAccuracy: true, timeout: 10000 });
  };

  const handleUseJoinCode = async () => {
    setCheckoutError('');
    try {
      const res = await onCommand('VERIFY_PRESENCE', {
        principalId: identityMode === 'MEMBER' ? loggedInMemberId : customerPrincipalId,
        joinCode: joinCodeInput,
      });
      const check = res?.result || res;
      setPresenceVerified(Boolean(check?.eligible));
      setPresenceStatusText(check?.message || '');
      if (!check?.eligible) {
        setCheckoutError(check?.message || 'Kode gabung tidak valid.');
      }
    } catch (err: any) {
      setCheckoutError(err.message);
    }
  };

  const handleRequestQuote = async (overridePromoCode?: string) => {
    setCheckoutError('');
    setCheckoutSuccessMsg('');
    const codeToApply =
      typeof overridePromoCode === 'string' ? overridePromoCode : promoCodeInput.trim();
    if (typeof overridePromoCode === 'string') {
      setPromoCodeInput(overridePromoCode);
    }
    try {
      const res = await onCommand('CREATE_QUOTE', {
        principalId: identityMode === 'MEMBER' ? loggedInMemberId : customerPrincipalId,
        memberId: identityMode === 'MEMBER' ? loggedInMemberId : undefined,
        mode: orderMode,
        tableId: orderMode === 'DINE_IN' ? selectedTableId : undefined,
        promoCode: canUsePromos ? codeToApply || undefined : undefined,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          variantId: c.variantId,
          modifierOptionIds: c.modifierOptionIds,
          note: c.note,
          quantity: c.quantity,
        })),
      });
      const quote = res?.result || res;
      setActiveQuote(quote);
      return quote;
    } catch (err: any) {
      setCheckoutError(err.message);
      return null;
    }
  };

  const handleReviewOrder = async () => {
    if (guestName.trim().length < 2) { setCheckoutError('Isi nama pemesan, minimal 2 karakter.'); return; }
    if (orderMode === 'DINE_IN' && !hasTableQrContext && !presenceVerified) { setCheckoutError('Verifikasi lokasi atau masukkan kode meja.'); return; }
    const quote = await handleRequestQuote();
    if (quote) setConfirmOrderOpen(true);
  };

  const handleSubmitOrderRequest = async () => {
    setCheckoutError('');
    setCheckoutSuccessMsg('');
    if (identityMode === 'MEMBER' && !loggedInMemberId) { setCheckoutError('Lanjutkan sebagai tamu.'); return; }
    if (guestName.trim().length < 2) {
      setCheckoutError(
        'Isi nama pemesan, minimal 2 karakter.'
      );
      return;
    }
    if (orderMode === 'DINE_IN' && !hasTableQrContext && !presenceVerified) {
      setCheckoutError('Verifikasi lokasi atau masukkan kode meja.');
      return;
    }

    try {
      const quoteToUse = activeQuote;
      if (!quoteToUse || Date.parse(quoteToUse.expiresAt) <= Date.now()) {
        const renewed = await handleRequestQuote();
        if (renewed) setCheckoutError('Harga telah diperbarui. Periksa total, lalu kirim pesanan lagi.');
        return;
      }

      const idemKey = `idem_${quoteToUse.quoteId}`;
      const subRes = await onCommand('SUBMIT_ORDER_REQUEST', {
        quoteId: quoteToUse.quoteId,
        principalId: identityMode === 'MEMBER' ? loggedInMemberId : customerPrincipalId,
        memberId: identityMode === 'MEMBER' ? loggedInMemberId : undefined,
        customerName: guestName.trim(),
        mode: orderMode,
        tableId: orderMode === 'DINE_IN' ? selectedTableId : undefined,
        presenceVerified,
        tableQrToken: hasTableQrContext ? selectedTable.qrToken : undefined,
        idempotencyKey: idemKey,
      });

      const outcome = subRes?.result || subRes;
      setCheckoutSuccessMsg(
        outcome?.orderId
          ? 'Pesanan diterima.'
          : 'Menunggu konfirmasi staf.'
      );
      if (outcome?.billId) {
        setSelectedBillId(outcome.billId);
      }
      updateCart([]);
      setConfirmOrderOpen(false);
      setActiveScreen('pesanan');
    } catch (err: any) {
      setCheckoutError(err.message);
    }
  };

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (copyFeedbackTimer.current) clearTimeout(copyFeedbackTimer.current);
      setCopiedKey(key);
      copyFeedbackTimer.current = setTimeout(() => setCopiedKey(''), 1800);
    } catch {
      setCopiedKey('');
    }
  };

  const getBillShareUrl = (bill: any) => {
    const url = new URL(
      `/t/${cafeConfig.venue.tenantSlug}/${cafeConfig.venue.outletSlug}/m/${encodeURIComponent(selectedTable.qrToken)}`,
      window.location.origin
    );
    url.searchParams.set('bill', bill.shareToken);
    return url.toString();
  };

  const selectedBill = customerBills.find((bill: any) => bill.id === selectedBillId) || customerBills.find((bill: any) => bill.balanceIdr > 0) || customerBills[0] || null;
  const pendingAttempt = (selectedBill?.attempts || []).find((attempt: any) => ['PENDING', 'CREATING', 'UNKNOWN'].includes(attempt.status));
  const paymentInstructions = pendingAttempt?.instructionsJson || {};
  const paymentIsDemo = Boolean(paymentInstructions.isDemo || snapshot?.paymentAccount?.isDemo);
  const paymentQrPayload = paymentInstructions.qrPayload || '';
  const paymentQr = paymentQrImage.payload === paymentQrPayload ? paymentQrImage.url : '';
  useEffect(() => {
    let active = true;
    if (paymentQrPayload) QRCode.toDataURL(paymentQrPayload, { width: 320, margin: 2 })
      .then((url) => { if (active) setPaymentQrImage({ payload: paymentQrPayload, url }); })
      .catch(() => { if (active) setPaymentQrImage({ payload: paymentQrPayload, url: '' }); });
    return () => { active = false; };
  }, [paymentQrPayload]);

  const navigateFromDrawer = (screen: CustomerScreenView) => {
    setActiveScreen(screen);
    setProfileDrawerOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Each screen is a separate task. Start at its heading when switching tabs,
  // including when the previous screen was scrolled beneath the sticky header.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeScreen]);


  const configuringPhotos: string[] = useMemo(() => {
    if (!configuringItem) return [];
    if (Array.isArray(configuringItem.photos) && configuringItem.photos.length > 0) {
      return configuringItem.photos;
    }
    return configuringItem.photoUrl ? [configuringItem.photoUrl] : [];
  }, [configuringItem]);

  return (
    <div className={`${styles.customer} min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col`}>
      {/* ===================================================================== */}
      {/* STICKY MOBILE-FIRST CUSTOMER HEADER                                   */}
      {/* ===================================================================== */}
      <a className="skip-link" href="#customer-content">Ke menu utama</a>
      <header className="sticky top-0 z-30 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-[1080px] mx-auto px-4 py-2 flex items-center justify-between gap-2">
          {/* Left: Clean ArrowLeft Back Icon (when on sub-screen) + Outlet & Table Context */}
          <div className="flex items-center gap-2 min-w-0">
            {activeScreen !== 'menu' ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveScreen('menu')}
                aria-label="Kembali ke menu utama"
                className="w-9 h-9 -ml-1.5 flex items-center justify-center text-[var(--foreground)] hover:text-[var(--primary-ink)] cursor-pointer shrink-0 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
            ) : null}

            <BrandMark className="hidden min-[370px]:inline-flex" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading text-[21px] leading-[25px] font-bold text-[var(--foreground)] truncate">
                  {cafeConfig.brand.name}
                </span>
                {snapshot?.runtime?.demo && <span className="text-[11px] text-[var(--muted-foreground)] shrink-0">Demo</span>}
                {!snapshot?.runtime?.demo && snapshot?.runtime?.sampleMenu && <span className="text-[11px] text-[var(--muted-foreground)] shrink-0">Contoh menu</span>}
              </div>

              {/* Interactive Table / Order Mode Selector */}
              {selectedTable.id ? <button
                type="button"
                onClick={() => setTableModalOpen(true)}
                className="mt-0.5 inline-flex items-center gap-1 text-[13px] leading-[18px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer max-w-full"
              >
                <MapPin className="w-3.5 h-3.5 text-[var(--primary-ink)] shrink-0" />
                <span className="truncate">
                  {orderMode === 'DINE_IN'
                    ? `Meja ${selectedTable.label} (${selectedTable.areaName})`
                    : 'Bawa pulang'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              </button> : <p className="text-xs mt-1 text-[var(--muted-foreground)]">{cafeConfig.venue.address}</p>}
            </div>
          </div>

          {/* Right: 3 Clean Unboxed Action Icons (Favorites Heart, Shopping Cart, Profile/Services) */}
          <div className="flex items-center gap-1 shrink-0 -mr-1">
            {/* 1. Love / Favorites Icon Button (No card wrapper) */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (activeScreen !== 'menu') {
                  setActiveScreen('menu');
                  setOnlyFavorites(true);
                } else {
                  setOnlyFavorites(!onlyFavorites);
                }
              }}
              aria-label="Filter menu favorit"
              aria-pressed={onlyFavorites}
              className={`relative w-12 h-12 hidden sm:flex items-center justify-center transition-colors cursor-pointer ${
                onlyFavorites
                  ? 'text-[#9E2A2B]'
                  : 'text-[var(--foreground)] hover:text-[var(--primary-ink)]'
              }`}
            >
              <Heart className={`w-5 h-5 ${onlyFavorites ? 'fill-[#9E2A2B]' : ''}`} />
              <AnimatePresence mode="popLayout">
                {favoriteIds.size > 0 && (
                  <motion.span
                    key={favoriteIds.size}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[10px] font-bold flex items-center justify-center tabular-nums"
                  >
                    {favoriteIds.size}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Cart is absent in catalog-only packages. */}
            {canOrder && <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() =>
                setActiveScreen(activeScreen === 'keranjang' ? 'menu' : 'keranjang')
              }
              aria-label={`Keranjang belanja (${cartSummary.totalQty} item)`}
              className={`relative w-12 h-12 hidden sm:flex items-center justify-center transition-colors cursor-pointer ${
                activeScreen === 'keranjang'
                  ? 'text-[var(--primary-ink)]'
                  : 'text-[var(--foreground)] hover:text-[var(--primary-ink)]'
              }`}
            >
              <ShoppingCart
                className={`w-5 h-5 ${activeScreen === 'keranjang' ? 'stroke-[2.4]' : ''}`}
              />
              <AnimatePresence mode="popLayout">
                {cartSummary.totalQty > 0 && (
                  <motion.span
                    key={cartSummary.totalQty}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-[10px] font-bold flex items-center justify-center tabular-nums"
                  >
                    {cartSummary.totalQty}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            }
            {/* 3. Profile, Orders, Payment & Table Services Icon Button (No card wrapper) */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setProfileDrawerOpen(true)}
              aria-label="Menu profil, pesanan, dan layanan meja"
              className={`relative w-12 h-12 flex items-center justify-center transition-colors cursor-pointer ${
                profileDrawerOpen ||
                ['pesanan', 'pembayaran', 'bantuan', 'wifi', 'member', 'antrean'].includes(
                  activeScreen
                )
                  ? 'text-[var(--primary-ink)]'
                  : 'text-[var(--foreground)] hover:text-[var(--primary-ink)]'
              }`}
            >
              <User className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MAIN MOBILE-FIRST CONTENT CONTAINER (ANIMATED VIEWS, LESS CARDS)      */}
      {/* ===================================================================== */}
      <main id="customer-content" className="flex-1 w-full max-w-[1080px] mx-auto px-4 sm:px-6 pt-3 pb-28 min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          {/* ================================================================= */}
          {/* SCREEN 1: MENU PELANGGAN (C01, C02, C14)                          */}
          {/* ================================================================= */}
          {activeScreen === 'menu' && (
            <MotionPanel
              key="screen-menu"
              className="space-y-3"
            >
              <PageHeader title="Menu" className="border-b-0 pb-0" />
              {snapshot?.outlet?.availabilityNote && <p className="text-xs text-[var(--muted-foreground)]">{snapshot.outlet.availabilityNote}</p>}
              {canOrder && (activeOrdersCount > 0 || unpaidBills.length > 0) && (
                <button type="button" onClick={() => setActiveScreen('pesanan')} className={styles.orderNotice}>
                  <span className="flex items-center gap-3"><span className="text-[var(--primary-ink)]"><Receipt className="h-4 w-4 text-[var(--primary-ink)]" /></span><span className="font-medium text-sm">{unpaidBills.length ? 'Tagihan belum dibayar' : 'Pesanan diproses'}</span></span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              <div className={styles.menuToolbar}>
                <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Cari menu" />
                <ChoiceStrip items={categoriesWithCounts.map((category:any)=>({ id:category.id, label:category.id==='ALL'?'Semua':category.name }))} value={activeCategoryId} onChange={setActiveCategoryId} ariaLabel="Kategori menu" variant="underline" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <h2 className="font-heading font-semibold text-lg">{onlyFavorites ? 'Favorit' : categoriesWithCounts.find((category: any) => category.id === activeCategoryId)?.name?.replace('Semua Kategori', 'Semua menu')}</h2>
                <div className="flex flex-wrap items-center gap-1"><FilterToggle pressed={onlyFavorites} onPressedChange={setOnlyFavorites} className="sm:hidden">Favorit</FilterToggle><FilterToggle pressed={onlyAvailable} onPressedChange={setOnlyAvailable}>Tersedia saja</FilterToggle></div>
              </div>
              {filteredCatalog.length === 0 ? (
                <EmptyState title="Menu tidak ditemukan" description="Coba kata kunci atau kategori lain." actionLabel="Reset pencarian" onAction={() => { setSearchQuery(''); setActiveCategoryId('ALL'); setOnlyFavorites(false); setOnlyAvailable(false); }} />
              ) : (
                <div className={styles.menuGrid} role="list" aria-label="Menu"><AnimatePresence initial={false} mode="popLayout">
                  {filteredCatalog.map((item: any, itemIndex: number) => {
                    const variant = item.variants?.find((entry: any) => entry.isDefault) || item.variants?.[0];
                    const photos = item.photos?.length ? item.photos : item.photoUrl ? [item.photoUrl] : [];
                    const quantity = cart.filter((line) => line.menuItemId === item.id).reduce((total, line) => total + line.quantity, 0);
                    const favorite = favoriteIds.has(item.id);
                    return <MotionItem order={itemIndex} key={item.id} role="listitem" className={`${styles.menuCard} ${!item.isAvailable ? styles.soldOut : ''}`}>
                      <div className={styles.menuImage}>
                        <button type="button" onClick={() => openItemModal(item)} aria-label={`Lihat ${item.name}`} className="w-full h-full">
                          {photos[0] ? <Image src={photos[0]} alt={item.name} width={640} height={480} unoptimized loading="lazy" /> : <Coffee className="w-12 h-12 text-[var(--primary-ink)] mx-auto" />}
                        </button>
                        <button type="button" onClick={() => setLocalFavoriteIds((ids) => favorite ? ids.filter((id) => id !== item.id) : [...ids, item.id])} aria-label={`${favorite ? 'Hapus' : 'Simpan'} ${item.name} ${favorite ? 'dari' : 'ke'} favorit`} aria-pressed={favorite} className={styles.favorite}><Heart className={`w-4 h-4 ${favorite ? 'fill-[var(--primary-ink)] text-[var(--primary-ink)]' : ''}`} /></button>
                        {!item.isAvailable && <span className={styles.soldOutBadge}>Habis</span>}
                        {canOrder && quantity > 0 && <span className={styles.quantityBadge}>{quantity} di keranjang</span>}
                      </div>
                      <div className={styles.menuCardBody}>
                        <button type="button" onClick={() => openItemModal(item)} className="text-left font-heading font-semibold text-[15px] sm:text-base leading-snug">{item.name}</button>
                        <p className={styles.menuDescription}>{item.description}</p>
                        <div className="flex items-center justify-between gap-2 mt-auto pt-2">
                          <Money amount={item.minPriceIdr || variant?.priceIdr || 0} className="font-semibold text-sm sm:text-base" />
                          {canOrder && <Button variant="subtle" size="sm" aria-label={`Tambah ${item.name}`} disabled={!item.isAvailable || busy} onClick={() => handleQuickAddOrConfigure(item)} className="min-h-[44px] min-w-[44px]"><Plus className="w-4 h-4" /><span className="hidden sm:inline">Tambah</span></Button>}
                        </div>
                      </div>
                    </MotionItem>;
                  })}
                </AnimatePresence></div>
              )}
              <p className="text-xs text-[var(--muted-foreground)] pt-2">{formatOutletChargePolicy(snapshot?.outlet)}</p>
            </MotionPanel>
          )}

          {/* ================================================================= */}
          {/* SCREEN 2: KERANJANG, IDENTITAS, LOKASI & QUOTE PROMO (C03–C06)    */}
          {/* ================================================================= */}
          {screenEnabled('keranjang') && activeScreen === 'keranjang' && (
            <MotionPanel
              key="screen-keranjang"
              className="space-y-6"
            >
              <div className={styles.screenHeading}>
                <h1 className="font-heading text-[22px] font-bold">Keranjang</h1>
                <Button variant="secondary" size="sm" onClick={() => setActiveScreen('menu')}>
                  + Tambah menu
                </Button>
              </div>

              {cart.length === 0 ? (
                <EmptyState
                  title="Keranjang masih kosong"
                  description="Pilih minuman atau makanan dari daftar menu untuk mulai memesan."
                  actionLabel="Lihat Menu"
                  onAction={() => setActiveScreen('menu')}
                />
              ) : (
                <div className="space-y-6">
                  {/* 1. Daftar Item Keranjang (Open Hairline List · No outer box card) */}
                  <section className="space-y-2">
                    <h2 className="font-heading text-[16px] font-semibold">
                      Menu ({cartSummary.totalQty} item)
                    </h2>
                    <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                      {cart.map((line, idx) => (
                        <motion.div
                          key={line.cartLineId}
                          layout="position"
                          className="py-3.5 flex items-start justify-between gap-3"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-semibold text-[15px] text-[var(--foreground)]">
                              {line.itemName}
                            </p>
                            <p className="text-[13px] text-[var(--muted-foreground)]">
                              {line.variantName}
                              {line.modifierNames.length > 0
                                ? ` · ${line.modifierNames.join(', ')}`
                                : ''}
                            </p>
                            {line.note && (
                              <p className="text-[12px] text-[var(--muted-foreground)] italic">
                                Catatan: &ldquo;{line.note}&rdquo;
                              </p>
                            )}
                            <div className="flex items-center gap-4 pt-2">
                              <Money amount={line.unitPriceIdr * line.quantity} className="font-semibold text-[14px]" />
                              <button type="button" className="text-sm text-[var(--primary-ink)] inline-flex items-center gap-1" onClick={() => editCartLine(line)}><Pencil className="h-3 w-3" /> Ubah</button>
                            </div>
                          </div>

                          <QuantityControl
                            value={line.quantity}
                            itemLabel={line.itemName}
                            onChange={(nextQty) => {
                              if (nextQty <= 0) {
                                updateCart(cart.filter((_, i) => i !== idx));
                              } else {
                                const copy = [...cart];
                                copy[idx] = { ...line, quantity: nextQty };
                                updateCart(copy);
                              }
                            }}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </section>

                  {/* 2. Identitas Pemesan (Unboxed Section with Shadcn Input & AnimatedSegmentedControl) */}
                  <section className="space-y-3 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-heading text-[16px] font-semibold">Nama pemesan</h2>
                      {canUseLoyalty && <AnimatedSegmentedControl
                        options={[
                          { value: 'GUEST', label: 'Tamu' },
                          { value: 'MEMBER', label: 'Member' },
                        ]}
                        value={identityMode}
                        onChange={(mode) => { setIdentityMode(mode); setActiveQuote(null); }}
                        ariaLabel="Mode identitas pemesan"
                        layoutId="customer-identity-mode"
                      />}
                    </div>

                    {identityMode === 'GUEST' ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="guest-name-input">
                          Nama
                        </Label>
                        <Input
                          id="guest-name-input"
                          value={guestName}
                          onChange={(e) => { setGuestName(e.target.value); setActiveQuote(null); }}
                          placeholder="Nama Anda"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl bg-[var(--accent-surface)] p-4 space-y-3">
                        <p className="text-sm text-[var(--muted-foreground)]">Login member belum tersedia.</p>
                        <Button variant="secondary" onClick={() => { setIdentityMode('GUEST'); setActiveQuote(null); }}>Lanjut sebagai tamu</Button>
                      </div>
                    )}
                  </section>

                  {/* 3. Verifikasi Kehadiran Meja (Unboxed Section with Hairline Top Divider) */}
                  {orderMode === 'DINE_IN' && !hasTableQrContext && <section className="pt-5 border-t border-[var(--border)] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-heading text-[16px] font-semibold">
                        Verifikasi meja
                      </h2>
                      <StatusLabel
                        label={presenceVerified ? 'Terverifikasi' : 'Belum terverifikasi'}
                        tone={presenceVerified ? 'success' : 'warning'}
                      />
                    </div>
                    <p className="text-[13px] text-[var(--muted-foreground)]">
                      Gunakan lokasi atau kode meja dari staf.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => handleCheckGpsPresence()}
                      >
                        <MapPin className="w-4 h-4" />
                        <span>Cek lokasi</span>
                      </Button>
                      <div className="flex items-center gap-2 flex-1 min-w-[210px]">
                        <Input
                          aria-label="Kode gabung meja dari staf"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value)}
                          placeholder="Kode meja dari staf"
                          className="uppercase tabular-nums"
                        />
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={handleUseJoinCode}
                        >
                          Terapkan
                        </Button>
                      </div>
                    </div>
                    {presenceStatusText && (
                      <p className="text-[12px] text-[var(--muted-foreground)]">
                        {presenceStatusText}
                      </p>
                    )}
                  </section>}

                  {/* 4. Promo Voucher & Rincian Biaya (Single Subtle Summary Surface) */}
                  <section className="pt-5 border-t border-[var(--border)] space-y-4">
                    <h2 className="font-heading text-[16px] font-semibold">
                      Ringkasan
                    </h2>

                    {canUsePromos && <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          id="promo-code-input"
                          value={promoCodeInput}
                          onChange={(e) => { setPromoCodeInput(e.target.value); setActiveQuote(null); }}
                          placeholder="Masukkan kode promo (mis. HEMAT10)"
                          className="uppercase"
                        />
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => handleRequestQuote()}
                        >
                          Terapkan
                        </Button>
                      </div>

                      {(snapshot?.promotionRules || []).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[12px] text-[var(--muted-foreground)]">
                            Voucher tersedia:
                          </span>
                          {(snapshot?.promotionRules || []).map((p: any) => (
                            <motion.button
                              key={p.id}
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleRequestQuote(p.code)}
                              className="px-2.5 py-1 rounded-[6px] bg-[var(--accent-surface)] border border-[#CBDAC8] text-[12px] font-semibold text-[var(--primary-ink)] hover:bg-[#DFE8DD] cursor-pointer transition-colors"
                            >
                              {p.code} ({p.name})
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>}

                    <div className={`${styles.summary} space-y-3`}>
                      <PaymentBreakdown
                        subtotalIdr={activeQuote?.subtotalIdr ?? cartSummary.subtotalIdr}
                        discountIdr={activeQuote?.discountIdr ?? cartSummary.discountIdr}
                        serviceIdr={activeQuote?.serviceIdr ?? cartSummary.serviceIdr}
                        taxIdr={activeQuote?.taxIdr ?? cartSummary.taxIdr}
                        totalIdr={activeQuote?.totalIdr ?? cartSummary.totalIdr}
                        serviceChargeBps={cartSummary.serviceChargeBps}
                        taxBps={cartSummary.taxBps}
                        taxInclusiveDisplay={cartSummary.taxInclusiveDisplay}
                      />

                      {activeQuote && (
                        <div className="pt-2 border-t border-[var(--border)] text-[12px] text-[var(--primary-ink)] font-medium">
                          Harga berlaku
                          hingga{' '}
                          {new Date(activeQuote.expiresAt).toLocaleTimeString('id-ID', {
                            timeZone: cafeConfig.timezone,
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>

                    {tableUnavailable && <p role="status" className="text-sm text-[var(--status-warning-fg)]">Meja ini belum siap menerima pesanan. Hubungi staf untuk menyiapkan meja atau memilih meja lain.</p>}
                    <InlineError message={checkoutError} />
                    {checkoutSuccessMsg && (
                      <StatusLabel label={checkoutSuccessMsg} tone="success" />
                    )}

                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      disabled={busy || tableUnavailable}
                      onClick={handleReviewOrder}
                    >
                      Periksa pesanan · {formatIdr(activeQuote?.totalIdr ?? cartSummary.totalIdr)}
                    </Button>
                  </section>
                </div>
              )}
            </MotionPanel>
          )}

          {/* ================================================================= */}
          {/* SCREEN 3: STATUS PESANAN 3 SUMBU (C07 · Less Cards, Clean Dividers)*/}
          {/* ================================================================= */}
          {screenEnabled('pesanan') && activeScreen === 'pesanan' && (
            <MotionPanel
              key="screen-pesanan"
              className="space-y-6"
            >
              <div className={styles.ordersHeading}>
                <h1 className="font-heading text-[22px] font-bold">Pesanan</h1>
                <div className={styles.ordersActions}>
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => onRefresh?.()}>Refresh</Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setActiveScreen('pembayaran')}
                >
                  Bayar / Lihat Struk
                </Button>
                </div>
              </div>

              {customerOrders.length === 0 && customerRequests.length === 0 && <EmptyState title="Belum ada pesanan" description="Pesanan Anda akan muncul di sini." actionLabel="Lihat menu" onAction={() => setActiveScreen('menu')} />}
              {customerRequests.filter((request: any) => ['EXPIRED', 'REJECTED', 'CANCELLED'].includes(request.state)).map((request: any) => <section key={request.id} className="border border-[var(--border)] rounded-[var(--radius-panel)] p-4 space-y-2"><StatusLabel label={request.state === 'EXPIRED' ? 'Pesanan kedaluwarsa' : 'Pesanan dibatalkan'} tone="warning" /><p className="text-sm text-[var(--muted-foreground)]">{request.reason || request.rejectionReason || 'Pesanan belum diterima. Silakan pilih menu lagi atau hubungi staf.'}</p><Button variant="secondary" size="sm" onClick={() => setActiveScreen('menu')}>Pilih menu lagi</Button></section>)}
              {/* Pending Order Requests waiting for staff */}
              {customerRequests.filter((r: any) => r.state === 'REQUESTED').length >
                0 && (
                <section className="space-y-2.5">
                  <h2 className="font-heading text-[16px] font-semibold">
                    Menunggu konfirmasi staf
                  </h2>
                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {customerRequests
                      .filter((r: any) => r.state === 'REQUESTED')
                      .map((req: any) => {
                        const matchedQuote = (snapshot?.quotes || []).find(
                          (q: any) => q.id === req.quoteId
                        );
                        return (
                          <div key={req.id} className="py-3.5 space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="min-w-0 break-words font-semibold text-[15px]">
                                Meja {req.tableLabel} · {req.customerName}
                              </span>
                              <StatusLabel label="Menunggu konfirmasi staf" tone="warning" />
                            </div>
                            <p className="text-[13px] text-[var(--muted-foreground)]">
                              Total estimasi:{' '}
                              <Money
                                amount={matchedQuote?.totalIdr ?? req.totalIdr ?? 0}
                                className="font-semibold"
                              />{' '}
                              · Diajukan pukul{' '}
                              {new Date(req.createdAt).toLocaleTimeString('id-ID', {
                            timeZone: cafeConfig.timezone,
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                </section>
              )}

              {/* Accepted Orders with 3 Distinct Status Axes (Clean Editorial List) */}
              {customerOrders.length > 0 && <section className="space-y-3">
                <div className={styles.orderList}>
                  {customerOrders.map((ord: any) => {
                    const units = (snapshot?.orderUnits || []).filter(
                      (u: any) => u.orderId === ord.id
                    );
                    const billing = summarizeOrderBilling(ord.id, snapshot?.bills || []);

                    return (
                      <article key={ord.id} data-order-id={ord.id} className={`${styles.orderArticle} space-y-3`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-heading font-semibold text-[16px]">
                              {ord.customerName}
                            </p>
                            <p className="text-[12px] text-[var(--muted-foreground)]">
                              {ord.mode === 'DINE_IN'
                                ? `Meja ${ord.tableLabelSnapshot || ord.tableLabel}`
                                : 'Bawa Pulang'}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusLabel label="Diterima Staf" tone="active" />
                            <StatusLabel
                              label={paymentLabel(billing.paymentState)}
                              tone={billing.paymentState === 'SETTLED' ? 'success' : billing.paymentState === 'REFUND_DUE' ? 'danger' : 'warning'}
                            />
                          </div>
                        </div>

                        {billing.relatedBills.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]"><span>{billing.hasMergedBill ? 'Termasuk dalam tagihan gabungan' : billing.relatedBills.length > 1 ? `Dibagi menjadi ${billing.relatedBills.length} tagihan` : 'Tagihan pesanan ini'}</span>{billing.hasPendingPayment && <StatusLabel label="Pembayaran dalam proses" tone="info" />}{billing.relatedBills.map(bill => <Button key={bill.id} variant="ghost" size="sm" onClick={() => { setSelectedBillId(bill.id); setActiveScreen('pembayaran'); }}>Lihat tagihan · {formatIdr(bill.balanceIdr > 0 ? bill.balanceIdr : 0)}</Button>)}</div>}

                        {/* Fulfillment per Unit */}
                        <div className="pl-3 border-l-2 border-[var(--border)] divide-y divide-[var(--border)]/70">
                          {units.map((u: any) => (
                            <div
                              key={u.id}
                              className={styles.orderUnit}
                            >
                              <div className={styles.orderUnitDetails}>
                                <span className="font-medium text-[var(--foreground)]">
                                  1× {u.itemNameSnapshot || u.itemName}
                                </span>{' '}
                                <span className="text-[var(--muted-foreground)]">
                                  ({u.variantNameSnapshot || u.variantName})
                                </span>
                                <p className="text-[12px] text-[var(--muted-foreground)]">
                                  Stasiun:{' '}
                                  {u.stationCode === 'BAR'
                                    ? 'Bar & Kopi'
                                    : u.stationCode === 'PASTRY'
                                    ? 'Pastry & Roti'
                                    : 'Dapur Utama'}
                                  {u.note ? ` · Catatan: "${u.note}"` : ''}
                                </p>
                              </div>

                              <StatusLabel
                                className={styles.orderUnitStatus}
                                label={
                                  ['SERVED', 'DELIVERED', 'PICKED_UP'].includes(u.fulfillmentStatus)
                                    ? (u.fulfillmentStatus === 'PICKED_UP' ? 'Sudah diambil' : 'Disajikan')
                                    : u.fulfillmentStatus === 'READY'
                                    ? 'Siap Diambil/Antar'
                                    : u.fulfillmentStatus === 'PREPARING'
                                    ? 'Sedang dibuat'
                                    : u.fulfillmentStatus === 'QUEUED'
                                    ? 'Dalam antrean'
                                    : u.fulfillmentStatus === 'CANCELLED' ? 'Dibatalkan' : 'Menunggu pembayaran'
                                }
                                tone={
                                  ['SERVED', 'DELIVERED', 'PICKED_UP'].includes(u.fulfillmentStatus) ||
                                  u.fulfillmentStatus === 'READY'
                                    ? 'success'
                                    : u.fulfillmentStatus === 'PREPARING' ||
                                      u.fulfillmentStatus === 'QUEUED'
                                    ? 'info'
                                    : 'warning'
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>}
            </MotionPanel>
          )}

          {/* ================================================================= */}
          {/* SCREEN 4: PEMBAYARAN TAGIHAN & STRUK DIGITAL (C08, C09)           */}
          {/* ================================================================= */}
          {screenEnabled('pembayaran') && activeScreen === 'pembayaran' && (
            <MotionPanel
              key="screen-pembayaran"
              className="space-y-6"
            >
              <div className={styles.screenHeading}>
                <h1 className="font-heading text-[22px] font-bold">Pembayaran</h1>
                <SelectField
                  aria-label="Pilih tagihan meja"
                  value={selectedBill?.id || ''}
                  onChange={(e) => setSelectedBillId(e.target.value)}
                  wrapperClassName="w-auto min-w-[230px]"
                >
                  {customerBills.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.ownerLabel} · Sisa {formatIdr(b.balanceIdr)}
                    </option>
                  ))}
                </SelectField>
              </div>

              {customerBills.length > 1 && <div className="rounded-[var(--radius-panel)] border border-[var(--border)] p-4 text-sm space-y-1" aria-label="Ringkasan seluruh tagihan"><p className="font-semibold">{customerBills.length} tagihan dalam kunjungan Anda</p><p>Sisa seluruh tagihan: <Money amount={customerBills.reduce((sum: number, bill: any) => sum + Math.max(0, bill.balanceIdr), 0)} /></p><p className="text-[var(--muted-foreground)]">Pesanan tambahan atau tagihan yang dipisah dibayar masing-masing. Periksa pilihan tagihan sebelum membayar.</p></div>}

              {!selectedBill && <EmptyState title="Belum ada tagihan" description="Tagihan tersedia setelah pesanan dikonfirmasi." actionLabel="Lihat pesanan" onAction={() => setActiveScreen('pesanan')} />}
              {selectedBill && (
                <div className="space-y-6">
                  {/* Bill Items (Open Hairline List) */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="font-heading text-[17px] font-semibold">
                          {selectedBill.ownerLabel}
                        </h2>
                      </div>
                      <StatusLabel
                        label={paymentLabel(selectedBill.paymentState)}
                        tone={selectedBill.paymentState === 'SETTLED' ? 'success' : selectedBill.paymentState === 'REFUND_DUE' ? 'danger' : 'warning'}
                      />
                    </div>

                    <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                      {(selectedBill.allocatedUnits || []).map((u: any) => (
                        <div
                          key={u.id}
                          className="py-2.5 flex items-center justify-between gap-3 text-[14px]"
                        >
                          <div>
                            <span className="font-medium">
                              {u.itemNameSnapshot || u.itemName}
                            </span>{' '}
                            <span className="text-[var(--muted-foreground)]">
                              ({u.variantNameSnapshot || u.variantName})
                            </span>
                          </div>
                          <Money
                            amount={u.netIdr ?? u.grossIdr ?? u.finalUnitTotalIdr ?? 0}
                            className="font-medium"
                          />
                        </div>
                      ))}
                    </div>

                    {orderMode === 'DINE_IN' && selectedTable.qrToken && selectedBill.shareToken && <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[12px] text-[var(--muted-foreground)]">
                        Bagikan tagihan
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          handleCopyText(
                            `share_${selectedBill.id}`,
                            getBillShareUrl(selectedBill)
                          )
                        }
                      >
                        {copiedKey === `share_${selectedBill.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[var(--status-success-fg)]" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Salin tautan</span>
                          </>
                        )}
                      </Button>
                    </div>}
                  </section>

                  {/* Payment Summary & QRIS / VA Interactive Checkout */}
                  <section className="pt-4 border-t border-[var(--border)] space-y-4">
                    <h2 className="font-heading text-[16px] font-semibold">Ringkasan</h2>
                    <div className={styles.summary}><PaymentBreakdown
                      subtotalIdr={selectedBill.subtotalIdr}
                      discountIdr={selectedBill.discountIdr}
                      serviceIdr={selectedBill.serviceIdr}
                      taxIdr={selectedBill.taxIdr}
                      totalIdr={selectedBill.originalTotalIdr ?? selectedBill.totalIdr ?? 0}
                      creditAdjustmentsIdr={selectedBill.creditAdjustmentsIdr}
                      verifiedReceiptsIdr={selectedBill.verifiedReceiptsIdr}
                      refundedIdr={selectedBill.refundedIdr}
                      balanceIdr={selectedBill.balanceIdr}
                      serviceChargeBps={snapshot?.outlet?.serviceChargeBps ?? 500}
                      taxBps={snapshot?.outlet?.taxBps ?? 1000}
                      taxInclusiveDisplay={Boolean(snapshot?.outlet?.taxInclusiveDisplay)}
                    /></div>

                    {!canPayOnline && selectedBill.balanceIdr > 0 && <div className="p-4 border border-[var(--border)] rounded-[var(--radius-panel)] bg-[var(--accent-surface)]"><p className="font-semibold">Bayar di kasir</p><p className="mt-1 text-sm">Sebutkan nama pemesan atau nomor meja. Staf akan mencatat pembayaran Anda.</p></div>}
                    {canPayOnline && selectedBill.balanceIdr > 0 && (
                      <div className="pt-4 border-t border-[var(--border)] space-y-4">
                        {!pendingAttempt ? (
                          <>
                            <AnimatedSegmentedControl options={[{ value: 'QRIS', label: 'QRIS' }, { value: 'VIRTUAL_ACCOUNT', label: 'Transfer bank' }]} value={selectedPaymentMethod} onChange={setSelectedPaymentMethod} ariaLabel="Metode pembayaran" layoutId="payment-method-selector" />
                            <div className="rounded-2xl bg-white border border-[var(--border)] p-6 text-center space-y-3">
                              <QrCode className="w-10 h-10 mx-auto text-[var(--primary-ink)]" />
                              <p className="font-semibold">{selectedPaymentMethod === 'QRIS' ? 'QRIS' : 'Virtual Account'}</p>
                              <Money amount={selectedBill.balanceIdr} className="block text-2xl font-semibold" />
                              {snapshot?.paymentAccount?.isDemo && <StatusLabel label="Demo" tone="neutral" />}
                            </div>
                            <Button variant="primary" className="w-full" disabled={busy} onClick={async () => {
                              setPaymentFeedback('');
                              try {
                                const fingerprint = `${selectedBill.id}:${selectedBill.version}:${selectedPaymentMethod}:${selectedBill.balanceIdr}`;
                                if (paymentSubmissionRef.current?.fingerprint !== fingerprint) paymentSubmissionRef.current = { fingerprint, key: `customer_payment_${crypto.randomUUID()}` };
                                await onCommand('RECORD_PAYMENT', { billId: selectedBill.id, method: selectedPaymentMethod, amountIdr: selectedBill.balanceIdr, actorName: guestName || 'Pelanggan', createExternalAttemptOnly: true, idempotencyKey: paymentSubmissionRef.current.key });
                                paymentSubmissionRef.current = null;
                              } catch (error: any) { setPaymentFeedback(error.message); }
                            }}>{busy ? 'Memuat…' : selectedPaymentMethod === 'QRIS' ? 'Buat QRIS' : 'Buat Virtual Account'}</Button>
                          </>
                        ) : (
                          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-8 text-center space-y-4">
                            <div className="flex justify-center items-center gap-2"><h3 className="font-heading text-lg font-semibold">{pendingAttempt.method === 'QRIS' ? 'QRIS' : 'Virtual Account'}</h3>{paymentIsDemo && <StatusLabel label="Demo" tone="neutral" />}</div>
                            <p className="text-sm text-[var(--muted-foreground)]">{snapshot?.outlet?.name}</p>
                            <Money amount={pendingAttempt.expectedAmountIdr} className="block text-3xl font-semibold" />
                            {pendingAttempt.method === 'QRIS' && paymentQr ? <Image src={paymentQr} width={320} height={320} unoptimized alt={paymentIsDemo ? 'Kode QR demo, tidak dapat dibayar' : 'Kode QRIS pembayaran'} className="w-full max-w-[280px] aspect-square mx-auto" /> : <div className="rounded-xl bg-[var(--background)] px-4 py-5 font-mono text-lg break-all">{paymentInstructions.vaNumber || 'Menyiapkan instruksi…'}</div>}
                            <p className="text-sm text-[var(--muted-foreground)]">{paymentIsDemo ? 'Kode demo. Tidak dapat dibayar.' : 'Pindai dengan mobile banking atau e-wallet.'}</p>
                            <StatusLabel label="Menunggu pembayaran" tone="warning" />
                            {pendingAttempt.expiresAt && <p className="text-xs text-[var(--muted-foreground)]">Berlaku sampai {new Date(pendingAttempt.expiresAt).toLocaleTimeString('id-ID', { timeZone: cafeConfig.timezone, hour: '2-digit', minute: '2-digit' })}</p>}
                            <div className="flex justify-center gap-2">
                              <Button variant="primary" disabled={busy} onClick={async () => { try { await onRefresh?.(); setPaymentFeedback('Status diperbarui.'); } catch (error: any) { setPaymentFeedback(error.message); } }}>Cek status</Button>
                              {paymentQr && pendingAttempt.method === 'QRIS' && <a href={paymentQr} download={`QRIS-${selectedBill.id}.png`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-medium"><Download className="h-4 w-4" />Unduh</a>}
                            </div>
                          </section>
                        )}
                        {paymentFeedback && <p role="status" className="text-sm text-[var(--muted-foreground)]">{paymentFeedback}</p>}
                        {cafeConfig.payment.mode === 'both' && <p className="text-sm text-[var(--muted-foreground)]">{pendingAttempt ? 'Ingin ganti metode? Minta staf membatalkan instruksi aktif sebelum membayar di kasir.' : 'Anda juga bisa membayar langsung di kasir.'}</p>}
                      </div>
                    )}
                  </section>

                  {/* Digital Receipt (Elevated Receipt Document Surface) */}
                  {(selectedBill.verifiedReceiptsIdr > 0 ||
                    selectedBill.paymentState === 'SETTLED') && (
                    <section className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] space-y-3">
                      <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                        <div>
                          <p className="font-heading font-bold text-[16px]">
                            Struk Digital · {snapshot?.outlet?.name}
                          </p>
                          <p className="text-[12px] text-[var(--muted-foreground)]">
                            {snapshot?.outlet?.address}
                          </p>
                        </div>
                        <StatusLabel label={paymentLabel(selectedBill.paymentState)} tone={selectedBill.paymentState === 'SETTLED' ? 'success' : 'warning'} />
                      </div>
                      <div className="text-[13px] space-y-1 tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-[var(--muted-foreground)]">
                            No. tagihan
                          </span>
                          <span className="font-medium">{selectedBill.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--muted-foreground)]">Pelanggan / meja</span>
                          <span className="font-medium">
                            {selectedBill.ownerLabel} · Meja {selectedBill.tableLabel}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--muted-foreground)]">Status pembayaran</span>
                          <span className="font-semibold text-[var(--status-success-fg)]">
                            {paymentLabel(selectedBill.paymentState)}
                          </span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-dashed border-[var(--border)] space-y-1 text-[13px]">
                        {(selectedBill.allocatedUnits || []).map((u: any) => (
                          <div key={u.id} className="flex justify-between tabular-nums">
                            <span>
                              1× {u.itemNameSnapshot || u.itemName} (
                              {u.variantNameSnapshot || u.variantName})
                            </span>
                            <span>
                              {formatIdr(u.netIdr ?? u.grossIdr ?? u.finalUnitTotalIdr ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between font-semibold text-[14px] tabular-nums">
                        <span>Total pembayaran diterima</span>
                        <span className="text-[var(--primary-ink)]">
                          {formatIdr(selectedBill.verifiedReceiptsIdr)}
                        </span>
                      </div>
                      {(selectedBill.receipts || []).map((receipt: any) => <div key={receipt.id} className="text-xs border-t border-[var(--border)] pt-2 space-y-1"><p>{paymentMethodLabel(receipt.method)} · <Money amount={receipt.amountIdr} /></p><p className="break-all text-[var(--muted-foreground)]">Referensi: {receipt.referenceCode}</p></div>)}
                      {selectedBill.refundedIdr > 0 && <p className="text-sm">Sudah dikembalikan: <Money amount={selectedBill.refundedIdr} /></p>}
                      {selectedBill.balanceIdr < 0 && <p role="status" className="text-sm text-[var(--status-warning-fg)]">Pengembalian <Money amount={-selectedBill.balanceIdr} /> sedang menunggu penyelesaian staf.</p>}
                    </section>
                  )}
                </div>
              )}
            </MotionPanel>
          )}

          {/* ================================================================= */}
          {/* SCREEN 5: BANTUAN MEJA / PANGGIL STAF (C10 · Less Cards)          */}
          {/* ================================================================= */}
          {screenEnabled('bantuan') && activeScreen === 'bantuan' && (
            <MotionPanel
              key="screen-bantuan"
              className="space-y-5"
            >
              <h1 className="font-heading text-[22px] font-bold pb-3 border-b border-[var(--border)]">
                Panggil pelayan
              </h1>

              <section className="space-y-4">
                <h2 className="font-heading text-[16px] font-semibold">
                  Kirim permintaan ke staf untuk Meja {selectedTable.label}
                </h2>
                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {[
                    { code: 'CALL_WAITER', label: 'Panggil pelayan' },
                    { code: 'REQUEST_BILL', label: 'Minta tagihan' },
                    { code: 'CUTLERY_NAPKIN', label: 'Alat makan' },
                    { code: 'PACK_LEFTOVER', label: 'Bungkus makanan' },
                    { code: 'ORDER_ISSUE', label: 'Kendala pesanan' },
                  ].map((opt) => {
                    const active = helpType === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => setHelpType(opt.code as any)}
                        className={`w-full py-3.5 px-2 flex items-center justify-between text-left text-[15px] transition-colors cursor-pointer ${
                          active
                            ? 'text-[var(--primary-ink)] font-semibold bg-[var(--accent-surface)]/50'
                            : 'text-[var(--foreground)] hover:bg-[var(--accent-surface)]/30 font-medium'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {active && <Check className="w-4 h-4 text-[var(--primary-ink)]" />}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="help-notes-input">Catatan tambahan (opsional)</Label>
                  <Textarea
                    id="help-notes-input"
                    rows={2}
                    value={helpNotes}
                    onChange={(e) => setHelpNotes(e.target.value)}
                    placeholder="Contoh: Minta 2 sendok makan dan air hangat"
                  />
                </div>

                {helpFeedback && <StatusLabel label={helpFeedback} tone="success" />}

                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={async () => {
                    setHelpFeedback('');
                    try {
                    const res = await onCommand('SERVICE_REQUEST_ACTION', {
                      action: 'CREATE',
                      visitId: currentVisit?.id,
                      tableLabel: selectedTable.label,
                      customerName: guestName || 'Pelanggan',
                      type: helpType,
                      notes: helpNotes,
                    });
                    const out = res?.result || res;
                    setHelpFeedback(out?.message || 'Permintaan bantuan terkirim ke staf.');
                    setHelpNotes('');
                    } catch (error: any) { setHelpFeedback(error.message); }
                  }}
                >
                  <Bell className="w-4 h-4" />
                  <span>Kirim permintaan</span>
                </Button>
              </section>
            </MotionPanel>
          )}

          {/* ================================================================= */}
          {/* SCREEN 6: WI-FI GRATIS & INFO OUTLET (C12 · Less Cards)           */}
          {/* ================================================================= */}
          {activeScreen === 'wifi' && (
            <MotionPanel
              key="screen-wifi"
              className="space-y-6"
            >
              <h1 className="font-heading text-[22px] font-bold pb-3 border-b border-[var(--border)]">
                Info kedai
              </h1>

              {snapshot?.wifiNetworks?.length > 0 && <section className="space-y-3">
                <h2 className="font-heading text-[16px] font-semibold">Wi-Fi</h2>
                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {(snapshot?.wifiNetworks || []).map((w: any) => (
                    <div
                      key={w.id}
                      className="py-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[15px]">{w.label}</span>
                          <StatusLabel label={w.area} tone="info" />
                        </div>
                        <p className="text-[14px] text-[var(--muted-foreground)]">
                          SSID: <strong className="text-[var(--foreground)]">{w.ssid}</strong> ·
                          Kata sandi:{' '}
                          <strong className="text-[var(--foreground)] tabular-nums">
                            {w.encryptedPassword}
                          </strong>
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopyText(w.id, w.encryptedPassword)}
                      >
                        {copiedKey === w.id ? (
                          <>
                            <Check className="w-4 h-4 text-[var(--status-success-fg)]" />
                            <span>Sandi Disalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Salin Sandi</span>
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </section>}

              <section className="space-y-2.5 text-[14px]">
                <h2 className="font-heading text-[16px] font-semibold">Jam Buka &amp; Fasilitas</h2>
                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-[var(--muted-foreground)]">Alamat</span>
                    <span className="font-medium text-right">{snapshot?.outlet?.address}</span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-[var(--muted-foreground)]">Jam Operasional</span>
                    <span className="font-medium text-right">
                      {snapshot?.outlet?.openHoursText}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-[var(--muted-foreground)]">Fasilitas</span>
                    <span className="font-medium text-right">
                      {snapshot?.outlet?.facilitiesText}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-[var(--muted-foreground)]">Ketentuan Biaya</span>
                    <span className="font-medium text-right">
                      {formatOutletChargePolicy(snapshot?.outlet)}
                    </span>
                  </div>
                </div>
              </section>
            </MotionPanel>
          )}

          {/* ================================================================= */}
          {/* SCREEN 7: MEMBER, STEMPEL LOYALITAS & ULASAN (C11 · Less Cards)   */}
          {/* ================================================================= */}
          {screenEnabled('member') && activeScreen === 'member' && (
            <MotionPanel
              key="screen-member"
              className="space-y-6"
            >
              <h1 className="font-heading text-[22px] font-bold pb-3 border-b border-[var(--border)]">
                Member
              </h1>

              <div className="rounded-2xl bg-white border border-[var(--border)] p-5">
                <p className="text-sm text-[var(--muted-foreground)]">Login member belum tersedia.</p>
              </div>

              {/* Send Review (Unboxed with Hairline Top Divider) */}
              <section className="pt-5 border-t border-[var(--border)] space-y-3">
                <h2 className="font-heading text-[16px] font-semibold">Ulasan</h2>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: 'Kepuasan', val: overallRating, set: setOverallRating },
                    { label: 'Rasa Menu', val: tasteRating, set: setTasteRating },
                    { label: 'Layanan', val: serviceRating, set: setServiceRating },
                  ].map((r) => (
                    <div key={r.label} className="space-y-1">
                      <Label>{r.label}</Label>
                      <SelectField
                        aria-label={r.label}
                        value={r.val}
                        onChange={(e) => r.set(Number(e.target.value))}
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} Bintang
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  ))}
                </div>
                <Textarea
                  rows={2}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Tulis ulasan"
                />
                {reviewSubmittedMsg && <StatusLabel label={reviewSubmittedMsg} tone="success" />}
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setReviewSubmittedMsg('');
                    if (!currentVisit || !guestName.trim()) { setReviewSubmittedMsg('Isi nama pemesan terlebih dahulu.'); return; }
                    try {
                    await onCommand('SETTINGS_PROMO_FEEDBACK_ACTION', {
                      action: 'SUBMIT_FEEDBACK',
                      feedbackData: {
                        visitId: currentVisit?.id,
                        participantId: (snapshot?.participants || []).find((person: any) => person.visitId === currentVisit?.id && person.customerName === guestName)?.id,
                        memberId: loggedInMemberId,
                        customerName: guestName,
                        overallRating,
                        tasteRating,
                        serviceRating,
                        speedRating: 5,
                        cleanlinessRating: 5,
                        comment: commentText,
                      },
                    });
                    setCommentText('');
                    setReviewSubmittedMsg('Ulasan terkirim.');
                    } catch (error: any) { setReviewSubmittedMsg(error.message); }
                  }}
                >
                  <Star className="w-4 h-4" />
                  <span>Kirim ulasan</span>
                </Button>
              </section>
            </MotionPanel>
          )}

          {/* ================================================================= */}
          {/* SCREEN 8: ANTREAN MEJA / WAITLIST (C13 · Less Cards)              */}
          {/* ================================================================= */}
          {screenEnabled('antrean') && activeScreen === 'antrean' && (
            <MotionPanel
              key="screen-antrean"
              className="space-y-6"
            >
              <h1 className="font-heading text-[22px] font-bold pb-3 border-b border-[var(--border)]">
                Antrean meja
              </h1>

              <section className="space-y-3">
                <h2 className="font-heading text-[16px] font-semibold">Ambil antrean</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="waitlist-guest-name">Nama Tamu</Label>
                    <Input
                      id="waitlist-guest-name" maxLength={60}
                      value={waitlistName}
                      onChange={(e) => setWaitlistName(e.target.value)}
                      placeholder="Nama Anda"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="waitlist-party-size">Jumlah Kursi</Label>
                    <Input
                      id="waitlist-party-size" step={1}
                      type="number"
                      min={1}
                      max={20}
                      value={waitlistPartySize}
                      onChange={(e) => setWaitlistPartySize(Number(e.target.value))}
                    />
                  </div>
                </div>
                {waitlistNotice && <StatusLabel label={waitlistNotice} tone="success" />}
                <InlineError message={waitlistError} />
                <Button
                  variant="primary"
                  disabled={busy || (waitlistName || guestName).trim().length < 2 || !Number.isInteger(waitlistPartySize) || waitlistPartySize < 1 || waitlistPartySize > 20}
                  onClick={async () => {
                    setWaitlistNotice(''); setWaitlistError('');
                    try {
                    const res = await onCommand('WAITLIST_ACTION', {
                      action: 'CREATE',
                      actorName: waitlistName || guestName || 'Pelanggan',
                      customerName: waitlistName || guestName,
                      partySize: waitlistPartySize,
                      preferredArea: waitlistArea,
                      contactPhone: waitlistPhone,
                      notes: waitlistNotes,
                    });
                    const out = res?.result || res;
                    setWaitlistNotice(`Nomor antrean ${out?.publicSequence}.`);
                    rememberWaitlist({ ...out, customerName: (waitlistName || guestName).trim(), partySize: waitlistPartySize });
                    if (!guestName.trim()) setGuestName(waitlistName.trim());
                    setWaitlistName('');
                    } catch (error: any) { setWaitlistError(error.message); }
                  }}
                >
                  Ambil antrean
                </Button>
              </section>

              <section className="pt-4 border-t border-[var(--border)] space-y-3" aria-label="Antrean Anda">
                <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-heading text-[16px] font-semibold">Antrean Anda</h2>{waitlistTicket && <Button size="sm" variant="secondary" disabled={busy} onClick={refreshWaitlist}>Perbarui antrean</Button>}</div>
                {waitlistTicket ? <article data-waitlist-id={waitlistTicket.id} className="rounded-[var(--radius-panel)] border border-[var(--border)] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Antrean #{waitlistTicket.publicSequence}</p><StatusLabel label={({ WAITING: 'Menunggu', CALLED: 'Dipanggil', SEATED: 'Sudah Duduk', COMPLETED: 'Kunjungan selesai', CANCELLED: 'Dibatalkan', EXPIRED: 'Kedaluwarsa' } as Record<string, string>)[waitlistTicket.status] || waitlistTicket.status} tone={waitlistTicket.status === 'CALLED' ? 'warning' : ['SEATED', 'COMPLETED'].includes(waitlistTicket.status) ? 'success' : 'info'} /></div>
                  <p className="text-sm">{waitlistTicket.customerName} · {waitlistTicket.partySize} orang</p>
                  {waitlistTicket.status === 'WAITING' && <p className="text-sm text-[var(--muted-foreground)]">{waitlistTicket.holdExpired ? 'Waktu panggilan sebelumnya habis. Hubungi staf untuk pemanggilan ulang.' : 'Silakan tunggu sampai staf menyiapkan meja. Perbarui antrean untuk melihat panggilan terbaru.'}</p>}
                  {waitlistTicket.status === 'CALLED' && <p className="text-sm">Silakan temui staf untuk Meja {waitlistTicket.heldTableLabel}.{waitlistTicket.holdExpiresAt ? ` Meja ditahan hingga ${new Date(waitlistTicket.holdExpiresAt).toLocaleTimeString('id-ID', { timeZone: cafeConfig.timezone, hour: '2-digit', minute: '2-digit' })}.` : ''}</p>}
                  {waitlistTicket.status === 'SEATED' && <div className="space-y-2"><p className="text-sm">Meja Anda sudah siap. Pindai QR meja untuk mulai memesan.</p>{(snapshot?.tables || []).some((table: any) => table.id === waitlistTicket.tableId && table.qrToken) && <Button onClick={() => { const table = snapshot.tables.find((entry: any) => entry.id === waitlistTicket.tableId); window.location.assign(`/t/${cafeConfig.venue.tenantSlug}/${cafeConfig.venue.outletSlug}/m/${encodeURIComponent(table.qrToken)}`); }}>Buka menu meja</Button>}</div>}
                  {waitlistError && <Button variant="ghost" size="sm" onClick={() => { rememberWaitlist(null); setWaitlistError(''); }}>Hapus antrean tersimpan</Button>}
                </article> : <p className="text-sm text-[var(--muted-foreground)]">Nomor antrean Anda akan muncul di sini setelah mendaftar.</p>}
              </section>
            </MotionPanel>
          )}
        </AnimatePresence>

        {/* Realistic Merchant Footer */}
        <footer className="mt-10 pt-5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--muted-foreground)]">
          <div>
            <span className="font-semibold text-[var(--foreground)]">
              {cafeConfig.brand.name}
            </span>{' '}
            · {cafeConfig.venue.address}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveScreen('wifi')}
              className="hover:text-[var(--foreground)] hover:underline cursor-pointer"
            >
              Info kedai
            </button>
            {canUseTables && <button type="button" onClick={() => setActiveScreen('bantuan')} className="hover:text-[var(--foreground)] hover:underline cursor-pointer">Panggil pelayan</button>}
            {onOpenStaffPortal && (
              <button
                type="button"
                onClick={onOpenStaffPortal}
                className="inline-flex items-center gap-1 font-medium text-[var(--primary-ink)] hover:underline cursor-pointer"
              >
                <Lock className="w-3 h-3" />
                <span>Portal Staf &amp; Kasir</span>
              </button>
            )}
          </div>
        </footer>
      </main>

      {/* ===================================================================== */}
      {/* ANIMATED STICKY BOTTOM CART BAR ON MENU VIEW (MOBILE-FIRST)           */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {canOrder && activeScreen === 'menu' && cart.length > 0 && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { y: 64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { y: 64, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed bottom-[76px] inset-x-0 z-20 px-4 py-3 pointer-events-none"
          >
            <div className="max-w-[720px] mx-auto flex items-center justify-between gap-3 bg-[var(--foreground)] text-white rounded-2xl px-5 py-3 shadow-xl pointer-events-auto">
              <div>
                <p className="text-[13px] font-medium opacity-75">
                  {cartSummary.totalQty} item di keranjang
                </p>
                <p className="text-[15px] font-bold text-white tabular-nums">
                  Estimasi <Money amount={cartSummary.totalIdr} />
                </p>
              </div>
              <Button variant="primary" onClick={() => setActiveScreen('keranjang')}>
                <ShoppingCart className="w-4 h-4" />
                <span>Lihat Keranjang</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className={styles.bottomNav} aria-label="Navigasi pelanggan">
        {([{ screen: 'menu', label: 'Menu', icon: BookOpenText }, { screen: 'keranjang', label: 'Keranjang', icon: ShoppingBag }, { screen: 'pesanan', label: 'Pesanan', icon: ClipboardList }, { screen: 'bantuan', label: 'Panggil pelayan', icon: HandHelping }] as const).filter(item => screenEnabled(item.screen)).map(({ screen, label, icon: Icon }) => <button key={screen} type="button" aria-current={activeScreen === screen ? 'page' : undefined} onClick={() => setActiveScreen(screen)} className={activeScreen === screen ? styles.navActive : ''}><Icon className="w-5 h-5" strokeWidth={1.8} /><span>{label}</span></button>)}
        <button type="button" onClick={() => setShareOpen(true)}><Share2 className="w-5 h-5" strokeWidth={1.8} /><span>Bagikan menu</span></button>
      </nav>
      <DialogModal open={shareOpen} onClose={() => setShareOpen(false)} title="Bagikan menu">
        <div className="text-center space-y-4">
          {shareQr && <Image src={shareQr} width={320} height={320} unoptimized alt="Kode QR tautan menu" className="w-64 h-64 mx-auto" />}
          <p className="text-sm text-[var(--muted-foreground)]">Bagikan menu ke teman.</p>
          <Button className="w-full" disabled={!shareUrl} onClick={() => handleCopyText('menu-share', shareUrl)}><Copy className="w-4 h-4" />{copiedKey === 'menu-share' ? 'Tersalin' : 'Salin tautan'}</Button>
        </div>
      </DialogModal>
      <DialogModal open={confirmOrderOpen} onClose={() => setConfirmOrderOpen(false)} title="Kirim pesanan?">
        <div className="space-y-5">
          <p className="text-sm text-[var(--muted-foreground)]">Periksa pesanan sebelum dikirim.</p>
          <div className="flex justify-between font-semibold"><span>{cartSummary.totalQty} item</span><Money amount={activeQuote?.totalIdr ?? cartSummary.totalIdr} /></div>
          <InlineError message={checkoutError} />
          <div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setConfirmOrderOpen(false)}>Kembali</Button><Button className="flex-1" disabled={busy || !cart.length} onClick={handleSubmitOrderRequest}>{busy ? 'Mengirim…' : 'Kirim pesanan'}</Button></div>
        </div>
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 1: PROFILE, ORDERS, PAYMENT & TABLE SERVICES MENU (Less Cards)  */}
      {/* ===================================================================== */}
      <DialogModal
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        title="Lainnya"
      >
        <div className="space-y-2">
          {/* Customer Identity Header (Unboxed with Hairline Bottom Divider) */}
          <div className="pb-3 border-b border-[var(--border)] flex items-center justify-between gap-2">
            <div>
              <p className="font-heading font-semibold text-[15px]">{guestName || 'Pelanggan baru'}</p>
              <p className="text-[12px] text-[var(--muted-foreground)]">
                {orderMode === 'DINE_IN'
                  ? selectedTable.id ? `Meja ${selectedTable.label} · ${selectedTable.areaName}` : cafeConfig.venue.address
                  : 'Bawa pulang'}
              </p>
            </div>
            {canUseLoyalty && <StatusLabel label={`${currentMember?.qualifiedVisitsCount ?? 0}/5 stempel`} tone="active" />}
          </div>

          {/* Clean Hairline Tap Rows (No outer box border!) */}
          <div className="divide-y divide-[var(--border)]">
            {[
              {
                id: 'pesanan' as CustomerScreenView,
                label: 'Pesanan',
                desc: 'Status pesanan',
                badge: activeOrdersCount > 0 ? `${activeOrdersCount} Aktif` : undefined,
                icon: Utensils,
              },
              {
                id: 'pembayaran' as CustomerScreenView,
                label: 'Pembayaran',
                desc: 'QRIS dan struk',
                badge:
                  unpaidBills.length > 0
                    ? formatIdr(unpaidBills[0].balanceIdr)
                    : 'Lunas / Struk',
                icon: Receipt,
              },
              {
                id: 'keranjang' as CustomerScreenView,
                label: 'Keranjang',
                desc: 'Ubah pesanan',
                badge: `${cartSummary.totalQty} item`,
                icon: ShoppingCart,
              },
              {
                id: 'bantuan' as CustomerScreenView,
                label: 'Panggil pelayan',
                desc: 'Bantuan meja',
                icon: Bell,
              },
              {
                id: 'member' as CustomerScreenView,
                label: 'Member',
                desc: 'Voucher & ulasan',
                icon: Award,
              },
              {
                id: 'wifi' as CustomerScreenView,
                label: 'Info kedai',
                desc: 'Info outlet',
                icon: Wifi,
              },
              {
                id: 'antrean' as CustomerScreenView,
                label: 'Antrean meja',
                desc: 'Daftar antrean',
                icon: Clock,
              },
            ].filter(item => screenEnabled(item.id)).map((item) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigateFromDrawer(item.id)}
                  className="w-full py-2.5 px-1 flex items-center justify-between gap-2.5 text-left hover:bg-[var(--accent-surface)]/50 transition-colors cursor-pointer rounded-[6px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 text-[var(--primary-ink)] shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[14px] leading-[19px] text-[var(--foreground)]">
                        {item.label}
                      </p>

                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-[6px] bg-[var(--accent-surface)] text-[var(--primary-ink)] text-[11px] font-semibold tabular-nums">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Subtle Staff / Cashier Portal Link at the bottom */}
          {onOpenStaffPortal && (
            <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
              <span className="text-[12px] text-[var(--muted-foreground)]">
                Staf kedai
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setProfileDrawerOpen(false);
                  onOpenStaffPortal();
                }}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Portal staf</span>
              </Button>
            </div>
          )}
        </div>
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 2: PILIH MEJA ATAU MODE PESANAN (DINE-IN / TAKEAWAY)            */}
      {/* ===================================================================== */}
      <DialogModal
        open={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        title="Meja & layanan"
      >
        <div className="space-y-4">
          {canOrder && <div className="space-y-1.5">
            <Label>Pilih Mode Layanan</Label>
            <AnimatedSegmentedControl
              options={[
                { value: 'DINE_IN', label: 'Makan di tempat' },
                { value: 'TAKEAWAY', label: 'Bawa pulang' },
              ]}
              value={orderMode}
              onChange={(mode) => { setOrderMode(mode); setActiveQuote(null); setPresenceVerified(false); }}
              ariaLabel="Mode layanan pesanan"
              layoutId="order-mode-segmented"
              className="w-full grid grid-cols-2"
            />
          </div>}

          {orderMode === 'DINE_IN' && (
            <div className="space-y-1.5">
              <Label htmlFor="modal-select-table">Pilih Meja Anda</Label>
              <SelectField
                id="modal-select-table"
                value={selectedTableId}
                onChange={(e) => { setSelectedTableId(e.target.value); setActiveQuote(null); setPresenceVerified(false); }}
              >
                {(snapshot?.tables || [])
                  .filter((t: any) => t.physicalState !== 'OUT_OF_SERVICE')
                  .map((t: any) => (
                    <option key={t.id} value={t.id}>
                      Meja {t.label} · {t.areaName} ({t.capacity} kursi)
                    </option>
                  ))}
              </SelectField>
            </div>
          )}

          <Button
            variant="primary"
            className="w-full"
            onClick={() => setTableModalOpen(false)}
          >
            Simpan Pilihan
          </Button>
        </div>
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 3: MULTI-PHOTO ITEM GALLERY (SLIDING CAROUSEL) & CUSTOMIZATION  */}
      {/* ===================================================================== */}
      <DialogModal
        open={Boolean(configuringItem)}
        onClose={() => setConfiguringItem(null)}
        title={configuringItem?.name || 'Detail Menu'}
      >
        {configuringItem && (
          <div className="space-y-4">
            {/* Reusable Animated Image Carousel with Directional Slide & Swipe */}
            {configuringPhotos.length > 0 && (
              <ImageCarousel
                photos={configuringPhotos}
                altPrefix={configuringItem.name}
                activeIndex={activePhotoIndex}
                onIndexChange={setActivePhotoIndex}
              />
            )}

            <p className="text-[14px] text-[var(--muted-foreground)]">
              {configuringItem.description}
            </p>

            {/* Variants Selection (Clean Hairline Rows) */}
            <div className="space-y-1.5">
              <p className="font-semibold text-[14px]">Varian</p>
              <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {(configuringItem.variants || []).map((v: any) => {
                  const disabled = v.availableToSell <= 0;
                  const active = selectedVariantId === v.id;
                  return (
                    <label
                      key={v.id}
                      className={`flex items-center justify-between py-2.5 px-2 cursor-pointer transition-colors ${
                        active ? 'bg-[var(--accent-surface)]/70 font-semibold' : ''
                      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="variant-select"
                          checked={active}
                          disabled={disabled}
                          onChange={() => setSelectedVariantId(v.id)}
                          className="w-4 h-4 accent-[var(--primary-ink)]"
                        />
                        <span className="text-[14px]">{v.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {disabled && <StatusLabel label="Habis" tone="danger" />}
                        <Money amount={v.priceIdr} className="font-semibold text-[14px]" />
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Modifier Groups (Clean Hairline Rows) */}
            {(configuringItem.modifierGroups || []).map((grp: any) => (
              <div key={grp.id} className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[14px]">{grp.name}</p>
                  <span className="text-[12px] text-[var(--muted-foreground)]">
                    {grp.required
                      ? `Wajib (Pilih ${grp.minSelect})`
                      : `Opsional (Maks ${grp.maxSelect})`}
                  </span>
                </div>
                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {(grp.options || []).map((opt: any) => {
                    const isRadio = grp.maxSelect === 1;
                    const checked = selectedModOptionIds.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between py-2.5 px-2 cursor-pointer transition-colors ${
                          checked ? 'bg-[var(--accent-surface)]/70 font-medium' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type={isRadio ? 'radio' : 'checkbox'}
                            name={`modgrp-${grp.id}`}
                            checked={checked}
                            onChange={() => {
                              if (isRadio) {
                                const otherGroupIds = (grp.options || []).map((o: any) => o.id);
                                setSelectedModOptionIds([
                                  ...selectedModOptionIds.filter(
                                    (id) => !otherGroupIds.includes(id)
                                  ),
                                  opt.id,
                                ]);
                              } else if (checked) {
                                setSelectedModOptionIds(
                                  selectedModOptionIds.filter((id) => id !== opt.id)
                                );
                              } else {
                                setSelectedModOptionIds([...selectedModOptionIds, opt.id]);
                              }
                            }}
                            className="w-4 h-4 accent-[var(--primary-ink)]"
                          />
                          <span className="text-[14px]">{opt.name}</span>
                        </div>
                        {opt.priceIdr > 0 && (
                          <Money
                            amount={opt.priceIdr}
                            signed
                            className="text-[13px] text-[var(--muted-foreground)]"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Ordering controls stay out of catalog-only detail sheets. */}
            {canOrder && <><div className="space-y-1.5 pt-2">
              <Label htmlFor="item-note-input">Catatan (opsional)</Label>
              <Input
                id="item-note-input"
                maxLength={200}
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                placeholder="Contoh: Es dipisah, disajikan hangat"
              />
            </div>

            <InlineError message={modalError} />

            {/* Modal Footer: Quantity + Add to Cart */}
            <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <QuantityControl
                value={itemQuantity}
                min={1}
                max={20}
                itemLabel={configuringItem.name}
                onChange={setItemQuantity}
              />
              <Button variant="primary" className="flex-1" onClick={handleConfirmModalAdd}>
                {editingLineId ? 'Simpan perubahan' : 'Tambah ke keranjang'}
              </Button>
            </div></>}
            {!canOrder && <p className="text-sm text-[var(--muted-foreground)] border-t border-[var(--border)] pt-4">Untuk memesan, hubungi staf di kasir.</p>}
          </div>
        )}
      </DialogModal>
    </div>
  );
}
