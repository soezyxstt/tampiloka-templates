'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  Button,
  Input,
  Textarea,
  Label,
  SelectField,
  AnimatedUnderlineTabs,
  AnimatedSegmentedControl,
  ImageCarousel,
  StatusLabel,
  Money,
  PaymentBreakdown,
  InlineError,
  EmptyState,
  DialogModal,
  formatIdr,
} from './ui-primitives';
import { FloorPlanEditor } from './floor-plan-editor';
import { sanitizeSpreadsheetExportCell } from '@/src/domain/rules';
import {
  Check,
  X,
  Plus,
  Split,
  Merge,
  Volume2,
  VolumeX,
  Printer,
  Download,
  Upload,
  Lock,
  LogOut,
  Images,
  Trash2,
  ArrowLeft,
  Search,
  Utensils,
  Bell,
  Clock,
  Receipt,
} from 'lucide-react';

export type StaffSection =
  | 'kasir'
  | 'dapur'
  | 'meja'
  | 'menu'
  | 'laporan'
  | 'pengaturan';

const STAFF_CREDENTIALS: Record<
  string,
  { pin: string; roleLabel: string; defaultSection: StaffSection }
> = {
  staff_owner: {
    pin: '1111',
    roleLabel: 'Pemilik Outlet',
    defaultSection: 'kasir',
  },
  staff_manager: {
    pin: '1111',
    roleLabel: 'Manajer Operasional',
    defaultSection: 'kasir',
  },
  staff_cashier: {
    pin: '2222',
    roleLabel: 'Kasir Utama',
    defaultSection: 'kasir',
  },
  staff_waiter: {
    pin: '4444',
    roleLabel: 'Pelayan Lantai',
    defaultSection: 'meja',
  },
  staff_bar: {
    pin: '3333',
    roleLabel: 'Barista & Minuman',
    defaultSection: 'dapur',
  },
  staff_kitchen: {
    pin: '3333',
    roleLabel: 'Koki Dapur Utama',
    defaultSection: 'dapur',
  },
};

function formatStationName(code: string): string {
  switch (code) {
    case 'BAR':
      return 'Bar & Kopi';
    case 'KITCHEN':
      return 'Dapur Utama';
    case 'PASTRY':
      return 'Pastry & Roti';
    default:
      return code;
  }
}

function formatFulfillmentLabel(status: string): {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral';
} {
  switch (status) {
    case 'DELIVERED':
    case 'PICKED_UP':
    case 'SERVED':
      return { label: 'Disajikan', tone: 'success' };
    case 'READY':
      return { label: 'Siap Diantar', tone: 'info' };
    case 'PREPARING':
      return { label: 'Sedang Dibuat', tone: 'warning' };
    case 'QUEUED':
      return { label: 'Antrean Baru', tone: 'neutral' };
    case 'CANCELLED':
      return { label: 'Dibatalkan', tone: 'danger' };
    default:
      return { label: 'Menunggu', tone: 'warning' };
  }
}

function formatPaymentStateLabel(state: string): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
} {
  switch (state) {
    case 'SETTLED':
      return { label: 'Lunas', tone: 'success' };
    case 'PARTIALLY_PAID':
      return { label: 'Dibayar Sebagian', tone: 'info' };
    case 'REFUND_DUE':
      return { label: 'Perlu Refund', tone: 'danger' };
    default:
      return { label: 'Belum Dibayar', tone: 'warning' };
  }
}

function formatOutletChargePolicy(outlet: any): string {
  const srvPct = ((outlet?.serviceChargeBps ?? 500) / 100).toFixed(0);
  const taxPct = ((outlet?.taxBps ?? 1000) / 100).toFixed(0);
  const inclusive = Boolean(outlet?.taxInclusiveDisplay);

  if (Number(srvPct) === 0 && Number(taxPct) === 0) {
    return 'Harga Nett (Tanpa Pajak & Biaya Layanan Tambahan)';
  }
  if (inclusive) {
    return `Harga Sudah Termasuk Pajak ${taxPct}%${
      Number(srvPct) > 0 ? ` & Layanan ${srvPct}%` : ''
    }`;
  }
  if (Number(srvPct) > 0 && Number(taxPct) > 0) {
    return `Layanan ${srvPct}% + Pajak ${taxPct}%`;
  }
  if (Number(taxPct) > 0) {
    return `Pajak Restoran ${taxPct}%`;
  }
  return `Biaya Layanan ${srvPct}%`;
}

export function StaffApp({
  snapshot,
  activeStaff: activeStaffProp,
  onSwitchStaff,
  onCommand,
  busy,
  initialSignedIn = false,
  onBackToCustomer,
}: {
  snapshot: any;
  activeStaff?: string;
  onSwitchStaff?: (id: string) => void;
  onCommand: (action: string, payload: Record<string, any>) => Promise<any>;
  onRefresh?: () => void;
  busy: boolean;
  initialSignedIn?: boolean;
  lastUpdated?: string;
  onBackToCustomer?: () => void;
}) {
  const [internalStaffId, setInternalStaffId] = useState<string>(
    activeStaffProp || 'staff_owner'
  );
  const activeStaff = activeStaffProp || internalStaffId;
  const handleSwitchStaff = (id: string) => {
    setInternalStaffId(id);
    onSwitchStaff?.(id);
  };

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initialSignedIn);
  const [loginStaffId, setLoginStaffId] = useState<string>(activeStaff || 'staff_cashier');
  const [pinInput, setPinInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const [activeSection, setActiveSection] = useState<StaffSection>('kasir');
  const [actionNotice, setActionNotice] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');

  // Kasir & Pesanan state
  const [selectedBillId, setSelectedBillId] = useState<string>('bill_demo_m04');
  const [selectedUnitIdsForSplit, setSelectedUnitIdsForSplit] = useState<string[]>([]);
  const [showSplitMergePanel, setShowSplitMergePanel] = useState<boolean>(false);
  const [splitNewOwnerLabel, setSplitNewOwnerLabel] = useState<string>('Tagihan Pisah #2');
  const [mergeTargetBillId, setMergeTargetBillId] = useState<string>('');
  const [tenderMethod, setTenderMethod] = useState<string>('CASH');
  const [tenderAmountInput, setTenderAmountInput] = useState<string>('');
  const [cashGivenInput, setCashGivenInput] = useState<string>('150000');
  const [transferRefInput, setTransferRefInput] = useState<string>('');

  // Cancel unit modal state
  const [cancellingUnit, setCancellingUnit] = useState<any | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>(
    'Permintaan pelanggan / ubah pesanan'
  );
  const [restockChoice, setRestockChoice] = useState<'RESTOCK' | 'WASTE'>('RESTOCK');

  // Walk-in / Staff Order Modal state
  const [newOrderModalOpen, setNewOrderModalOpen] = useState<boolean>(false);
  const [posCustomerName, setPosCustomerName] = useState<string>('Tamu Walk-in');
  const [posTableId, setPosTableId] = useState<string>('tbl_m02');
  const [posMenuItemId, setPosMenuItemId] = useState<string>('item_kopi_susu');
  const [posQuantity, setPosQuantity] = useState<number>(1);

  // Dapur & Bar state
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Meja & Antrean sub-tab state
  const [floorSubTab, setFloorSubTab] = useState<'DENAH' | 'ANTREAN'>('DENAH');
  const [moveTargetTableId, setMoveTargetTableId] = useState<string>('tbl_m02');
  const [issuedJoinCodeText, setIssuedJoinCodeText] = useState<string>('');

  // Katalog & Stok state
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('ALL');
  const [stockAdjustMap, setStockAdjustMap] = useState<Record<string, number>>({});
  const [addMenuModalOpen, setAddMenuModalOpen] = useState<boolean>(false);
  const [newMenuCode, setNewMenuCode] = useState<string>('M-011');
  const [newMenuName, setNewMenuName] = useState<string>('');
  const [newMenuCategoryId, setNewMenuCategoryId] = useState<string>('cat_kopi');
  const [newMenuStation, setNewMenuStation] = useState<string>('BAR');
  const [newMenuPrice, setNewMenuPrice] = useState<string>('28000');
  const [newMenuDesc, setNewMenuDesc] = useState<string>('');
  const [newMenuPhotos, setNewMenuPhotos] = useState<string[]>([
    '/images/menu/es-kopi-susu-aren.svg',
  ]);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState<string>('');

  // Multi-photo editor modal
  const [editingPhotosItem, setEditingPhotosItem] = useState<any | null>(null);
  const [photoDraftList, setPhotoDraftList] = useState<string[]>([]);
  const [newPhotoUrlInput, setNewPhotoUrlInput] = useState<string>('');

  // QR Print & CSV Import Modals
  const [showQrPrintModal, setShowQrPrintModal] = useState<boolean>(false);
  const [showCsvModal, setShowCsvModal] = useState<boolean>(false);
  const [csvTextInput, setCsvTextInput] = useState<string>(
    `externalCode,name,categorySlug,stationCode,variantName,priceIdr\nM-010,Kopi Tubruk Gayo,kopi,BAR,Cangkir,22000\nM-011,Roti Bakar Srikaya,kudapan,PASTRY,Porsi,24000`
  );
  const [previewBatch, setPreviewBatch] = useState<any>(null);

  // Shift & Laporan state
  const [shiftMoveAmount, setShiftMoveAmount] = useState<string>('50000');
  const [shiftMoveReason, setShiftMoveReason] = useState<string>(
    'Pembelian es batu & galon darurat'
  );
  const [countedCashInput, setCountedCashInput] = useState<string>('685340');
  const [closeVarianceReason, setCloseVarianceReason] = useState<string>(
    'Sesuai hitungan fisik kasir'
  );

  // Pengaturan & Promo state
  const [customServicePct, setCustomServicePct] = useState<string>(
    String((snapshot?.outlet?.serviceChargeBps ?? 500) / 100)
  );
  const [customTaxPct, setCustomTaxPct] = useState<string>(
    String((snapshot?.outlet?.taxBps ?? 1000) / 100)
  );
  const [customTaxInclusive, setCustomTaxInclusive] = useState<boolean>(
    Boolean(snapshot?.outlet?.taxInclusiveDisplay ?? false)
  );
  const [newPromoModalOpen, setNewPromoModalOpen] = useState<boolean>(false);
  const [newPromoCode, setNewPromoCode] = useState<string>('KOPIPAGI');
  const [newPromoName, setNewPromoName] = useState<string>('Diskon Pagi Rp10.000');
  const [newPromoValue, setNewPromoValue] = useState<number>(10000);
  const [newPromoMinSpend, setNewPromoMinSpend] = useState<number>(40000);

  const staffList = snapshot?.staffRoles || snapshot?.staffAccounts || [];
  const currentStaffObj =
    staffList.find((s: any) => s.id === activeStaff) ||
    staffList[0] || {
      id: 'staff_owner',
      userName: 'Raka Pratama',
      role: 'OWNER',
      mfaEnabled: true,
    };

  const runStaffCommand = async (action: string, payload: Record<string, any>) => {
    setActionNotice('');
    setActionError('');
    try {
      const res = await onCommand(action, {
        ...payload,
        actorName: currentStaffObj.userName,
        actorRole: currentStaffObj.role,
        sessionAssurance: 'PASSWORD_2FA',
      });
      return res;
    } catch (err: any) {
      setActionError(err.message || 'Gagal menjalankan perintah.');
      throw err;
    }
  };

  const pendingOrderRequests = useMemo(
    () => (snapshot?.orderRequests || []).filter((r: any) => r.state === 'REQUESTED'),
    [snapshot]
  );

  const activeBills = useMemo(() => snapshot?.bills || [], [snapshot]);
  const selectedBill = useMemo(
    () =>
      activeBills.find((b: any) => b.id === selectedBillId) ||
      activeBills.find((b: any) => b.balanceIdr > 0) ||
      activeBills[0] ||
      null,
    [activeBills, selectedBillId]
  );

  const kitchenUnits = useMemo(() => {
    const all = (snapshot?.orderUnits || []).filter(
      (u: any) => u.fulfillmentStatus !== 'CANCELLED'
    );
    if (stationFilter === 'ALL') return all;
    return all.filter((u: any) => u.stationCode === stationFilter);
  }, [snapshot, stationFilter]);

  const activeShift = useMemo(() => (snapshot?.cashShifts || [])[0] || null, [snapshot]);

  const filteredCatalog = useMemo(() => {
    const list = snapshot?.catalog || [];
    return list.filter((item: any) => {
      if (menuCategoryFilter !== 'ALL' && item.categoryId !== menuCategoryFilter) {
        return false;
      }
      if (menuSearchQuery.trim()) {
        const q = menuSearchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.externalCode || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [snapshot, menuCategoryFilter, menuSearchQuery]);

  const handleExportReportCsv = () => {
    const headers = ['ID Tagihan', 'Meja / Pemilik', 'Status Bayar', 'Total', 'Diterima', 'Sisa'];
    const rows = (snapshot?.bills || []).map((b: any) => [
      b.id,
      `${b.tableLabel} - ${b.ownerLabel}`,
      b.paymentState,
      b.originalTotalIdr ?? b.totalIdr ?? 0,
      b.verifiedReceiptsIdr,
      b.balanceIdr,
    ]);
    const csvLines = [
      headers.join(','),
      ...rows.map((r: (string | number)[]) =>
        r.map((cell) => String(sanitizeSpreadsheetExportCell(cell))).join(',')
      ),
    ];
    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-harian-meranti.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setActionNotice('Laporan CSV berhasil diunduh.');
  };

  const handlePhotoFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'NEW_MENU' | 'EDIT_MODAL'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const resultUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!resultUrl) return;
        if (target === 'NEW_MENU') {
          setNewMenuPhotos((prev) => [...prev, resultUrl]);
        } else {
          setPhotoDraftList((prev) => [...prev, resultUrl]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleStaffLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const cred = STAFF_CREDENTIALS[loginStaffId];
    if (!cred || pinInput.trim() === cred.pin) {
      handleSwitchStaff(loginStaffId);
      setActiveSection(cred?.defaultSection || 'kasir');
      setIsAuthenticated(true);
      setPinInput('');
    } else {
      setLoginError('PIN Staf tidak sesuai. Gunakan PIN staf Anda.');
    }
  };

  // =========================================================================
  // STAFF & CASHIER SIGN-IN GATE
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col justify-center items-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className="w-full max-w-[420px] bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-6 space-y-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-[var(--primary)]" />
              <div>
                <h1 className="font-heading text-[18px] leading-[24px] font-bold">
                  Login Kasir &amp; Staf
                </h1>
                <p className="text-[12px] text-[var(--muted-foreground)]">
                  {snapshot?.outlet?.name || 'Kedai Meranti'}
                </p>
              </div>
            </div>
            {onBackToCustomer && (
              <Button variant="ghost" size="sm" onClick={onBackToCustomer}>
                <ArrowLeft className="w-4 h-4" />
                <span>Menu Tamu</span>
              </Button>
            )}
          </div>

          <form onSubmit={handleStaffLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-login-select">Pilih Akun Staf</Label>
              <SelectField
                id="staff-login-select"
                value={loginStaffId}
                onChange={(e) => {
                  setLoginStaffId(e.target.value);
                  setLoginError('');
                }}
              >
                {staffList.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.userName} — {STAFF_CREDENTIALS[s.id]?.roleLabel || s.role}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-pin-input">PIN Keamanan (4 Digit)</Label>
              <Input
                id="staff-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Masukkan PIN..."
                className="text-[16px] tracking-widest tabular-nums"
              />
            </div>

            {/* Quick Role Login Presets */}
            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <p className="text-[12px] text-[var(--muted-foreground)]">
                Akses cepat perangkat kasir/bar:
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {staffList.map((s: any) => {
                  const cred = STAFF_CREDENTIALS[s.id];
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setLoginStaffId(s.id);
                        setPinInput(cred?.pin || '1111');
                        handleSwitchStaff(s.id);
                        setActiveSection(cred?.defaultSection || 'kasir');
                        setIsAuthenticated(true);
                      }}
                      className="px-2.5 py-2 rounded-[8px] border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent-surface)] text-left text-[12px] transition-colors cursor-pointer"
                    >
                      <span className="font-semibold block text-[var(--foreground)] truncate">
                        {s.userName}
                      </span>
                      <span className="text-[var(--muted-foreground)]">
                        {cred?.roleLabel || s.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <InlineError message={loginError} />

            <Button type="submit" variant="primary" size="lg" className="w-full">
              Masuk ke Portal Operasional
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  const openWaitlistCount = (snapshot?.waitlistEntries || []).filter((w: any) =>
    ['WAITING', 'CALLED'].includes(w.status)
  ).length;
  const openHelpCount = (snapshot?.serviceRequests || []).filter(
    (s: any) => s.state !== 'RESOLVED'
  ).length;

  const navItems: { id: StaffSection; label: string; count?: number }[] = [
    {
      id: 'kasir',
      label: 'Kasir & Pesanan',
      count:
        pendingOrderRequests.length +
        activeBills.filter((b: any) => b.balanceIdr > 0).length,
    },
    {
      id: 'dapur',
      label: 'Dapur & Bar',
      count: kitchenUnits.filter((u: any) =>
        ['QUEUED', 'PREPARING', 'READY'].includes(u.fulfillmentStatus)
      ).length,
    },
    {
      id: 'meja',
      label: 'Meja & Antrean',
      count: openWaitlistCount + openHelpCount,
    },
    { id: 'menu', label: 'Katalog & Stok' },
    { id: 'laporan', label: 'Laporan & Shift' },
    { id: 'pengaturan', label: 'Pengaturan' },
  ];

  const effectiveTenderAmount =
    Number(tenderAmountInput) > 0
      ? Number(tenderAmountInput)
      : selectedBill?.balanceIdr || 0;
  const cashChangePreview =
    tenderMethod === 'CASH'
      ? Math.max(0, (Number(cashGivenInput) || 0) - effectiveTenderAmount)
      : 0;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* ===================================================================== */}
      {/* CLEAN FIELD-READY POS TOP BAR (NO TEST DROPDOWNS)                     */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-30 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-3 pb-0">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            <div className="flex items-center gap-3 min-w-0">
              {onBackToCustomer && (
                <button
                  type="button"
                  onClick={onBackToCustomer}
                  aria-label="Kembali ke layar menu pelanggan"
                  className="w-9 h-9 -ml-1.5 flex items-center justify-center text-[var(--foreground)] hover:text-[var(--primary)] transition-colors cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-[18px] font-bold truncate">
                    {snapshot?.outlet?.name || 'Kedai Meranti'}
                  </span>
                  <span className="text-[12px] font-medium px-2 py-0.5 rounded-[6px] bg-[var(--accent-surface)] text-[var(--primary)]">
                    POS &amp; Operasional
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <SelectField
                aria-label="Petugas aktif"
                value={activeStaff}
                onChange={(e) => handleSwitchStaff(e.target.value)}
                wrapperClassName="w-auto min-w-[200px]"
                className="min-h-[36px] py-1 text-[13px]"
              >
                {staffList.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.userName} ({STAFF_CREDENTIALS[s.id]?.roleLabel || s.role})
                  </option>
                ))}
              </SelectField>

              <button
                type="button"
                onClick={() => setIsAuthenticated(false)}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--status-danger-fg)] transition-colors cursor-pointer px-2 py-1"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>

          <AnimatedUnderlineTabs
            items={navItems}
            activeId={activeSection}
            onSelect={(id) => {
              setActiveSection(id);
              setActionNotice('');
              setActionError('');
            }}
            ariaLabel="Navigasi operasional kafe"
            layoutId="staff-pos-nav-underline"
            className="border-b-0"
          />
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MAIN WORKSPACE CONTAINER (CLEAN HAIRLINES, LESS CARDS)                */}
      {/* ===================================================================== */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <AnimatePresence>
          {(actionNotice || actionError) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center justify-between gap-3"
            >
              {actionNotice && <StatusLabel label={actionNotice} tone="success" />}
              {actionError && <InlineError message={actionError} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* =================================================================== */}
        {/* TAB 1: KASIR & PESANAN (UNIFIED POS WORKSPACE)                      */}
        {/* =================================================================== */}
        {activeSection === 'kasir' && (
          <motion.div
            key="pos-kasir"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Unboxed Architectural Metric Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-3 border-y border-[var(--border)]">
              <div className="space-y-0.5">
                <p className="text-[12px] font-medium text-[var(--muted-foreground)]">
                  Pesanan Baru Masuk
                </p>
                <p className="font-heading text-[22px] font-bold tabular-nums">
                  {pendingOrderRequests.length}
                </p>
              </div>
              <div className="space-y-0.5 lg:border-l lg:border-[var(--border)] lg:pl-4">
                <p className="text-[12px] font-medium text-[var(--muted-foreground)]">
                  Meja Sedang Terisi
                </p>
                <p className="font-heading text-[22px] font-bold tabular-nums">
                  {
                    (snapshot?.tables || []).filter(
                      (t: any) => t.physicalState === 'OCCUPIED'
                    ).length
                  }{' '}
                  / {(snapshot?.tables || []).length}
                </p>
              </div>
              <div className="space-y-0.5 lg:border-l lg:border-[var(--border)] lg:pl-4">
                <p className="text-[12px] font-medium text-[var(--muted-foreground)]">
                  Antrean Dapur &amp; Bar
                </p>
                <p className="font-heading text-[22px] font-bold tabular-nums">
                  {
                    kitchenUnits.filter((u: any) =>
                      ['QUEUED', 'PREPARING'].includes(u.fulfillmentStatus)
                    ).length
                  }{' '}
                  porsi
                </p>
              </div>
              <div className="space-y-0.5 lg:border-l lg:border-[var(--border)] lg:pl-4">
                <p className="text-[12px] font-medium text-[var(--muted-foreground)]">
                  Penerimaan Hari Ini
                </p>
                <Money
                  amount={(snapshot?.bills || []).reduce(
                    (s: number, b: any) => s + (b.verifiedReceiptsIdr || 0),
                    0
                  )}
                  className="font-heading text-[22px] font-bold text-[var(--primary)] block"
                />
              </div>
            </div>

            {/* Incoming Customer QR Order Requests (If any) */}
            {pendingOrderRequests.length > 0 && (
              <section className="space-y-3 pb-6 border-b border-[var(--border)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B45309] animate-pulse" />
                    <h2 className="font-heading text-[17px] font-bold">
                      Pesanan Baru dari QR Meja ({pendingOrderRequests.length})
                    </h2>
                  </div>
                  <span className="text-[12px] text-[var(--muted-foreground)]">
                    Konfirmasi pesanan agar langsung masuk ke layar Dapur &amp; Bar
                  </span>
                </div>

                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {pendingOrderRequests.map((req: any) => {
                    const matchedQuote = (snapshot?.quotes || []).find(
                      (q: any) => q.id === req.quoteId
                    );
                    const lines =
                      (matchedQuote?.itemsSnapshotJson as any[]) ||
                      (req.linesJson as any[]) ||
                      [];
                    const reqTotalIdr = matchedQuote?.totalIdr ?? req.totalIdr ?? 0;
                    return (
                      <div
                        key={req.id}
                        className="py-3.5 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-[240px] flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-[16px] font-bold">
                              Meja {req.tableLabel} · {req.customerName}
                            </span>
                            <StatusLabel label="Menunggu Konfirmasi" tone="warning" />
                          </div>
                          <div className="text-[13px] text-[var(--muted-foreground)] space-y-0.5">
                            {lines.map((ln: any, idx: number) => (
                              <p key={idx}>
                                <strong className="text-[var(--foreground)]">
                                  {ln.quantity ?? ln.qty ?? 1}×
                                </strong>{' '}
                                {ln.itemName} ({ln.variantName})
                                {ln.modifiers?.length ? ` · ${ln.modifiers.join(', ')}` : ''}
                                {ln.note ? ` — Catatan: "${ln.note}"` : ''}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right mr-2">
                            <span className="block text-[11px] text-[var(--muted-foreground)]">
                              Total Pesanan
                            </span>
                            <Money amount={reqTotalIdr} className="font-bold text-[16px]" />
                          </div>

                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busy}
                            onClick={async () => {
                              await runStaffCommand('ACCEPT_ORDER_REQUEST', {
                                orderRequestId: req.id,
                              });
                              setActionNotice(
                                `Pesanan Meja ${req.tableLabel} (${req.customerName}) diterima & diteruskan ke dapur/bar.`
                              );
                            }}
                          >
                            <Check className="w-4 h-4" />
                            <span>Terima Pesanan</span>
                          </Button>

                          <Button
                            variant="danger"
                            size="sm"
                            disabled={busy}
                            onClick={async () => {
                              await runStaffCommand('REJECT_ORDER_REQUEST', {
                                orderRequestId: req.id,
                                reason: 'Ditolak oleh staf kasir',
                              });
                              setActionNotice(`Pesanan Meja ${req.tableLabel} ditolak.`);
                            }}
                          >
                            <X className="w-4 h-4" />
                            <span>Tolak</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Main 2-Column Cashier Workspace (Separated by Hairline, No Heavy Card Boxes) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT 4 COLS: Active Bills List + Walk-In Order Button */}
              <div className="lg:col-span-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-heading text-[17px] font-bold">
                    Daftar Tagihan Meja
                  </h2>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setNewOrderModalOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Pesanan Baru</span>
                  </Button>
                </div>

                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {activeBills.map((b: any) => {
                    const isSel = b.id === selectedBill?.id;
                    const payBadge = formatPaymentStateLabel(b.paymentState);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setSelectedBillId(b.id);
                          setSelectedUnitIdsForSplit([]);
                          setTenderAmountInput('');
                        }}
                        className={`w-full py-3.5 px-3 text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                          isSel
                            ? 'bg-[var(--accent-surface)] border-l-4 border-l-[var(--primary)]'
                            : 'hover:bg-[var(--accent-surface)]/40'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-heading font-semibold text-[15px] text-[var(--foreground)] truncate">
                            Meja {b.tableLabel} · {b.ownerLabel}
                          </p>
                          <p className="text-[12px] text-[var(--muted-foreground)] tabular-nums">
                            {(b.allocatedUnits || []).length} porsi menu
                          </p>
                        </div>
                        <div className="text-right space-y-1 shrink-0">
                          <Money
                            amount={
                              b.balanceIdr > 0
                                ? b.balanceIdr
                                : b.originalTotalIdr ?? b.totalIdr ?? 0
                            }
                            className="block font-bold text-[15px] text-[var(--foreground)]"
                          />
                          <StatusLabel label={payBadge.label} tone={payBadge.tone} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT 8 COLS: Selected Bill Details & Cashier Checkout */}
              <div className="lg:col-span-8 lg:border-l lg:border-[var(--border)] lg:pl-8 space-y-6">
                {selectedBill ? (
                  <>
                    {/* Bill Header */}
                    <div className="pb-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="font-heading text-[20px] font-bold">
                            Meja {selectedBill.tableLabel} · {selectedBill.ownerLabel}
                          </h2>
                          <StatusLabel
                            label={formatPaymentStateLabel(selectedBill.paymentState).label}
                            tone={formatPaymentStateLabel(selectedBill.paymentState).tone}
                          />
                        </div>
                        <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5">
                          {(selectedBill.allocatedUnits || []).length} item tercatat pada tagihan ini
                        </p>
                      </div>

                      {selectedBill.lifecycle === 'OPEN' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowSplitMergePanel(!showSplitMergePanel)}
                        >
                          <Split className="w-4 h-4" />
                          <span>
                            {showSplitMergePanel
                              ? 'Tutup Pisah/Gabung'
                              : 'Pisah / Gabung Tagihan'}
                          </span>
                        </Button>
                      )}
                    </div>

                    {/* Collapsible Split / Merge Bill Bar */}
                    <AnimatePresence>
                      {showSplitMergePanel && selectedBill.lifecycle === 'OPEN' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 rounded-[10px] bg-[var(--surface)] border border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>
                                Pisah item terpilih ({selectedUnitIdsForSplit.length} item dicentang
                                di bawah)
                              </Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={splitNewOwnerLabel}
                                  onChange={(e) => setSplitNewOwnerLabel(e.target.value)}
                                  placeholder="Nama tagihan baru"
                                />
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={busy || selectedUnitIdsForSplit.length === 0}
                                  onClick={async () => {
                                    await runStaffCommand('SPLIT_BILL', {
                                      sourceBillId: selectedBill.id,
                                      unitIdsToMove: selectedUnitIdsForSplit,
                                      newOwnerLabel: splitNewOwnerLabel,
                                    });
                                    setSelectedUnitIdsForSplit([]);
                                    setActionNotice('Tagihan berhasil dipisahkan.');
                                  }}
                                >
                                  <Split className="w-4 h-4" />
                                  <span>Pisahkan</span>
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Gabung ke tagihan meja lain</Label>
                              <div className="flex items-center gap-2">
                                <SelectField
                                  value={mergeTargetBillId}
                                  onChange={(e) => setMergeTargetBillId(e.target.value)}
                                >
                                  <option value="">Pilih tagihan tujuan...</option>
                                  {activeBills
                                    .filter(
                                      (b: any) =>
                                        b.id !== selectedBill.id && b.lifecycle === 'OPEN'
                                    )
                                    .map((b: any) => (
                                      <option key={b.id} value={b.id}>
                                        Meja {b.tableLabel} · {b.ownerLabel} (
                                        {formatIdr(b.balanceIdr)})
                                      </option>
                                    ))}
                                </SelectField>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={busy || !mergeTargetBillId}
                                  onClick={async () => {
                                    await runStaffCommand('MERGE_BILLS', {
                                      sourceBillId: selectedBill.id,
                                      targetBillId: mergeTargetBillId,
                                    });
                                    setSelectedBillId(mergeTargetBillId);
                                    setMergeTargetBillId('');
                                    setActionNotice('Tagihan berhasil digabungkan.');
                                  }}
                                >
                                  <Merge className="w-4 h-4" />
                                  <span>Gabung</span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Bill Items Hairline List */}
                    <div className="space-y-2">
                      <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                        {(selectedBill.allocatedUnits || []).map((u: any) => {
                          const checked = selectedUnitIdsForSplit.includes(u.id);
                          const isCancelled = u.fulfillmentStatus === 'CANCELLED';
                          const st = formatFulfillmentLabel(u.fulfillmentStatus);
                          const itemName = u.itemNameSnapshot || u.itemName;
                          const variantName = u.variantNameSnapshot || u.variantName;
                          const unitPrice = u.netIdr ?? u.finalUnitTotalIdr ?? 0;

                          return (
                            <div
                              key={u.id}
                              className={`py-3 flex flex-wrap items-center justify-between gap-3 text-[14px] ${
                                isCancelled ? 'opacity-50' : ''
                              }`}
                            >
                              <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-[200px]">
                                {showSplitMergePanel && (
                                  <input
                                    type="checkbox"
                                    disabled={selectedBill.lifecycle !== 'OPEN' || isCancelled}
                                    checked={checked}
                                    onChange={() => {
                                      if (checked) {
                                        setSelectedUnitIdsForSplit(
                                          selectedUnitIdsForSplit.filter((id) => id !== u.id)
                                        );
                                      } else {
                                        setSelectedUnitIdsForSplit([
                                          ...selectedUnitIdsForSplit,
                                          u.id,
                                        ]);
                                      }
                                    }}
                                    className="w-4 h-4 accent-[var(--primary)]"
                                  />
                                )}
                                <div>
                                  <span className="font-semibold text-[var(--foreground)]">
                                    1× {itemName}
                                  </span>{' '}
                                  <span className="text-[var(--muted-foreground)]">
                                    ({variantName})
                                  </span>
                                </div>
                              </label>

                              <div className="flex items-center gap-3 shrink-0">
                                <StatusLabel label={st.label} tone={st.tone} />
                                <Money
                                  amount={unitPrice}
                                  className="font-semibold text-[14px] min-w-[85px] text-right"
                                />
                                {!isCancelled && (
                                  <button
                                    type="button"
                                    onClick={() => setCancellingUnit(u)}
                                    className="text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--status-danger-fg)] transition-colors cursor-pointer px-1.5 py-1"
                                  >
                                    Batalkan
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Financial Summary & Payment Checkout */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2 items-start">
                      <div className="md:col-span-5 p-4 rounded-[12px] bg-[var(--surface)] border border-[var(--border)]">
                        <PaymentBreakdown
                          subtotalIdr={selectedBill.subtotalIdr}
                          discountIdr={selectedBill.discountIdr}
                          serviceIdr={selectedBill.serviceIdr}
                          taxIdr={selectedBill.taxIdr}
                          totalIdr={selectedBill.originalTotalIdr ?? selectedBill.totalIdr}
                          creditAdjustmentsIdr={selectedBill.creditAdjustmentsIdr}
                          verifiedReceiptsIdr={selectedBill.verifiedReceiptsIdr}
                          refundedIdr={selectedBill.refundedIdr}
                          balanceIdr={selectedBill.balanceIdr}
                          serviceChargeBps={snapshot?.outlet?.serviceChargeBps ?? 500}
                          taxBps={snapshot?.outlet?.taxBps ?? 1000}
                          taxInclusiveDisplay={Boolean(snapshot?.outlet?.taxInclusiveDisplay)}
                        />
                      </div>

                      <div className="md:col-span-7 space-y-4">
                        {selectedBill.balanceIdr > 0 ? (
                          <>
                            <div className="space-y-1.5">
                              <Label>Metode Pembayaran Kasir</Label>
                              <AnimatedSegmentedControl
                                ariaLabel="Metode pembayaran kasir"
                                options={[
                                  { value: 'CASH', label: 'Tunai' },
                                  { value: 'QRIS', label: 'QRIS' },
                                  { value: 'VIRTUAL_ACCOUNT', label: 'Virtual Account' },
                                  { value: 'MANUAL_TRANSFER', label: 'Transfer' },
                                ]}
                                value={tenderMethod}
                                onChange={setTenderMethod}
                                layoutId="cashier-tender-method"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label htmlFor="cashier-tender-amount">
                                  Nominal Dibayar (Rp)
                                </Label>
                                <Input
                                  id="cashier-tender-amount"
                                  type="number"
                                  placeholder={String(selectedBill.balanceIdr)}
                                  value={tenderAmountInput}
                                  onChange={(e) => setTenderAmountInput(e.target.value)}
                                  className="tabular-nums font-semibold"
                                />
                              </div>

                              {tenderMethod === 'CASH' ? (
                                <div className="space-y-1.5">
                                  <Label htmlFor="cashier-cash-given">
                                    Uang Tunai Diterima (Rp)
                                  </Label>
                                  <Input
                                    id="cashier-cash-given"
                                    type="number"
                                    value={cashGivenInput}
                                    onChange={(e) => setCashGivenInput(e.target.value)}
                                    className="tabular-nums font-semibold"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <Label htmlFor="cashier-ref-code">
                                    Nomor Referensi (Opsional)
                                  </Label>
                                  <Input
                                    id="cashier-ref-code"
                                    value={transferRefInput}
                                    onChange={(e) => setTransferRefInput(e.target.value)}
                                    placeholder="Ref QRIS / Bukti Transfer"
                                  />
                                </div>
                              )}
                            </div>

                            {tenderMethod === 'CASH' && (
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {[
                                    {
                                      label: 'Uang Pas',
                                      val: effectiveTenderAmount,
                                    },
                                    { label: 'Rp50.000', val: 50000 },
                                    { label: 'Rp100.000', val: 100000 },
                                    { label: 'Rp200.000', val: 200000 },
                                  ].map((preset) => (
                                    <button
                                      key={preset.label}
                                      type="button"
                                      onClick={() => setCashGivenInput(String(preset.val))}
                                      className="px-2.5 py-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--accent-surface)] text-[12px] font-medium tabular-nums cursor-pointer transition-colors"
                                    >
                                      {preset.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="text-[13px]">
                                  <span className="text-[var(--muted-foreground)]">Kembalian: </span>
                                  <Money
                                    amount={cashChangePreview}
                                    className="font-bold text-[var(--primary)]"
                                  />
                                </div>
                              </div>
                            )}

                            <Button
                              variant="primary"
                              size="lg"
                              className="w-full"
                              disabled={busy}
                              onClick={async () => {
                                const amt = effectiveTenderAmount;
                                const res = await runStaffCommand('RECORD_PAYMENT', {
                                  billId: selectedBill.id,
                                  method: tenderMethod,
                                  amountIdr: amt,
                                  tenderedIdr:
                                    tenderMethod === 'CASH'
                                      ? Number(cashGivenInput) || amt
                                      : amt,
                                  referenceCode: transferRefInput || `POS-${Date.now()}`,
                                });
                                setActionNotice(
                                  `Pembayaran ${
                                    tenderMethod === 'CASH' ? 'Tunai' : tenderMethod
                                  } sebesar ${formatIdr(amt)} berhasil dicatat.${
                                    (res?.result?.changeIdr ?? 0) > 0
                                      ? ` Kembalian: ${formatIdr(res.result.changeIdr)}`
                                      : ''
                                  }`
                                );
                              }}
                            >
                              <Receipt className="w-4 h-4" />
                              <span>
                                Terima Pembayaran{' '}
                                {tenderMethod === 'CASH' ? 'Tunai' : tenderMethod} ·{' '}
                                {formatIdr(effectiveTenderAmount)}
                              </span>
                            </Button>
                          </>
                        ) : (
                          <div className="p-4 rounded-[10px] bg-[var(--status-success-bg)] text-[var(--status-success-fg)] flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-[15px]">Tagihan Sudah Lunas</p>
                              <p className="text-[13px]">
                                Seluruh kewajiban pembayaran untuk meja ini telah selesai.
                              </p>
                            </div>
                            <Check className="w-5 h-5 shrink-0" />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState title="Pilih tagihan meja di sebelah kiri" />
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: DAPUR & BAR (CLEAN KDS WORKSPACE)                            */}
        {/* =================================================================== */}
        {activeSection === 'dapur' && (
          <motion.div
            key="pos-dapur"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="pb-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-[22px] font-bold">Antrean Dapur &amp; Bar</h1>
                <AnimatedSegmentedControl
                  ariaLabel="Filter stasiun kerja"
                  options={[
                    { value: 'ALL', label: 'Semua Stasiun' },
                    { value: 'BAR', label: 'Bar & Kopi' },
                    { value: 'KITCHEN', label: 'Dapur Utama' },
                    { value: 'PASTRY', label: 'Pastry & Roti' },
                  ]}
                  value={stationFilter}
                  onChange={setStationFilter}
                  layoutId="kds-station-filter"
                />
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-[var(--status-success-fg)]" />
                ) : (
                  <VolumeX className="w-4 h-4 text-[var(--muted-foreground)]" />
                )}
                <span>{soundEnabled ? 'Suara Notifikasi Aktif' : 'Suara Mati'}</span>
              </Button>
            </div>

            {kitchenUnits.length === 0 ? (
              <EmptyState title="Tidak ada pesanan aktif pada stasiun ini" />
            ) : (
              <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {kitchenUnits.map((u: any) => {
                  const st = formatFulfillmentLabel(u.fulfillmentStatus);
                  const itemName = u.itemNameSnapshot || u.itemName;
                  const variantName = u.variantNameSnapshot || u.variantName;
                  const tableLabel = u.tableLabelSnapshot || u.tableLabel || '-';
                  const customerName = u.customerNameSnapshot || u.customerName || 'Tamu';

                  return (
                    <div
                      key={u.id}
                      className="py-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-[240px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-heading text-[17px] font-bold text-[var(--foreground)]">
                            Meja {tableLabel}
                          </span>
                          <span className="text-[13px] text-[var(--muted-foreground)]">
                            · {customerName}
                          </span>
                          <span className="text-[12px] font-medium px-2 py-0.5 rounded-[6px] bg-[var(--accent-surface)] text-[var(--primary)]">
                            {formatStationName(u.stationCode)}
                          </span>
                          <StatusLabel label={st.label} tone={st.tone} />
                        </div>

                        <p className="font-heading text-[16px] font-semibold text-[var(--foreground)]">
                          1× {itemName}{' '}
                          <span className="font-normal text-[var(--muted-foreground)]">
                            ({variantName})
                          </span>
                        </p>

                        {u.modifiersSummary && (
                          <p className="text-[13px] text-[var(--muted-foreground)]">
                            Opsi: {u.modifiersSummary}
                          </p>
                        )}
                        {u.note && (
                          <p className="text-[13px] font-medium text-[var(--status-warning-fg)]">
                            Catatan Dapur: &ldquo;{u.note}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {u.fulfillmentStatus === 'QUEUED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              runStaffCommand('TRANSITION_UNITS', {
                                unitIds: [u.id],
                                targetStatus: 'PREPARING',
                              })
                            }
                          >
                            Mulai Buat
                          </Button>
                        )}
                        {u.fulfillmentStatus === 'PREPARING' && (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              runStaffCommand('TRANSITION_UNITS', {
                                unitIds: [u.id],
                                targetStatus: 'READY',
                              })
                            }
                          >
                            Tandai Siap Antar
                          </Button>
                        )}
                        {u.fulfillmentStatus === 'READY' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              runStaffCommand('TRANSITION_UNITS', {
                                unitIds: [u.id],
                                targetStatus: String(tableLabel).startsWith('TW-')
                                  ? 'PICKED_UP'
                                  : 'DELIVERED',
                              })
                            }
                          >
                            <Check className="w-4 h-4" />
                            <span>Sudah Disajikan</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: MEJA, KUNJUNGAN & ANTREAN TAMU                               */}
        {/* =================================================================== */}
        {activeSection === 'meja' && (
          <motion.div
            key="pos-meja"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="pb-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-heading text-[22px] font-bold">
                Operasional Meja &amp; Antrean Tamu
              </h1>
              <AnimatedSegmentedControl
                ariaLabel="Sub-menu operasional lantai"
                options={[
                  { value: 'DENAH', label: 'Denah & Kunjungan Meja' },
                  {
                    value: 'ANTREAN',
                    label: `Panggilan & Antrean (${openWaitlistCount + openHelpCount})`,
                  },
                ]}
                value={floorSubTab}
                onChange={setFloorSubTab}
                layoutId="floor-sub-tab"
              />
            </div>

            {floorSubTab === 'DENAH' ? (
              <div className="space-y-8">
                <FloorPlanEditor
                  rooms={snapshot?.rooms || []}
                  tables={snapshot?.tables || []}
                  waitlistEntries={snapshot?.waitlistEntries || []}
                  busy={busy}
                  actorName={currentStaffObj.userName}
                  onSaveOrPublish={async (payload) => {
                    await runStaffCommand('FLOOR_PLAN_ACTION', payload);
                  }}
                  onTableAction={async (payload) => {
                    await runStaffCommand('TABLE_OR_VISIT_ACTION', payload);
                  }}
                />

                {/* Active Table Visits (Hairline List) */}
                <section className="pt-6 border-t border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-heading text-[17px] font-bold">
                      Tamu yang Sedang Makan di Meja
                    </h2>
                    {issuedJoinCodeText && (
                      <StatusLabel label={issuedJoinCodeText} tone="active" />
                    )}
                  </div>

                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {(snapshot?.visits || [])
                      .filter((v: any) => v.status === 'OPEN')
                      .map((v: any) => (
                        <div
                          key={v.id}
                          className="py-3.5 flex flex-wrap items-center justify-between gap-4"
                        >
                          <div>
                            <p className="font-heading font-semibold text-[15px]">
                              {v.mode === 'DINE_IN'
                                ? `Meja ${((v.tableLabelsJson as string[]) || []).join(', ')}`
                                : `Bawa Pulang ${v.pickupNumber}`}{' '}
                              · {v.customerName}
                            </p>
                            <p className="text-[13px] text-[var(--muted-foreground)]">
                              {v.partySize} orang · Sedang berlangsung
                            </p>
                          </div>

                          {v.mode === 'DINE_IN' && (
                            <div className="flex flex-wrap items-center gap-2">
                              <SelectField
                                value={moveTargetTableId}
                                onChange={(e) => setMoveTargetTableId(e.target.value)}
                                aria-label="Pilih meja tujuan pindah"
                                wrapperClassName="w-auto min-w-[165px]"
                                className="min-h-[36px] py-1 text-[13px]"
                              >
                                {(snapshot?.tables || [])
                                  .filter((t: any) => t.physicalState === 'AVAILABLE')
                                  .map((t: any) => (
                                    <option key={t.id} value={t.id}>
                                      Ke Meja {t.label}
                                    </option>
                                  ))}
                              </SelectField>

                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={async () => {
                                  const res = await runStaffCommand('TABLE_OR_VISIT_ACTION', {
                                    action: 'MOVE_TABLE',
                                    visitId: v.id,
                                    fromTableId: v.primaryTableId,
                                    toTableId: moveTargetTableId,
                                  });
                                  setActionNotice(
                                    `Tamu ${v.customerName} dipindahkan ke Meja ${res?.result?.newTableLabel}.`
                                  );
                                }}
                              >
                                Pindah Meja
                              </Button>

                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={async () => {
                                  const res = await runStaffCommand('TABLE_OR_VISIT_ACTION', {
                                    action: 'ISSUE_JOIN_CODE',
                                    visitId: v.id,
                                  });
                                  setIssuedJoinCodeText(
                                    `Kode Meja (${v.customerName}): ${res?.result?.code}`
                                  );
                                }}
                              >
                                Kode Gabung Meja
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={async () => {
                                  await runStaffCommand('TABLE_OR_VISIT_ACTION', {
                                    action: 'DEPART_VISIT',
                                    visitId: v.id,
                                  });
                                  setActionNotice(
                                    `Kunjungan ${v.customerName} selesai. Meja siap dibersihkan.`
                                  );
                                }}
                              >
                                Selesai / Pulang
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </section>
              </div>
            ) : (
              /* Panggilan Bantuan Meja & Antrean Tamu (Waitlist) */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left 6 cols: Panggilan Bantuan dari Meja */}
                <section className="lg:col-span-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[var(--primary)]" />
                    <h2 className="font-heading text-[17px] font-bold">
                      Panggilan Bantuan dari Meja
                    </h2>
                  </div>

                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {(snapshot?.serviceRequests || []).map((sr: any) => (
                      <div
                        key={sr.id}
                        className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[15px]">
                              Meja {sr.tableLabel} · {sr.customerName}
                            </span>
                            <StatusLabel
                              label={
                                sr.state === 'RESOLVED'
                                  ? 'Selesai'
                                  : sr.state === 'ACKNOWLEDGED'
                                  ? 'Sedang Ditangani'
                                  : 'Menunggu Staf'
                              }
                              tone={
                                sr.state === 'RESOLVED'
                                  ? 'success'
                                  : sr.state === 'ACKNOWLEDGED'
                                  ? 'info'
                                  : 'warning'
                              }
                            />
                          </div>
                          {sr.notes && (
                            <p className="text-[13px] text-[var(--muted-foreground)]">
                              Permintaan: {sr.notes}
                            </p>
                          )}
                        </div>

                        {sr.state !== 'RESOLVED' && (
                          <div className="flex items-center gap-2">
                            {sr.state === 'OPEN' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  runStaffCommand('SERVICE_REQUEST_ACTION', {
                                    action: 'ACKNOWLEDGE',
                                    requestId: sr.id,
                                  })
                                }
                              >
                                Tangani
                              </Button>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                runStaffCommand('SERVICE_REQUEST_ACTION', {
                                  action: 'RESOLVE',
                                  requestId: sr.id,
                                  resolutionNote: 'Selesai dibantu oleh staf',
                                })
                              }
                            >
                              Selesai
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Right 6 cols: Antrean Tamu (Waitlist) */}
                <section className="lg:col-span-6 lg:border-l lg:border-[var(--border)] lg:pl-8 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--primary)]" />
                    <h2 className="font-heading text-[17px] font-bold">
                      Daftar Antrean Meja (Waitlist)
                    </h2>
                  </div>

                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {(snapshot?.waitlistEntries || []).map((w: any) => (
                      <div
                        key={w.id}
                        className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-[16px] tabular-nums text-[var(--primary)]">
                              {w.publicSequence}
                            </span>
                            <span className="font-semibold text-[15px]">{w.customerName}</span>
                            <StatusLabel
                              label={
                                w.status === 'SEATED'
                                  ? 'Sudah Duduk'
                                  : w.status === 'CALLED'
                                  ? 'Dipanggil'
                                  : 'Menunggu'
                              }
                              tone={
                                w.status === 'SEATED'
                                  ? 'success'
                                  : w.status === 'CALLED'
                                  ? 'info'
                                  : 'warning'
                              }
                            />
                          </div>
                          <p className="text-[13px] text-[var(--muted-foreground)]">
                            {w.partySize} orang · Area {w.preferredArea}
                            {w.heldTableLabel ? ` · Ditahan di Meja ${w.heldTableLabel}` : ''}
                          </p>
                        </div>

                        {['WAITING', 'CALLED'].includes(w.status) && (
                          <div className="flex items-center gap-2">
                            {w.status === 'WAITING' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  runStaffCommand('WAITLIST_ACTION', {
                                    action: 'CALL',
                                    waitlistId: w.id,
                                    tableId: 'tbl_m02',
                                  })
                                }
                              >
                                Panggil Tamu
                              </Button>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                runStaffCommand('WAITLIST_ACTION', {
                                  action: 'SEAT',
                                  waitlistId: w.id,
                                  tableId: w.heldTableId || 'tbl_m02',
                                })
                              }
                            >
                              Dudukkan ke Meja
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </motion.div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: KATALOG MENU, MULTI-FOTO & STOK PORSI                        */}
        {/* =================================================================== */}
        {activeSection === 'menu' && (
          <motion.div
            key="pos-menu"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Clean Toolbar */}
            <div className="pb-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-heading text-[22px] font-bold">
                  Katalog Menu &amp; Stok Porsi
                </h1>
                <p className="text-[13px] text-[var(--muted-foreground)]">
                  Kelola ketersediaan menu, stok porsi harian, dan galeri multi-foto produk
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowQrPrintModal(true)}
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak QR Meja</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCsvModal(true)}
                >
                  <Upload className="w-4 h-4" />
                  <span>Impor CSV</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setAddMenuModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Menu / Kategori</span>
                </Button>
              </div>
            </div>

            {/* Search & Category Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7 relative">
                <Search className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  placeholder="Cari nama menu atau kode..."
                  className="pl-10"
                />
              </div>
              <div className="sm:col-span-5">
                <SelectField
                  aria-label="Filter kategori katalog"
                  value={menuCategoryFilter}
                  onChange={(e) => setMenuCategoryFilter(e.target.value)}
                >
                  <option value="ALL">
                    Semua Kategori ({(snapshot?.categories || []).length})
                  </option>
                  {(snapshot?.categories || []).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>

            {/* Main Unboxed Hairline Menu & Stock List */}
            <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {filteredCatalog.map((item: any) => {
                const itemPhotos: string[] = Array.isArray(item.photos)
                  ? item.photos
                  : item.photoUrl
                  ? [item.photoUrl]
                  : [];

                return (
                  <div
                    key={item.id}
                    className="py-4 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPhotosItem(item);
                          setPhotoDraftList(itemPhotos);
                          setNewPhotoUrlInput('');
                        }}
                        className="relative w-14 h-14 rounded-[10px] overflow-hidden border border-[var(--border)] bg-[#F2EFE9] shrink-0 cursor-pointer group"
                      >
                        {itemPhotos[0] ? (
                          <Image
                            src={itemPhotos[0]}
                            alt={item.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded-[4px] bg-black/70 text-white text-[10px] font-semibold tabular-nums">
                          {itemPhotos.length} foto
                        </span>
                      </button>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="font-heading font-semibold text-[16px] truncate">
                            {item.name}
                          </p>
                          <StatusLabel
                            label={item.manualSoldOut ? 'Habis' : 'Tersedia'}
                            tone={item.manualSoldOut ? 'danger' : 'success'}
                          />
                        </div>
                        <p className="text-[13px] text-[var(--muted-foreground)] tabular-nums">
                          {formatStationName(item.stationCode)} · Mulai{' '}
                          <strong className="text-[var(--foreground)]">
                            {formatIdr(item.minPriceIdr)}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingPhotosItem(item);
                          setPhotoDraftList(itemPhotos);
                          setNewPhotoUrlInput('');
                        }}
                      >
                        <Images className="w-4 h-4" />
                        <span>Foto ({itemPhotos.length})</span>
                      </Button>

                      <Button
                        variant={item.manualSoldOut ? 'primary' : 'secondary'}
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          runStaffCommand('MENU_STOCK_ACTION', {
                            action: 'TOGGLE_SOLD_OUT',
                            menuItemId: item.id,
                            manualSoldOut: !item.manualSoldOut,
                          })
                        }
                      >
                        {item.manualSoldOut ? 'Aktifkan Kembali' : 'Tandai Habis'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Finite Stock Pools Section (Clean Hairline List) */}
            <section className="pt-4 space-y-3">
              <h2 className="font-heading text-[17px] font-bold">
                Stok Porsi Harian Terbatas
              </h2>
              <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {(snapshot?.stockPools || [])
                  .filter((p: any) => p.mode === 'FINITE')
                  .map((p: any) => (
                    <div
                      key={p.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3 text-[14px]"
                    >
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-[13px] text-[var(--muted-foreground)] tabular-nums">
                          Tersedia dijual: <strong>{p.availableToSell} porsi</strong> (Fisik:{' '}
                          {p.onHand} · Dipesan: {p.reserved})
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={p.reserved}
                          value={stockAdjustMap[p.id] ?? p.onHand}
                          onChange={(e) =>
                            setStockAdjustMap({
                              ...stockAdjustMap,
                              [p.id]: Number(e.target.value),
                            })
                          }
                          aria-label={`Ubah jumlah stok ${p.name}`}
                          className="w-24 min-h-[36px] py-1 tabular-nums text-center"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={async () => {
                            await runStaffCommand('MENU_STOCK_ACTION', {
                              action: 'ADJUST_STOCK',
                              poolId: p.id,
                              newOnHand: stockAdjustMap[p.id] ?? p.onHand,
                              reason: 'Penyesuaian stok harian',
                            });
                            setActionNotice(`Stok ${p.name} berhasil diperbarui.`);
                          }}
                        >
                          Update Stok
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </motion.div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: LAPORAN HARIAN & SHIFT KASIR                                 */}
        {/* =================================================================== */}
        {activeSection === 'laporan' && (
          <motion.div
            key="pos-laporan"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="pb-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-heading text-[22px] font-bold">
                  Laporan Penjualan &amp; Shift Kasir
                </h1>
                <p className="text-[13px] text-[var(--muted-foreground)]">
                  Rekapitulasi transaksi harian dan rekonsiliasi uang tunai laci kasir
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleExportReportCsv}>
                <Download className="w-4 h-4" />
                <span>Unduh Laporan CSV</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 6 cols: Daily Financial Summary Table */}
              <section className="lg:col-span-6 space-y-4">
                <h2 className="font-heading text-[17px] font-bold">
                  Ringkasan Keuangan Hari Ini
                </h2>
                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-[14px] tabular-nums">
                  <div className="py-3 flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Penjualan Kotor</span>
                    <Money
                      amount={(snapshot?.bills || []).reduce(
                        (s: number, b: any) => s + (b.subtotalIdr || 0),
                        0
                      )}
                      className="font-medium"
                    />
                  </div>
                  <div className="py-3 flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Total Potongan Promo</span>
                    <Money
                      amount={-(snapshot?.bills || []).reduce(
                        (s: number, b: any) => s + (b.discountIdr || 0),
                        0
                      )}
                      className="text-[var(--status-success-fg)]"
                    />
                  </div>
                  <div className="py-3 flex justify-between">
                    <span className="text-[var(--muted-foreground)]">
                      Biaya Layanan &amp; Pajak Restoran
                    </span>
                    <Money
                      amount={(snapshot?.bills || []).reduce(
                        (s: number, b: any) => s + (b.serviceIdr || 0) + (b.taxIdr || 0),
                        0
                      )}
                    />
                  </div>
                  <div className="py-3 flex justify-between">
                    <span className="text-[var(--muted-foreground)]">
                      Koreksi / Pembatalan Item
                    </span>
                    <Money
                      amount={-(snapshot?.bills || []).reduce(
                        (s: number, b: any) => s + (b.creditAdjustmentsIdr || 0),
                        0
                      )}
                      className="text-[var(--status-danger-fg)]"
                    />
                  </div>
                  <div className="py-3.5 flex justify-between font-bold text-[16px]">
                    <span>Total Penerimaan Bersih</span>
                    <Money
                      amount={(snapshot?.bills || []).reduce(
                        (s: number, b: any) => s + (b.verifiedReceiptsIdr || 0),
                        0
                      )}
                      className="text-[var(--primary)]"
                    />
                  </div>
                </div>
              </section>

              {/* Right 6 cols: Cash Drawer & Shift */}
              <section className="lg:col-span-6 lg:border-l lg:border-[var(--border)] lg:pl-8 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-[17px] font-bold">
                    Laci Kasir ({activeShift?.drawerName || 'Kasir Utama'})
                  </h2>
                  <StatusLabel
                    label={activeShift?.state === 'OPEN' ? 'Shift Aktif' : 'Shift Ditutup'}
                    tone={activeShift?.state === 'OPEN' ? 'success' : 'neutral'}
                  />
                </div>

                {activeShift && (
                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-[14px] tabular-nums">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-[var(--muted-foreground)]">Modal Awal Laci</span>
                      <Money amount={activeShift.openingFloatIdr} />
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-[var(--muted-foreground)]">Penjualan Tunai</span>
                      <Money amount={activeShift.cashReceiptsIdr} signed />
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-[var(--muted-foreground)]">Kas Masuk / Keluar</span>
                      <Money amount={activeShift.cashInIdr - activeShift.cashOutIdr} signed />
                    </div>
                    <div className="py-3 flex justify-between font-bold text-[15px]">
                      <span>Uang Tunai Seharusnya di Laci</span>
                      <Money amount={activeShift.expectedCashIdr} />
                    </div>
                  </div>
                )}

                {activeShift?.state === 'OPEN' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="shift-move-amt">Nominal Kas Masuk/Keluar (Rp)</Label>
                        <Input
                          id="shift-move-amt"
                          type="number"
                          value={shiftMoveAmount}
                          onChange={(e) => setShiftMoveAmount(e.target.value)}
                          className="tabular-nums"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="shift-move-reason">Keterangan</Label>
                        <Input
                          id="shift-move-reason"
                          value={shiftMoveReason}
                          onChange={(e) => setShiftMoveReason(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          runStaffCommand('CASH_SHIFT_ACTION', {
                            action: 'CASH_IN',
                            shiftId: activeShift.id,
                            amountIdr: Number(shiftMoveAmount),
                            reason: shiftMoveReason,
                          })
                        }
                      >
                        + Catat Kas Masuk
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          runStaffCommand('CASH_SHIFT_ACTION', {
                            action: 'CASH_OUT',
                            shiftId: activeShift.id,
                            amountIdr: Number(shiftMoveAmount),
                            reason: shiftMoveReason,
                          })
                        }
                      >
                        - Catat Kas Keluar
                      </Button>
                    </div>

                    <div className="pt-4 border-t border-[var(--border)] space-y-3">
                      <p className="font-semibold text-[14px]">Rekonsiliasi &amp; Tutup Shift</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="shift-counted-input">Uang Fisik Dihitung (Rp)</Label>
                          <Input
                            id="shift-counted-input"
                            type="number"
                            value={countedCashInput}
                            onChange={(e) => setCountedCashInput(e.target.value)}
                            className="tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="shift-var-reason">Catatan Penutupan</Label>
                          <Input
                            id="shift-var-reason"
                            value={closeVarianceReason}
                            onChange={(e) => setCloseVarianceReason(e.target.value)}
                          />
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busy}
                        onClick={async () => {
                          await runStaffCommand('CASH_SHIFT_ACTION', {
                            action: 'CLOSE_SHIFT',
                            shiftId: activeShift.id,
                            countedCashIdr: Number(countedCashInput),
                            reason: closeVarianceReason,
                          });
                          setActionNotice('Shift kasir berhasil ditutup.');
                        }}
                      >
                        Tutup Shift Kasir
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      runStaffCommand('CASH_SHIFT_ACTION', {
                        action: 'OPEN_SHIFT',
                        amountIdr: 500000,
                      })
                    }
                  >
                    Buka Shift Kasir Baru (Modal Rp500.000)
                  </Button>
                )}
              </section>
            </div>
          </motion.div>
        )}

        {/* =================================================================== */}
        {/* TAB 6: PENGATURAN PAJAK, PROMO & OUTLET                             */}
        {/* =================================================================== */}
        {activeSection === 'pengaturan' && (
          <motion.div
            key="pos-pengaturan"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="pb-4 border-b border-[var(--border)]">
              <h1 className="font-heading text-[22px] font-bold">
                Pengaturan Pajak, Promo &amp; Outlet
              </h1>
              <p className="text-[13px] text-[var(--muted-foreground)]">
                Konfigurasi skema pajak restoran (PB1/PPN), biaya layanan, dan voucher promo
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 6 cols: Tax & Service Charge Config */}
              <section className="lg:col-span-6 space-y-4">
                <div>
                  <h2 className="font-heading text-[17px] font-bold">
                    Skema Pajak &amp; Biaya Layanan
                  </h2>
                  <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5">
                    Aktif saat ini:{' '}
                    <strong className="text-[var(--foreground)]">
                      {formatOutletChargePolicy(snapshot?.outlet)}
                    </strong>
                  </p>
                </div>

                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {[
                    {
                      label: 'Harga Nett / Tanpa Biaya Tambahan (0%)',
                      srv: 0,
                      tax: 0,
                      inc: true,
                    },
                    {
                      label: 'Hanya Pajak Restoran PB1 10%',
                      srv: 0,
                      tax: 10,
                      inc: false,
                    },
                    {
                      label: 'Hanya PPN 11%',
                      srv: 0,
                      tax: 11,
                      inc: false,
                    },
                    {
                      label: 'Biaya Layanan 5% + Pajak PB1 10%',
                      srv: 5,
                      tax: 10,
                      inc: false,
                    },
                    {
                      label: 'Biaya Layanan 5% + Pajak PPN 11%',
                      srv: 5,
                      tax: 11,
                      inc: false,
                    },
                  ].map((preset) => {
                    const isCurrent =
                      Number(customServicePct) === preset.srv &&
                      Number(customTaxPct) === preset.tax &&
                      customTaxInclusive === preset.inc;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setCustomServicePct(String(preset.srv));
                          setCustomTaxPct(String(preset.tax));
                          setCustomTaxInclusive(preset.inc);
                          await runStaffCommand('SETTINGS_PROMO_FEEDBACK_ACTION', {
                            action: 'UPDATE_OUTLET_SETTINGS',
                            outletPatch: {
                              serviceChargeBps: preset.srv * 100,
                              taxBps: preset.tax * 100,
                              taxInclusiveDisplay: preset.inc,
                            },
                          });
                          setActionNotice(`Skema biaya diperbarui: ${preset.label}`);
                        }}
                        className={`w-full py-3 px-2 flex items-center justify-between text-left text-[14px] transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[var(--accent-surface)] font-semibold text-[var(--primary)]'
                            : 'hover:bg-[var(--accent-surface)]/40'
                        }`}
                      >
                        <span>{preset.label}</span>
                        {isCurrent && <Check className="w-4 h-4 text-[var(--primary)]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Percentage Inputs */}
                <div className="pt-2 space-y-3">
                  <p className="text-[13px] font-semibold text-[var(--muted-foreground)]">
                    Atau atur persentase kustom:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="custom-srv-pct">Biaya Layanan (%)</Label>
                      <Input
                        id="custom-srv-pct"
                        type="number"
                        min={0}
                        max={25}
                        step={0.5}
                        value={customServicePct}
                        onChange={(e) => setCustomServicePct(e.target.value)}
                        className="tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="custom-tax-pct">Pajak PB1 / PPN (%)</Label>
                      <Input
                        id="custom-tax-pct"
                        type="number"
                        min={0}
                        max={25}
                        step={0.5}
                        value={customTaxPct}
                        onChange={(e) => setCustomTaxPct(e.target.value)}
                        className="tabular-nums"
                      />
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      const srvBps = Math.round((Number(customServicePct) || 0) * 100);
                      const txBps = Math.round((Number(customTaxPct) || 0) * 100);
                      await runStaffCommand('SETTINGS_PROMO_FEEDBACK_ACTION', {
                        action: 'UPDATE_OUTLET_SETTINGS',
                        outletPatch: {
                          serviceChargeBps: srvBps,
                          taxBps: txBps,
                          taxInclusiveDisplay: customTaxInclusive,
                        },
                      });
                      setActionNotice('Konfigurasi pajak & layanan berhasil disimpan.');
                    }}
                  >
                    Simpan Tarif Pajak &amp; Layanan
                  </Button>
                </div>
              </section>

              {/* Right 6 cols: Promo Rules & Customer Reviews */}
              <section className="lg:col-span-6 lg:border-l lg:border-[var(--border)] lg:pl-8 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-heading text-[17px] font-bold">
                      Voucher &amp; Promo Aktif
                    </h2>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setNewPromoModalOpen(true)}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Promo</span>
                    </Button>
                  </div>

                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {(snapshot?.promotionRules || []).map((pr: any) => (
                      <div
                        key={pr.id}
                        className="py-3 flex items-center justify-between gap-3 text-[14px]"
                      >
                        <div>
                          <p className="font-semibold">
                            {pr.code} — {pr.name}
                          </p>
                          <p className="text-[12px] text-[var(--muted-foreground)] tabular-nums">
                            Terpakai {pr.quotaUsed} dari {pr.quotaTotal} kuota
                          </p>
                        </div>
                        <StatusLabel label="Aktif" tone="success" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Feedback */}
                <div className="pt-4 border-t border-[var(--border)] space-y-3">
                  <h2 className="font-heading text-[17px] font-bold">
                    Ulasan Pelanggan Terbaru
                  </h2>
                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {(snapshot?.feedbackEntries || []).map((fb: any) => (
                      <div key={fb.id} className="py-3 space-y-1 text-[14px]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{fb.customerName}</span>
                          <StatusLabel label={`Rating ${fb.overallRating}/5`} tone="success" />
                        </div>
                        <p className="text-[var(--muted-foreground)]">{fb.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* MODAL 1: BUAT PESANAN BARU OLEH KASIR / PELAYAN                       */}
      {/* ===================================================================== */}
      <DialogModal
        open={newOrderModalOpen}
        onClose={() => setNewOrderModalOpen(false)}
        title="Input Pesanan Baru (Walk-in / Meja)"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pos-cust-name">Nama Tamu</Label>
            <Input
              id="pos-cust-name"
              value={posCustomerName}
              onChange={(e) => setPosCustomerName(e.target.value)}
              placeholder="Nama pelanggan..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pos-table-select">Pilih Meja</Label>
            <SelectField
              id="pos-table-select"
              value={posTableId}
              onChange={(e) => setPosTableId(e.target.value)}
            >
              {(snapshot?.tables || []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  Meja {t.label} ({t.areaName})
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="pos-menu-select">Pilih Menu</Label>
              <SelectField
                id="pos-menu-select"
                value={posMenuItemId}
                onChange={(e) => setPosMenuItemId(e.target.value)}
              >
                {(snapshot?.catalog || []).map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({formatIdr(m.minPriceIdr)})
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-qty-input">Jumlah</Label>
              <Input
                id="pos-qty-input"
                type="number"
                min={1}
                max={20}
                value={posQuantity}
                onChange={(e) => setPosQuantity(Number(e.target.value))}
                className="tabular-nums"
              />
            </div>
          </div>

          <Button
            variant="primary"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              const item = (snapshot?.catalog || []).find((m: any) => m.id === posMenuItemId);
              const variant = item?.variants?.[0];
              if (!item || !variant) return;

              const qRes = await onCommand('CREATE_CHECKOUT_QUOTE', {
                visitId: 'visit_m01_open',
                mode: 'DINE_IN',
                tableId: posTableId,
                customerName: posCustomerName,
                lines: [
                  {
                    menuItemId: item.id,
                    variantId: variant.id,
                    quantity: posQuantity,
                    modifierOptionIds: [],
                    note: 'Input kasir',
                  },
                ],
              });
              const quoteObj = qRes?.result || qRes;
              const subRes = await onCommand('SUBMIT_ORDER_REQUEST', {
                quoteId: quoteObj.quoteId,
                customerName: posCustomerName,
                tableId: posTableId,
                mode: 'DINE_IN',
                gpsVerified: true,
                gpsDistanceMeters: 5,
                idempotencyKey: `staff_pos_${Date.now()}`,
              });
              const reqId = (subRes?.result || subRes)?.orderRequestId;
              if (reqId) {
                await runStaffCommand('ACCEPT_ORDER_REQUEST', {
                  orderRequestId: reqId,
                });
              }
              setNewOrderModalOpen(false);
              setActionNotice(
                `Pesanan ${posCustomerName} berhasil dibuat dan dikirim ke dapur/bar.`
              );
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Buat &amp; Kirim ke Dapur</span>
          </Button>
        </div>
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 2: BATALKAN / REFUND ITEM TAGIHAN                               */}
      {/* ===================================================================== */}
      <DialogModal
        open={Boolean(cancellingUnit)}
        onClose={() => setCancellingUnit(null)}
        title="Batalkan Item dari Tagihan"
      >
        {cancellingUnit && (
          <div className="space-y-4">
            <p className="text-[14px] text-[var(--muted-foreground)]">
              Anda akan membatalkan{' '}
              <strong className="text-[var(--foreground)]">
                1× {cancellingUnit.itemNameSnapshot || cancellingUnit.itemName}
              </strong>{' '}
              dari tagihan ini.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="modal-cancel-reason">Alasan Pembatalan</Label>
              <Input
                id="modal-cancel-reason"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modal-restock-choice">Perlakuan Stok Porsi</Label>
              <SelectField
                id="modal-restock-choice"
                value={restockChoice}
                onChange={(e) => setRestockChoice(e.target.value as any)}
              >
                <option value="RESTOCK">Kembalikan ke stok (Belum dimasak)</option>
                <option value="WASTE">Catat sebagai bahan terbuang (Waste)</option>
              </SelectField>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCancellingUnit(null)}>
                Kembali
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  await runStaffCommand('CANCEL_UNIT_OR_REFUND', {
                    unitId: cancellingUnit.id,
                    reason: cancelReasonInput,
                    restockChoice,
                    issueRefundNow: (selectedBill?.verifiedReceiptsIdr || 0) > 0,
                    approverName: currentStaffObj.userName,
                  });
                  setCancellingUnit(null);
                  setActionNotice('Item berhasil dibatalkan dari tagihan.');
                }}
              >
                Konfirmasi Batalkan Item
              </Button>
            </div>
          </div>
        )}
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 3: TAMBAH MENU BARU & KATEGORI                                  */}
      {/* ===================================================================== */}
      <DialogModal
        open={addMenuModalOpen}
        onClose={() => setAddMenuModalOpen(false)}
        title="Tambah Menu atau Kategori Baru"
      >
        <div className="space-y-5">
          {/* Quick Add Category */}
          <div className="pb-4 border-b border-[var(--border)] space-y-2">
            <Label htmlFor="modal-new-cat">Tambah Kategori Menu Baru</Label>
            <div className="flex items-center gap-2">
              <Input
                id="modal-new-cat"
                value={newCategoryNameInput}
                onChange={(e) => setNewCategoryNameInput(e.target.value)}
                placeholder="Contoh: Es Krim & Dessert"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || !newCategoryNameInput.trim()}
                onClick={async () => {
                  await runStaffCommand('MENU_STOCK_ACTION', {
                    action: 'CREATE_CATEGORY',
                    newCategoryName: newCategoryNameInput,
                  });
                  setNewCategoryNameInput('');
                  setActionNotice('Kategori baru berhasil ditambahkan.');
                }}
              >
                + Kategori
              </Button>
            </div>
          </div>

          {/* Add Menu Form */}
          <div className="space-y-3">
            <p className="font-semibold text-[15px]">Tambah Item Menu Baru</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Kode</Label>
                <Input
                  value={newMenuCode}
                  onChange={(e) => setNewMenuCode(e.target.value)}
                  placeholder="M-012"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Nama Menu</Label>
                <Input
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  placeholder="Contoh: Affogato Vanila"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Kategori</Label>
                <SelectField
                  value={newMenuCategoryId}
                  onChange={(e) => setNewMenuCategoryId(e.target.value)}
                >
                  {(snapshot?.categories || []).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="space-y-1">
                <Label>Stasiun</Label>
                <SelectField
                  value={newMenuStation}
                  onChange={(e) => setNewMenuStation(e.target.value)}
                >
                  <option value="BAR">Bar &amp; Kopi</option>
                  <option value="KITCHEN">Dapur Utama</option>
                  <option value="PASTRY">Pastry &amp; Roti</option>
                </SelectField>
              </div>
              <div className="space-y-1">
                <Label>Harga (Rp)</Label>
                <Input
                  type="number"
                  value={newMenuPrice}
                  onChange={(e) => setNewMenuPrice(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Deskripsi Singkat</Label>
              <Input
                value={newMenuDesc}
                onChange={(e) => setNewMenuDesc(e.target.value)}
                placeholder="Deskripsi bahan dan penyajian..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Foto Menu ({newMenuPhotos.length} foto)</Label>
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[var(--accent-surface)] text-[var(--primary)] font-semibold text-[12px] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Pilih File Gambar</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handlePhotoFileSelect(e, 'NEW_MENU')}
                    className="hidden"
                  />
                </label>
              </div>

              {newMenuPhotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {newMenuPhotos.map((pUrl, idx) => (
                    <div
                      key={`${pUrl}_${idx}`}
                      className="relative w-12 h-12 rounded-[6px] overflow-hidden border border-[var(--border)] bg-[#F2EFE9]"
                    >
                      <Image
                        src={pUrl}
                        alt={`Foto ${idx + 1}`}
                        fill
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="primary"
              className="w-full"
              disabled={busy || !newMenuName.trim()}
              onClick={async () => {
                await runStaffCommand('MENU_STOCK_ACTION', {
                  action: 'CREATE_MENU_ITEM',
                  newMenuItem: {
                    externalCode: newMenuCode,
                    name: newMenuName,
                    description: newMenuDesc,
                    categoryId: newMenuCategoryId,
                    stationCode: newMenuStation,
                    variantName: 'Reguler',
                    priceIdr: Number(newMenuPrice),
                    photos: newMenuPhotos,
                    allergens: [],
                  },
                });
                setNewMenuName('');
                setNewMenuDesc('');
                setAddMenuModalOpen(false);
                setActionNotice('Menu baru berhasil ditambahkan ke katalog.');
              }}
            >
              Simpan Menu Baru
            </Button>
          </div>
        </div>
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 4: KELOLA GALERI MULTI-FOTO MENU (ANIMATED CAROUSEL)            */}
      {/* ===================================================================== */}
      <DialogModal
        open={Boolean(editingPhotosItem)}
        onClose={() => setEditingPhotosItem(null)}
        title={`Galeri Foto: ${editingPhotosItem?.name || ''}`}
      >
        {editingPhotosItem && (
          <div className="space-y-4">
            {photoDraftList.length > 0 && (
              <ImageCarousel
                photos={photoDraftList}
                altPrefix={editingPhotosItem.name}
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-[13px] cursor-pointer hover:bg-[var(--primary-hover)] transition-colors">
                <Upload className="w-4 h-4" />
                <span>Unggah Foto dari Perangkat</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handlePhotoFileSelect(e, 'EDIT_MODAL')}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
              <Label>Atau tambahkan URL foto:</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={newPhotoUrlInput}
                  onChange={(e) => setNewPhotoUrlInput(e.target.value)}
                  placeholder="https://... atau /images/menu/..."
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!newPhotoUrlInput.trim()) return;
                    setPhotoDraftList([...photoDraftList, newPhotoUrlInput.trim()]);
                    setNewPhotoUrlInput('');
                  }}
                >
                  + Tambah
                </Button>
              </div>
            </div>

            {photoDraftList.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-[var(--border)]">
                {photoDraftList.map((url, idx) => (
                  <div
                    key={`${url}_${idx}`}
                    className="p-2 rounded-[8px] border border-[var(--border)] bg-[var(--background)] space-y-1.5"
                  >
                    <div className="relative w-full h-16 rounded-[6px] overflow-hidden bg-[#F2EFE9]">
                      <Image
                        src={url}
                        alt={`${editingPhotosItem.name} ${idx + 1}`}
                        fill
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      {idx > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...photoDraftList];
                            const [picked] = next.splice(idx, 1);
                            next.unshift(picked);
                            setPhotoDraftList(next);
                          }}
                          className="text-[11px] font-medium text-[var(--primary)] hover:underline cursor-pointer"
                        >
                          Jadikan Utama
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-[var(--primary)]">
                          Foto Utama
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setPhotoDraftList(photoDraftList.filter((_, i) => i !== idx))
                        }
                        className="text-[var(--status-danger-fg)] p-1 cursor-pointer"
                        aria-label={`Hapus foto ${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingPhotosItem(null)}>
                Batal
              </Button>
              <Button
                variant="primary"
                disabled={busy || photoDraftList.length === 0}
                onClick={async () => {
                  await runStaffCommand('MENU_STOCK_ACTION', {
                    action: 'UPDATE_MENU_PHOTOS',
                    menuItemId: editingPhotosItem.id,
                    photos: photoDraftList,
                  });
                  setEditingPhotosItem(null);
                  setActionNotice(`Galeri foto ${editingPhotosItem.name} berhasil disimpan.`);
                }}
              >
                Simpan Galeri ({photoDraftList.length} Foto)
              </Button>
            </div>
          </div>
        )}
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 5: CETAK QR MEJA                                                */}
      {/* ===================================================================== */}
      <DialogModal
        open={showQrPrintModal}
        onClose={() => setShowQrPrintModal(false)}
        title="Lembar Cetak QR Pemesanan Meja"
      >
        <div className="grid grid-cols-2 gap-3">
          {(snapshot?.tables || []).map((t: any) => (
            <div
              key={t.id}
              className="p-3 border border-[var(--border)] rounded-[8px] text-center space-y-1 bg-[var(--background)]"
            >
              <p className="font-heading font-bold text-[15px]">Meja {t.label}</p>
              <p className="text-[12px] text-[var(--muted-foreground)]">{t.areaName}</p>
              <p className="text-[11px] text-[var(--primary)] font-mono truncate">
                ?table={t.label}
              </p>
            </div>
          ))}
        </div>
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 6: IMPOR KATALOG CSV                                            */}
      {/* ===================================================================== */}
      <DialogModal
        open={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        title="Impor Katalog Menu via CSV"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="csv-import-textarea">
              Format: externalCode,name,categorySlug,stationCode,variantName,priceIdr
            </Label>
            <Textarea
              id="csv-import-textarea"
              rows={4}
              value={csvTextInput}
              onChange={(e) => setCsvTextInput(e.target.value)}
              className="font-mono text-[12px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={async () => {
                const lines = csvTextInput
                  .trim()
                  .split('\n')
                  .slice(1)
                  .map((line) => {
                    const [
                      externalCode,
                      name,
                      categorySlug,
                      stationCode,
                      variantName,
                      priceIdr,
                    ] = line.split(',');
                    return {
                      externalCode,
                      name,
                      categorySlug,
                      stationCode,
                      variantName,
                      priceIdr,
                    };
                  });
                const res = await runStaffCommand('MENU_STOCK_ACTION', {
                  action: 'PREVIEW_CSV_IMPORT',
                  csvRows: lines,
                });
                setPreviewBatch(res?.result || res);
              }}
            >
              Periksa CSV
            </Button>

            {previewBatch && previewBatch.errorRows === 0 && (
              <Button
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  await runStaffCommand('MENU_STOCK_ACTION', {
                    action: 'COMMIT_CSV_IMPORT',
                    importBatchId: previewBatch.batchId,
                  });
                  setPreviewBatch(null);
                  setShowCsvModal(false);
                  setActionNotice('Katalog CSV berhasil diimpor.');
                }}
              >
                Simpan ({previewBatch.validRows} Menu)
              </Button>
            )}
          </div>
        </div>
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 7: TAMBAH VOUCHER PROMO BARU                                    */}
      {/* ===================================================================== */}
      <DialogModal
        open={newPromoModalOpen}
        onClose={() => setNewPromoModalOpen(false)}
        title="Buat Voucher Promo Baru"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kode Voucher</Label>
              <Input
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nama Promo</Label>
              <Input
                value={newPromoName}
                onChange={(e) => setNewPromoName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Minimum Belanja (Rp)</Label>
              <Input
                type="number"
                value={newPromoMinSpend}
                onChange={(e) => setNewPromoMinSpend(Number(e.target.value))}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Potongan Harga (Rp)</Label>
              <Input
                type="number"
                value={newPromoValue}
                onChange={(e) => setNewPromoValue(Number(e.target.value))}
                className="tabular-nums"
              />
            </div>
          </div>

          <Button
            variant="primary"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              await runStaffCommand('SETTINGS_PROMO_FEEDBACK_ACTION', {
                action: 'CREATE_PROMO',
                promoData: {
                  code: newPromoCode,
                  name: newPromoName,
                  description: `Potongan ${formatIdr(newPromoValue)} min. belanja ${formatIdr(
                    newPromoMinSpend
                  )}`,
                  audience: 'ALL',
                  triggerType: 'MIN_SPEND',
                  minSpendIdr: newPromoMinSpend,
                  nthVisit: 0,
                  benefitType: 'FLAT_DISCOUNT',
                  benefitValue: newPromoValue,
                  maxDiscountIdr: newPromoValue,
                  quotaTotal: 100,
                },
              });
              setNewPromoModalOpen(false);
              setActionNotice(`Voucher promo ${newPromoCode} berhasil diterbitkan.`);
            }}
          >
            Terbitkan Voucher Promo
          </Button>
        </div>
      </DialogModal>
    </div>
  );
}
