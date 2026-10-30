'use client';

import React, { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { MotionPanel } from '@/components/ui/motion';
import { motion, AnimatePresence } from 'motion/react';
import {
  Button,
  PageHeader,
  InlineNotice,
  StatStrip,
  ChoiceStrip,
  Surface,
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
import { cafeConfig, isModuleEnabled, getDefaultStaffModule } from '@/src/config/cafe';
import { BrandMark } from './brand';
import { PosComposer } from './pos-composer';
import { OrderInbox } from './order-inbox';
import { DemoPaymentControls } from './demo-payment-controls';
import { ShiftControls } from './shift-controls';
import { VisitService } from './visit-service';
import styles from './staff-app.module.css';
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
  Coffee,
  LayoutGrid,
  Wallet,
  ClipboardList,
  Settings2,
  RefreshCw,
  ArrowUpRight,
  ChefHat,
} from 'lucide-react';

export type StaffSection =
  | 'kasir'
  | 'dapur'
  | 'meja'
  | 'menu'
  | 'laporan'
  | 'pengaturan';

function sectionEnabled(section: StaffSection): boolean {
  switch (section) {
    case 'kasir': return isModuleEnabled('cashier') || isModuleEnabled('ordering');
    case 'dapur': return isModuleEnabled('kitchen');
    case 'meja': return isModuleEnabled('tables');
    case 'menu': return isModuleEnabled('catalog') || isModuleEnabled('cashier');
    case 'laporan': return isModuleEnabled('dashboard');
    case 'pengaturan': return true;
  }
}
const defaultSection = ({ cashier: 'kasir', ordering: 'kasir', kitchen: 'dapur', dashboard: 'laporan', tables: 'meja', marketing: 'pengaturan' } as Record<string, StaffSection>)[getDefaultStaffModule() || ''] || 'pengaturan';
const availableSection = (section?: StaffSection) => section && sectionEnabled(section) ? section : defaultSection;

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
  onRefresh,
  lastUpdated,
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

  const canCashier = isModuleEnabled('cashier');
  const canKitchen = isModuleEnabled('kitchen');
  const canTables = isModuleEnabled('tables');
  const canMarketing = isModuleEnabled('marketing');
  const [activeSection, setActiveSection] = useState<StaffSection>(defaultSection);
  const [actionNotice, setActionNotice] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');
  const [billSearch, setBillSearch] = useState('');
  const [billFilter, setBillFilter] = useState<'OPEN' | 'PAID' | 'ALL'>('OPEN');
  const [kitchenStatusFilter, setKitchenStatusFilter] = useState('ACTIVE');
  const [showResolvedRequests, setShowResolvedRequests] = useState(false);

  // Kasir & Pesanan state
  const [selectedBillId, setSelectedBillId] = useState<string>('bill_demo_m04');
  const [selectedUnitIdsForSplit, setSelectedUnitIdsForSplit] = useState<string[]>([]);
  const [showSplitMergePanel, setShowSplitMergePanel] = useState<boolean>(false);
  const [splitNewOwnerLabel, setSplitNewOwnerLabel] = useState<string>('Tagihan Pisah #2');
  const [mergeTargetBillId, setMergeTargetBillId] = useState<string>('');
  const [tenderMethod, setTenderMethod] = useState<string>('CASH');
  const [tenderAmountInput, setTenderAmountInput] = useState<string>('');
  const [cashGivenInput, setCashGivenInput] = useState<string>('');
  const [transferRefInput, setTransferRefInput] = useState<string>('');
  const paymentAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const paymentSubmittingRef = useRef(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [modalActionError, setModalActionError] = useState('');

  // Cancel unit modal state
  const [cancellingUnit, setCancellingUnit] = useState<any | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>(
    'Permintaan pelanggan / ubah pesanan'
  );
  const [restockChoice, setRestockChoice] = useState<'RESTOCK' | 'WASTE'>('RESTOCK');
  const [refundNow, setRefundNow] = useState(true);

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
  const [waitlistTables, setWaitlistTables] = useState<Record<string, string>>({});

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

  // Report dates follow the cafe's timezone, not the browser's timezone.
  const todayReportDate = new Intl.DateTimeFormat('en-CA', { timeZone: cafeConfig.timezone }).format(new Date(snapshot.serverTime));
  const [reportDate, setReportDate] = useState(todayReportDate);

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
  const [customPaymentPolicy, setCustomPaymentPolicy] = useState<string>(snapshot?.outlet?.paymentPolicy || 'PREPAY');
  const [customTakeawayPolicy, setCustomTakeawayPolicy] = useState<string>(snapshot?.outlet?.takeawayPaymentPolicy || 'PREPAY');
  const [customAutoAccept, setCustomAutoAccept] = useState<boolean>(Boolean(snapshot?.outlet?.autoAcceptParticipant));
  const [policyEditing, setPolicyEditing] = useState(false);
  const editPolicy = () => { if (!policyEditing) { setCustomPaymentPolicy(snapshot?.outlet?.paymentPolicy || 'PREPAY'); setCustomTakeawayPolicy(snapshot?.outlet?.takeawayPaymentPolicy || 'PREPAY'); setCustomAutoAccept(Boolean(snapshot?.outlet?.autoAcceptParticipant)); setPolicyEditing(true); } };
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

  const activeBills = useMemo(() => (snapshot?.bills || []).filter((bill: any) => bill.lifecycle !== 'VOID'), [snapshot]);
  const filteredBills = useMemo(() => activeBills.filter((bill: any) => {
    if (billFilter === 'OPEN' && bill.balanceIdr === 0) return false;
    if (billFilter === 'PAID' && bill.paymentState !== 'SETTLED') return false;
    return `${bill.tableLabel || ''} ${bill.ownerLabel || ''} ${bill.id || ''}`
      .toLocaleLowerCase('id').includes(billSearch.trim().toLocaleLowerCase('id'));
  }), [activeBills, billFilter, billSearch]);

  const selectedBill = useMemo(
    () =>
      filteredBills.find((b: any) => b.id === selectedBillId) ||
      filteredBills[0] ||
      null,
    [filteredBills, selectedBillId]
  );

  const kitchenUnits = useMemo(() => {
    const all = (snapshot?.orderUnits || []).filter(
      (u: any) => u.fulfillmentStatus !== 'CANCELLED' &&
        (kitchenStatusFilter === 'ALL' ||
          (kitchenStatusFilter === 'ACTIVE'
            ? ['QUEUED', 'PREPARING', 'READY'].includes(u.fulfillmentStatus)
            : u.fulfillmentStatus === kitchenStatusFilter))
    );
    if (stationFilter === 'ALL') return all;
    return all.filter((u: any) => u.stationCode === stationFilter);
  }, [snapshot, stationFilter, kitchenStatusFilter]);

  const reportBills = useMemo(() => (snapshot?.bills || []).filter((bill: any) => bill.businessDate === reportDate && bill.lifecycle !== 'VOID'), [snapshot, reportDate]);
  const reportShifts = useMemo(() => (snapshot?.cashShifts || []).filter((shift: any) => shift.businessDate === reportDate), [snapshot, reportDate]);
  const reportTotals = useMemo(() => reportBills.reduce((totals: any, bill: any) => ({
    subtotal: totals.subtotal + Number(bill.subtotalIdr || 0),
    discount: totals.discount + Number(bill.discountIdr || 0),
    service: totals.service + Number(bill.serviceIdr || 0),
    tax: totals.tax + Number(bill.taxIdr || 0),
    corrections: totals.corrections + Number(bill.debitAdjustmentsIdr || 0) - Number(bill.creditAdjustmentsIdr || 0),
    billed: totals.billed + Math.max(0, Number(bill.originalTotalIdr || 0) + Number(bill.debitAdjustmentsIdr || 0) - Number(bill.creditAdjustmentsIdr || 0)),
    received: totals.received + Number(bill.verifiedReceiptsIdr || 0),
    refunded: totals.refunded + Number(bill.refundedIdr || 0),
    outstanding: totals.outstanding + Math.max(0, Number(bill.balanceIdr || 0)),
  }), { subtotal: 0, discount: 0, service: 0, tax: 0, corrections: 0, billed: 0, received: 0, refunded: 0, outstanding: 0 }), [reportBills]);

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

  const openVisitBills = (visitId: string) => {
    const matching = activeBills.filter((bill: any) => bill.visitId === visitId);
    const bill = matching.find((entry: any) => entry.balanceIdr !== 0) || matching[0];
    setActiveSection('kasir'); setBillSearch(''); setBillFilter('ALL');
    if (bill) setSelectedBillId(bill.id);
  };

  const handleExportReportCsv = () => {
    const headers = ['Tanggal Tagihan', 'ID Tagihan', 'Meja / Pemilik', 'Status Bayar', 'Subtotal', 'Diskon', 'Layanan', 'Pajak', 'Koreksi Debit', 'Koreksi Kredit', 'Nilai Tagihan', 'Diterima', 'Dikembalikan', 'Penerimaan Bersih', 'Sisa'];
    const rows = reportBills.map((bill: any) => [
      bill.businessDate, bill.id, `${bill.tableLabel} / ${bill.ownerLabel}`, bill.paymentState,
      bill.subtotalIdr, bill.discountIdr, bill.serviceIdr, bill.taxIdr,
      bill.debitAdjustmentsIdr, bill.creditAdjustmentsIdr,
      Math.max(0, Number(bill.originalTotalIdr || 0) + Number(bill.debitAdjustmentsIdr || 0) - Number(bill.creditAdjustmentsIdr || 0)),
      bill.verifiedReceiptsIdr, bill.refundedIdr,
      Number(bill.verifiedReceiptsIdr || 0) - Number(bill.refundedIdr || 0), bill.balanceIdr,
    ]);
    const csvCell = (cell: string | number) => `"${String(sanitizeSpreadsheetExportCell(cell ?? '')).replaceAll('"', '""')}"`;
    const csvContent = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `laporan-${cafeConfig.venue.outletSlug}-${reportDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setActionNotice(`Laporan tagihan ${reportDate} berhasil diunduh.`);
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
    if (cred && pinInput.trim() === cred.pin) {
      handleSwitchStaff(loginStaffId);
      setActiveSection(availableSection(cred?.defaultSection));
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
      <div className="cafe-staff min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col justify-center items-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className="w-full max-w-[460px] bg-[var(--surface)] border border-[var(--border)] rounded-[28px] p-7 sm:p-9 space-y-6 shadow-[0_24px_80px_-30px_rgba(65,40,28,0.2)]"
        >
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-[var(--primary-ink)]" />
              <div>
                <h1 className="font-heading text-[18px] leading-[24px] font-bold">
                  Ruang operasional
                </h1>
                <p className="text-[12px] text-[var(--muted-foreground)]">
                  {cafeConfig.brand.name}
                </p>
              </div>
            </div>
            {onBackToCustomer && (
              <Button variant="ghost" size="sm" onClick={onBackToCustomer}>
                <ArrowLeft className="w-4 h-4" />
                <span>Menu pelanggan</span>
              </Button>
            )}
          </div>

          <form onSubmit={handleStaffLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-login-select">Pilih akun staf</Label>
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
                    {s.userName} · {STAFF_CREDENTIALS[s.id]?.roleLabel || s.role}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-pin-input">PIN staf (4 digit)</Label>
              <Input
                id="staff-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Masukkan PIN"
                className="text-[16px] tracking-widest tabular-nums"
              />
            </div>

            {/* Quick Role Login Presets */}
            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <p className="text-[12px] text-[var(--muted-foreground)]">
                Akses demo
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
                        setActiveSection(availableSection(cred?.defaultSection));
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
              Masuk
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

  const allNavItems: { id: StaffSection; label: string; count?: number }[] = [
    {
      id: 'kasir',
      label: canCashier ? 'Kasir & Pesanan' : 'Pesanan masuk',
      count:
        pendingOrderRequests.length +
        activeBills.filter((b: any) => b.balanceIdr > 0).length,
    },
    {
      id: 'dapur',
      label: 'Dapur & Bar',
      count: (snapshot?.orderUnits || []).filter((u: any) =>
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
  const navItems = allNavItems.filter(item => sectionEnabled(item.id));

  const effectiveTenderAmount =
    tenderAmountInput.trim() === ''
      ? selectedBill?.balanceIdr || 0
      : Number(tenderAmountInput);
  const cashChangePreview =
    tenderMethod === 'CASH'
      ? Math.max(0, (Number(cashGivenInput) || 0) - effectiveTenderAmount)
      : 0;

  return (
    <div className={`cafe-staff min-h-screen bg-[var(--background)] text-[var(--foreground)] ${styles.workspace}`}>
      <aside className="staff-sidebar">
        <div className="flex items-center gap-3 px-2 py-3">
          <BrandMark />
          <div className="min-w-0"><p className="font-heading font-bold text-base leading-snug break-words">{cafeConfig.brand.name}</p></div>
        </div>
        <p className={styles.sidebarLabel}>Operasional</p>
        <nav aria-label="Navigasi operasional desktop" className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = ({ kasir: Wallet, dapur: ChefHat, meja: LayoutGrid, menu: Coffee, laporan: ClipboardList, pengaturan: Settings2 })[item.id];
            return <button key={item.id} type="button" aria-current={activeSection === item.id ? 'page' : undefined} onClick={() => { setActiveSection(item.id); setActionNotice(''); setActionError(''); }} className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-colors ${activeSection === item.id ? 'bg-[var(--accent-surface)] text-[var(--primary-ink)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]'}`}>
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{item.label}</span>{Boolean(item.count) && <span className="rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] tabular-nums">{item.count}</span>}
            </button>;
          })}
        </nav>
        <div className="mt-auto space-y-4 pt-6">

          {onBackToCustomer && <button type="button" onClick={onBackToCustomer} className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--primary-ink)]">Lihat menu pelanggan<ArrowUpRight className="h-4 w-4" /></button>}
        </div>
      </aside>
      <header className="staff-header">
        <div className="staff-toolbar">
          <div className="staff-identity">
            {onBackToCustomer && <Button variant="ghost" size="icon" onClick={onBackToCustomer} aria-label="Kembali ke menu pelanggan" className="xl:hidden"><ArrowLeft className="h-4 w-4" /></Button>}
            <div><p className="text-sm font-semibold">{cafeConfig.brand.name}</p><p id="active-staff-role" className="text-xs text-[var(--muted-foreground)]">{STAFF_CREDENTIALS[activeStaff]?.roleLabel || currentStaffObj.role}</p></div>
          </div>
          <SelectField aria-label="Petugas aktif" aria-describedby="active-staff-role" value={activeStaff} onChange={(e) => handleSwitchStaff(e.target.value)} wrapperClassName="staff-account">
            {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.userName}</option>)}
          </SelectField>
          <div className="staff-actions">
            {lastUpdated && <span className={styles.syncText}>{lastUpdated}</span>}
            <Button variant="ghost" size="icon" title={lastUpdated} disabled={busy || !onRefresh} onClick={onRefresh} aria-label="Perbarui data operasional"><RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button>
            <Button variant="ghost" size="icon" onClick={() => setIsAuthenticated(false)} aria-label="Keluar dari portal staf"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="staff-mobile-nav"><AnimatedUnderlineTabs items={navItems} activeId={activeSection} onSelect={(id) => { setActiveSection(id); setActionNotice(''); setActionError(''); }} ariaLabel="Navigasi operasional kafe" layoutId="staff-pos-nav-underline" className="border-b-0" /></div>
      </header>
      <a href="#staff-content" className="skip-link">Ke ruang kerja</a>
      <main id="staff-content" className="staff-main">
        <PageHeader title={navItems.find(item => item.id === activeSection)?.label || 'Operasional'} actions={canCashier && activeSection === 'kasir' ? <Button variant="primary" onClick={() => setNewOrderModalOpen(true)}><Plus className="h-4 w-4" />Pesanan baru</Button> : undefined} />
        <AnimatePresence>
          {(actionNotice || actionError) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="staff-feedback"
            >
              {actionNotice && <InlineNotice tone="success">{actionNotice}</InlineNotice>}
              {actionError && <InlineError message={actionError} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* =================================================================== */}
        {/* TAB 1: KASIR & PESANAN (UNIFIED POS WORKSPACE)                      */}
        {/* =================================================================== */}
        <AnimatePresence mode="wait" initial={false}><MotionPanel key={activeSection}>{sectionEnabled('kasir') && activeSection === 'kasir' && (
          <div
            key="pos-kasir"
            className="workspace-stack"
          >
            <StatStrip items={[
              { id:'new', label:'Pesanan baru', value:pendingOrderRequests.length, icon:Receipt, onSelect:()=>document.getElementById('incoming-orders')?.scrollIntoView({ behavior:'smooth', block:'center' }) },
              ...(canTables ? [{ id:'tables', label:'Meja terisi', value:(snapshot?.tables || []).filter((t:any)=>t.physicalState==='OCCUPIED').length, icon:LayoutGrid, onSelect:()=>{setActiveSection('meja');setFloorSubTab('DENAH');} }] : []),
              ...(canKitchen ? [{ id:'preparing', label:'Dalam proses', value:(snapshot?.orderUnits || []).filter((u:any)=>['QUEUED','PREPARING'].includes(u.fulfillmentStatus)).length, icon:ChefHat, onSelect:()=>{setActiveSection('dapur');setKitchenStatusFilter('ACTIVE');} }] : []),
              ...(canTables ? [{ id:'help', label:'Panggilan tamu', value:openHelpCount, icon:Bell, onSelect:()=>{setActiveSection('meja');setFloorSubTab('ANTREAN');} }] : []),
            ]} />

            {canCashier && <ShiftControls snapshot={snapshot} busy={busy} onCommand={runStaffCommand} />}

            {/* Incoming Customer QR Order Requests (If any) */}
            {pendingOrderRequests.length > 0 && (
              <Surface id="incoming-orders" variant="ruled" className="space-y-3 scroll-mt-28">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B45309] animate-pulse" />
                    <h2 className="font-heading text-[17px] font-bold">
                      Pesanan baru ({pendingOrderRequests.length})
                    </h2>
                  </div>

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
                        data-request-id={req.id}
                        className="py-3.5 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0 basis-[240px] flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-[16px] font-bold">
                              Meja {req.tableLabel} · {req.customerName}
                            </span>
                            <StatusLabel label="Menunggu" tone="warning" />
                          </div>
                          <div className="text-[13px] text-[var(--muted-foreground)] space-y-0.5">
                            {lines.map((ln: any, idx: number) => (
                              <p key={idx}>
                                <strong className="text-[var(--foreground)]">
                                  {ln.quantity ?? ln.qty ?? 1}×
                                </strong>{' '}
                                {ln.itemName} ({ln.variantName})
                                {ln.modifiers?.length ? ` · ${ln.modifiers.join(', ')}` : ''}
                                {ln.note ? ` · Catatan: "${ln.note}"` : ''}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 min-w-0">
                          <div className="text-right mr-2">
                            <span className="block text-[11px] text-[var(--muted-foreground)]">
                              Total
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
                                `Pesanan Meja ${req.tableLabel} diterima.`
                              );
                            }}
                          >
                            <Check className="w-4 h-4" />
                            <span>Terima</span>
                          </Button>

                          <Button
                            variant="danger"
                            size="sm"
                            disabled={busy}
                            onClick={() => { setRejectingRequest(req); setRejectReason(''); setModalActionError(''); }}
                          >
                            <X className="w-4 h-4" />
                            <span>Tolak</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Surface>
            )}

            <DemoPaymentControls snapshot={snapshot} busy={busy} onCommand={runStaffCommand} />
            {!canKitchen && <OrderInbox snapshot={snapshot} busy={busy} onCommand={runStaffCommand} />}
            {/* The cashier workspace is separate from the ordering inbox. */}
            {canCashier && <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* LEFT 4 COLS: Active Bills List + Walk-In Order Button */}
              <div className="lg:col-span-4 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-heading text-[17px] font-bold">
                    Tagihan
                  </h2>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setNewOrderModalOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Pesanan baru</span>
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-[var(--muted-foreground)]" /><Input aria-label="Cari tagihan berdasarkan meja atau pelanggan" placeholder="Cari meja atau pelanggan…" value={billSearch} onChange={(e) => setBillSearch(e.target.value)} className="pl-9" /></div>
                  <AnimatedSegmentedControl ariaLabel="Filter pembayaran tagihan" options={[{ value: 'OPEN', label: 'Belum lunas' }, { value: 'PAID', label: 'Lunas' }, { value: 'ALL', label: 'Semua' }]} value={billFilter} onChange={(value) => setBillFilter(value as typeof billFilter)} layoutId="staff-bill-filter" />
                </div>
                {filteredBills.length === 0 && <EmptyState title="Tidak ada tagihan" description={billSearch ? 'Coba nama pelanggan atau nomor meja lain.' : 'Tagihan yang sesuai akan tampil di sini.'} />}
                <div className="space-y-2">
                  {filteredBills.map((b: any) => {
                    const isSel = b.id === selectedBill?.id;
                    const payBadge = formatPaymentStateLabel(b.paymentState);
                    return (
                      <button
                        key={b.id}
                        data-bill-id={b.id}
                        type="button"
                        onClick={() => {
                          setSelectedBillId(b.id);
                          setSelectedUnitIdsForSplit([]);
                          setTenderAmountInput('');
                          setCashGivenInput('');
                          setTransferRefInput('');
                        }}
                        className={`w-full py-3.5 px-3 text-left transition-colors flex flex-col gap-3 cursor-pointer ${
                          isSel
                            ? 'rounded-xl bg-[var(--accent-surface)] ring-1 ring-[var(--primary-ink)]'
                            : 'rounded-xl hover:bg-[var(--background)]'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 w-full">
                          <p className="font-heading font-semibold text-[15px] text-[var(--foreground)]">{b.tableLabel ? `Meja ${b.tableLabel}` : 'Bawa pulang'}</p>
                          <p className="text-sm break-words">{b.ownerLabel}</p>
                          <p className="text-[12px] text-[var(--muted-foreground)] tabular-nums">
                            {(b.allocatedUnits || []).length} porsi menu
                          </p>
                        </div>
                        <div className="w-full flex flex-wrap items-center justify-between gap-2">
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
              <div data-selected-bill-id={selectedBill?.id} className="lg:col-span-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 space-y-6">
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
                                  aria-label="Tagihan tujuan penggabungan"
                                  value={mergeTargetBillId}
                                  onChange={(e) => setMergeTargetBillId(e.target.value)}
                                >
                                  <option value="">Pilih tagihan tujuan</option>
                                  {activeBills
                                    .filter(
                                      (b: any) =>
                                        b.id !== selectedBill.id && b.lifecycle === 'OPEN' && b.visitId === selectedBill.visitId && b.paymentPolicy === selectedBill.paymentPolicy && !b.hasActiveExternalAttempt && !b.verifiedReceiptsIdr && !(b.adjustments || []).length
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
                              data-unit-id={u.id}
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
                                    className="w-4 h-4 accent-[var(--primary-ink)]"
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
                                {(!isCancelled || selectedBill.balanceIdr < 0) && (
                                  <button
                                    type="button"
                                    onClick={() => { setCancellingUnit(u); setRefundNow(true); setModalActionError(''); setCancelReasonInput(isCancelled ? 'Pengembalian pembayaran setelah pembatalan' : 'Permintaan pelanggan / ubah pesanan'); }}
                                    className="text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--status-danger-fg)] transition-colors cursor-pointer px-1.5 py-1"
                                  >
                                    {isCancelled ? 'Selesaikan pengembalian' : 'Batalkan'}
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
                              <Label>Pembayaran</Label>
                              <AnimatedSegmentedControl
                                ariaLabel="Metode pembayaran kasir"
                                options={[
                                  { value: 'CASH', label: 'Tunai' },
                                  ...(isModuleEnabled('payments') ? [{ value: 'QRIS', label: 'QRIS demo' }, { value: 'VIRTUAL_ACCOUNT', label: 'VA demo' }] : []),
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
                                  Jumlah bayar (Rp)
                                </Label>
                                <Input
                                  id="cashier-tender-amount"
                                  type="number" min={1} max={selectedBill.balanceIdr} step={1}
                                  placeholder={String(selectedBill.balanceIdr)}
                                  value={tenderAmountInput}
                                  onChange={(e) => setTenderAmountInput(e.target.value)}
                                  className="tabular-nums font-semibold"
                                />
                              </div>

                              {tenderMethod === 'CASH' ? (
                                <div className="space-y-1.5">
                                  <Label htmlFor="cashier-cash-given">
                                    Tunai diterima (Rp)
                                  </Label>
                                  <Input
                                    id="cashier-cash-given"
                                    type="number" min={0} step={1}
                                    value={cashGivenInput}
                                    onChange={(e) => setCashGivenInput(e.target.value)}
                                    className="tabular-nums font-semibold"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <Label htmlFor="cashier-ref-code">
                                    Referensi (opsional)
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
                                    className="font-bold text-[var(--primary-ink)]"
                                  />
                                </div>
                              </div>
                            )}

                            {selectedBill.hasActiveExternalAttempt && <p role="status" className="text-sm text-[var(--status-warning-fg)]">Instruksi pembayaran masih aktif. Konfirmasikan hasilnya atau batalkan melalui Uji pembayaran demo sebelum mencatat pembayaran lain.</p>}
                            <Button
                              variant="primary"
                              size="lg"
                              className="w-full"
                              disabled={busy || paymentSubmitting || selectedBill.hasActiveExternalAttempt || !Number.isSafeInteger(effectiveTenderAmount) || effectiveTenderAmount <= 0 || effectiveTenderAmount > selectedBill.balanceIdr || (tenderMethod === 'CASH' && (!Number.isSafeInteger(Number(cashGivenInput)) || Number(cashGivenInput) < effectiveTenderAmount))}
                              onClick={async () => {
                                if (paymentSubmittingRef.current) return;
                                paymentSubmittingRef.current = true; setPaymentSubmitting(true);
                                const amt = effectiveTenderAmount;
                                const paymentPayload = { billId: selectedBill.id, method: tenderMethod, amountIdr: amt, tenderedIdr: tenderMethod === 'CASH' ? Number(cashGivenInput) : amt, referenceCode: transferRefInput || undefined };
                                const fingerprint = JSON.stringify(paymentPayload);
                                if (paymentAttemptRef.current?.fingerprint !== fingerprint) paymentAttemptRef.current = { fingerprint, key: `payment_${crypto.randomUUID()}` };
                                try {
                                  const res = await runStaffCommand('RECORD_PAYMENT', { ...paymentPayload, idempotencyKey: paymentAttemptRef.current.key });
                                  const external = tenderMethod === 'QRIS' || tenderMethod === 'VIRTUAL_ACCOUNT';
                                  setActionNotice(external ? 'Instruksi pembayaran demo dibuat. Pembayaran masih menunggu konfirmasi.' : `Pembayaran ${tenderMethod === 'CASH' ? 'tunai' : 'transfer'} sebesar ${formatIdr(amt)} berhasil dicatat.${(res?.result?.changeIdr ?? 0) > 0 ? ` Kembalian: ${formatIdr(res.result.changeIdr)}` : ''}`);
                                  setTenderAmountInput(''); setCashGivenInput(''); setTransferRefInput(''); paymentAttemptRef.current = null;
                                } catch { /* runStaffCommand displays the server's error. Keep the retry key. */ }
                                finally { paymentSubmittingRef.current = false; setPaymentSubmitting(false); }
                              }}
                            >
                              <Receipt className="w-4 h-4" />
                              <span className="whitespace-normal leading-snug"><span className="block">{tenderMethod === 'CASH' ? 'Terima tunai' : tenderMethod === 'MANUAL_TRANSFER' ? 'Catat transfer' : 'Buat instruksi demo'}</span><Money amount={effectiveTenderAmount} className="block" /></span>
                            </Button>
                          </>
                        ) : (
                          <div className="p-4 rounded-[10px] bg-[var(--status-success-bg)] text-[var(--status-success-fg)] flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-[15px]">{selectedBill.balanceIdr < 0 ? `Perlu pengembalian ${formatIdr(-selectedBill.balanceIdr)}` : 'Lunas'}</p>

                            </div>
                            <Check className="w-5 h-5 shrink-0" />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState title="Pilih tagihan" />
                )}
              </div>
            </div>}
            {!canTables && <VisitService snapshot={snapshot} busy={busy} canTables={false} actorRole={currentStaffObj.role} onCommand={runStaffCommand} onNotice={setActionNotice} onOpenBills={canCashier ? openVisitBills : undefined} />}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: DAPUR & BAR (CLEAN KDS WORKSPACE)                            */}
        {/* =================================================================== */}
        {sectionEnabled('dapur') && activeSection === 'dapur' && (
          <div
            key="pos-dapur"
            className="space-y-6"
          >
            <div className="pb-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 max-w-full flex flex-wrap items-center gap-3">

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
                <span>{soundEnabled ? 'Suara aktif' : 'Suara Mati'}</span>
              </Button>
            </div>

            <ChoiceStrip ariaLabel="Status pesanan dapur" items={[['ACTIVE','Semua aktif'],['QUEUED','Antrean baru'],['PREPARING','Sedang dibuat'],['READY','Siap diantar'],['ALL','Termasuk selesai']].map(([id,label])=>({id,label}))} value={kitchenStatusFilter} onChange={setKitchenStatusFilter} variant="underline" />
            {kitchenUnits.length === 0 ? (
              <EmptyState title="Tidak ada pesanan" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {kitchenUnits.map((u: any) => {
                  const st = formatFulfillmentLabel(u.fulfillmentStatus);
                  const itemName = u.itemNameSnapshot || u.itemName;
                  const variantName = u.variantNameSnapshot || u.variantName;
                  const tableLabel = u.tableLabelSnapshot || u.tableLabel || '-';
                  const customerName = u.customerNameSnapshot || u.customerName || 'Tamu';
                  const takeaway = (snapshot?.orders || []).find((order: any) => order.id === u.orderId)?.mode === 'TAKEAWAY';

                  return (
                    <div
                      key={u.id}
                      data-unit-id={u.id}
                      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col items-stretch justify-between gap-3 border-t-[3px] ${u.fulfillmentStatus === 'READY' ? 'border-t-emerald-500' : u.fulfillmentStatus === 'PREPARING' ? 'border-t-amber-500' : 'border-t-[var(--primary)]'}`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-heading text-[17px] font-bold text-[var(--foreground)]">
                            Meja {tableLabel}
                          </span>
                          <span className="text-[13px] text-[var(--muted-foreground)]">
                            · {customerName}
                          </span>
                          <span className="text-[12px] font-medium px-2 py-0.5 rounded-[6px] bg-[var(--accent-surface)] text-[var(--primary-ink)]">
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
                          <p className="text-[13px] font-medium text-[var(--status-warning-fg)] bg-[var(--status-warning-bg)] rounded-lg p-3 mt-3">
                            Catatan: &ldquo;{u.note}&rdquo;
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
                            Mulai siapkan
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
                            Siap diantar
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
                                targetStatus: takeaway ? 'PICKED_UP' : 'DELIVERED',
                              })
                            }
                          >
                            <Check className="w-4 h-4" />
                            <span>{takeaway ? 'Sudah diambil' : 'Disajikan'}</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: MEJA, KUNJUNGAN & ANTREAN TAMU                               */}
        {/* =================================================================== */}
        {sectionEnabled('meja') && activeSection === 'meja' && (
          <div
            key="pos-meja"
            className="space-y-6"
          >
            <div className="pb-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">

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
                <VisitService snapshot={snapshot} busy={busy} canTables={canTables} actorRole={currentStaffObj.role} onCommand={runStaffCommand} onNotice={setActionNotice} onOpenBills={canCashier ? openVisitBills : undefined} />

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


              </div>
            ) : (
              /* Panggilan Bantuan Meja & Antrean Tamu (Waitlist) */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left 6 cols: Bantuan meja */}
                <section className="lg:col-span-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[var(--primary-ink)]" />
                    <h2 className="font-heading text-[17px] font-bold">
                      Bantuan meja
                    </h2>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><input type="checkbox" checked={showResolvedRequests} onChange={(e) => setShowResolvedRequests(e.target.checked)} className="accent-[var(--primary-ink)]" />Tampilkan permintaan selesai</label>
                  {!(snapshot?.serviceRequests || []).some((sr: any) => showResolvedRequests || sr.state !== 'RESOLVED') && <EmptyState title="Semua tamu terlayani" />}
                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {(snapshot?.serviceRequests || []).filter((sr: any) => showResolvedRequests || sr.state !== 'RESOLVED').map((sr: any) => (
                      <div
                        key={sr.id}
                        data-service-request-id={sr.id}
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
                          <p className="text-sm font-medium text-[var(--primary-ink)]">{({ CALL_STAFF: 'Panggil staf', CALL_WAITER: 'Panggil pelayan', ASK_BILL: 'Minta tagihan', REQUEST_BILL: 'Minta tagihan', EXTRA_CUTLERY: 'Alat makan', CUTLERY_NAPKIN: 'Alat makan', CLEAR_TABLE: 'Bersihkan meja', PACK_LEFTOVER: 'Bungkus makanan', ISSUE_REPORT: 'Laporan kendala', ORDER_ISSUE: 'Kendala pesanan' } as Record<string, string>)[sr.requestType || sr.type] || 'Bantuan pelanggan'}</p>
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
                    <Clock className="w-4 h-4 text-[var(--primary-ink)]" />
                    <h2 className="font-heading text-[17px] font-bold">
                      Antrean meja
                    </h2>
                  </div>

                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {(snapshot?.waitlistEntries || []).map((w: any) => (
                      <div
                        key={w.id}
                        data-waitlist-id={w.id}
                        className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-[16px] tabular-nums text-[var(--primary-ink)]">
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
                          <div className="flex flex-wrap items-center gap-2">
                            <SelectField aria-label={`Meja untuk ${w.customerName}`} value={waitlistTables[w.id] || w.heldTableId || ''} onChange={event => setWaitlistTables(current => ({ ...current, [w.id]: event.target.value }))} wrapperClassName="w-[180px]">
                              <option value="">Pilih meja tersedia</option>
                              {(snapshot?.tables || []).filter((table: any) => table.active && table.capacity >= w.partySize && table.physicalState === 'AVAILABLE' && !(snapshot?.waitlistEntries || []).some((other: any) => other.id !== w.id && other.status === 'CALLED' && other.heldTableId === table.id && Date.parse(other.holdExpiresAt) > Date.parse(snapshot.serverTime))).map((table: any) => <option key={table.id} value={table.id}>{table.label} · {table.capacity} kursi</option>)}
                            </SelectField>
                            {w.status === 'WAITING' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy || !(waitlistTables[w.id] || w.heldTableId)}
                                onClick={() =>
                                  runStaffCommand('WAITLIST_ACTION', {
                                    action: 'CALL',
                                    waitlistId: w.id,
                                    tableId: waitlistTables[w.id] || w.heldTableId,
                                  })
                                }
                              >
                                Panggil tamu
                              </Button>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={busy || !(waitlistTables[w.id] || w.heldTableId)}
                              onClick={() =>
                                runStaffCommand('WAITLIST_ACTION', {
                                  action: 'SEAT',
                                  waitlistId: w.id,
                                  tableId: waitlistTables[w.id] || w.heldTableId,
                                })
                              }
                            >
                              Tempatkan di meja
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: KATALOG MENU, MULTI-FOTO & STOK PORSI                        */}
        {/* =================================================================== */}
        {sectionEnabled('menu') && activeSection === 'menu' && (
          <div
            key="pos-menu"
            className="space-y-6"
          >
            {/* Clean Toolbar */}
            <div className="pb-4 border-b border-[var(--border)] flex flex-wrap items-center justify-end gap-3">

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowQrPrintModal(true)}
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak QR meja</span>
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
                  <span>Tambah menu</span>
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
                    Semua kategori ({(snapshot?.categories || []).length})
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
                        className="relative w-14 h-14 rounded-[10px] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)] shrink-0 cursor-pointer group"
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
                Batas stok harian
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
                          Perbarui stok
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: LAPORAN HARIAN & SHIFT KASIR                                 */}
        {/* =================================================================== */}
        {sectionEnabled('laporan') && activeSection === 'laporan' && (
          <div key="pos-laporan" className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div className="flex flex-wrap items-end gap-2"><div className="space-y-1"><Label htmlFor="report-date">Tanggal tagihan</Label><Input id="report-date" type="date" value={reportDate} onChange={event => { if (event.target.value) setReportDate(event.target.value); }} /></div><Button variant="secondary" size="sm" onClick={() => setReportDate(todayReportDate)}>Hari ini</Button></div>
              <Button variant="secondary" size="sm" disabled={!reportBills.length} onClick={handleExportReportCsv}><Download className="w-4 h-4" />Unduh CSV</Button>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]"><p className="text-sm text-[var(--muted-foreground)]">Tagihan</p><p className="font-heading text-3xl font-semibold mt-2 tabular-nums">{reportBills.length}</p></div>
              <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]"><p className="text-sm text-[var(--muted-foreground)]">Nilai tagihan</p><Money amount={reportTotals.billed} className="block font-heading text-xl lg:text-2xl font-semibold mt-2" /></div>
              <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]"><p className="text-sm text-[var(--muted-foreground)]">Diterima bersih</p><Money amount={reportTotals.received - reportTotals.refunded} className="block font-heading text-xl lg:text-2xl font-semibold mt-2 text-[var(--primary-ink)]" /></div>
              <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]"><p className="text-sm text-[var(--muted-foreground)]">Belum dibayar</p><Money amount={reportTotals.outstanding} className="block font-heading text-xl lg:text-2xl font-semibold mt-2" /></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="space-y-3"><h2 className="font-heading text-lg font-semibold">Rincian tagihan</h2><dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
                {[['Harga menu', reportTotals.subtotal], ['Potongan', -reportTotals.discount], ['Biaya layanan', reportTotals.service], ['Pajak', reportTotals.tax], ['Koreksi tagihan', reportTotals.corrections], ['Nilai tagihan setelah koreksi', reportTotals.billed]].map(([label, amount]) => <div key={label} className="py-3 flex justify-between gap-3"><dt>{label}</dt><dd><Money amount={Number(amount)} /></dd></div>)}
              </dl></section>
              <section className="space-y-3"><h2 className="font-heading text-lg font-semibold">Pembayaran</h2><dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm"><div className="py-3 flex justify-between gap-3"><dt>Pembayaran diterima</dt><dd><Money amount={reportTotals.received} /></dd></div><div className="py-3 flex justify-between gap-3"><dt>Uang dikembalikan</dt><dd><Money amount={-reportTotals.refunded} /></dd></div><div className="py-3 flex justify-between gap-3 font-semibold"><dt>Penerimaan bersih</dt><dd><Money amount={reportTotals.received - reportTotals.refunded} /></dd></div></dl><p className="text-xs leading-relaxed text-[var(--muted-foreground)]">Cakupan: tagihan pada tanggal yang dipilih. Penerimaan menghitung pembayaran dan pengembalian untuk tagihan tersebut. Tagihan batal tidak dihitung. Biaya bahan, gaji, dan laba belum tercakup.</p></section>
            </div>
            <section className="space-y-3"><h2 className="font-heading text-lg font-semibold">Daftar tagihan</h2>{!reportBills.length ? <EmptyState title="Belum ada tagihan" description="Pilih tanggal lain atau buat pesanan untuk melihat laporan." /> : <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--border)]" role="region" aria-label="Daftar tagihan tanggal terpilih" tabIndex={0}><table className="w-full min-w-[620px] text-sm text-left"><thead className="bg-[var(--background)]"><tr>{['Pemesan / meja', 'Status', 'Nilai tagihan', 'Diterima bersih', 'Sisa'].map(heading => <th key={heading} scope="col" className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border)]">{reportBills.map((bill: any) => <tr key={bill.id}><th scope="row" className="px-4 py-3 font-normal"><span className="block font-medium">{bill.ownerLabel}</span><span className="text-xs text-[var(--muted-foreground)]">{bill.tableLabel}</span></th><td className="px-4 py-3">{formatPaymentStateLabel(bill.paymentState).label}</td><td className="px-4 py-3"><Money amount={Math.max(0, Number(bill.originalTotalIdr || 0) + Number(bill.debitAdjustmentsIdr || 0) - Number(bill.creditAdjustmentsIdr || 0))} /></td><td className="px-4 py-3"><Money amount={Number(bill.verifiedReceiptsIdr || 0) - Number(bill.refundedIdr || 0)} /></td><td className="px-4 py-3"><Money amount={bill.balanceIdr} /></td></tr>)}</tbody></table></div>}</section>
            <section className="space-y-3"><h2 className="font-heading text-lg font-semibold">Catatan shift kasir</h2>{!reportShifts.length ? <p className="text-sm text-[var(--muted-foreground)]">Tidak ada shift pada tanggal ini.</p> : <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{reportShifts.map((shift: any) => <div key={shift.id} className="py-4 flex flex-wrap justify-between gap-4"><div><p className="text-sm font-semibold">{shift.drawerName}</p><p className="text-xs text-[var(--muted-foreground)] mt-1">{shift.operatorName} · {shift.state === 'OPEN' ? 'Terbuka' : 'Ditutup'}</p></div><dl className="flex flex-wrap gap-5 text-sm"><div><dt className="text-xs text-[var(--muted-foreground)]">Perkiraan laci</dt><dd className="mt-1"><Money amount={shift.expectedCashIdr} /></dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Uang terhitung</dt><dd className="mt-1">{shift.countedCashIdr == null ? 'Belum ditutup' : <Money amount={shift.countedCashIdr} />}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Selisih</dt><dd className="mt-1">{shift.varianceIdr == null ? 'Belum ditutup' : <Money amount={shift.varianceIdr} signed />}</dd></div></dl></div>)}</div>}</section>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 6: PENGATURAN PAJAK, PROMO & OUTLET                             */}
        {/* =================================================================== */}
        {sectionEnabled('pengaturan') && activeSection === 'pengaturan' && (
          <div
            key="pos-pengaturan"
            className="space-y-6"
          >


            {(canCashier || isModuleEnabled('ordering')) && <section aria-label="Alur pemesanan" className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
              <div><h2 className="font-heading text-lg font-semibold">Alur pemesanan</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Berlaku untuk pesanan yang diterima setelah pengaturan disimpan. Pesanan yang sudah diterima tetap memakai aturan semula.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label htmlFor="dine-payment-policy">Pembayaran makan di tempat</Label><SelectField id="dine-payment-policy" value={policyEditing ? customPaymentPolicy : snapshot?.outlet?.paymentPolicy || 'PREPAY'} disabled={!canCashier && !isModuleEnabled('payments')} onChange={event => { editPolicy(); setCustomPaymentPolicy(event.target.value); }}><option value="PREPAY">Bayar sebelum dibuat</option><option value="PAY_LATER">Bayar setelah makan</option></SelectField></div>
                <div className="space-y-1.5"><Label htmlFor="takeaway-payment-policy">Pembayaran bawa pulang</Label><SelectField id="takeaway-payment-policy" value={policyEditing ? customTakeawayPolicy : snapshot?.outlet?.takeawayPaymentPolicy || 'PREPAY'} disabled={!canCashier && !isModuleEnabled('payments')} onChange={event => { editPolicy(); setCustomTakeawayPolicy(event.target.value); }}><option value="PREPAY">Bayar sebelum dibuat</option><option value="PAY_LATER">Bayar saat pengambilan</option></SelectField></div>
              </div>
              {!canCashier && !isModuleEnabled('payments') && <p className="text-sm text-[var(--muted-foreground)]">Pembayaran ditangani kasir di luar sistem. Staf dapat mengonfirmasi penerimaan pembayaran pada tagihan pesanan.</p>}
              <label className="flex items-center gap-3 text-sm min-h-11"><input type="checkbox" className="h-4 w-4 accent-[var(--primary-ink)]" checked={policyEditing ? customAutoAccept : Boolean(snapshot?.outlet?.autoAcceptParticipant)} onChange={event => { editPolicy(); setCustomAutoAccept(event.target.checked); }} />Terima otomatis pesanan tambahan tamu aktif</label>
              <p className="text-xs text-[var(--muted-foreground)]">Pesanan pertama tetap menunggu konfirmasi staf. Tamu yang sudah diterima dapat menambah pesanan dalam kunjungan yang sama.</p>
              <Button disabled={busy} onClick={async () => { try { await runStaffCommand('SETTINGS_PROMO_FEEDBACK_ACTION', { action: 'UPDATE_OUTLET_POLICY', paymentPolicy: !canCashier && !isModuleEnabled('payments') ? 'PAY_LATER' : policyEditing ? customPaymentPolicy : snapshot?.outlet?.paymentPolicy, takeawayPaymentPolicy: !canCashier && !isModuleEnabled('payments') ? 'PAY_LATER' : policyEditing ? customTakeawayPolicy : snapshot?.outlet?.takeawayPaymentPolicy, autoAcceptParticipant: policyEditing ? customAutoAccept : Boolean(snapshot?.outlet?.autoAcceptParticipant) }); setPolicyEditing(false); setActionNotice('Alur pemesanan disimpan. Pesanan berikutnya mengikuti pengaturan ini.'); } catch { /* Displayed by runStaffCommand. */ } }}>Simpan alur pemesanan</Button>
            </section>}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 6 cols: Tax & Service Charge Config */}
              <section className="lg:col-span-6 space-y-4">
                <div>
                  <h2 className="font-heading text-[17px] font-bold">
                    Pajak &amp; layanan
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
                      label: 'Tanpa pajak & layanan',
                      srv: 0,
                      tax: 0,
                      inc: true,
                    },
                    {
                      label: 'PB1 10%',
                      srv: 0,
                      tax: 10,
                      inc: false,
                    },
                    {
                      label: 'PPN 11%',
                      srv: 0,
                      tax: 11,
                      inc: false,
                    },
                    {
                      label: 'Layanan 5% + PB1 10%',
                      srv: 5,
                      tax: 10,
                      inc: false,
                    },
                    {
                      label: 'Layanan 5% + PPN 11%',
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
                            action: 'UPDATE_OUTLET_POLICY',
                            serviceChargeBps: preset.srv * 100,
                            taxBps: preset.tax * 100,
                            taxInclusiveDisplay: preset.inc,
                          });
                          setActionNotice(`Skema biaya diperbarui: ${preset.label}`);
                        }}
                        className={`w-full py-3 px-2 flex items-center justify-between text-left text-[14px] transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[var(--accent-surface)] font-semibold text-[var(--primary-ink)]'
                            : 'rounded-xl hover:bg-[var(--background)]'
                        }`}
                      >
                        <span>{preset.label}</span>
                        {isCurrent && <Check className="w-4 h-4 text-[var(--primary-ink)]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Percentage Inputs */}
                <div className="pt-2 space-y-3">
                  <p className="text-[13px] font-semibold text-[var(--muted-foreground)]">
                    Tarif kustom
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="custom-srv-pct">Biaya layanan (%)</Label>
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
                        action: 'UPDATE_OUTLET_POLICY',
                        serviceChargeBps: srvBps,
                        taxBps: txBps,
                        taxInclusiveDisplay: customTaxInclusive,
                      });
                      setActionNotice('Pajak & layanan disimpan.');
                    }}
                  >
                    Simpan
                  </Button>
                </div>
              </section>

              {/* Right 6 cols: Promo Rules & Customer Reviews */}
              {canMarketing && <section className="lg:col-span-6 lg:border-l lg:border-[var(--border)] lg:pl-8 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-heading text-[17px] font-bold">
                      Promo
                    </h2>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setNewPromoModalOpen(true)}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah promo</span>
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
                            {pr.code} · {pr.name}
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
                    Ulasan pelanggan terbaru
                  </h2>
                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {(snapshot?.feedbackEntries || []).map((fb: any) => (
                      <div key={fb.id} className="py-3 space-y-1 text-[14px]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{fb.displayName}</span>
                          <StatusLabel label={`Rating ${fb.overallRating}/5`} tone="success" />
                        </div>
                        <p className="text-[var(--muted-foreground)]">{fb.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>}
            </div>
          </div>
        )}</MotionPanel></AnimatePresence>
      </main>

      <DialogModal open={Boolean(rejectingRequest)} onClose={() => { if (!busy) setRejectingRequest(null); }} title="Tolak pesanan">
        {rejectingRequest && <div className="space-y-4"><p className="text-sm">Pesanan {rejectingRequest.customerName} belum akan dibuat. Alasan ini juga terlihat oleh pelanggan.</p><div className="space-y-1.5"><Label htmlFor="order-reject-reason">Alasan penolakan</Label><Textarea id="order-reject-reason" value={rejectReason} maxLength={500} onChange={event => setRejectReason(event.target.value)} placeholder="Contoh: varian yang dipilih baru saja habis" /></div><InlineError message={modalActionError} /><div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setRejectingRequest(null)}>Kembali</Button><Button variant="danger" disabled={busy || rejectReason.trim().length < 3} onClick={async () => { setModalActionError(''); try { await runStaffCommand('REJECT_ORDER_REQUEST', { orderRequestId: rejectingRequest.id, reason: rejectReason.trim() }); setActionNotice(`Pesanan ${rejectingRequest.customerName} ditolak dengan alasan yang tercatat.`); setRejectingRequest(null); } catch (caught) { setModalActionError(caught instanceof Error ? caught.message : 'Pesanan belum ditolak.'); } }}>Konfirmasi penolakan</Button></div></div>}
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 1: BUAT PESANAN BARU OLEH KASIR / PELAYAN                       */}
      {/* ===================================================================== */}
      <DialogModal open={newOrderModalOpen} onClose={() => { if (!busy) setNewOrderModalOpen(false); }} title="Pesanan baru" maxWidth="max-w-5xl">
        {newOrderModalOpen && <PosComposer snapshot={snapshot} busy={busy} actorId={activeStaff} actorName={currentStaffObj.userName} actorRole={currentStaffObj.role} onCommand={onCommand} onComplete={(billId) => { if (billId) setSelectedBillId(billId); setNewOrderModalOpen(false); setActionNotice('Pesanan dibuat. Periksa tagihan dan status pembayarannya.'); }} />}
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 2: BATALKAN / REFUND ITEM TAGIHAN                               */}
      {/* ===================================================================== */}
      <DialogModal
        open={Boolean(cancellingUnit)}
        onClose={() => setCancellingUnit(null)}
        title={cancellingUnit?.fulfillmentStatus === 'CANCELLED' ? 'Selesaikan pengembalian' : 'Batalkan item'}
      >
        {cancellingUnit && (
          <div className="space-y-4">
            <p className="text-[14px] text-[var(--muted-foreground)]">
              {cancellingUnit.fulfillmentStatus === 'CANCELLED' ? 'Selesaikan pengembalian untuk ' : 'Anda akan membatalkan '}
              <strong className="text-[var(--foreground)]">
                1× {cancellingUnit.itemNameSnapshot || cancellingUnit.itemName}
              </strong>{' '}
              dari tagihan ini.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="modal-cancel-reason">{cancellingUnit.fulfillmentStatus === 'CANCELLED' ? 'Alasan pengembalian' : 'Alasan Pembatalan'}</Label>
              <Input
                id="modal-cancel-reason"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
              />
            </div>

            {cancellingUnit.fulfillmentStatus !== 'CANCELLED' && <div className="space-y-1.5">
              <Label htmlFor="modal-restock-choice">Stok</Label>
              <SelectField
                id="modal-restock-choice"
                value={restockChoice}
                onChange={(e) => setRestockChoice(e.target.value as any)}
              >
                <option value="RESTOCK">Kembalikan ke stok (belum dimasak)</option>
                <option value="WASTE">Catat sebagai bahan terbuang</option>
              </SelectField>
            </div>}

            {selectedBill?.verifiedReceiptsIdr > 0 && <div className="space-y-2"><p className="text-sm text-[var(--muted-foreground)]">Koreksi mengurangi tagihan. Kelebihan pembayaran dikembalikan melalui metode pembayaran semula dan dicatat pada struk.</p>{cancellingUnit.fulfillmentStatus !== 'CANCELLED' && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={refundNow} onChange={event => setRefundNow(event.target.checked)} className="mt-1 accent-[var(--primary-ink)]" />Kembalikan kelebihan pembayaran sekarang</label>}{!refundNow && <p className="text-sm text-[var(--status-warning-fg)]">Pengembalian tetap tercatat sebagai kewajiban. Selesaikan sebelum menutup kunjungan.</p>}</div>}
            {selectedBill?.hasActiveExternalAttempt && <p className="text-sm text-[var(--status-warning-fg)]">Selesaikan atau batalkan instruksi pembayaran aktif sebelum membatalkan item.</p>}
            <InlineError message={modalActionError} />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" disabled={busy} onClick={() => setCancellingUnit(null)}>
                Kembali
              </Button>
              <Button
                variant="danger"
                disabled={busy || !cancelReasonInput.trim() || selectedBill?.hasActiveExternalAttempt}
                onClick={async () => {
                  setModalActionError('');
                  try {
                    const response = await runStaffCommand('CANCEL_UNIT_OR_REFUND', {
                      unitId: cancellingUnit.id,
                      reason: cancelReasonInput.trim(),
                      restockChoice,
                      issueRefundNow: refundNow && (selectedBill?.verifiedReceiptsIdr || 0) > 0,
                      approverName: currentStaffObj.userName,
                    });
                    setCancellingUnit(null);
                    setActionNotice(response?.result?.refundId ? 'Item dibatalkan dan pengembalian pembayaran tercatat.' : 'Item dibatalkan dan tagihan telah dikoreksi.');
                  } catch (caught) { setModalActionError(caught instanceof Error ? caught.message : 'Item belum dibatalkan.'); }
                }}
              >
                {cancellingUnit.fulfillmentStatus === 'CANCELLED' ? 'Catat pengembalian' : 'Batalkan item'}
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
        title="Tambah menu"
      >
        <div className="space-y-5">
          {/* Quick Add Category */}
          <div className="pb-4 border-b border-[var(--border)] space-y-2">
            <Label htmlFor="modal-new-cat">Kategori baru</Label>
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
            <p className="font-semibold text-[15px]">Menu baru</p>
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
                <Label>Nama menu</Label>
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
              <Label>Deskripsi singkat</Label>
              <Input
                value={newMenuDesc}
                onChange={(e) => setNewMenuDesc(e.target.value)}
                placeholder="Deskripsi bahan dan penyajian..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Foto Menu ({newMenuPhotos.length} foto)</Label>
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[var(--accent-surface)] text-[var(--primary-ink)] font-semibold text-[12px] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Pilih foto</span>
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
                      className="relative w-12 h-12 rounded-[6px] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)]"
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
              Simpan menu baru
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
                <span>Unggah foto</span>
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
              <Label>URL foto</Label>
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
                    <div className="relative w-full h-16 rounded-[6px] overflow-hidden bg-[var(--surface-muted)]">
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
                          className="text-[11px] font-medium text-[var(--primary-ink)] hover:underline cursor-pointer"
                        >
                          Jadikan foto utama
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-[var(--primary-ink)]">
                          Foto utama
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
                Simpan galeri ({photoDraftList.length} Foto)
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
        title="QR meja"
      >
        <div className="grid grid-cols-2 gap-3">
          {(snapshot?.tables || []).map((t: any) => (
            <div
              key={t.id}
              className="p-3 border border-[var(--border)] rounded-[8px] text-center space-y-1 bg-[var(--background)]"
            >
              <p className="font-heading font-bold text-[15px]">Meja {t.label}</p>
              <p className="text-[12px] text-[var(--muted-foreground)]">{t.areaName}</p>
              <p className="text-[11px] text-[var(--primary-ink)] font-mono truncate">
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
        title="Impor menu"
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
        title="Promo baru"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kode voucher</Label>
              <Input
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nama promo</Label>
              <Input
                value={newPromoName}
                onChange={(e) => setNewPromoName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Minimum belanja (Rp)</Label>
              <Input
                type="number"
                value={newPromoMinSpend}
                onChange={(e) => setNewPromoMinSpend(Number(e.target.value))}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Potongan (Rp)</Label>
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
            Terbitkan voucher
          </Button>
        </div>
      </DialogModal>
    </div>
  );
}
