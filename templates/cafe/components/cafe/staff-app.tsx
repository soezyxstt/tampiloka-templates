'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useCafeLanguage } from '@/lib/language';
import { localizeSampleName } from '@/src/catalog/sample-menu';
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

type Translate = (id: string, en: string) => string;

function formatStationName(code: string, t: Translate): string {
  switch (code) {
    case 'BAR':
      return t('Bar & Kopi', 'Bar & Coffee');
    case 'KITCHEN':
      return t('Dapur Utama', 'Main Kitchen');
    case 'PASTRY':
      return t('Pastry & Roti', 'Pastries & Bread');
    default:
      return code;
  }
}

function formatFulfillmentLabel(status: string, t: Translate): {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral';
} {
  switch (status) {
    case 'DELIVERED':
    case 'PICKED_UP':
    case 'SERVED':
      return { label: t('Disajikan', 'Served'), tone: 'success' };
    case 'READY':
      return { label: t('Siap Diantar', 'Ready to serve'), tone: 'info' };
    case 'PREPARING':
      return { label: t('Sedang Dibuat', 'Preparing'), tone: 'warning' };
    case 'QUEUED':
      return { label: t('Antrean Baru', 'New in queue'), tone: 'neutral' };
    case 'CANCELLED':
      return { label: t('Dibatalkan', 'Cancelled'), tone: 'danger' };
    default:
      return { label: t("Menunggu", "Waiting"), tone: 'warning' };
  }
}

function formatPaymentStateLabel(state: string, t: Translate): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
} {
  switch (state) {
    case 'SETTLED':
      return { label: t("Lunas", "Paid"), tone: 'success' };
    case 'PARTIALLY_PAID':
      return { label: t('Dibayar Sebagian', 'Partially paid'), tone: 'info' };
    case 'REFUND_DUE':
      return { label: t('Perlu Refund', 'Refund due'), tone: 'danger' };
    default:
      return { label: t('Belum Dibayar', 'Unpaid'), tone: 'warning' };
  }
}

function formatOutletChargePolicy(outlet: any, t: Translate): string {
  const srvPct = ((outlet?.serviceChargeBps ?? 500) / 100).toFixed(0);
  const taxPct = ((outlet?.taxBps ?? 1000) / 100).toFixed(0);
  const inclusive = Boolean(outlet?.taxInclusiveDisplay);

  if (Number(srvPct) === 0 && Number(taxPct) === 0) {
    return t('Harga Nett (Tanpa Pajak & Biaya Layanan Tambahan)', 'Net price (no additional tax or service charge)');
  }
  if (inclusive) {
    return t(`Harga Sudah Termasuk Pajak ${taxPct}%${Number(srvPct) > 0 ? ` & Layanan ${srvPct}%` : ''}`, `Price includes ${taxPct}% tax${Number(srvPct) > 0 ? ` & ${srvPct}% service charge` : ''}`);
  }
  if (Number(srvPct) > 0 && Number(taxPct) > 0) {
    return t(`Layanan ${srvPct}% + Pajak ${taxPct}%`, `Service ${srvPct}% + tax ${taxPct}%`);
  }
  if (Number(taxPct) > 0) {
    return t(`Pajak Restoran ${taxPct}%`, `Restaurant tax ${taxPct}%`);
  }
  return t(`Biaya Layanan ${srvPct}%`, `Service charge ${srvPct}%`);
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
  const { t, language } = useCafeLanguage();
  const sampleName = (id: string, name: string) => localizeSampleName(id, name, language, Boolean(snapshot?.runtime?.demo));
  const staffRoleLabel = (id: string, fallback: string) => {
    const labels: Record<string, [string, string]> = {
      staff_owner: ['Pemilik Outlet', 'Outlet owner'],
      staff_manager: ['Manajer Operasional', 'Operations manager'],
      staff_cashier: ['Kasir Utama', 'Cashier'],
      staff_waiter: ['Pelayan Lantai', 'Floor staff'],
      staff_bar: ['Barista & Minuman', 'Barista & beverages'],
      staff_kitchen: ['Koki Dapur Utama', 'Head chef'],
    };
    const label = labels[id];
    return label ? t(label[0], label[1]) : fallback;
  };
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
    '/images/menu/photos/kopi-aren.jpg',
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
      setActionError(err.message || t("Gagal menjalankan perintah.", "Unable to complete the action."));
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
    setActionNotice(t(`Laporan tagihan ${reportDate} berhasil diunduh.`, `Bill report for ${reportDate} downloaded.`));
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
      setLoginError(t("PIN Staf tidak sesuai. Gunakan PIN staf Anda.", "Incorrect staff PIN. Enter your staff PIN."));
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
                  {t("Ruang operasional", "Operations workspace")}
                </h1>
                <p className="text-[12px] text-[var(--muted-foreground)]">
                  {cafeConfig.brand.name}
                </p>
              </div>
            </div>
            {onBackToCustomer && (
              <Button variant="ghost" size="sm" onClick={onBackToCustomer}>
                <ArrowLeft className="w-4 h-4" />
                <span>{t("Menu pelanggan", "Customer menu")}</span>
              </Button>
            )}
          </div>

          <form onSubmit={handleStaffLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-login-select">{t("Pilih akun staf", "Select staff account")}</Label>
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
                    {s.userName} · {staffRoleLabel(s.id, s.role)}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-pin-input">{t("PIN staf (4 digit)", "Staff PIN (4 digits)")}</Label>
              <Input
                id="staff-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder={t("Masukkan PIN", "Enter PIN")}
                className="text-[16px] tracking-widest tabular-nums"
              />
            </div>

            {/* Quick Role Login Presets */}
            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <p className="text-[12px] text-[var(--muted-foreground)]">
                {t("Akses demo", "Demo access")}
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
                        {staffRoleLabel(s.id, s.role)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <InlineError message={loginError} />

            <Button type="submit" variant="primary" size="lg" className="w-full">
              {t("Masuk", "Sign in")}
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
      label: canCashier ? t('Kasir & Pesanan', 'Cashier & orders') : t('Pesanan masuk', 'Incoming orders'),
      count:
        pendingOrderRequests.length +
        activeBills.filter((b: any) => b.balanceIdr > 0).length,
    },
    {
      id: 'dapur',
      label: t('Dapur & Bar', 'Kitchen & bar'),
      count: (snapshot?.orderUnits || []).filter((u: any) =>
        ['QUEUED', 'PREPARING', 'READY'].includes(u.fulfillmentStatus)
      ).length,
    },
    {
      id: 'meja',
      label: t('Meja & Antrean', 'Tables & waitlist'),
      count: openWaitlistCount + openHelpCount,
    },
    { id: 'menu', label: t('Katalog & Stok', 'Catalogue & stock') },
    { id: 'laporan', label: t('Laporan & Shift', 'Reports & shifts') },
    { id: 'pengaturan', label: t('Pengaturan', 'Settings') },
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
        <p className={styles.sidebarLabel}>{t("Operasional", "Operations")}</p>
        <nav aria-label={t("Navigasi operasional desktop", "Desktop operations navigation")} className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = ({ kasir: Wallet, dapur: ChefHat, meja: LayoutGrid, menu: Coffee, laporan: ClipboardList, pengaturan: Settings2 })[item.id];
            return <button key={item.id} type="button" aria-current={activeSection === item.id ? 'page' : undefined} onClick={() => { setActiveSection(item.id); setActionNotice(''); setActionError(''); }} className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-colors ${activeSection === item.id ? 'bg-[var(--accent-surface)] text-[var(--primary-ink)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]'}`}>
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{item.label}</span>{Boolean(item.count) && <span className="rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[12px] tabular-nums">{item.count}</span>}
            </button>;
          })}
        </nav>
        <div className="mt-auto space-y-4 pt-6">

          {onBackToCustomer && <button type="button" onClick={onBackToCustomer} className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--primary-ink)]">{t("Lihat menu pelanggan", "View customer menu")}<ArrowUpRight className="h-4 w-4" /></button>}
        </div>
      </aside>
      <header className="staff-header">
        <div className="staff-toolbar">
          <div className="staff-identity">
            {onBackToCustomer && <Button variant="ghost" size="icon" onClick={onBackToCustomer} aria-label={t("Kembali ke menu pelanggan", "Back to customer menu")} className="xl:hidden"><ArrowLeft className="h-4 w-4" /></Button>}
            <div><p className="text-sm font-semibold">{cafeConfig.brand.name}</p><p id="active-staff-role" className="text-xs text-[var(--muted-foreground)]">{staffRoleLabel(activeStaff, currentStaffObj.role)}</p></div>
          </div>
          <SelectField aria-label={t("Petugas aktif", "Active staff member")} aria-describedby="active-staff-role" value={activeStaff} onChange={(e) => handleSwitchStaff(e.target.value)} wrapperClassName="staff-account">
            {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.userName}</option>)}
          </SelectField>
          <div className="staff-actions">
            {lastUpdated && <span className={styles.syncText}>{lastUpdated}</span>}
            <Button variant="ghost" size="icon" title={lastUpdated} disabled={busy || !onRefresh} onClick={onRefresh} aria-label={t("Perbarui data operasional", "Refresh operational data")}><RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button>
            <Button variant="ghost" size="icon" onClick={() => setIsAuthenticated(false)} aria-label={t("Keluar dari portal staf", "Sign out of staff portal")}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="staff-mobile-nav"><AnimatedUnderlineTabs items={navItems} activeId={activeSection} onSelect={(id) => { setActiveSection(id); setActionNotice(''); setActionError(''); }} ariaLabel={t('Navigasi operasional kafe', 'Cafe operations navigation')} layoutId="staff-pos-nav-underline" className="border-b-0" /></div>
      </header>
      <a href="#staff-content" className="skip-link">{t("Ke ruang kerja", "Open workspace")}</a>
      <main id="staff-content" className="staff-main">
        <PageHeader title={navItems.find(item => item.id === activeSection)?.label || t('Operasional', 'Operations')} actions={canCashier && activeSection === 'kasir' ? <Button variant="primary" onClick={() => setNewOrderModalOpen(true)}><Plus className="h-4 w-4" />{t("Pesanan baru", "New orders")}</Button> : undefined} />
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
              { id:'new', label:t("Pesanan baru", "New orders"), value:pendingOrderRequests.length, icon:Receipt, onSelect:()=>document.getElementById('incoming-orders')?.scrollIntoView({ behavior:'smooth', block:'center' }) },
              ...(canTables ? [{ id:'tables', label:t("Meja terisi", "Occupied tables"), value:(snapshot?.tables || []).filter((t:any)=>t.physicalState==='OCCUPIED').length, icon:LayoutGrid, onSelect:()=>{setActiveSection('meja');setFloorSubTab('DENAH');} }] : []),
              ...(canKitchen ? [{ id:'preparing', label:t("Dalam proses", "In progress"), value:(snapshot?.orderUnits || []).filter((u:any)=>['QUEUED','PREPARING'].includes(u.fulfillmentStatus)).length, icon:ChefHat, onSelect:()=>{setActiveSection('dapur');setKitchenStatusFilter('ACTIVE');} }] : []),
              ...(canTables ? [{ id:'help', label:t("Panggilan tamu", "Guest requests"), value:openHelpCount, icon:Bell, onSelect:()=>{setActiveSection('meja');setFloorSubTab('ANTREAN');} }] : []),
            ]} />

            {canCashier && <ShiftControls snapshot={snapshot} busy={busy} onCommand={runStaffCommand} />}

            {/* Incoming Customer QR Order Requests (If any) */}
            {pendingOrderRequests.length > 0 && (
              <Surface id="incoming-orders" variant="ruled" className="space-y-3 scroll-mt-28">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-warning-fg)] animate-pulse" />
                    <h2 className="font-heading text-[17px] font-bold">
                      {t("Pesanan baru (", "New orders (")}{pendingOrderRequests.length})
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
                              {t("Meja", "Table")} {req.tableLabel} · {req.customerName}
                            </span>
                            <StatusLabel label={t("Menunggu", "Waiting")} tone="warning" />
                          </div>
                          <div className="text-[13px] text-[var(--muted-foreground)] space-y-0.5">
                            {lines.map((ln: any, idx: number) => (
                              <p key={idx}>
                                <strong className="text-[var(--foreground)]">
                                  {ln.quantity ?? ln.qty ?? 1}×
                                </strong>{' '}
                                {sampleName(ln.menuItemId, ln.itemName)} ({sampleName(ln.variantId, ln.variantName)})
                                {ln.modifiers?.length ? ` · ${ln.modifiers.join(', ')}` : ''}
                                {ln.note ? t(` · Catatan: "${ln.note}"`, ` · Note: "${ln.note}"`) : ''}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 min-w-0">
                          <div className="text-right mr-2">
                            <span className="block text-[12px] text-[var(--muted-foreground)]">
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
                                t(`Pesanan Meja ${req.tableLabel} diterima.`, `Order for table ${req.tableLabel} accepted.`)
                              );
                            }}
                          >
                            <Check className="w-4 h-4" />
                            <span>{t("Terima", "Accept")}</span>
                          </Button>

                          <Button
                            variant="danger"
                            size="sm"
                            disabled={busy}
                            onClick={() => { setRejectingRequest(req); setRejectReason(''); setModalActionError(''); }}
                          >
                            <X className="w-4 h-4" />
                            <span>{t("Tolak", "Reject")}</span>
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
                    {t("Tagihan", "Bill")}
                  </h2>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setNewOrderModalOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t("Pesanan baru", "New orders")}</span>
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-[var(--muted-foreground)]" /><Input aria-label={t("Cari tagihan berdasarkan meja atau pelanggan", "Search bills by table or customer")} placeholder={t("Cari meja atau pelanggan…", "Search table or customer…")} value={billSearch} onChange={(e) => setBillSearch(e.target.value)} className="pl-9" /></div>
                  <AnimatedSegmentedControl ariaLabel={t('Filter pembayaran tagihan', 'Filter bills by payment status')} options={[{ value: 'OPEN', label: t("Belum lunas", "Unpaid") }, { value: 'PAID', label: t("Lunas", "Paid") }, { value: 'ALL', label: t("Semua", "All") }]} value={billFilter} onChange={(value) => setBillFilter(value as typeof billFilter)} layoutId="staff-bill-filter" />
                </div>
                {filteredBills.length === 0 && <EmptyState title={t("Tidak ada tagihan", "No bills")} description={billSearch ? t("Coba nama pelanggan atau nomor meja lain.", "Try another customer name or table number.") : t("Tagihan yang sesuai akan tampil di sini.", "Matching bills will appear here.")} />}
                <div className="space-y-2">
                  {filteredBills.map((b: any) => {
                    const isSel = b.id === selectedBill?.id;
                    const payBadge = formatPaymentStateLabel(b.paymentState, t);
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
                          <p className="font-heading font-semibold text-[15px] text-[var(--foreground)]">{b.tableLabel ? t(`Meja ${b.tableLabel}`, `Table ${b.tableLabel}`) : t("Bawa pulang", "Takeaway")}</p>
                          <p className="text-sm break-words">{b.ownerLabel}</p>
                          <p className="text-[12px] text-[var(--muted-foreground)] tabular-nums">
                            {(b.allocatedUnits || []).length} {t("porsi menu", "menu servings")}
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
                            {t("Meja", "Table")} {selectedBill.tableLabel} · {selectedBill.ownerLabel}
                          </h2>
                          <StatusLabel
                            label={formatPaymentStateLabel(selectedBill.paymentState, t).label}
                            tone={formatPaymentStateLabel(selectedBill.paymentState, t).tone}
                          />
                        </div>
                        <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5">
                          {(selectedBill.allocatedUnits || []).length} {t("item tercatat pada tagihan ini", "items recorded on this bill")}
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
                              ? t("Tutup Pisah/Gabung", "Close split / merge")
                              : t("Pisah / Gabung Tagihan", "Split / merge bill")}
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
                                {t("Pisah item terpilih (", "Split selected items (")}{selectedUnitIdsForSplit.length} {t('item dicentang di bawah)', 'items selected below)')}
                              </Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={splitNewOwnerLabel}
                                  onChange={(e) => setSplitNewOwnerLabel(e.target.value)}
                                  placeholder={t("Nama tagihan baru", "New bill name")}
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
                                    setActionNotice(t("Tagihan berhasil dipisahkan.", "The bill was split."));
                                  }}
                                >
                                  <Split className="w-4 h-4" />
                                  <span>{t("Pisahkan", "Split")}</span>
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>{t("Gabung ke tagihan meja lain", "Merge into another table bill")}</Label>
                              <div className="flex items-center gap-2">
                                <SelectField
                                  aria-label={t("Tagihan tujuan penggabungan", "Destination bill")}
                                  value={mergeTargetBillId}
                                  onChange={(e) => setMergeTargetBillId(e.target.value)}
                                >
                                  <option value="">{t("Pilih tagihan tujuan", "Choose destination bill")}</option>
                                  {activeBills
                                    .filter(
                                      (b: any) =>
                                        b.id !== selectedBill.id && b.lifecycle === 'OPEN' && b.visitId === selectedBill.visitId && b.paymentPolicy === selectedBill.paymentPolicy && !b.hasActiveExternalAttempt && !b.verifiedReceiptsIdr && !(b.adjustments || []).length
                                    )
                                    .map((b: any) => (
                                      <option key={b.id} value={b.id}>
                                        {t("Meja", "Table")} {b.tableLabel} · {b.ownerLabel} (
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
                                    setActionNotice(t("Tagihan berhasil digabungkan.", "The bills were merged."));
                                  }}
                                >
                                  <Merge className="w-4 h-4" />
                                  <span>{t("Gabung", "Merge")}</span>
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
                          const st = formatFulfillmentLabel(u.fulfillmentStatus, t);
                          const itemName = sampleName(u.menuItemId, u.itemNameSnapshot || u.itemName);
                          const variantName = sampleName(u.variantId, u.variantNameSnapshot || u.variantName);
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
                                    onClick={() => { setCancellingUnit(u); setRefundNow(true); setModalActionError(''); setCancelReasonInput(isCancelled ? t("Pengembalian pembayaran setelah pembatalan", "Refund after cancellation") : t("Permintaan pelanggan / ubah pesanan", "Customer request / change order")); }}
                                    className="text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--status-danger-fg)] transition-colors cursor-pointer px-1.5 py-1"
                                  >
                                    {isCancelled ? t("Selesaikan pengembalian", "Complete refund") : t("Batalkan", "Cancel")}
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
                              <Label>{t("Pembayaran", "Payment")}</Label>
                              <AnimatedSegmentedControl
                                ariaLabel={t("Metode pembayaran kasir", "Cashier payment method")}
                                options={[
                                  { value: 'CASH', label: t("Tunai", "Cash") },
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
                                  {t("Jumlah bayar (Rp)", "Amount to pay (Rp)")}
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
                                    {t("Tunai diterima (Rp)", "Cash received (Rp)")}
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
                                    {t("Referensi (opsional)", "Reference (optional)")}
                                  </Label>
                                  <Input
                                    id="cashier-ref-code"
                                    value={transferRefInput}
                                    onChange={(e) => setTransferRefInput(e.target.value)}
                                    placeholder={t("Ref QRIS / Bukti Transfer", "QRIS reference / transfer proof")}
                                  />
                                </div>
                              )}
                            </div>

                            {tenderMethod === 'CASH' && (
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {[
                                    {
                                      label: t("Uang Pas", "Exact amount"),
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
                                  <span className="text-[var(--muted-foreground)]">{t("Kembalian:", "Change:")} </span>
                                  <Money
                                    amount={cashChangePreview}
                                    className="font-bold text-[var(--primary-ink)]"
                                  />
                                </div>
                              </div>
                            )}

                            {selectedBill.hasActiveExternalAttempt && <p role="status" className="text-sm text-[var(--status-warning-fg)]">{t("Instruksi pembayaran masih aktif. Konfirmasikan hasilnya atau batalkan melalui Uji pembayaran demo sebelum mencatat pembayaran lain.", "Payment instructions are still active. Confirm the result or cancel them in the demo payment test before recording another payment.")}</p>}
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
                                  setActionNotice(external ? t("Instruksi pembayaran demo dibuat. Pembayaran masih menunggu konfirmasi.", "Demo payment instructions created. Payment is awaiting confirmation.") : t(`Pembayaran ${tenderMethod === 'CASH' ? 'tunai' : 'transfer'} sebesar ${formatIdr(amt)} berhasil dicatat.${(res?.result?.changeIdr ?? 0) > 0 ? ` Kembalian: ${formatIdr(res.result.changeIdr)}` : ''}`, `${tenderMethod === 'CASH' ? 'Cash' : 'Transfer'} payment of ${formatIdr(amt)} recorded.${(res?.result?.changeIdr ?? 0) > 0 ? ` Change: ${formatIdr(res.result.changeIdr)}` : ''}`));
                                  setTenderAmountInput(''); setCashGivenInput(''); setTransferRefInput(''); paymentAttemptRef.current = null;
                                } catch { /* runStaffCommand displays the server's error. Keep the retry key. */ }
                                finally { paymentSubmittingRef.current = false; setPaymentSubmitting(false); }
                              }}
                            >
                              <Receipt className="w-4 h-4" />
                              <span className="whitespace-normal leading-snug"><span className="block">{tenderMethod === 'CASH' ? t("Terima tunai", "Accept cash") : tenderMethod === 'MANUAL_TRANSFER' ? t("Catat transfer", "Record transfer") : t("Buat instruksi demo", "Create demo instructions")}</span><Money amount={effectiveTenderAmount} className="block" /></span>
                            </Button>
                          </>
                        ) : (
                          <div className="p-4 rounded-[10px] bg-[var(--status-success-bg)] text-[var(--status-success-fg)] flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-[15px]">{selectedBill.balanceIdr < 0 ? t(`Perlu pengembalian ${formatIdr(-selectedBill.balanceIdr)}`, `Refund due ${formatIdr(-selectedBill.balanceIdr)}`) : t("Lunas", "Paid")}</p>

                            </div>
                            <Check className="w-5 h-5 shrink-0" />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState title={t("Pilih tagihan", "Select a bill")} />
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
                  ariaLabel={t('Filter stasiun kerja', 'Filter work station')}
                  options={[
                    { value: 'ALL', label: t('Semua Stasiun', 'All stations') },
                    { value: 'BAR', label: t('Bar & Kopi', 'Bar & Coffee') },
                    { value: 'KITCHEN', label: t("Dapur Utama", "Main Kitchen") },
                    { value: 'PASTRY', label: t('Pastry & Roti', 'Pastries & Bread') },
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
                <span>{soundEnabled ? t('Suara aktif', 'Sound on') : t('Suara Mati', 'Sound off')}</span>
              </Button>
            </div>

            <ChoiceStrip ariaLabel={t('Status pesanan dapur', 'Kitchen order status')} items={[['ACTIVE',t('Semua aktif','All active')],['QUEUED',t('Antrean baru','New in queue')],['PREPARING',t('Sedang dibuat','Preparing')],['READY',t('Siap diantar','Ready to serve')],['ALL',t('Termasuk selesai','Including completed')]].map(([id,label])=>({id,label}))} value={kitchenStatusFilter} onChange={setKitchenStatusFilter} variant="underline" />
            {kitchenUnits.length === 0 ? (
              <EmptyState title={t("Tidak ada pesanan", "No orders")} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {kitchenUnits.map((u: any) => {
                  const st = formatFulfillmentLabel(u.fulfillmentStatus, t);
                  const itemName = sampleName(u.menuItemId, u.itemNameSnapshot || u.itemName);
                  const variantName = sampleName(u.variantId, u.variantNameSnapshot || u.variantName);
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
                            {t("Meja", "Table")} {tableLabel}
                          </span>
                          <span className="text-[13px] text-[var(--muted-foreground)]">
                            · {customerName}
                          </span>
                          <span className="text-[12px] font-medium px-2 py-0.5 rounded-[6px] bg-[var(--accent-surface)] text-[var(--primary-ink)]">
                            {formatStationName(u.stationCode, t)}
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
                            {t("Opsi:", "Options:")} {u.modifiersSummary}
                          </p>
                        )}
                        {u.note && (
                          <p className="text-[13px] font-medium text-[var(--status-warning-fg)] bg-[var(--status-warning-bg)] rounded-lg p-3 mt-3">
                            {t('Catatan:', 'Note:')} &ldquo;{u.note}&rdquo;
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
                            {t("Mulai siapkan", "Start preparing")}
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
                            {t("Siap diantar", "Ready to serve")}
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
                            <span>{takeaway ? t("Sudah diambil", "Picked up") : t("Disajikan", "Served")}</span>
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
                ariaLabel={t('Sub-menu operasional lantai', 'Floor operations menu')}
                options={[
                  { value: 'DENAH', label: t('Denah & Kunjungan Meja', 'Floor plan & visits') },
                  {
                    value: 'ANTREAN',
                    label: t(`Panggilan & Antrean (${openWaitlistCount + openHelpCount})`, `Requests & waitlist (${openWaitlistCount + openHelpCount})`),
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
                      {t("Bantuan meja", "Table assistance")}
                    </h2>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><input type="checkbox" checked={showResolvedRequests} onChange={(e) => setShowResolvedRequests(e.target.checked)} className="accent-[var(--primary-ink)]" />{t("Tampilkan permintaan selesai", "Show completed requests")}</label>
                  {!(snapshot?.serviceRequests || []).some((sr: any) => showResolvedRequests || sr.state !== 'RESOLVED') && <EmptyState title={t("Semua tamu terlayani", "All guests assisted")} />}
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
                              {t("Meja", "Table")} {sr.tableLabel} · {sr.customerName}
                            </span>
                            <StatusLabel
                              label={
                                sr.state === 'RESOLVED'
                                  ? t("Selesai", "Done")
                                  : sr.state === 'ACKNOWLEDGED'
                                  ? t("Sedang Ditangani", "In progress")
                                  : t("Menunggu Staf", "Waiting for staff")
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
                          <p className="text-sm font-medium text-[var(--primary-ink)]">{({ CALL_STAFF: t('Panggil staf', 'Call staff'), CALL_WAITER: t('Panggil pelayan', 'Call waiter'), ASK_BILL: t('Minta tagihan', 'Request bill'), REQUEST_BILL: t('Minta tagihan', 'Request bill'), EXTRA_CUTLERY: t('Alat makan', 'Cutlery'), CUTLERY_NAPKIN: t('Alat makan', 'Cutlery'), CLEAR_TABLE: t('Bersihkan meja', 'Clean table'), PACK_LEFTOVER: t('Bungkus makanan', 'Pack food'), ISSUE_REPORT: t('Laporan kendala', 'Report an issue'), ORDER_ISSUE: t('Kendala pesanan', 'Order issue') } as Record<string, string>)[sr.requestType || sr.type] || t('Bantuan pelanggan', 'Customer assistance')}</p>
                          {sr.notes && (
                            <p className="text-[13px] text-[var(--muted-foreground)]">
                              {t("Permintaan:", "Request:")} {sr.notes}
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
                                {t("Tangani", "Handle")}
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
                              {t("Selesai", "Done")}
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
                      {t("Antrean meja", "Table waitlist")}
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
                                  ? t("Sudah Duduk", "Seated")
                                  : w.status === 'CALLED'
                                  ? t("Dipanggil", "Called")
                                  : t("Menunggu", "Waiting")
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
                            {w.partySize} {t("orang · Area", "guests · Area")} {w.preferredArea}
                            {w.heldTableLabel ? ` · Ditahan di Meja ${w.heldTableLabel}` : ''}
                          </p>
                        </div>

                        {['WAITING', 'CALLED'].includes(w.status) && (
                          <div className="flex flex-wrap items-center gap-2">
                            <SelectField aria-label={t(`Meja untuk ${w.customerName}`, `Table for ${w.customerName}`)} value={waitlistTables[w.id] || w.heldTableId || ''} onChange={event => setWaitlistTables(current => ({ ...current, [w.id]: event.target.value }))} wrapperClassName="w-[180px]">
                              <option value="">{t("Pilih meja tersedia", "Choose an available table")}</option>
                              {(snapshot?.tables || []).filter((table: any) => table.active && table.capacity >= w.partySize && table.physicalState === 'AVAILABLE' && !(snapshot?.waitlistEntries || []).some((other: any) => other.id !== w.id && other.status === 'CALLED' && other.heldTableId === table.id && Date.parse(other.holdExpiresAt) > Date.parse(snapshot.serverTime))).map((table: any) => <option key={table.id} value={table.id}>{table.label} · {table.capacity} {t("kursi", "seats")}</option>)}
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
                                {t("Panggil tamu", "Call guest")}
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
                              {t("Tempatkan di meja", "Seat at table")}
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
                  <span>{t("Cetak QR meja", "Print table QR codes")}</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCsvModal(true)}
                >
                  <Upload className="w-4 h-4" />
                  <span>{t("Impor CSV", "Import CSV")}</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setAddMenuModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  <span>{t("Tambah menu", "Add menu item")}</span>
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
                  placeholder={t("Cari nama menu atau kode...", "Search menu name or code...")}
                  className="pl-10"
                />
              </div>
              <div className="sm:col-span-5">
                <SelectField
                  aria-label={t("Filter kategori katalog", "Filter catalogue categories")}
                  value={menuCategoryFilter}
                  onChange={(e) => setMenuCategoryFilter(e.target.value)}
                >
                  <option value="ALL">
                    {t("Semua kategori (", "All categories (")}{(snapshot?.categories || []).length})
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
                        <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded-[4px] bg-[var(--foreground)]/75 text-white text-[12px] font-semibold tabular-nums">
                          {itemPhotos.length} {t("foto", "photos")}
                        </span>
                      </button>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="font-heading font-semibold text-[16px] truncate">
                            {item.name}
                          </p>
                          <StatusLabel
                            label={item.manualSoldOut ? t("Habis", "Sold out") : t("Tersedia", "Available")}
                            tone={item.manualSoldOut ? 'danger' : 'success'}
                          />
                        </div>
                        <p className="text-[13px] text-[var(--muted-foreground)] tabular-nums">
                          {formatStationName(item.stationCode, t)} {t("· Mulai", "· Starting at")}{' '}
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
                        <span>{t("Foto (", "Photos (")}{itemPhotos.length})</span>
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
                        {item.manualSoldOut ? t("Aktifkan Kembali", "Reactivate") : t("Tandai Habis", "Mark sold out")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Finite Stock Pools Section (Clean Hairline List) */}
            <section className="pt-4 space-y-3">
              <h2 className="font-heading text-[17px] font-bold">
                {t("Batas stok harian", "Daily stock limit")}
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
                          {t("Tersedia dijual:", "Available to sell:")} <strong>{p.availableToSell} {t("porsi", "servings")}</strong> {t("(Fisik:", "(Physical:")}{' '}
                          {p.onHand} {t("· Dipesan:", "· Reserved:")} {p.reserved})
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
                          aria-label={t(`Ubah jumlah stok ${p.name}`, `Change stock quantity for ${p.name}`)}
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
                            setActionNotice(t(`Stok ${p.name} berhasil diperbarui.`, `Stock for ${p.name} updated.`));
                          }}
                        >
                          {t("Perbarui stok", "Update stock")}
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
              <div className="flex flex-wrap items-end gap-2"><div className="space-y-1"><Label htmlFor="report-date">{t("Tanggal tagihan", "Bill date")}</Label><Input id="report-date" type="date" value={reportDate} onChange={event => { if (event.target.value) setReportDate(event.target.value); }} /></div><Button variant="secondary" size="sm" onClick={() => setReportDate(todayReportDate)}>{t("Hari ini", "Today")}</Button></div>
              <Button variant="secondary" size="sm" disabled={!reportBills.length} onClick={handleExportReportCsv}><Download className="w-4 h-4" />{t("Unduh CSV", "Download CSV")}</Button>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]"><p className="text-sm text-[var(--muted-foreground)]">{t("Tagihan", "Bills")}</p><p className="font-heading text-3xl font-semibold mt-2 tabular-nums">{reportBills.length}</p></div>
              <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]"><p className="text-sm text-[var(--muted-foreground)]">{t("Nilai tagihan", "Billed amount")}</p><Money amount={reportTotals.billed} className="block font-heading text-xl lg:text-2xl font-semibold mt-2" /></div>
              <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]"><p className="text-sm text-[var(--muted-foreground)]">{t("Diterima bersih", "Net receipts")}</p><Money amount={reportTotals.received - reportTotals.refunded} className="block font-heading text-xl lg:text-2xl font-semibold mt-2 text-[var(--primary-ink)]" /></div>
              <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]"><p className="text-sm text-[var(--muted-foreground)]">{t("Belum dibayar", "Unpaid")}</p><Money amount={reportTotals.outstanding} className="block font-heading text-xl lg:text-2xl font-semibold mt-2" /></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="space-y-3"><h2 className="font-heading text-lg font-semibold">{t("Rincian tagihan", "Bill details")}</h2><dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
                {[[t('Harga menu', 'Menu price'), reportTotals.subtotal], [t('Potongan', 'Discount'), -reportTotals.discount], [t('Biaya layanan', 'Service charge'), reportTotals.service], [t('Pajak', 'Tax'), reportTotals.tax], [t('Koreksi tagihan', 'Bill adjustment'), reportTotals.corrections], [t('Nilai tagihan setelah koreksi', 'Bill after adjustment'), reportTotals.billed]].map(([label, amount]) => <div key={label} className="py-3 flex justify-between gap-3"><dt>{label}</dt><dd><Money amount={Number(amount)} /></dd></div>)}
              </dl></section>
              <section className="space-y-3"><h2 className="font-heading text-lg font-semibold">{t("Pembayaran", "Payment")}</h2><dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm"><div className="py-3 flex justify-between gap-3"><dt>{t("Pembayaran diterima", "Payments received")}</dt><dd><Money amount={reportTotals.received} /></dd></div><div className="py-3 flex justify-between gap-3"><dt>{t("Uang dikembalikan", "Refunds")}</dt><dd><Money amount={-reportTotals.refunded} /></dd></div><div className="py-3 flex justify-between gap-3 font-semibold"><dt>{t("Penerimaan bersih", "Net receipts")}</dt><dd><Money amount={reportTotals.received - reportTotals.refunded} /></dd></div></dl><p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("Cakupan: tagihan pada tanggal yang dipilih. Penerimaan menghitung pembayaran dan pengembalian untuk tagihan tersebut. Tagihan batal tidak dihitung. Biaya bahan, gaji, dan laba belum tercakup.", "Scope: bills on the selected date. Receipts include payments and refunds for those bills. Cancelled bills are excluded. Ingredient costs, wages and profit are not included.")}</p></section>
            </div>
            <section className="space-y-3"><h2 className="font-heading text-lg font-semibold">{t("Daftar tagihan", "Bills")}</h2>{!reportBills.length ? <EmptyState title={t("Belum ada tagihan", "No bills yet")} description={t("Pilih tanggal lain atau buat pesanan untuk melihat laporan.", "Select another date or create an order to view reports.")} /> : <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--border)]" role="region" aria-label={t("Daftar tagihan tanggal terpilih", "Bills for selected date")} tabIndex={0}><table className="w-full min-w-[620px] text-sm text-left"><thead className="bg-[var(--background)]"><tr>{[t('Pemesan / meja','Customer / table'), 'Status', t('Nilai tagihan','Billed amount'), t('Diterima bersih','Net receipts'), t('Sisa','Remaining')].map(heading => <th key={heading} scope="col" className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border)]">{reportBills.map((bill: any) => <tr key={bill.id}><th scope="row" className="px-4 py-3 font-normal"><span className="block font-medium">{bill.ownerLabel}</span><span className="text-xs text-[var(--muted-foreground)]">{bill.tableLabel}</span></th><td className="px-4 py-3">{formatPaymentStateLabel(bill.paymentState, t).label}</td><td className="px-4 py-3"><Money amount={Math.max(0, Number(bill.originalTotalIdr || 0) + Number(bill.debitAdjustmentsIdr || 0) - Number(bill.creditAdjustmentsIdr || 0))} /></td><td className="px-4 py-3"><Money amount={Number(bill.verifiedReceiptsIdr || 0) - Number(bill.refundedIdr || 0)} /></td><td className="px-4 py-3"><Money amount={bill.balanceIdr} /></td></tr>)}</tbody></table></div>}</section>
            <section className="space-y-3"><h2 className="font-heading text-lg font-semibold">{t("Catatan shift kasir", "Cashier shift notes")}</h2>{!reportShifts.length ? <p className="text-sm text-[var(--muted-foreground)]">{t("Tidak ada shift pada tanggal ini.", "No shifts on this date.")}</p> : <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{reportShifts.map((shift: any) => <div key={shift.id} className="py-4 flex flex-wrap justify-between gap-4"><div><p className="text-sm font-semibold">{shift.drawerName}</p><p className="text-xs text-[var(--muted-foreground)] mt-1">{shift.operatorName} · {shift.state === 'OPEN' ? t("Terbuka", "Open") : t("Ditutup", "Closed")}</p></div><dl className="flex flex-wrap gap-5 text-sm"><div><dt className="text-xs text-[var(--muted-foreground)]">{t("Perkiraan laci", "Expected cash")}</dt><dd className="mt-1"><Money amount={shift.expectedCashIdr} /></dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">{t("Uang terhitung", "Counted cash")}</dt><dd className="mt-1">{shift.countedCashIdr == null ? t("Belum ditutup", "Not closed") : <Money amount={shift.countedCashIdr} />}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">{t("Selisih", "Difference")}</dt><dd className="mt-1">{shift.varianceIdr == null ? t("Belum ditutup", "Not closed") : <Money amount={shift.varianceIdr} signed />}</dd></div></dl></div>)}</div>}</section>
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


            {(canCashier || isModuleEnabled('ordering')) && <section aria-label={t("Alur pemesanan", "Ordering flow")} className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
              <div><h2 className="font-heading text-lg font-semibold">{t("Alur pemesanan", "Ordering flow")}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{t("Berlaku untuk pesanan yang diterima setelah pengaturan disimpan. Pesanan yang sudah diterima tetap memakai aturan semula.", "Applies to orders accepted after saving. Previously accepted orders keep their original rules.")}</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label htmlFor="dine-payment-policy">{t("Pembayaran makan di tempat", "Dine-in payment")}</Label><SelectField id="dine-payment-policy" value={policyEditing ? customPaymentPolicy : snapshot?.outlet?.paymentPolicy || 'PREPAY'} disabled={!canCashier && !isModuleEnabled('payments')} onChange={event => { editPolicy(); setCustomPaymentPolicy(event.target.value); }}><option value="PREPAY">{t("Bayar sebelum dibuat", "Pay before preparation")}</option><option value="PAY_LATER">{t("Bayar setelah makan", "Pay after dining")}</option></SelectField></div>
                <div className="space-y-1.5"><Label htmlFor="takeaway-payment-policy">{t("Pembayaran bawa pulang", "Takeaway payment")}</Label><SelectField id="takeaway-payment-policy" value={policyEditing ? customTakeawayPolicy : snapshot?.outlet?.takeawayPaymentPolicy || 'PREPAY'} disabled={!canCashier && !isModuleEnabled('payments')} onChange={event => { editPolicy(); setCustomTakeawayPolicy(event.target.value); }}><option value="PREPAY">{t("Bayar sebelum dibuat", "Pay before preparation")}</option><option value="PAY_LATER">{t("Bayar saat pengambilan", "Pay on pickup")}</option></SelectField></div>
              </div>
              {!canCashier && !isModuleEnabled('payments') && <p className="text-sm text-[var(--muted-foreground)]">{t("Pembayaran ditangani kasir di luar sistem. Staf dapat mengonfirmasi penerimaan pembayaran pada tagihan pesanan.", "Payment is handled by the cashier outside the system. Staff can confirm payment on the order bill.")}</p>}
              <label className="flex items-center gap-3 text-sm min-h-11"><input type="checkbox" className="h-4 w-4 accent-[var(--primary-ink)]" checked={policyEditing ? customAutoAccept : Boolean(snapshot?.outlet?.autoAcceptParticipant)} onChange={event => { editPolicy(); setCustomAutoAccept(event.target.checked); }} />{t("Terima otomatis pesanan tambahan tamu aktif", "Automatically accept additional orders from active guests")}</label>
              <p className="text-xs text-[var(--muted-foreground)]">{t("Pesanan pertama tetap menunggu konfirmasi staf. Tamu yang sudah diterima dapat menambah pesanan dalam kunjungan yang sama.", "The first order still requires staff confirmation. Accepted guests can place additional orders during the same visit.")}</p>
              <Button disabled={busy} onClick={async () => { try { await runStaffCommand('SETTINGS_PROMO_FEEDBACK_ACTION', { action: 'UPDATE_OUTLET_POLICY', paymentPolicy: !canCashier && !isModuleEnabled('payments') ? 'PAY_LATER' : policyEditing ? customPaymentPolicy : snapshot?.outlet?.paymentPolicy, takeawayPaymentPolicy: !canCashier && !isModuleEnabled('payments') ? 'PAY_LATER' : policyEditing ? customTakeawayPolicy : snapshot?.outlet?.takeawayPaymentPolicy, autoAcceptParticipant: policyEditing ? customAutoAccept : Boolean(snapshot?.outlet?.autoAcceptParticipant) }); setPolicyEditing(false); setActionNotice(t("Alur pemesanan disimpan. Pesanan berikutnya mengikuti pengaturan ini.", "Ordering settings saved. Future orders will use these settings.")); } catch { /* Displayed by runStaffCommand. */ } }}>{t("Simpan alur pemesanan", "Save ordering flow")}</Button>
            </section>}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 6 cols: Tax & Service Charge Config */}
              <section className="lg:col-span-6 space-y-4">
                <div>
                  <h2 className="font-heading text-[17px] font-bold">
                    {t("Pajak & layanan", "Tax & service")}
                  </h2>
                  <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5">
                    {t("Aktif saat ini:", "Currently active:")}{' '}
                    <strong className="text-[var(--foreground)]">
                      {formatOutletChargePolicy(snapshot?.outlet, t)}
                    </strong>
                  </p>
                </div>

                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {[
                    {
                      label: t("Tanpa pajak & layanan", "No tax or service charge"),
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
                      label: t("Layanan 5% + PB1 10%", "Service 5% + PB1 10%"),
                      srv: 5,
                      tax: 10,
                      inc: false,
                    },
                    {
                      label: t("Layanan 5% + PPN 11%", "Service 5% + VAT 11%"),
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
                          setActionNotice(t(`Skema biaya diperbarui: ${preset.label}`, `Charge scheme updated: ${preset.label}`));
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
                    {t("Tarif kustom", "Custom rates")}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="custom-srv-pct">{t("Biaya layanan (%)", "Service charge (%)")}</Label>
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
                      <Label htmlFor="custom-tax-pct">{t("Pajak PB1 / PPN (%)", "PB1 / VAT (%)")}</Label>
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
                      setActionNotice(t("Pajak & layanan disimpan.", "Tax and service settings saved."));
                    }}
                  >
                    {t("Simpan", "Save")}
                  </Button>
                </div>
              </section>

              {/* Right 6 cols: Promo Rules & Customer Reviews */}
              {canMarketing && <section className="lg:col-span-6 lg:border-l lg:border-[var(--border)] lg:pl-8 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-heading text-[17px] font-bold">
                      {t("Promo", "Promotions")}
                    </h2>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setNewPromoModalOpen(true)}
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t("Tambah promo", "Add promotion")}</span>
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
                            {t("Terpakai", "Used")} {pr.quotaUsed} {t("dari", "of")} {pr.quotaTotal} {t("kuota", "quota")}
                          </p>
                        </div>
                        <StatusLabel label={t("Aktif", "Active")} tone="success" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Feedback */}
                <div className="pt-4 border-t border-[var(--border)] space-y-3">
                  <h2 className="font-heading text-[17px] font-bold">
                    {t("Ulasan pelanggan terbaru", "Recent customer reviews")}
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

      <DialogModal open={Boolean(rejectingRequest)} onClose={() => { if (!busy) setRejectingRequest(null); }} title={t("Tolak pesanan", "Reject order")}>
        {rejectingRequest && <div className="space-y-4"><p className="text-sm">{t("Pesanan", "Order")} {rejectingRequest.customerName} {t("belum akan dibuat. Alasan ini juga terlihat oleh pelanggan.", "will not be prepared. The customer will also see this reason.")}</p><div className="space-y-1.5"><Label htmlFor="order-reject-reason">{t("Alasan penolakan", "Reason for rejection")}</Label><Textarea id="order-reject-reason" value={rejectReason} maxLength={500} onChange={event => setRejectReason(event.target.value)} placeholder={t("Contoh: varian yang dipilih baru saja habis", "Example: the selected variant has just sold out")} /></div><InlineError message={modalActionError} /><div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setRejectingRequest(null)}>{t("Kembali", "Back")}</Button><Button variant="danger" disabled={busy || rejectReason.trim().length < 3} onClick={async () => { setModalActionError(''); try { await runStaffCommand('REJECT_ORDER_REQUEST', { orderRequestId: rejectingRequest.id, reason: rejectReason.trim() }); setActionNotice(t(`Pesanan ${rejectingRequest.customerName} ditolak dengan alasan yang tercatat.`, `Order for ${rejectingRequest.customerName} rejected with the recorded reason.`)); setRejectingRequest(null); } catch (caught) { setModalActionError(caught instanceof Error ? caught.message : t("Pesanan belum ditolak.", "The order was not rejected.")); } }}>{t("Konfirmasi penolakan", "Confirm rejection")}</Button></div></div>}
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 1: BUAT PESANAN BARU OLEH KASIR / PELAYAN                       */}
      {/* ===================================================================== */}
      <DialogModal open={newOrderModalOpen} onClose={() => { if (!busy) setNewOrderModalOpen(false); }} title={t("Pesanan baru", "New orders")} maxWidth="max-w-5xl">
        {newOrderModalOpen && <PosComposer snapshot={snapshot} busy={busy} actorId={activeStaff} actorName={currentStaffObj.userName} actorRole={currentStaffObj.role} onCommand={onCommand} onComplete={(billId) => { if (billId) setSelectedBillId(billId); setNewOrderModalOpen(false); setActionNotice(t("Pesanan dibuat. Periksa tagihan dan status pembayarannya.", "Order created. Check the bill and payment status.")); }} />}
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 2: BATALKAN / REFUND ITEM TAGIHAN                               */}
      {/* ===================================================================== */}
      <DialogModal
        open={Boolean(cancellingUnit)}
        onClose={() => setCancellingUnit(null)}
        title={cancellingUnit?.fulfillmentStatus === 'CANCELLED' ? t("Selesaikan pengembalian", "Complete refund") : t("Batalkan item", "Cancel item")}
      >
        {cancellingUnit && (
          <div className="space-y-4">
            <p className="text-[14px] text-[var(--muted-foreground)]">
              {cancellingUnit.fulfillmentStatus === 'CANCELLED' ? t("Selesaikan pengembalian untuk ", "Complete the refund for ") : t("Anda akan membatalkan ", "You are about to cancel ")}
              <strong className="text-[var(--foreground)]">
                1× {sampleName(cancellingUnit.menuItemId, cancellingUnit.itemNameSnapshot || cancellingUnit.itemName)}
              </strong>{' '}
              {t("dari tagihan ini.", "from this bill.")}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="modal-cancel-reason">{cancellingUnit.fulfillmentStatus === 'CANCELLED' ? t("Alasan pengembalian", "Reason for refund") : t("Alasan Pembatalan", "Reason for cancellation")}</Label>
              <Input
                id="modal-cancel-reason"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
              />
            </div>

            {cancellingUnit.fulfillmentStatus !== 'CANCELLED' && <div className="space-y-1.5">
              <Label htmlFor="modal-restock-choice">{t("Stok", "Stock")}</Label>
              <SelectField
                id="modal-restock-choice"
                value={restockChoice}
                onChange={(e) => setRestockChoice(e.target.value as any)}
              >
                <option value="RESTOCK">{t("Kembalikan ke stok (belum dimasak)", "Return to stock (not prepared)")}</option>
                <option value="WASTE">{t("Catat sebagai bahan terbuang", "Record as waste")}</option>
              </SelectField>
            </div>}

            {selectedBill?.verifiedReceiptsIdr > 0 && <div className="space-y-2"><p className="text-sm text-[var(--muted-foreground)]">{t("Koreksi mengurangi tagihan. Kelebihan pembayaran dikembalikan melalui metode pembayaran semula dan dicatat pada struk.", "The adjustment reduces the bill. Excess payment is refunded via the original payment method and recorded on the receipt.")}</p>{cancellingUnit.fulfillmentStatus !== 'CANCELLED' && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={refundNow} onChange={event => setRefundNow(event.target.checked)} className="mt-1 accent-[var(--primary-ink)]" />{t("Kembalikan kelebihan pembayaran sekarang", "Refund the excess payment now")}</label>}{!refundNow && <p className="text-sm text-[var(--status-warning-fg)]">{t("Pengembalian tetap tercatat sebagai kewajiban. Selesaikan sebelum menutup kunjungan.", "The refund remains outstanding. Complete it before closing the visit.")}</p>}</div>}
            {selectedBill?.hasActiveExternalAttempt && <p className="text-sm text-[var(--status-warning-fg)]">{t("Selesaikan atau batalkan instruksi pembayaran aktif sebelum membatalkan item.", "Complete or cancel active payment instructions before cancelling the item.")}</p>}
            <InlineError message={modalActionError} />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" disabled={busy} onClick={() => setCancellingUnit(null)}>
                {t("Kembali", "Back")}
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
                    setActionNotice(response?.result?.refundId ? t("Item dibatalkan dan pengembalian pembayaran tercatat.", "Item cancelled and refund recorded.") : t("Item dibatalkan dan tagihan telah dikoreksi.", "Item cancelled and bill adjusted."));
                  } catch (caught) { setModalActionError(caught instanceof Error ? caught.message : t("Item belum dibatalkan.", "The item was not cancelled.")); }
                }}
              >
                {cancellingUnit.fulfillmentStatus === 'CANCELLED' ? t("Catat pengembalian", "Record refund") : t("Batalkan item", "Cancel item")}
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
        title={t("Tambah menu", "Add menu item")}
      >
        <div className="space-y-5">
          {/* Quick Add Category */}
          <div className="pb-4 border-b border-[var(--border)] space-y-2">
            <Label htmlFor="modal-new-cat">{t("Kategori baru", "New category")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="modal-new-cat"
                value={newCategoryNameInput}
                onChange={(e) => setNewCategoryNameInput(e.target.value)}
                placeholder={t("Contoh: Es Krim & Dessert", "Example: Ice Cream & Dessert")}
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
                  setActionNotice(t("Kategori baru berhasil ditambahkan.", "The new category was added."));
                }}
              >
                {t("+ Kategori", "+ Category")}
              </Button>
            </div>
          </div>

          {/* Add Menu Form */}
          <div className="space-y-3">
            <p className="font-semibold text-[15px]">{t("Menu baru", "New menu item")}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{t("Kode", "Code")}</Label>
                <Input
                  value={newMenuCode}
                  onChange={(e) => setNewMenuCode(e.target.value)}
                  placeholder="M-012"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>{t("Nama menu", "Item name")}</Label>
                <Input
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  placeholder={t("Contoh: Affogato Vanila", "Example: Vanilla Affogato")}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{t("Kategori", "Category")}</Label>
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
                <Label>{t("Stasiun", "Station")}</Label>
                <SelectField
                  value={newMenuStation}
                  onChange={(e) => setNewMenuStation(e.target.value)}
                >
                  <option value="BAR">{t("Bar & Kopi", "Bar & Coffee")}</option>
                  <option value="KITCHEN">{t("Dapur Utama", "Main Kitchen")}</option>
                  <option value="PASTRY">{t("Pastry & Roti", "Pastries & Bread")}</option>
                </SelectField>
              </div>
              <div className="space-y-1">
                <Label>{t("Harga (Rp)", "Price (Rp)")}</Label>
                <Input
                  type="number"
                  value={newMenuPrice}
                  onChange={(e) => setNewMenuPrice(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t("Deskripsi singkat", "Short description")}</Label>
              <Input
                value={newMenuDesc}
                onChange={(e) => setNewMenuDesc(e.target.value)}
                placeholder={t("Deskripsi bahan dan penyajian...", "Ingredients and serving description...")}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("Foto Menu (", "Menu photos (")}{newMenuPhotos.length} {t("foto)", "photos)")}</Label>
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[var(--accent-surface)] text-[var(--primary-ink)] font-semibold text-[12px] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t("Pilih foto", "Choose photo")}</span>
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
                        alt={t(`Foto ${idx + 1}`, `Photo ${idx + 1}`)}
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
                setActionNotice(t("Menu baru berhasil ditambahkan ke katalog.", "The new item was added to the catalogue."));
              }}
            >
              {t("Simpan menu baru", "Save new menu item")}
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
        title={t(`Galeri Foto: ${editingPhotosItem?.name || ''}`, `Photo gallery: ${editingPhotosItem?.name || ''}`)}
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
                <span>{t("Unggah foto", "Upload photo")}</span>
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
              <Label>{t("URL foto", "Photo URL")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={newPhotoUrlInput}
                  onChange={(e) => setNewPhotoUrlInput(e.target.value)}
                  placeholder={t("https://... atau /images/menu/...", "https://... or /images/menu/...")}
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
                  {t("+ Tambah", "+ Add")}
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
                          className="text-[12px] font-medium text-[var(--primary-ink)] hover:underline cursor-pointer"
                        >
                          {t("Jadikan foto utama", "Set as primary photo")}
                        </button>
                      ) : (
                        <span className="text-[12px] font-semibold text-[var(--primary-ink)]">
                          {t("Foto utama", "Primary photo")}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setPhotoDraftList(photoDraftList.filter((_, i) => i !== idx))
                        }
                        className="text-[var(--status-danger-fg)] p-1 cursor-pointer"
                        aria-label={t(`Hapus foto ${idx + 1}`, `Remove photo ${idx + 1}`)}
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
                {t("Batal", "Cancel")}
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
                  setActionNotice(t(`Galeri foto ${editingPhotosItem.name} berhasil disimpan.`, `Photo gallery for ${editingPhotosItem.name} saved.`));
                }}
              >
                {t("Simpan galeri (", "Save gallery (")}{photoDraftList.length} {t("Foto)", "photos)")}
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
        title={t("QR meja", "Table QR code")}
      >
        <div className="grid grid-cols-2 gap-3">
          {(snapshot?.tables || []).map((table: any) => (
            <div
              key={table.id}
              className="p-3 border border-[var(--border)] rounded-[8px] text-center space-y-1 bg-[var(--background)]"
            >
              <p className="font-heading font-bold text-[15px]">{t("Meja", "Table")} {table.label}</p>
              <p className="text-[12px] text-[var(--muted-foreground)]">{table.areaName}</p>
              <p className="text-[12px] text-[var(--primary-ink)] font-mono truncate">
                ?table={table.label}
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
        title={t("Impor menu", "Import menu")}
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
              {t("Periksa CSV", "Check CSV")}
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
                  setActionNotice(t("Katalog CSV berhasil diimpor.", "The CSV catalogue was imported."));
                }}
              >
                {t("Simpan (", "Save (")}{previewBatch.validRows} {t("Menu)", "items)")}
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
        title={t("Promo baru", "New promotion")}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("Kode voucher", "Voucher code")}</Label>
              <Input
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Nama promo", "Promotion name")}</Label>
              <Input
                value={newPromoName}
                onChange={(e) => setNewPromoName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Minimum belanja (Rp)", "Minimum spend (Rp)")}</Label>
              <Input
                type="number"
                value={newPromoMinSpend}
                onChange={(e) => setNewPromoMinSpend(Number(e.target.value))}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Potongan (Rp)", "Discount (Rp)")}</Label>
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
              setActionNotice(t(`Voucher promo ${newPromoCode} berhasil diterbitkan.`, `Promotion voucher ${newPromoCode} published.`));
            }}
          >
            {t("Terbitkan voucher", "Publish voucher")}
          </Button>
        </div>
      </DialogModal>
    </div>
  );
}
