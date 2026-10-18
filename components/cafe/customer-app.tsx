'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Button,
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
} from 'lucide-react';

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
}: {
  snapshot: any;
  onCommand: (command: string, payload: any) => Promise<any>;
  busy: boolean;
  onOpenStaffPortal?: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  // Navigation & Drawer state
  const [activeScreen, setActiveScreen] = useState<CustomerScreenView>('menu');
  const [profileDrawerOpen, setProfileDrawerOpen] = useState<boolean>(false);
  const [tableModalOpen, setTableModalOpen] = useState<boolean>(false);

  // Table & Order Mode context
  const [orderMode, setOrderMode] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState<string>('tbl_m01');

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
  const [cart, setCart] = useState<CartLineDraft[]>([
    {
      cartLineId: 'cl_initial_1',
      menuItemId: 'item_kopi_aren',
      variantId: 'var_kopi_aren_reg',
      itemName: 'Es Kopi Susu Gula Aren',
      variantName: 'Regular (250 ml)',
      unitPriceIdr: 28000,
      modifierOptionIds: ['modopt_gula_less', 'modopt_es_normal'],
      modifierNames: ['Kurang Manis (70%)', 'Es Normal'],
      note: '',
      quantity: 1,
    },
  ]);

  // Customer identity & OTP state (C03 / C04)
  const [identityMode, setIdentityMode] = useState<'GUEST' | 'MEMBER'>('GUEST');
  const [guestName, setGuestName] = useState<string>('Anisa Putri');
  const [memberContact, setMemberContact] = useState<string>('+6281234567890');
  const [otpInput, setOtpInput] = useState<string>('123456');
  const [loggedInMemberId, setLoggedInMemberId] = useState<string>('mem_anisa');
  const [otpStatusMessage, setOtpStatusMessage] = useState<string>('');

  // Presence check state (C05 / B07)
  const [presenceVerified, setPresenceVerified] = useState<boolean>(true);
  const [presenceStatusText, setPresenceStatusText] = useState<string>(
    'Lokasi terverifikasi (14 m dari outlet Kedai Meranti).'
  );
  const [joinCodeInput, setJoinCodeInput] = useState<string>('M01-8842');

  // Promo & Quote state (C06)
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [activeQuote, setActiveQuote] = useState<any | null>(null);
  const [checkoutError, setCheckoutError] = useState<string>('');
  const [checkoutSuccessMsg, setCheckoutSuccessMsg] = useState<string>('');

  // Payment screen state (C08 / C09)
  const [selectedBillId, setSelectedBillId] = useState<string>('bill_demo_m04');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'QRIS' | 'VIRTUAL_ACCOUNT'>(
    'QRIS'
  );
  const [paymentFeedback, setPaymentFeedback] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string>('');

  // Table Help / Service Request state (C10)
  const [helpType, setHelpType] = useState<
    'CALL_STAFF' | 'ASK_BILL' | 'EXTRA_CUTLERY' | 'CLEAR_TABLE' | 'ISSUE_REPORT'
  >('CALL_STAFF');
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

  const selectedTable = useMemo(() => {
    return (
      snapshot?.tables?.find((t: any) => t.id === selectedTableId) ||
      snapshot?.tables?.[0] || { id: 'tbl_m01', label: 'M01', areaName: 'Ruang Utama (Indoor)' }
    );
  }, [snapshot, selectedTableId]);

  const currentMember = useMemo(() => {
    return snapshot?.members?.find((m: any) => m.id === loggedInMemberId) || null;
  }, [snapshot, loggedInMemberId]);

  const favoriteIds = useMemo(() => {
    return new Set<string>((currentMember?.favoriteMenuIdsJson as string[]) || []);
  }, [currentMember]);

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
  const activeOrdersCount = useMemo(() => {
    const reqs = (snapshot?.orderRequests || []).filter((r: any) => r.state === 'REQUESTED').length;
    const ords = (snapshot?.orders || []).length;
    return reqs + ords;
  }, [snapshot]);

  const unpaidBills = useMemo(() => {
    return (snapshot?.bills || []).filter(
      (b: any) => b.lifecycle !== 'VOID' && b.balanceIdr > 0
    );
  }, [snapshot]);

  const updateCart = (next: CartLineDraft[]) => {
    setCart(next);
    setActiveQuote(null);
  };

  const openItemModal = (item: any) => {
    const defaultVar = item.variants?.find((v: any) => v.isDefault) || item.variants?.[0];
    setConfiguringItem(item);
    setActivePhotoIndex(0);
    setSelectedVariantId(defaultVar?.id || '');
    setSelectedModOptionIds([]);
    setItemNote('');
    setItemQuantity(1);
    setModalError('');
  };

  const handleQuickAddOrConfigure = (item: any) => {
    const hasRequiredMods = (item.modifierGroups || []).some((g: any) => g.required);
    const hasMultipleVariants = (item.variants || []).length > 1;
    const hasMultiplePhotos = (item.photos || []).length > 1;
    if (hasRequiredMods || hasMultipleVariants || hasMultiplePhotos) {
      openItemModal(item);
      return;
    }
    const v = item.variants?.[0];
    if (!v) return;
    const existingIdx = cart.findIndex(
      (c) =>
        c.menuItemId === item.id &&
        c.variantId === v.id &&
        c.modifierOptionIds.length === 0 &&
        !c.note
    );
    if (existingIdx >= 0) {
      const next = [...cart];
      next[existingIdx] = {
        ...next[existingIdx],
        quantity: Math.min(20, next[existingIdx].quantity + 1),
      };
      updateCart(next);
    } else {
      updateCart([
        ...cart,
        {
          cartLineId: `cl_${Date.now()}`,
          menuItemId: item.id,
          variantId: v.id,
          itemName: item.name,
          variantName: v.name,
          unitPriceIdr: v.priceIdr,
          modifierOptionIds: [],
          modifierNames: [],
          note: '',
          quantity: 1,
        },
      ]);
    }
  };

  const handleConfirmModalAdd = () => {
    if (!configuringItem) return;
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
      ...cart,
      {
        cartLineId: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
    setCheckoutError('');
    if (otpInput.trim() !== '123456') {
      setOtpStatusMessage('');
      setCheckoutError(
        'Kode OTP salah atau telah kedaluwarsa. Gunakan kode uji 123456 atau kirim ulang setelah 60 detik (A03).'
      );
      return;
    }
    setLoggedInMemberId('mem_anisa');
    setGuestName('Anisa Putri');
    setOtpStatusMessage('Terverifikasi sebagai Member: Anisa Putri (4 kunjungan sah).');
  };

  const handleCheckGpsPresence = async (simulateFailure = false) => {
    setCheckoutError('');
    try {
      const res = await onCommand('VERIFY_PRESENCE', {
        principalId: identityMode === 'MEMBER' ? loggedInMemberId : `guest_${guestName}`,
        lat: simulateFailure ? -6.95 : -6.91755,
        lng: simulateFailure ? 107.65 : 107.61915,
        accuracyMeters: simulateFailure ? 140 : 14,
      });
      const check = res?.result || res;
      setPresenceVerified(Boolean(check?.eligible));
      setPresenceStatusText(check?.message || '');
      if (!check?.eligible) {
        setCheckoutError(check?.message || 'Lokasi belum memenuhi syarat.');
      }
    } catch (err: any) {
      setCheckoutError(err.message);
    }
  };

  const handleUseJoinCode = async () => {
    setCheckoutError('');
    try {
      const res = await onCommand('VERIFY_PRESENCE', {
        principalId: identityMode === 'MEMBER' ? loggedInMemberId : `guest_${guestName}`,
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
        principalId: identityMode === 'MEMBER' ? loggedInMemberId : `guest_${guestName}`,
        memberId: identityMode === 'MEMBER' ? loggedInMemberId : undefined,
        mode: orderMode,
        tableId: orderMode === 'DINE_IN' ? selectedTableId : undefined,
        promoCode: codeToApply || undefined,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          variantId: c.variantId,
          modifierOptionIds: c.modifierOptionIds,
          note: c.note,
          quantity: c.quantity,
        })),
      });
      setActiveQuote(res?.result || res);
    } catch (err: any) {
      setCheckoutError(err.message);
    }
  };

  const handleSubmitOrderRequest = async () => {
    setCheckoutError('');
    setCheckoutSuccessMsg('');
    if (guestName.trim().length < 2) {
      setCheckoutError(
        'Nama pemesan wajib diisi minimal 2 karakter (A02). Keranjang Anda tetap tersimpan.'
      );
      return;
    }
    if (!presenceVerified) {
      setCheckoutError('Lokasi belum terbaca. Coba lagi atau minta bantuan staf (A06).');
      return;
    }

    try {
      let quoteToUse = activeQuote;
      if (!quoteToUse) {
        const qRes = await onCommand('CREATE_QUOTE', {
          principalId: identityMode === 'MEMBER' ? loggedInMemberId : `guest_${guestName}`,
          memberId: identityMode === 'MEMBER' ? loggedInMemberId : undefined,
          mode: orderMode,
          tableId: orderMode === 'DINE_IN' ? selectedTableId : undefined,
          promoCode: promoCodeInput.trim() || undefined,
          items: cart.map((c) => ({
            menuItemId: c.menuItemId,
            variantId: c.variantId,
            modifierOptionIds: c.modifierOptionIds,
            note: c.note,
            quantity: c.quantity,
          })),
        });
        quoteToUse = qRes?.result || qRes;
        setActiveQuote(quoteToUse);
      }

      const idemKey = `idem_${quoteToUse.quoteId}`;
      const subRes = await onCommand('SUBMIT_ORDER_REQUEST', {
        quoteId: quoteToUse.quoteId,
        principalId: identityMode === 'MEMBER' ? loggedInMemberId : `guest_${guestName}`,
        memberId: identityMode === 'MEMBER' ? loggedInMemberId : undefined,
        customerName: guestName.trim(),
        mode: orderMode,
        tableId: orderMode === 'DINE_IN' ? selectedTableId : undefined,
        presenceVerified: true,
        idempotencyKey: idemKey,
      });

      const outcome = subRes?.result || subRes;
      setCheckoutSuccessMsg(
        outcome?.orderId
          ? `Pesanan langsung diterima otomatis untuk kunjungan aktif (${outcome.tableLabel || 'Meja'}).`
          : `Permintaan pesanan berhasil dikirim (${outcome?.tableLabel}). Menunggu konfirmasi staf.`
      );
      if (outcome?.billId) {
        setSelectedBillId(outcome.billId);
      }
      setActiveScreen('pesanan');
    } catch (err: any) {
      setCheckoutError(err.message);
    }
  };

  const handleCopyText = (key: string, text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const selectedBill = useMemo(() => {
    const list = snapshot?.bills || [];
    return list.find((b: any) => b.id === selectedBillId) || list[0] || null;
  }, [snapshot, selectedBillId]);

  const navigateFromDrawer = (screen: CustomerScreenView) => {
    setActiveScreen(screen);
    setProfileDrawerOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const configuringPhotos: string[] = useMemo(() => {
    if (!configuringItem) return [];
    if (Array.isArray(configuringItem.photos) && configuringItem.photos.length > 0) {
      return configuringItem.photos;
    }
    return configuringItem.photoUrl ? [configuringItem.photoUrl] : [];
  }, [configuringItem]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
      {/* ===================================================================== */}
      {/* STICKY MOBILE-FIRST CUSTOMER HEADER                                   */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-30 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-[680px] mx-auto px-4 py-3 flex items-center justify-between gap-2">
          {/* Left: Clean ArrowLeft Back Icon (when on sub-screen) + Outlet & Table Context */}
          <div className="flex items-center gap-2 min-w-0">
            {activeScreen !== 'menu' ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveScreen('menu')}
                aria-label="Kembali ke menu utama"
                className="w-9 h-9 -ml-1.5 flex items-center justify-center text-[var(--foreground)] hover:text-[var(--primary)] cursor-pointer shrink-0 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
            ) : null}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading text-[18px] leading-[22px] font-bold text-[var(--foreground)] truncate">
                  {snapshot?.outlet?.name || 'Kedai Meranti'}
                </span>
                <span className="text-[12px] font-medium text-[var(--status-success-fg)] shrink-0">
                  · Buka
                </span>
              </div>

              {/* Interactive Table / Order Mode Selector */}
              <button
                type="button"
                onClick={() => setTableModalOpen(true)}
                className="mt-0.5 inline-flex items-center gap-1 text-[13px] leading-[18px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer max-w-full"
              >
                <MapPin className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                <span className="truncate">
                  {orderMode === 'DINE_IN'
                    ? `Meja ${selectedTable.label} (${selectedTable.areaName})`
                    : 'Bawa Pulang (Takeaway)'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              </button>
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
              className={`relative w-10 h-10 flex items-center justify-center transition-colors cursor-pointer ${
                onlyFavorites
                  ? 'text-[#9E2A2B]'
                  : 'text-[var(--foreground)] hover:text-[var(--primary)]'
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

            {/* 2. Actual Shopping Cart Icon Button (No card wrapper) */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() =>
                setActiveScreen(activeScreen === 'keranjang' ? 'menu' : 'keranjang')
              }
              aria-label={`Keranjang belanja (${cartSummary.totalQty} item)`}
              className={`relative w-10 h-10 flex items-center justify-center transition-colors cursor-pointer ${
                activeScreen === 'keranjang'
                  ? 'text-[var(--primary)]'
                  : 'text-[var(--foreground)] hover:text-[var(--primary)]'
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

            {/* 3. Profile, Orders, Payment & Table Services Icon Button (No card wrapper) */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setProfileDrawerOpen(true)}
              aria-label="Menu profil, pesanan, dan layanan meja"
              className={`relative w-10 h-10 flex items-center justify-center transition-colors cursor-pointer ${
                profileDrawerOpen ||
                ['pesanan', 'pembayaran', 'bantuan', 'wifi', 'member', 'antrean'].includes(
                  activeScreen
                )
                  ? 'text-[var(--primary)]'
                  : 'text-[var(--foreground)] hover:text-[var(--primary)]'
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
      <main className="flex-1 w-full max-w-[680px] mx-auto px-4 pt-4 pb-28">
        <AnimatePresence mode="wait" initial={false}>
          {/* ================================================================= */}
          {/* SCREEN 1: MENU PELANGGAN (C01, C02, C14)                          */}
          {/* ================================================================= */}
          {activeScreen === 'menu' && (
            <motion.div
              key="screen-menu"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="space-y-4"
            >
              {/* Active Order / Unpaid Bill Quick Strip */}
              {(activeOrdersCount > 0 || unpaidBills.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-3 px-3.5 rounded-[10px] bg-[var(--accent-surface)] border border-[#CBDAC8] flex flex-wrap items-center justify-between gap-2.5"
                >
                  <div className="text-[13px] leading-[18px] min-w-0">
                    <p className="font-semibold text-[var(--foreground)] truncate">
                      Meja {selectedTable.label} memiliki pesanan &amp; tagihan aktif
                    </p>
                    <p className="text-[var(--muted-foreground)] tabular-nums">
                      {unpaidBills.length > 0
                        ? `Tagihan belum dibayar: ${formatIdr(unpaidBills[0].balanceIdr)}`
                        : 'Pesanan sedang diproses dapur/bar'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveScreen('pesanan')}
                    >
                      Status Pesanan
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveScreen('pembayaran')}
                    >
                      Bayar / Struk
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Menu Title + Live Outlet Tax/Service Policy Indicator */}
              <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1">
                <h1 className="font-heading text-[24px] leading-[30px] font-bold text-[var(--foreground)]">
                  Menu
                </h1>
                <span className="text-[12px] text-[var(--muted-foreground)]">
                  {formatOutletChargePolicy(snapshot?.outlet)}
                </span>
              </div>

              {/* Shadcn Search Input + Shadcn SelectField Category Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-7">
                  <SearchField
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Cari kopi, makanan, pastry..."
                  />
                </div>
                <div className="sm:col-span-5">
                  <Label htmlFor="category-dropdown" className="sr-only">
                    Pilih kategori menu
                  </Label>
                  <SelectField
                    id="category-dropdown"
                    aria-label="Pilih kategori menu"
                    value={activeCategoryId}
                    onChange={(e) => setActiveCategoryId(e.target.value)}
                  >
                    {categoriesWithCounts.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.count})
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>

              {/* Quick Filter Toggles */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
                <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setOnlyAvailable(!onlyAvailable)}
                    aria-pressed={onlyAvailable}
                    className={`min-h-[34px] px-3 py-1 rounded-[6px] border text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      onlyAvailable
                        ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    Tersedia Saja
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setOnlyFavorites(!onlyFavorites)}
                    aria-pressed={onlyFavorites}
                    className={`min-h-[34px] px-3 py-1 rounded-[6px] border text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                      onlyFavorites
                        ? 'bg-[#FCE8E8] border-[#F3C5C5] text-[#9E2A2B]'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-[#9E2A2B]' : ''}`} />
                    <span>Favorit ({favoriteIds.size})</span>
                  </motion.button>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setActiveScreen('wifi')}
                  className="min-h-[34px] px-2.5 py-1 rounded-[6px] bg-transparent hover:bg-[var(--accent-surface)] text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                >
                  <Wifi className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Wi-Fi Meja</span>
                </motion.button>
              </div>

              {/* Menu List — Less-Cards Hairline Divided Editorial Feed */}
              {filteredCatalog.length === 0 ? (
                <EmptyState
                  title="Menu tidak ditemukan"
                  description={
                    onlyFavorites
                      ? 'Anda belum menandai menu favorit di kategori ini.'
                      : 'Tidak ada menu yang cocok dengan kata kunci atau kategori terpilih.'
                  }
                  actionLabel="Tampilkan semua menu"
                  onAction={() => {
                    setSearchQuery('');
                    setActiveCategoryId('ALL');
                    setOnlyFavorites(false);
                    setOnlyAvailable(false);
                  }}
                />
              ) : (
                <div
                  className="divide-y divide-[var(--border)] border-t border-b border-[var(--border)]"
                  role="list"
                  aria-label="Daftar menu"
                >
                  <AnimatePresence initial={false}>
                    {filteredCatalog.map((item: any, idx: number) => {
                      const defaultVariant =
                        item.variants?.find((v: any) => v.isDefault) || item.variants?.[0];
                      const maxAvail = Math.max(
                        0,
                        ...(item.variants || []).map((v: any) => v.availableToSell)
                      );
                      const isLowStock = item.isAvailable && maxAvail > 0 && maxAvail <= 3;
                      const isFav = favoriteIds.has(item.id);
                      const hasRequiredMod = (item.modifierGroups || []).some(
                        (g: any) => g.required
                      );
                      const photosList: string[] = Array.isArray(item.photos)
                        ? item.photos
                        : item.photoUrl
                        ? [item.photoUrl]
                        : [];
                      const qtyInCart = cart
                        .filter((c) => c.menuItemId === item.id)
                        .reduce((s, c) => s + c.quantity, 0);

                      return (
                        <motion.article
                          key={item.id}
                          layout="position"
                          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                          transition={{
                            duration: 0.16,
                            delay: Math.min(idx * 0.02, 0.12),
                          }}
                          role="listitem"
                          className={`py-4 flex gap-3.5 sm:gap-4 transition-colors ${
                            !item.isAvailable ? 'opacity-60' : ''
                          }`}
                        >
                          {/* Animated Multi-Photo Thumbnail Slider (Slide inline OR tap to open modal) */}
                          <ThumbnailImageSlider
                            photos={photosList}
                            itemName={item.name}
                            externalCode={item.externalCode}
                            onOpenDetail={() => openItemModal(item)}
                          />

                          {/* Right Content (Unboxed Editorial Layout) */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => openItemModal(item)}
                                  className="text-left font-heading text-[16px] leading-[22px] font-semibold text-[var(--foreground)] hover:text-[var(--primary)] cursor-pointer transition-colors"
                                >
                                  {item.name}
                                </button>
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.85 }}
                                  onClick={() =>
                                    onCommand('SETTINGS_PROMO_FEEDBACK_ACTION', {
                                      action: 'TOGGLE_FAVORITE',
                                      memberId: loggedInMemberId,
                                      menuItemId: item.id,
                                    })
                                  }
                                  aria-label={
                                    isFav
                                      ? `Hapus ${item.name} dari favorit`
                                      : `Simpan ${item.name} ke favorit`
                                  }
                                  className="p-1.5 -mr-1 -mt-1 text-[var(--muted-foreground)] hover:text-[#9E2A2B] rounded-[6px] cursor-pointer shrink-0 transition-colors"
                                >
                                  <Heart
                                    className={`w-4 h-4 ${
                                      isFav ? 'fill-[#9E2A2B] text-[#9E2A2B]' : ''
                                    }`}
                                  />
                                </motion.button>
                              </div>

                              <p className="mt-0.5 text-[13px] leading-[19px] text-[var(--muted-foreground)] line-clamp-2">
                                {item.description}
                              </p>

                              {/* Clean Unboxed Metadata Tags */}
                              <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                                {[
                                  hasRequiredMod ? 'Pilihan wajib' : null,
                                  (item.variants?.length ?? 0) > 1
                                    ? `${item.variants.length} ukuran`
                                    : null,
                                  Array.isArray(item.allergensJson) &&
                                  item.allergensJson.length > 0
                                    ? `Alergen: ${item.allergensJson.join(', ')}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>

                            {/* Price + Availability + Add CTA */}
                            <div className="mt-2.5 flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Money
                                  amount={item.minPriceIdr || defaultVariant?.priceIdr || 0}
                                  className="font-semibold text-[15px] text-[var(--foreground)]"
                                />
                                {!item.isAvailable ? (
                                  <StatusLabel label="Habis" tone="danger" />
                                ) : isLowStock ? (
                                  <StatusLabel label={`Sisa ${maxAvail}`} tone="warning" />
                                ) : null}
                              </div>

                              <div className="flex items-center gap-2">
                                {qtyInCart > 0 && (
                                  <span className="text-[12px] font-semibold text-[var(--primary)] tabular-nums">
                                    {qtyInCart}× di keranjang
                                  </span>
                                )}
                                <Button
                                  variant={item.isAvailable ? 'primary' : 'secondary'}
                                  size="sm"
                                  disabled={!item.isAvailable || busy}
                                  onClick={() => handleQuickAddOrConfigure(item)}
                                >
                                  {!item.isAvailable
                                    ? 'Habis'
                                    : hasRequiredMod || (item.variants?.length ?? 0) > 1
                                    ? 'Pilih'
                                    : '+ Tambah'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {/* ================================================================= */}
          {/* SCREEN 2: KERANJANG, IDENTITAS, LOKASI & QUOTE PROMO (C03–C06)    */}
          {/* ================================================================= */}
          {activeScreen === 'keranjang' && (
            <motion.div
              key="screen-keranjang"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
                <h1 className="font-heading text-[22px] font-bold">Keranjang Pesanan</h1>
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
                  {/* 1. Daftar Item Keranjang (Open Hairline List — No outer box card) */}
                  <section className="space-y-2">
                    <h2 className="font-heading text-[16px] font-semibold">
                      Daftar menu ({cartSummary.totalQty} item)
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
                            <p className="pt-1 font-semibold text-[14px]">
                              <Money amount={line.unitPriceIdr * line.quantity} />
                            </p>
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
                      <h2 className="font-heading text-[16px] font-semibold">Identitas pemesan</h2>
                      <AnimatedSegmentedControl
                        options={[
                          { value: 'GUEST', label: 'Tamu' },
                          { value: 'MEMBER', label: 'Member OTP' },
                        ]}
                        value={identityMode}
                        onChange={setIdentityMode}
                        ariaLabel="Mode identitas pemesan"
                        layoutId="customer-identity-mode"
                      />
                    </div>

                    {identityMode === 'GUEST' ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="guest-name-input">
                          Nama pemesan di meja (2–60 karakter)
                        </Label>
                        <Input
                          id="guest-name-input"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="Contoh: Budi / Anisa"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="member-contact-input">Nomor WhatsApp / Email</Label>
                            <Input
                              id="member-contact-input"
                              value={memberContact}
                              onChange={(e) => setMemberContact(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="member-otp-input">Kode OTP (Uji: 123456)</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="member-otp-input"
                                value={otpInput}
                                onChange={(e) => setOtpInput(e.target.value)}
                                className="tabular-nums"
                              />
                              <Button variant="secondary" onClick={handleVerifyOtp}>
                                Verifikasi
                              </Button>
                            </div>
                          </div>
                        </div>
                        {otpStatusMessage && (
                          <StatusLabel label={otpStatusMessage} tone="success" />
                        )}
                      </div>
                    )}
                  </section>

                  {/* 3. Verifikasi Kehadiran Meja (Unboxed Section with Hairline Top Divider) */}
                  <section className="pt-5 border-t border-[var(--border)] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-heading text-[16px] font-semibold">
                        Verifikasi lokasi meja
                      </h2>
                      <StatusLabel
                        label={presenceVerified ? 'Terverifikasi' : 'Perlu Verifikasi'}
                        tone={presenceVerified ? 'success' : 'warning'}
                      />
                    </div>
                    <p className="text-[13px] text-[var(--muted-foreground)]">
                      Radius geofence outlet ({snapshot?.outlet?.geofenceRadiusMeters ?? 75} m) atau
                      kode gabung dari staf meja:
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => handleCheckGpsPresence(false)}
                      >
                        <MapPin className="w-4 h-4" />
                        <span>Cek GPS di lokasi</span>
                      </Button>
                      <div className="flex items-center gap-2 flex-1 min-w-[210px]">
                        <Input
                          aria-label="Kode gabung meja dari staf"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value)}
                          placeholder="Kode staf (M01-8842)"
                          className="uppercase tabular-nums"
                        />
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={handleUseJoinCode}
                        >
                          Pakai Kode
                        </Button>
                      </div>
                    </div>
                    {presenceStatusText && (
                      <p className="text-[12px] text-[var(--muted-foreground)]">
                        {presenceStatusText}
                      </p>
                    )}
                  </section>

                  {/* 4. Promo Voucher & Rincian Biaya (Single Subtle Summary Surface) */}
                  <section className="pt-5 border-t border-[var(--border)] space-y-4">
                    <h2 className="font-heading text-[16px] font-semibold">
                      Promo &amp; rincian pembayaran
                    </h2>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          id="promo-code-input"
                          value={promoCodeInput}
                          onChange={(e) => setPromoCodeInput(e.target.value)}
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

                      {(snapshot?.promotions || []).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[12px] text-[var(--muted-foreground)]">
                            Voucher tersedia:
                          </span>
                          {(snapshot?.promotions || []).map((p: any) => (
                            <motion.button
                              key={p.id}
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleRequestQuote(p.code)}
                              className="px-2.5 py-1 rounded-[6px] bg-[var(--accent-surface)] border border-[#CBDAC8] text-[12px] font-semibold text-[var(--primary)] hover:bg-[#DFE8DD] cursor-pointer transition-colors"
                            >
                              {p.code} ({p.name})
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-[12px] bg-[var(--surface)] border border-[var(--border)] space-y-3">
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
                        <div className="pt-2 border-t border-[var(--border)] text-[12px] text-[var(--primary)] font-medium">
                          Quote sah terkunci (Versi katalog #{activeQuote.catalogVersion}) · Berlaku
                          hingga{' '}
                          {new Date(activeQuote.expiresAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>

                    <InlineError message={checkoutError} />
                    {checkoutSuccessMsg && (
                      <StatusLabel label={checkoutSuccessMsg} tone="success" />
                    )}

                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      disabled={busy}
                      onClick={handleSubmitOrderRequest}
                    >
                      Ajukan pesanan · {formatIdr(activeQuote?.totalIdr ?? cartSummary.totalIdr)}
                    </Button>
                  </section>
                </div>
              )}
            </motion.div>
          )}

          {/* ================================================================= */}
          {/* SCREEN 3: STATUS PESANAN 3 SUMBU (C07 — Less Cards, Clean Dividers)*/}
          {/* ================================================================= */}
          {activeScreen === 'pesanan' && (
            <motion.div
              key="screen-pesanan"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
                <h1 className="font-heading text-[22px] font-bold">Status Pesanan</h1>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setActiveScreen('pembayaran')}
                >
                  Bayar / Lihat Struk
                </Button>
              </div>

              {/* Pending Order Requests waiting for staff */}
              {(snapshot?.orderRequests || []).filter((r: any) => r.state === 'REQUESTED').length >
                0 && (
                <section className="space-y-2.5">
                  <h2 className="font-heading text-[16px] font-semibold">
                    Menunggu konfirmasi staf
                  </h2>
                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {(snapshot?.orderRequests || [])
                      .filter((r: any) => r.state === 'REQUESTED')
                      .map((req: any) => {
                        const matchedQuote = (snapshot?.quotes || []).find(
                          (q: any) => q.id === req.quoteId
                        );
                        return (
                          <div key={req.id} className="py-3.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[15px]">
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
              <section className="space-y-3">
                <h2 className="font-heading text-[16px] font-semibold">
                  Pesanan terkonfirmasi &amp; progres dapur/bar
                </h2>
                <div className="divide-y divide-[var(--border)] border-t border-b border-[var(--border)]">
                  {(snapshot?.orders || []).map((ord: any) => {
                    const units = (snapshot?.orderUnits || []).filter(
                      (u: any) => u.orderId === ord.id
                    );
                    const relatedBill = (snapshot?.bills || []).find(
                      (b: any) => b.visitId === ord.visitId
                    );

                    return (
                      <article key={ord.id} className="py-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-heading font-semibold text-[16px]">
                              Pesanan #{ord.orderNumber || String(ord.id).slice(-6).toUpperCase()} ·{' '}
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
                              label={
                                relatedBill?.paymentState === 'SETTLED'
                                  ? 'Lunas'
                                  : relatedBill?.paymentState === 'PARTIALLY_PAID'
                                  ? 'Dibayar Sebagian'
                                  : 'Belum Dibayar'
                              }
                              tone={relatedBill?.paymentState === 'SETTLED' ? 'success' : 'warning'}
                            />
                          </div>
                        </div>

                        {/* Fulfillment per Unit */}
                        <div className="pl-3 border-l-2 border-[var(--border)] divide-y divide-[var(--border)]/70">
                          {units.map((u: any) => (
                            <div
                              key={u.id}
                              className="py-2 flex items-center justify-between gap-3 text-[14px]"
                            >
                              <div>
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
                                label={
                                  u.fulfillmentStatus === 'SERVED'
                                    ? 'Disajikan'
                                    : u.fulfillmentStatus === 'READY'
                                    ? 'Siap Diambil/Antar'
                                    : u.fulfillmentStatus === 'PREPARING'
                                    ? 'Sedang Dimasak'
                                    : u.fulfillmentStatus === 'QUEUED'
                                    ? 'Dalam Antrean Dapur'
                                    : 'Menunggu Pembayaran'
                                }
                                tone={
                                  u.fulfillmentStatus === 'SERVED' ||
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
              </section>
            </motion.div>
          )}

          {/* ================================================================= */}
          {/* SCREEN 4: PEMBAYARAN TAGIHAN & STRUK DIGITAL (C08, C09)           */}
          {/* ================================================================= */}
          {activeScreen === 'pembayaran' && (
            <motion.div
              key="screen-pembayaran"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
                <h1 className="font-heading text-[22px] font-bold">Pembayaran &amp; Struk</h1>
                <SelectField
                  aria-label="Pilih tagihan meja"
                  value={selectedBill?.id || ''}
                  onChange={(e) => setSelectedBillId(e.target.value)}
                  wrapperClassName="w-auto min-w-[230px]"
                >
                  {(snapshot?.bills || []).map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.ownerLabel} — Sisa {formatIdr(b.balanceIdr)}
                    </option>
                  ))}
                </SelectField>
              </div>

              {selectedBill && (
                <div className="space-y-6">
                  {/* Bill Items (Open Hairline List) */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="font-heading text-[17px] font-semibold">
                          {selectedBill.ownerLabel}
                        </h2>
                        <p className="text-[12px] text-[var(--muted-foreground)] tabular-nums">
                          ID Tagihan: {selectedBill.id}
                        </p>
                      </div>
                      <StatusLabel
                        label={
                          selectedBill.paymentState === 'SETTLED'
                            ? 'Lunas'
                            : selectedBill.paymentState === 'PARTIALLY_PAID'
                            ? 'Dibayar Sebagian'
                            : 'Belum Dibayar'
                        }
                        tone={selectedBill.paymentState === 'SETTLED' ? 'success' : 'warning'}
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

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[12px] text-[var(--muted-foreground)]">
                        Bagikan khusus tagihan ini ke teman semeja:
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          handleCopyText(
                            `share_${selectedBill.id}`,
                            `${typeof window !== 'undefined' ? window.location.origin : ''}/?bill=${
                              selectedBill.shareToken
                            }`
                          )
                        }
                      >
                        {copiedKey === `share_${selectedBill.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[var(--status-success-fg)]" />
                            <span>Link Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Salin Link Tagihan</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </section>

                  {/* Payment Summary & QRIS / VA Interactive Checkout */}
                  <section className="pt-4 border-t border-[var(--border)] space-y-4">
                    <h2 className="font-heading text-[16px] font-semibold">Ringkasan kewajiban</h2>
                    <PaymentBreakdown
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
                    />

                    {selectedBill.balanceIdr > 0 && (
                      <div className="pt-4 border-t border-[var(--border)] space-y-4">
                        <AnimatedSegmentedControl
                          options={[
                            { value: 'QRIS', label: 'QRIS' },
                            { value: 'VIRTUAL_ACCOUNT', label: 'Virtual Account BCA' },
                          ]}
                          value={selectedPaymentMethod}
                          onChange={setSelectedPaymentMethod}
                          ariaLabel="Pilih metode pembayaran online"
                          layoutId="payment-method-selector"
                        />

                        <AnimatePresence mode="wait">
                          {selectedPaymentMethod === 'QRIS' ? (
                            <motion.div
                              key="qris-box"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.16 }}
                              className="p-4 rounded-[12px] bg-[var(--surface)] border border-[var(--border)] text-center space-y-2"
                            >
                              <p className="font-heading font-semibold text-[15px]">
                                QRIS — PT Kedai Meranti Nusantara
                              </p>
                              <p className="text-[12px] text-[var(--muted-foreground)] tabular-nums">
                                NMID: ID1026008192837 · Nominal Terkunci:{' '}
                                <strong>{formatIdr(selectedBill.balanceIdr)}</strong>
                              </p>
                              <div className="w-36 h-36 mx-auto my-2 p-3 bg-white border-2 border-[var(--foreground)] rounded-[8px] flex flex-col items-center justify-center gap-1">
                                <QrCode className="w-24 h-24 text-[var(--foreground)]" />
                                <span className="text-[10px] font-bold tracking-wider">
                                  QRIS MERANTI
                                </span>
                              </div>
                              <p className="text-[12px] text-[var(--muted-foreground)]">
                                Pindai menggunakan aplikasi m-Banking atau e-Wallet Anda
                              </p>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="va-box"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.16 }}
                              className="p-4 rounded-[12px] bg-[var(--surface)] border border-[var(--border)] space-y-2"
                            >
                              <p className="text-[12px] text-[var(--muted-foreground)]">
                                Nomor Virtual Account BCA:
                              </p>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-heading font-bold text-[18px] tabular-nums">
                                  88012 0812 3456 789
                                </span>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleCopyText('va_bca', '8801208123456789')}
                                >
                                  {copiedKey === 'va_bca' ? 'Tersalin' : 'Salin VA'}
                                </Button>
                              </div>
                              <p className="text-[12px] text-[var(--muted-foreground)]">
                                a.n. Kedai Meranti ({selectedBill.ownerLabel})
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            variant="primary"
                            className="flex-1"
                            disabled={busy}
                            onClick={async () => {
                              setPaymentFeedback('');
                              const res = await onCommand('PROCESS_PAYMENT', {
                                billId: selectedBill.id,
                                method: selectedPaymentMethod,
                                amountIdr: selectedBill.balanceIdr,
                                actorName: guestName,
                                actorRole: 'CUSTOMER',
                                idempotencyKey: `cust_pay_${selectedBill.id}_${selectedPaymentMethod}`,
                              });
                              const out = res?.result || res;
                              setPaymentFeedback(
                                `Instruksi ${selectedPaymentMethod} dibuat (Ref: ${out?.providerRef}).`
                              );
                            }}
                          >
                            <QrCode className="w-4 h-4" />
                            <span>
                              Buat &amp; Segarkan{' '}
                              {selectedPaymentMethod === 'QRIS' ? 'QRIS' : 'VA'} ·{' '}
                              {formatIdr(selectedBill.balanceIdr)}
                            </span>
                          </Button>

                          {selectedBill.attempts?.some((a: any) => a.status === 'PENDING') && (
                            <Button
                              variant="subtle"
                              disabled={busy}
                              onClick={async () => {
                                const pendingAtt = selectedBill.attempts.find(
                                  (a: any) => a.status === 'PENDING'
                                );
                                if (!pendingAtt) return;
                                await onCommand('SIMULATE_WEBHOOK', {
                                  attemptId: pendingAtt.id,
                                  outcome: 'SETTLED',
                                  actorName: 'Payment Gateway',
                                });
                                setPaymentFeedback('Pembayaran berhasil diverifikasi otomatis!');
                              }}
                            >
                              Simulasi Bayar Lunas
                            </Button>
                          )}
                        </div>

                        {paymentFeedback && <StatusLabel label={paymentFeedback} tone="info" />}

                        <p className="text-[12px] text-[var(--muted-foreground)]">
                          Ingin bayar tunai atau pisah tagihan (Split Bill)? Silakan menuju kasir
                          atau panggil staf dengan menyebutkan Meja {selectedBill.tableLabel}.
                        </p>
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
                            Struk Digital — {snapshot?.outlet?.name}
                          </p>
                          <p className="text-[12px] text-[var(--muted-foreground)]">
                            {snapshot?.outlet?.address}
                          </p>
                        </div>
                        <StatusLabel label="Bukti Bayar Sah" tone="success" />
                      </div>
                      <div className="text-[13px] space-y-1 tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-[var(--muted-foreground)]">
                            No. Tagihan / Struk
                          </span>
                          <span className="font-medium">{selectedBill.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--muted-foreground)]">Pelanggan / Meja</span>
                          <span className="font-medium">
                            {selectedBill.ownerLabel} · Meja {selectedBill.tableLabel}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--muted-foreground)]">Status Pembayaran</span>
                          <span className="font-semibold text-[var(--status-success-fg)]">
                            {selectedBill.paymentState}
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
                        <span>Total Diterima Kasir/QRIS</span>
                        <span className="text-[var(--primary)]">
                          {formatIdr(selectedBill.verifiedReceiptsIdr)}
                        </span>
                      </div>
                    </section>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ================================================================= */}
          {/* SCREEN 5: BANTUAN MEJA / PANGGIL STAF (C10 — Less Cards)          */}
          {/* ================================================================= */}
          {activeScreen === 'bantuan' && (
            <motion.div
              key="screen-bantuan"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="space-y-5"
            >
              <h1 className="font-heading text-[22px] font-bold pb-3 border-b border-[var(--border)]">
                Panggil Staf &amp; Bantuan Meja
              </h1>

              <section className="space-y-4">
                <h2 className="font-heading text-[16px] font-semibold">
                  Kirim permintaan ke staf untuk Meja {selectedTable.label}
                </h2>
                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {[
                    { code: 'CALL_STAFF', label: 'Panggil staf ke meja' },
                    { code: 'ASK_BILL', label: 'Minta bantuan tagihan / bayar tunai' },
                    { code: 'EXTRA_CUTLERY', label: 'Minta alat makan / tisu / air' },
                    { code: 'CLEAR_TABLE', label: 'Minta bersihkan meja' },
                    { code: 'ISSUE_REPORT', label: 'Laporkan kendala pesanan' },
                  ].map((opt) => {
                    const active = helpType === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => setHelpType(opt.code as any)}
                        className={`w-full py-3.5 px-2 flex items-center justify-between text-left text-[15px] transition-colors cursor-pointer ${
                          active
                            ? 'text-[var(--primary)] font-semibold bg-[var(--accent-surface)]/50'
                            : 'text-[var(--foreground)] hover:bg-[var(--accent-surface)]/30 font-medium'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {active && <Check className="w-4 h-4 text-[var(--primary)]" />}
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
                    const res = await onCommand('SERVICE_REQUEST_ACTION', {
                      action: 'CREATE',
                      visitId: 'visit_m01_open',
                      tableLabel: selectedTable.label,
                      customerName: guestName,
                      type: helpType,
                      notes: helpNotes,
                    });
                    const out = res?.result || res;
                    setHelpFeedback(out?.message || 'Permintaan bantuan terkirim ke staf.');
                    setHelpNotes('');
                  }}
                >
                  <Bell className="w-4 h-4" />
                  <span>Kirim Permintaan Bantuan</span>
                </Button>
              </section>
            </motion.div>
          )}

          {/* ================================================================= */}
          {/* SCREEN 6: WI-FI GRATIS & INFO OUTLET (C12 — Less Cards)           */}
          {/* ================================================================= */}
          {activeScreen === 'wifi' && (
            <motion.div
              key="screen-wifi"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="space-y-6"
            >
              <h1 className="font-heading text-[22px] font-bold pb-3 border-b border-[var(--border)]">
                Wi-Fi Gratis &amp; Informasi Outlet
              </h1>

              <section className="space-y-3">
                <h2 className="font-heading text-[16px] font-semibold">Jaringan Wi-Fi Pelanggan</h2>
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
              </section>

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
            </motion.div>
          )}

          {/* ================================================================= */}
          {/* SCREEN 7: MEMBER, STEMPEL LOYALITAS & ULASAN (C11 — Less Cards)   */}
          {/* ================================================================= */}
          {activeScreen === 'member' && (
            <motion.div
              key="screen-member"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="space-y-6"
            >
              <h1 className="font-heading text-[22px] font-bold pb-3 border-b border-[var(--border)]">
                Member, Promo &amp; Ulasan
              </h1>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-[17px] font-semibold">
                      {currentMember?.displayName || 'Anisa Putri'}
                    </h2>
                    <p className="text-[13px] text-[var(--muted-foreground)]">
                      {currentMember?.phone} · {currentMember?.qualifiedVisitsCount ?? 4} kunjungan
                      sah
                    </p>
                  </div>
                  <StatusLabel label="Member Aktif" tone="success" />
                </div>

                <div className="p-4 rounded-[12px] bg-[var(--accent-surface)] border border-[#CBDAC8] space-y-2.5">
                  <div className="flex items-center justify-between text-[13px] font-semibold text-[var(--primary)]">
                    <span>Progres Stempel Loyalitas</span>
                    <span className="tabular-nums">
                      {currentMember?.qualifiedVisitsCount ?? 4} / 5 Kunjungan
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((step) => {
                      const achieved = (currentMember?.qualifiedVisitsCount ?? 4) >= step;
                      return (
                        <motion.div
                          key={step}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: step * 0.04 }}
                          className={`h-9 rounded-[8px] flex items-center justify-center text-[12px] font-bold border ${
                            achieved
                              ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]'
                              : 'bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border)]'
                          }`}
                        >
                          #{step}
                        </motion.div>
                      );
                    })}
                  </div>
                  <p className="text-[12px] text-[var(--muted-foreground)]">
                    1 kunjungan lagi untuk membuka diskon 20% kode <strong>MEMBERKE5</strong>!
                  </p>
                </div>
              </section>

              {/* Send Review (Unboxed with Hairline Top Divider) */}
              <section className="pt-5 border-t border-[var(--border)] space-y-3">
                <h2 className="font-heading text-[16px] font-semibold">Beri Ulasan Kunjungan</h2>
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
                  placeholder="Ceritakan pengalaman Anda di Kedai Meranti..."
                />
                {reviewSubmittedMsg && <StatusLabel label={reviewSubmittedMsg} tone="success" />}
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    await onCommand('SETTINGS_PROMO_FEEDBACK_ACTION', {
                      action: 'SUBMIT_FEEDBACK',
                      feedbackData: {
                        visitId: 'visit_m01_open',
                        participantId: 'part_anisa',
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
                    setReviewSubmittedMsg('Terima kasih! Ulasan Anda telah tersimpan.');
                  }}
                >
                  <Star className="w-4 h-4" />
                  <span>Kirim Ulasan</span>
                </Button>
              </section>
            </motion.div>
          )}

          {/* ================================================================= */}
          {/* SCREEN 8: ANTREAN MEJA / WAITLIST (C13 — Less Cards)              */}
          {/* ================================================================= */}
          {activeScreen === 'antrean' && (
            <motion.div
              key="screen-antrean"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="space-y-6"
            >
              <h1 className="font-heading text-[22px] font-bold pb-3 border-b border-[var(--border)]">
                Daftar Antrean Meja (Waitlist)
              </h1>

              <section className="space-y-3">
                <h2 className="font-heading text-[16px] font-semibold">Ambil Nomor Antrean</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nama Tamu</Label>
                    <Input
                      value={waitlistName}
                      onChange={(e) => setWaitlistName(e.target.value)}
                      placeholder="Contoh: Hendra Wijaya"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Jumlah Kursi</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={waitlistPartySize}
                      onChange={(e) => setWaitlistPartySize(Number(e.target.value))}
                    />
                  </div>
                </div>
                {waitlistNotice && <StatusLabel label={waitlistNotice} tone="success" />}
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={async () => {
                    const res = await onCommand('WAITLIST_ACTION', {
                      action: 'JOIN',
                      customerName: waitlistName || guestName,
                      partySize: waitlistPartySize,
                      preferredArea: waitlistArea,
                      contactPhone: waitlistPhone,
                      notes: waitlistNotes,
                    });
                    const out = res?.result || res;
                    setWaitlistNotice(
                      `Terdaftar di antrean #${out?.entry?.queueNumber}. Estimasi ${out?.entry?.estimatedMinutes} menit.`
                    );
                    setWaitlistName('');
                  }}
                >
                  Ambil Nomor Antrean
                </Button>
              </section>

              <section className="pt-4 border-t border-[var(--border)] space-y-2.5">
                <h2 className="font-heading text-[16px] font-semibold">Status Antrean Saat Ini</h2>
                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {(snapshot?.waitlist || []).map((w: any) => (
                    <div key={w.id} className="py-3.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[15px]">
                          Antrean #{w.queueNumber} · {w.customerName} ({w.partySize} kursi)
                        </p>
                        <p className="text-[12px] text-[var(--muted-foreground)]">
                          Area: {w.preferredArea} · Estimasi {w.estimatedMinutes} mnt
                        </p>
                      </div>
                      <StatusLabel
                        label={w.status}
                        tone={w.status === 'CALLED' ? 'warning' : 'info'}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Realistic Merchant Footer */}
        <footer className="mt-10 pt-5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--muted-foreground)]">
          <div>
            <span className="font-semibold text-[var(--foreground)]">
              {snapshot?.outlet?.name || 'Kedai Meranti'}
            </span>{' '}
            · {snapshot?.outlet?.address || 'Jl. Meranti No. 18, Bandung'}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveScreen('wifi')}
              className="hover:text-[var(--foreground)] hover:underline cursor-pointer"
            >
              Wi-Fi &amp; Info
            </button>
            <button
              type="button"
              onClick={() => setActiveScreen('bantuan')}
              className="hover:text-[var(--foreground)] hover:underline cursor-pointer"
            >
              Panggil Staf
            </button>
            {onOpenStaffPortal && (
              <button
                type="button"
                onClick={onOpenStaffPortal}
                className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline cursor-pointer"
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
        {activeScreen === 'menu' && cart.length > 0 && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { y: 64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { y: 64, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed bottom-0 inset-x-0 z-20 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--border)] px-4 py-3 shadow-sm"
          >
            <div className="max-w-[680px] mx-auto flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
                  {cartSummary.totalQty} item di keranjang
                </p>
                <p className="text-[15px] font-bold text-[var(--foreground)] tabular-nums">
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

      {/* ===================================================================== */}
      {/* MODAL 1: PROFILE, ORDERS, PAYMENT & TABLE SERVICES MENU (Less Cards)  */}
      {/* ===================================================================== */}
      <DialogModal
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        title="Akun, Pesanan & Layanan Meja"
      >
        <div className="space-y-2">
          {/* Customer Identity Header (Unboxed with Hairline Bottom Divider) */}
          <div className="pb-3 border-b border-[var(--border)] flex items-center justify-between gap-2">
            <div>
              <p className="font-heading font-semibold text-[15px]">{guestName}</p>
              <p className="text-[12px] text-[var(--muted-foreground)]">
                {orderMode === 'DINE_IN'
                  ? `Meja ${selectedTable.label} · ${selectedTable.areaName}`
                  : 'Mode Bawa Pulang (Takeaway)'}
              </p>
            </div>
            <StatusLabel
              label={`${currentMember?.qualifiedVisitsCount ?? 4}/5 Stempel Member`}
              tone="active"
            />
          </div>

          {/* Clean Hairline Tap Rows (No outer box border!) */}
          <div className="divide-y divide-[var(--border)]">
            {[
              {
                id: 'pesanan' as CustomerScreenView,
                label: 'Pesanan Saya & Status Dapur',
                desc: 'Pantau status konfirmasi staf dan progres masak per porsi',
                badge: activeOrdersCount > 0 ? `${activeOrdersCount} Aktif` : undefined,
                icon: Utensils,
              },
              {
                id: 'pembayaran' as CustomerScreenView,
                label: 'Pembayaran Tagihan & Struk Digital',
                desc: 'Bayar dengan QRIS, Virtual Account, atau unduh struk',
                badge:
                  unpaidBills.length > 0
                    ? formatIdr(unpaidBills[0].balanceIdr)
                    : 'Lunas / Struk',
                icon: Receipt,
              },
              {
                id: 'keranjang' as CustomerScreenView,
                label: 'Keranjang Belanja',
                desc: 'Ubah jumlah porsi, catatan item, dan kode voucher promo',
                badge: `${cartSummary.totalQty} item`,
                icon: ShoppingCart,
              },
              {
                id: 'bantuan' as CustomerScreenView,
                label: 'Panggil Staf / Bantuan Meja',
                desc: 'Minta alat makan, air tambahan, bersihkan meja, atau tagihan',
                icon: Bell,
              },
              {
                id: 'member' as CustomerScreenView,
                label: 'Member, Voucher Promo & Ulasan',
                desc: 'Kartu stempel kunjungan, klaim diskon member, dan beri rating',
                icon: Award,
              },
              {
                id: 'wifi' as CustomerScreenView,
                label: 'Wi-Fi Gratis & Info Outlet',
                desc: 'Salin kata sandi Wi-Fi meja sekali ketuk dan jam operasional',
                icon: Wifi,
              },
              {
                id: 'antrean' as CustomerScreenView,
                label: 'Daftar Antrean Meja (Waitlist)',
                desc: 'Ambil nomor antrean meja saat ruang utama sedang penuh',
                icon: Clock,
              },
            ].map((item) => {
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
                    <Icon className="w-4 h-4 text-[var(--primary)] shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[14px] leading-[19px] text-[var(--foreground)]">
                        {item.label}
                      </p>
                      <p className="text-[12px] leading-[16px] text-[var(--muted-foreground)] line-clamp-1">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-[6px] bg-[var(--accent-surface)] text-[var(--primary)] text-[11px] font-semibold tabular-nums">
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
                Petugas kasir, barista, atau pemilik?
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
                <span>Login Staf / Kasir</span>
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
        title="Mode Pesanan & Nomor Meja"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Pilih Mode Layanan</Label>
            <AnimatedSegmentedControl
              options={[
                { value: 'DINE_IN', label: 'Makan di Tempat (Dine-In)' },
                { value: 'TAKEAWAY', label: 'Bawa Pulang (Takeaway)' },
              ]}
              value={orderMode}
              onChange={setOrderMode}
              ariaLabel="Mode layanan pesanan"
              layoutId="order-mode-segmented"
              className="w-full grid grid-cols-2"
            />
          </div>

          {orderMode === 'DINE_IN' && (
            <div className="space-y-1.5">
              <Label htmlFor="modal-select-table">Pilih Meja Anda</Label>
              <SelectField
                id="modal-select-table"
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
              >
                {(snapshot?.tables || [])
                  .filter((t: any) => t.physicalState !== 'OUT_OF_SERVICE')
                  .map((t: any) => (
                    <option key={t.id} value={t.id}>
                      Meja {t.label} — {t.areaName} ({t.capacity} kursi)
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
              <p className="font-semibold text-[14px]">Pilih ukuran / varian (Wajib)</p>
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
                          className="w-4 h-4 accent-[var(--primary)]"
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
                            className="w-4 h-4 accent-[var(--primary)]"
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

            {/* Item Note (Shadcn Input) */}
            <div className="space-y-1.5 pt-2">
              <Label htmlFor="item-note-input">Catatan untuk dapur/bar (opsional)</Label>
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
                Tambah ke Keranjang
              </Button>
            </div>
          </div>
        )}
      </DialogModal>
    </div>
  );
}
