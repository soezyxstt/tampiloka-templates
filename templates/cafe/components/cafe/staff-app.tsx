'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useCafeLanguage } from '@/lib/language';
import { localizeSampleName } from '@/src/catalog/sample-menu';
import Image from 'next/image';
import { MotionPanel } from '@/components/ui/motion';
import { motion, AnimatePresence } from 'motion/react';
import {
  Button,
  PageHeader,
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
import { ShiftControls } from './shift-controls';
import { VisitService } from './visit-service';
import { OrderNotifications } from './order-notifications';
import styles from './staff-app.module.css';
import { sanitizeSpreadsheetExportCell } from '@/src/domain/rules';
import { filterReportBills, isInReportRange, reportBilledAmount, reportBillTotals, reportDailyTotals, reportRangeForPeriod, type ReportPeriod } from '@/lib/reporting';
import {
  Check,
  X,
  Plus,
  Split,
  Merge,
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
  explorationManaged = false,
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
  /** The surrounding demo toolbar owns staff and customer navigation. */
  explorationManaged?: boolean;
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
  const [actionError, setActionError] = useState<string>('');
  const [cashierTask, setCashierTask] = useState<'orders' | 'bills' | 'visits'>('orders');
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
  const [paymentError, setPaymentError] = useState('');
  const billDetailRef = useRef<HTMLDivElement>(null);
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

  // Meja & Antrean sub-tab state
  const [floorSubTab, setFloorSubTab] = useState<'KUNJUNGAN' | 'DENAH' | 'PANGGILAN' | 'ANTREAN'>('KUNJUNGAN');
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
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('day');
  const [reportStartDate, setReportStartDate] = useState(todayReportDate);
  const [reportEndDate, setReportEndDate] = useState(todayReportDate);
  const customReportInitialized = useRef(false);

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

  // Reset role-owned UI before rendering the new identity, without an effect
  // that first commits the previous role's workspace.
  const identityKey = `${activeStaff}:${currentStaffObj.role}`;
  const [workspaceIdentity, setWorkspaceIdentity] = useState('');
  if (workspaceIdentity !== identityKey) {
    setWorkspaceIdentity(identityKey);
    const role = currentStaffObj.role;
    const preferred: StaffSection = role === 'OWNER' && sectionEnabled('laporan') ? 'laporan' : role === 'BAR' || role === 'KITCHEN' ? 'dapur' : role === 'WAITER' ? 'meja' : 'kasir';
    const roleSections: StaffSection[] = role === 'BAR' || role === 'KITCHEN'
      ? (sectionEnabled('dapur') ? ['dapur'] : ['kasir']) : role === 'WAITER' ? ['meja', 'kasir', 'dapur']
      : role === 'CASHIER' ? ['kasir', 'meja', 'dapur'] : ['kasir', 'dapur', 'meja', 'menu', 'laporan', 'pengaturan'];
    setActiveSection(sectionEnabled(preferred) ? preferred : roleSections.find(sectionEnabled) || defaultSection);
    setCashierTask('orders');
    setFloorSubTab('KUNJUNGAN');
    setStationFilter(role === 'BAR' ? 'BAR' : role === 'KITCHEN' ? 'KITCHEN' : 'ALL');
    setActionError('');
    setNewOrderModalOpen(false);
    setRejectingRequest(null);
    setCancellingUnit(null);
    setAddMenuModalOpen(false);
    setEditingPhotosItem(null);
    setShowQrPrintModal(false);
    setShowCsvModal(false);
    setNewPromoModalOpen(false);
    setShowSplitMergePanel(false);
    setSelectedUnitIdsForSplit([]);
  }

  const runStaffCommand = async (action: string, payload: Record<string, any>) => {
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

  const kitchenGroups = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const unit of kitchenUnits) {
      const key = `${unit.orderId}:${unit.stationCode}`;
      groups.set(key, [...(groups.get(key) || []), unit]);
    }
    return Array.from(groups.entries());
  }, [kitchenUnits]);

  const reportRange = useMemo(() => reportRangeForPeriod(reportPeriod, reportDate, reportStartDate, reportEndDate), [reportPeriod, reportDate, reportStartDate, reportEndDate]);
  const reportBills = useMemo(() => filterReportBills<any>(snapshot?.bills || [], reportRange), [snapshot, reportRange]);
  const reportShifts = useMemo(() => (snapshot?.cashShifts || []).filter((shift: any) => isInReportRange(shift.businessDate, reportRange)), [snapshot, reportRange]);
  const reportTotals = useMemo(() => reportBillTotals(reportBills), [reportBills]);
  const reportDays = useMemo(() => reportDailyTotals(reportBills), [reportBills]);
  const reportSpansMultipleDays = Boolean(reportRange && reportRange.start !== reportRange.end);

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
    setActiveSection('kasir'); setCashierTask('bills'); setBillSearch(''); setBillFilter('ALL');
    setTenderAmountInput(''); setCashGivenInput(''); setTransferRefInput(''); setPaymentError('');
    setShowSplitMergePanel(false); setSelectedUnitIdsForSplit([]);
    if (bill) setSelectedBillId(bill.id);
  };

  const handleExportReportCsv = () => {
    if (!reportRange || !reportBills.length) return;
    const headers = [t('Tanggal Tagihan', 'Bill date'), t('ID Tagihan', 'Bill ID'), t('Meja / Pemilik', 'Table / Customer'), t('Status Bayar', 'Payment status'), 'Subtotal', t('Diskon', 'Discount'), t('Layanan', 'Service charge'), t('Pajak', 'Tax'), t('Koreksi Debit', 'Debit adjustment'), t('Koreksi Kredit', 'Credit adjustment'), t('Nilai Tagihan', 'Billed amount'), t('Diterima', 'Received'), t('Dikembalikan', 'Refunded'), t('Penerimaan Bersih', 'Net receipts'), t('Sisa', 'Balance')];
    const rows = reportBills.map((bill: any) => [
      bill.businessDate, bill.id, `${bill.tableLabel} / ${bill.ownerLabel}`, bill.paymentState,
      bill.subtotalIdr, bill.discountIdr, bill.serviceIdr, bill.taxIdr,
      bill.debitAdjustmentsIdr, bill.creditAdjustmentsIdr,
      reportBilledAmount(bill),
      bill.verifiedReceiptsIdr, bill.refundedIdr,
      Number(bill.verifiedReceiptsIdr || 0) - Number(bill.refundedIdr || 0), bill.balanceIdr,
    ]);
    const csvCell = (cell: string | number) => `"${String(sanitizeSpreadsheetExportCell(cell ?? '')).replaceAll('"', '""')}"`;
    const csvContent = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const rangeLabel = reportRange.start === reportRange.end ? reportRange.start : `${reportRange.start}-${reportRange.end}`;
    anchor.download = `laporan-${cafeConfig.venue.outletSlug}-${rangeLabel}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(t(`Laporan tagihan ${rangeLabel} berhasil diunduh.`, `Bill report for ${rangeLabel} downloaded.`));
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
            {!explorationManaged && onBackToCustomer && (
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
            {snapshot?.runtime?.demo && !explorationManaged && <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <p className="text-[12px] text-[var(--muted-foreground)]">
                {t("Pilih staf", "Choose staff")}
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
            </div>}

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
  const roleSections: StaffSection[] = currentStaffObj.role === 'BAR' || currentStaffObj.role === 'KITCHEN'
    ? (sectionEnabled('dapur') ? ['dapur'] : ['kasir'])
    : currentStaffObj.role === 'WAITER'
      ? ['meja', 'kasir', 'dapur']
      : currentStaffObj.role === 'CASHIER'
        ? ['kasir', 'meja', 'dapur']
        : ['kasir', 'dapur', 'meja', 'menu', 'laporan', 'pengaturan'];
  const enabledRoleSections = roleSections.filter(sectionEnabled);
  // A role whose usual module is absent still needs an enabled landing view.
  const navItems = allNavItems.filter(item => (enabledRoleSections.length ? enabledRoleSections : [defaultSection]).includes(item.id) && sectionEnabled(item.id));
  const currentSection = navItems.some(item => item.id === activeSection) ? activeSection : navItems[0]?.id || defaultSection;

  const billLocationLabel = (bill: any) => {
    const visit = (snapshot?.visits || []).find((entry: any) => entry.id === bill.visitId);
    return visit?.mode === 'TAKEAWAY' || !bill.tableLabel ? t('Bawa pulang', 'Takeaway') : t(`Meja ${bill.tableLabel}`, `Table ${bill.tableLabel}`);
  };

  const billOwnerName = (bill: any) => {
    const label = String(bill.ownerLabel || '');
    for (const table of [bill.tableLabel, `Meja ${bill.tableLabel}`, `Table ${bill.tableLabel}`]) {
      const suffix = ` (${table})`;
      if (bill.tableLabel && label.endsWith(suffix)) return label.slice(0, -suffix.length);
    }
    return label;
  };

  const effectiveTenderAmount =
    tenderAmountInput.trim() === ''
      ? selectedBill?.balanceIdr || 0
      : Number(tenderAmountInput);
  const cashChangePreview =
    tenderMethod === 'CASH'
      ? Math.max(0, (Number(cashGivenInput) || 0) - effectiveTenderAmount)
      : 0;

  return (
    <div className={`cafe-staff min-h-screen bg-[var(--background)] text-[var(--foreground)] ${styles.workspace} ${styles.explorationManaged}`}>
      <aside className="staff-sidebar">
        <div className="flex items-center gap-3 px-2 py-3">
          <BrandMark />
          <div className="min-w-0"><p className="font-heading font-bold text-base leading-snug break-words">{cafeConfig.brand.name}</p></div>
        </div>
        <p className={styles.sidebarLabel}>{t("Operasional", "Operations")}</p>
        <nav aria-label={t("Navigasi operasional desktop", "Desktop operations navigation")} className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = ({ kasir: Wallet, dapur: ChefHat, meja: LayoutGrid, menu: Coffee, laporan: ClipboardList, pengaturan: Settings2 })[item.id];
            return <button key={item.id} type="button" aria-current={currentSection === item.id ? 'page' : undefined} onClick={() => { setActiveSection(item.id); setActionError(''); }} className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-colors ${currentSection === item.id ? 'bg-[var(--accent-surface)] text-[var(--primary-ink)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]'}`}>
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{item.label}</span>{Boolean(item.count) && <span className="rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[12px] tabular-nums">{item.count}</span>}
            </button>;
          })}
        </nav>
        <div className="mt-auto space-y-4 pt-6">

          {!explorationManaged && onBackToCustomer && <button type="button" onClick={onBackToCustomer} className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--primary-ink)]">{t("Lihat menu pelanggan", "View customer menu")}<ArrowUpRight className="h-4 w-4" /></button>}
        </div>
      </aside>
      <header className="staff-header">
        <div className="staff-toolbar">
          <div className="staff-identity">
            {!explorationManaged && onBackToCustomer && <Button variant="ghost" size="icon" onClick={onBackToCustomer} aria-label={t("Kembali ke menu pelanggan", "Back to customer menu")} className="xl:hidden"><ArrowLeft className="h-4 w-4" /></Button>}
            <div><p className="text-sm font-semibold">{cafeConfig.brand.name}</p><p id="active-staff-role" className="text-xs text-[var(--muted-foreground)]">{currentStaffObj.userName} · {staffRoleLabel(activeStaff, currentStaffObj.role)}</p></div>
          </div>

          <div className="staff-actions">
            {lastUpdated && <span className={styles.syncText}>{lastUpdated}</span>}
            <OrderNotifications snapshot={snapshot} />
            <Button variant="ghost" size="icon" title={lastUpdated} disabled={busy || !onRefresh} onClick={onRefresh} aria-label={t("Perbarui data operasional", "Refresh operational data")}><RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button>
            {!explorationManaged && <Button variant="ghost" size="icon" onClick={() => setIsAuthenticated(false)} aria-label={t("Keluar dari portal staf", "Sign out of staff portal")}><LogOut className="h-4 w-4" /></Button>}
          </div>
        </div>
        <div className="staff-mobile-nav"><AnimatedUnderlineTabs items={navItems} activeId={currentSection} onSelect={(id) => { setActiveSection(id); setActionError(''); }} ariaLabel={t('Navigasi operasional kafe', 'Cafe operations navigation')} layoutId="staff-pos-nav-underline" className="border-b-0" /></div>
      </header>
      <a href="#staff-content" className="skip-link">{t("Ke ruang kerja", "Open workspace")}</a>
      <main id="staff-content" className="staff-main">
        {currentSection !== 'meja' && <PageHeader title={navItems.find(item => item.id === currentSection)?.label || t('Operasional', 'Operations')} actions={canCashier && currentSection === 'kasir' ? <Button variant="primary" onClick={() => setNewOrderModalOpen(true)}><Plus className="h-4 w-4" />{t("Pesanan baru", "New order")}</Button> : undefined} />}
        <AnimatePresence>
          {actionError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="staff-feedback"
            >
              {actionError && <InlineError message={actionError} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* =================================================================== */}
        {/* TAB 1: KASIR & PESANAN (UNIFIED POS WORKSPACE)                      */}
        {/* =================================================================== */}
        <AnimatePresence key={activeStaff} mode="wait" initial={false}><MotionPanel key={currentSection}>{sectionEnabled('kasir') && currentSection === 'kasir' && (
          <div
            key="pos-kasir"
            className="workspace-stack"
          >
            <ChoiceStrip<'orders' | 'bills' | 'visits'>
              ariaLabel={t('Tugas kasir dan pesanan', 'Cashier and order tasks')}
              kind="navigation"
              items={[
                { id: 'orders', label: t('Pesanan masuk', 'Incoming orders'), count: pendingOrderRequests.length },
                ...(canCashier ? [{ id: 'bills' as const, label: t('Tagihan', 'Bills'), count: activeBills.filter((bill: any) => bill.balanceIdr !== 0).length }] : []),
                { id: 'visits', label: t('Kunjungan aktif', 'Active visits'), count: (snapshot?.visits || []).filter((visit: any) => visit.status === 'OPEN').length },
              ]}
              value={cashierTask}
              onChange={task => { setCashierTask(task); setActionError(''); }}
            />

            {cashierTask === 'orders' && <div className="workspace-stack">
              <Surface id="incoming-orders" variant="plain" className="space-y-3 scroll-mt-28">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-[17px] font-bold">
                      {t("Menunggu konfirmasi", "Awaiting confirmation")} ({pendingOrderRequests.length})
                    </h2>
                  </div>

                </div>

                {!pendingOrderRequests.length && <EmptyState title={t("Tidak ada pesanan yang menunggu", "No orders awaiting confirmation")} />}
                <div className="operation-list">
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
                      <Surface as="div" variant="task"
                        key={req.id}
                        data-request-id={req.id}
                        className="flex flex-wrap items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0 basis-[240px] flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-[16px] font-bold">
                              {t("Meja", "Table")} {req.tableLabel} · {req.customerName}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--muted-foreground)]">{lines.map((ln: any) => `${ln.quantity ?? ln.qty ?? 1}× ${sampleName(ln.menuItemId, ln.itemName)}`).join(', ')}</p>
                          <details className={styles.disclosure}>
                            <summary>{t('Rincian pesanan', 'Order details')}</summary>
                            <div className="space-y-1 pt-2 text-sm">
                              {lines.map((ln: any, idx: number) => <p key={idx}>
                                <strong>{ln.quantity ?? ln.qty ?? 1}× {sampleName(ln.menuItemId, ln.itemName)}</strong>
                                {ln.variantName ? ` (${sampleName(ln.variantId, ln.variantName)})` : ''}
                                {ln.modifiers?.length ? ` · ${ln.modifiers.join(', ')}` : ''}
                                {ln.note ? t(` · Catatan: "${ln.note}"`, ` · Note: "${ln.note}"`) : ''}
                              </p>)}
                            </div>
                          </details>
                        </div>

                        <div className="operation-actions">
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
                              try {
                                await runStaffCommand('ACCEPT_ORDER_REQUEST', { orderRequestId: req.id });
                                toast.success(t(`Pesanan ${req.customerName} diterima.`, `Order for ${req.customerName} accepted.`));
                              } catch { /* The actionable error is shown above the workspace. */ }
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
                      </Surface>
                    );
                  })}
                </div>
              </Surface>
              {!canKitchen && <OrderInbox snapshot={snapshot} busy={busy} onCommand={runStaffCommand} />}
            </div>}

            {canCashier && cashierTask === 'bills' && <div className="workspace-stack">
              <ShiftControls snapshot={snapshot} busy={busy} onCommand={runStaffCommand} />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* LEFT 4 COLS: Active Bills List + Walk-In Order Button */}
              <div className="lg:col-span-4 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-heading text-[17px] font-bold">
                    {t("Tagihan", "Bills")}
                  </h2>
                </div>

                <div className="space-y-3">
                  <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-[var(--muted-foreground)]" /><Input aria-label={t("Cari tagihan berdasarkan meja atau pelanggan", "Search bills by table or customer")} placeholder={t("Cari meja atau pelanggan…", "Search table or customer…")} value={billSearch} onChange={(e) => setBillSearch(e.target.value)} className="pl-9" /></div>
                  <AnimatedSegmentedControl ariaLabel={t('Filter pembayaran tagihan', 'Filter bills by payment status')} options={[{ value: 'OPEN', label: t("Belum lunas", "Unpaid") }, { value: 'PAID', label: t("Lunas", "Paid") }, { value: 'ALL', label: t("Semua", "All") }]} value={billFilter} onChange={(value) => setBillFilter(value as typeof billFilter)} layoutId="staff-bill-filter" />
                </div>
                {filteredBills.length === 0 && <EmptyState title={t("Tidak ada tagihan", "No bills")} description={billSearch ? t("Coba nama pelanggan atau nomor meja lain.", "Try another customer name or table number.") : undefined} />}
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
                          setPaymentError('');
                          if (window.matchMedia('(max-width: 1023px)').matches) {
                            requestAnimationFrame(() => billDetailRef.current?.focus());
                          }
                        }}
                        aria-pressed={isSel}
                        className="operation-choice w-full py-3 px-3 text-left transition-colors flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-[var(--accent-surface)]"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="font-heading font-semibold text-[15px] text-[var(--foreground)]">{billLocationLabel(b)}</p>
                          <p className="text-sm break-words">{billOwnerName(b)}</p>
                          <p className="text-[12px] text-[var(--muted-foreground)] tabular-nums">
                            {(b.allocatedUnits || []).length} {t("porsi menu", "menu servings")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Money
                            amount={
                              b.balanceIdr !== 0
                                ? Math.abs(b.balanceIdr)
                                : b.originalTotalIdr ?? b.totalIdr ?? 0
                            }
                            className="block font-bold text-[15px] text-[var(--foreground)]"
                          />
                          <span className="flex items-center gap-1.5">{isSel && <Check className="h-4 w-4" aria-hidden="true" />}<StatusLabel label={payBadge.label} tone={payBadge.tone} /></span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT 8 COLS: Selected Bill Details & Cashier Checkout */}
              <div ref={billDetailRef} tabIndex={-1} data-selected-bill-id={selectedBill?.id} className="lg:col-span-8 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 space-y-6">
                {selectedBill ? (
                  <>
                    {/* Bill Header */}
                    <div className="pb-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h2 className="font-heading text-[20px] font-bold">
                            {billLocationLabel(selectedBill)} · {billOwnerName(selectedBill)}
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
                                    toast.success(t("Tagihan berhasil dipisahkan.", "The bill was split."));
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
                                    toast.success(t("Tagihan berhasil digabungkan.", "The bills were merged."));
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
                                  ...(isModuleEnabled('payments') ? [{ value: 'QRIS', label: 'QRIS' }, { value: 'VIRTUAL_ACCOUNT', label: 'VA' }] : []),
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
                                      className="min-h-11 px-2.5 py-1 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--accent-surface)] text-[12px] font-medium tabular-nums cursor-pointer transition-colors"
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

                            {selectedBill.hasActiveExternalAttempt && <p role="status" className="text-sm text-[var(--status-warning-fg)]">{snapshot?.runtime?.demo ? explorationManaged ? t('Pembayaran masih aktif. Selesaikan atau batalkan melalui pengaturan di bilah atas.', 'Payment is active. Complete or cancel it in the top-bar settings.') : t('Pembayaran masih aktif. Selesaikan atau batalkan melalui pengaturan di bilah atas.', 'Payment is active. Complete or cancel it in the top-bar settings.') : t('Instruksi pembayaran masih aktif. Konfirmasikan hasilnya atau batalkan sebelum mencatat pembayaran lain.', 'Payment instructions are still active. Confirm the result or cancel them before recording another payment.')}</p>}
                            {tenderMethod === 'CASH' && !cashGivenInput.trim() && <p className="text-sm text-[var(--muted-foreground)]">{t('Masukkan uang tunai yang diterima.', 'Enter the cash received.')}</p>}
                            {tenderMethod === 'CASH' && cashGivenInput.trim() !== '' && Number(cashGivenInput) < effectiveTenderAmount && <p className="text-sm text-[var(--status-warning-fg)]">{t('Uang tunai yang diterima kurang dari jumlah bayar.', 'Cash received is less than the amount to pay.')}</p>}
                            <InlineError message={paymentError} />
                            <Button
                              variant="primary"
                              size="lg"
                              className="w-full"
                              disabled={busy || paymentSubmitting || selectedBill.hasActiveExternalAttempt || !Number.isSafeInteger(effectiveTenderAmount) || effectiveTenderAmount <= 0 || effectiveTenderAmount > selectedBill.balanceIdr || (tenderMethod === 'CASH' && (!Number.isSafeInteger(Number(cashGivenInput)) || Number(cashGivenInput) < effectiveTenderAmount))}
                              onClick={async () => {
                                if (paymentSubmittingRef.current) return;
                                paymentSubmittingRef.current = true; setPaymentSubmitting(true); setPaymentError('');
                                const amt = effectiveTenderAmount;
                                const paymentPayload = { billId: selectedBill.id, method: tenderMethod, amountIdr: amt, tenderedIdr: tenderMethod === 'CASH' ? Number(cashGivenInput) : amt, referenceCode: transferRefInput || undefined };
                                const fingerprint = JSON.stringify(paymentPayload);
                                if (paymentAttemptRef.current?.fingerprint !== fingerprint) paymentAttemptRef.current = { fingerprint, key: `payment_${crypto.randomUUID()}` };
                                try {
                                  const res = await runStaffCommand('RECORD_PAYMENT', { ...paymentPayload, idempotencyKey: paymentAttemptRef.current.key });
                                  const external = tenderMethod === 'QRIS' || tenderMethod === 'VIRTUAL_ACCOUNT';
                                  toast.success(external ? t('Instruksi pembayaran dibuat. Pembayaran masih menunggu konfirmasi.', 'Payment instructions created. Payment is awaiting confirmation.') : t(`Pembayaran ${tenderMethod === 'CASH' ? 'tunai' : 'transfer'} sebesar ${formatIdr(amt)} berhasil dicatat.${(res?.result?.changeIdr ?? 0) > 0 ? ` Kembalian: ${formatIdr(res.result.changeIdr)}` : ''}`, `${tenderMethod === 'CASH' ? 'Cash' : 'Transfer'} payment of ${formatIdr(amt)} recorded.${(res?.result?.changeIdr ?? 0) > 0 ? ` Change: ${formatIdr(res.result.changeIdr)}` : ''}`));
                                  setTenderAmountInput(''); setCashGivenInput(''); setTransferRefInput(''); paymentAttemptRef.current = null;
                                } catch (caught) { setPaymentError(caught instanceof Error ? caught.message : t('Pembayaran belum tercatat.', 'Payment was not recorded.')); /* Keep the retry key. */ }
                                finally { paymentSubmittingRef.current = false; setPaymentSubmitting(false); }
                              }}
                            >
                              <Receipt className="w-4 h-4" />
                              <span className="whitespace-normal leading-snug"><span className="block">{tenderMethod === 'CASH' ? t('Terima tunai', 'Accept cash') : tenderMethod === 'MANUAL_TRANSFER' ? t('Catat transfer', 'Record transfer') : t('Buat instruksi pembayaran', 'Create payment instructions')}</span><Money amount={effectiveTenderAmount} className="block" /></span>
                            </Button>
                          </>
                        ) : (
                          <div className={`p-4 rounded-[var(--radius-control)] flex items-center justify-between ${selectedBill.balanceIdr < 0 ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]' : 'bg-[var(--status-success-bg)] text-[var(--status-success-fg)]'}`}>
                            <div>
                              <p className="font-semibold text-[15px]">{selectedBill.balanceIdr < 0 ? t(`Perlu pengembalian ${formatIdr(-selectedBill.balanceIdr)}`, `Refund due ${formatIdr(-selectedBill.balanceIdr)}`) : t("Lunas", "Paid")}</p>

                            </div>
                            {selectedBill.balanceIdr === 0 && <Check className="w-5 h-5 shrink-0" />}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Bill Items Hairline List */}
                    <details className={styles.disclosure} open={showSplitMergePanel || undefined} data-ui="bill-items">
                      <summary>{t('Rincian item', 'Item details')} ({(selectedBill.allocatedUnits || []).length})</summary>
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
                                    className="text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--status-danger-fg)] transition-colors cursor-pointer px-2 py-2 min-h-10"
                                  >
                                    {isCancelled ? t("Selesaikan pengembalian", "Complete refund") : t("Batalkan", "Cancel")}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>

                  </>
                ) : (
                  <EmptyState title={t("Pilih tagihan", "Select a bill")} />
                )}
              </div>
              </div>
            </div>}
            {cashierTask === 'visits' && <VisitService snapshot={snapshot} busy={busy} canTables={canTables} actorRole={currentStaffObj.role} onCommand={runStaffCommand} onNotice={toast.success} onOpenBills={canCashier ? openVisitBills : undefined} />}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: DAPUR & BAR (CLEAN KDS WORKSPACE)                            */}
        {/* =================================================================== */}
        {sectionEnabled('dapur') && currentSection === 'dapur' && (
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

            </div>

            <ChoiceStrip ariaLabel={t('Status pesanan dapur', 'Kitchen order status')} items={[['ACTIVE',t('Semua aktif','All active')],['QUEUED',t('Antrean baru','New in queue')],['PREPARING',t('Sedang dibuat','Preparing')],['READY',t('Siap diantar','Ready to serve')],['ALL',t('Termasuk selesai','Including completed')]].map(([id,label])=>({id,label}))} value={kitchenStatusFilter} onChange={setKitchenStatusFilter} variant="underline" />
            {kitchenUnits.length === 0 ? (
              <EmptyState title={t("Tidak ada pesanan", "No orders")} />
            ) : (
              <div className={styles.kitchenGrid}>
                {kitchenGroups.map(([key, units]) => {
                  const first = units[0];
                  const tableLabel = first.tableLabelSnapshot || first.tableLabel || '-';
                  const customerName = first.customerNameSnapshot || first.customerName || t('Tamu', 'Guest');
                  const takeaway = (snapshot?.orders || []).find((order: any) => order.id === first.orderId)?.mode === 'TAKEAWAY';
                  return <article key={key} className={styles.kitchenTicket}>
                    <header className={styles.kitchenTicketHeader}>
                      <div><h2 className="font-heading font-semibold">{takeaway ? t('Bawa pulang', 'Takeaway') : t(`Meja ${tableLabel}`, `Table ${tableLabel}`)} · {customerName}</h2>
                        <p className="text-sm text-[var(--muted-foreground)]">{formatStationName(first.stationCode, t)} · {units.length} {t('item', 'items')}</p>
                      </div>
                    </header>
                    <div className="divide-y divide-[var(--border)]">
                      {units.map((unit: any) => {
                        const status = takeaway && unit.fulfillmentStatus === 'READY' ? { label: t('Siap diambil', 'Ready for pickup'), tone: 'info' as const } : takeaway && unit.fulfillmentStatus === 'PICKED_UP' ? { label: t('Sudah diambil', 'Picked up'), tone: 'success' as const } : formatFulfillmentLabel(unit.fulfillmentStatus, t);
                        const itemName = sampleName(unit.menuItemId, unit.itemNameSnapshot || unit.itemName);
                        const variantName = sampleName(unit.variantId, unit.variantNameSnapshot || unit.variantName);
                        const targetStatus = unit.fulfillmentStatus === 'QUEUED' ? 'PREPARING' : unit.fulfillmentStatus === 'PREPARING' ? 'READY' : unit.fulfillmentStatus === 'READY' ? (takeaway ? 'PICKED_UP' : 'DELIVERED') : null;
                        const actionLabel = unit.fulfillmentStatus === 'QUEUED' ? t('Mulai siapkan', 'Start preparing') : unit.fulfillmentStatus === 'PREPARING' ? t('Siap diantar', 'Ready to serve') : takeaway ? t('Sudah diambil', 'Picked up') : t('Disajikan', 'Served');
                        return <div key={unit.id} data-unit-id={unit.id} className={styles.kitchenItem}>
                          <div className="min-w-0 space-y-1">
                            <p className="font-semibold">1× {itemName}{variantName && <span className="font-normal text-[var(--muted-foreground)]"> ({variantName})</span>}</p>
                            {unit.modifiersSummary && <p className="text-sm">{t('Opsi:', 'Options:')} {unit.modifiersSummary}</p>}
                            {unit.note && <p className="text-sm font-medium text-[var(--status-warning-fg)]">{t('Catatan:', 'Note:')} {unit.note}</p>}
                            <StatusLabel label={status.label} tone={status.tone} />
                          </div>
                          {targetStatus && <Button variant={unit.fulfillmentStatus === 'READY' ? 'secondary' : 'primary'} size="sm" disabled={busy} aria-label={`${actionLabel}: ${itemName}, ${customerName}`} onClick={async () => {
                            try {
                              await runStaffCommand('TRANSITION_UNITS', { unitIds: [unit.id], targetStatus });
                              toast.success(t(`Status ${itemName} diperbarui.`, `${itemName} status updated.`));
                            } catch { /* The workspace shows the server error. */ }
                          }}>{actionLabel}</Button>}
                        </div>;
                      })}
                    </div>
                  </article>;
                })}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: MEJA, KUNJUNGAN & ANTREAN TAMU                               */}
        {/* =================================================================== */}
        {sectionEnabled('meja') && currentSection === 'meja' && (
          <div
            key="pos-meja"
            className="space-y-4"
          >
            <div className={styles.floorNav}>
              <h1 className="font-heading text-[22px] leading-[28px] font-bold">{t('Meja & Antrean', 'Tables & waitlist')}</h1>
              <AnimatedSegmentedControl
                ariaLabel={t('Sub-menu operasional lantai', 'Floor operations menu')}
                options={[
                  { value: 'KUNJUNGAN', label: t('Kunjungan aktif', 'Active visits') },
                  { value: 'DENAH', label: t('Atur denah', 'Edit floor plan') },
                  { value: 'PANGGILAN', label: t(`Panggilan pelayan (${openHelpCount})`, `Guest requests (${openHelpCount})`) },
                  { value: 'ANTREAN', label: t(`Antrean tamu (${openWaitlistCount})`, `Guest waitlist (${openWaitlistCount})`) },
                ]}
                value={floorSubTab}
                onChange={setFloorSubTab}
                layoutId="floor-sub-tab"
              />
            </div>

            {floorSubTab === 'KUNJUNGAN' ? (
              <VisitService snapshot={snapshot} busy={busy} canTables={canTables} actorRole={currentStaffObj.role} onCommand={runStaffCommand} onNotice={toast.success} onOpenBills={canCashier ? openVisitBills : undefined} />
            ) : floorSubTab === 'DENAH' ? (
              <div>
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
              <div className="space-y-6">
                {/* Left 6 cols: Bantuan meja */}
                {floorSubTab === 'PANGGILAN' && <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[var(--primary-ink)]" />
                    <h2 className="font-heading text-[17px] font-bold">
                      {t("Bantuan meja", "Table assistance")}
                    </h2>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><input type="checkbox" checked={showResolvedRequests} onChange={(e) => setShowResolvedRequests(e.target.checked)} className="accent-[var(--primary-ink)]" />{t("Tampilkan permintaan selesai", "Show completed requests")}</label>
                  {!(snapshot?.serviceRequests || []).some((sr: any) => showResolvedRequests || sr.state !== 'RESOLVED') && <EmptyState title={t("Semua tamu terlayani", "All guests assisted")} />}
                  <div className="operation-list">
                    {(snapshot?.serviceRequests || []).filter((sr: any) => showResolvedRequests || sr.state !== 'RESOLVED').map((sr: any) => (
                      <div
                        key={sr.id}
                        data-service-request-id={sr.id}
                        className="operation-record flex flex-wrap items-center justify-between gap-3"
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
                </section>}

                {/* Waiting parties have their own task view. */}
                {floorSubTab === 'ANTREAN' && <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--primary-ink)]" />
                    <h2 className="font-heading text-[17px] font-bold">
                      {t("Antrean meja", "Table waitlist")}
                    </h2>
                  </div>

                  <div className="operation-list">
                    {(snapshot?.waitlistEntries || []).map((w: any) => (
                      <div
                        key={w.id}
                        data-waitlist-id={w.id}
                        className="operation-record flex flex-wrap items-center justify-between gap-3"
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
                            {w.heldTableLabel ? t(` · Ditahan di Meja ${w.heldTableLabel}`, ` · Held at table ${w.heldTableLabel}`) : ''}
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
                </section>}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: KATALOG MENU, MULTI-FOTO & STOK PORSI                        */}
        {/* =================================================================== */}
        {sectionEnabled('menu') && currentSection === 'menu' && (
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

            {/* One menu entry and its availability controls per record. */}
            <div className="operation-list">
              {filteredCatalog.map((item: any) => {
                const itemPhotos: string[] = Array.isArray(item.photos)
                  ? item.photos
                  : item.photoUrl
                  ? [item.photoUrl]
                  : [];

                return (
                  <div
                    key={item.id}
                    data-menu-item-id={item.id}
                    className="operation-record flex flex-wrap items-center justify-between gap-4"
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
              <div className="operation-list">
                {(snapshot?.stockPools || [])
                  .filter((p: any) => p.mode === 'FINITE')
                  .map((p: any) => (
                    <div
                      key={p.id}
                      data-stock-pool-id={p.id}
                      className="operation-record flex flex-wrap items-center justify-between gap-3 text-[14px]"
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
                            toast.success(t(`Stok ${p.name} berhasil diperbarui.`, `Stock for ${p.name} updated.`));
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
        {/* TAB 5: LAPORAN & SHIFT KASIR                                        */}
        {/* =================================================================== */}
        {sectionEnabled('laporan') && currentSection === 'laporan' && (
          <div key="pos-laporan" className="space-y-6">
            <div className="space-y-3 border-b border-[var(--border)] pb-4">
              <ChoiceStrip<ReportPeriod>
                ariaLabel={t('Periode laporan', 'Reporting period')}
                variant="segmented"
                items={[
                  { id: 'day', label: t('Harian', 'Day') },
                  { id: 'week', label: t('Mingguan', 'Week') },
                  { id: 'month', label: t('Bulanan', 'Month') },
                  { id: 'custom', label: t('Rentang khusus', 'Custom range') },
                ]}
                value={reportPeriod}
                onChange={period => {
                  if (period === 'custom' && !customReportInitialized.current) {
                    setReportStartDate(reportRange?.start || reportDate);
                    setReportEndDate(reportRange?.end || reportDate);
                    customReportInitialized.current = true;
                  }
                  setReportPeriod(period);
                }}
              />
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-2">
                  {reportPeriod === 'day' && <div className="space-y-1"><Label htmlFor="report-date">{t('Tanggal tagihan', 'Bill date')}</Label><Input id="report-date" type="date" value={reportDate} onChange={event => { if (event.target.value) setReportDate(event.target.value); }} /></div>}
                  {reportPeriod === 'week' && <div className="space-y-1"><Label htmlFor="report-week-date">{t('Tanggal dalam minggu', 'Date within week')}</Label><Input id="report-week-date" type="date" value={reportDate} onChange={event => { if (event.target.value) setReportDate(event.target.value); }} /></div>}
                  {reportPeriod === 'month' && <div className="space-y-1"><Label htmlFor="report-month">{t('Bulan tagihan', 'Bill month')}</Label><Input id="report-month" type="month" value={reportDate.slice(0, 7)} onChange={event => { if (event.target.value) setReportDate(`${event.target.value}-01`); }} /></div>}
                  {reportPeriod === 'custom' && <>
                    <div className="space-y-1"><Label htmlFor="report-start-date">{t('Dari tanggal', 'Start date')}</Label><Input id="report-start-date" type="date" value={reportStartDate} aria-invalid={!reportRange} aria-describedby={!reportRange ? 'report-range-error' : undefined} onChange={event => setReportStartDate(event.target.value)} /></div>
                    <div className="space-y-1"><Label htmlFor="report-end-date">{t('Sampai tanggal', 'End date')}</Label><Input id="report-end-date" type="date" value={reportEndDate} aria-invalid={!reportRange} aria-describedby={!reportRange ? 'report-range-error' : undefined} onChange={event => setReportEndDate(event.target.value)} /></div>
                  </>}
                  <Button variant="secondary" size="sm" onClick={() => {
                    if (reportPeriod === 'custom') { setReportStartDate(todayReportDate); setReportEndDate(todayReportDate); }
                    else setReportDate(todayReportDate);
                  }}>{reportPeriod === 'week' ? t('Minggu ini', 'This week') : reportPeriod === 'month' ? t('Bulan ini', 'This month') : t('Hari ini', 'Today')}</Button>
                </div>
                <div className="space-y-1">
                  <Button variant="secondary" size="sm" disabled={!reportRange || !reportBills.length} onClick={handleExportReportCsv}><Download className="w-4 h-4" />{t('Unduh CSV', 'Download CSV')}</Button>
                  {reportRange && !reportBills.length && <p className="text-xs text-[var(--muted-foreground)]">{t('Tidak ada tagihan untuk diunduh.', 'No bills to download.')}</p>}
                </div>
              </div>
              {!reportRange ? <p id="report-range-error" role="alert" className="text-sm text-[var(--status-danger-fg)]">{t('Masukkan tanggal yang valid; tanggal awal tidak boleh setelah tanggal akhir.', 'Enter valid dates; the start date must not be after the end date.')}</p> : <p className="text-sm text-[var(--muted-foreground)]" aria-live="polite">{t('Tanggal bisnis', 'Business dates')}: <span className="font-medium text-[var(--foreground)] tabular-nums">{reportRange.start}{reportRange.start !== reportRange.end && ` – ${reportRange.end}`}</span>{reportPeriod === 'week' && ` · ${t('Senin–Minggu', 'Monday–Sunday')}`}{reportRange.start !== reportRange.end && ` · ${t('termasuk kedua tanggal', 'both dates inclusive')}`}</p>}
            </div>
            {reportRange && <>
            <dl className={styles.reportSummary}>
              <div><dt>{t('Tagihan', 'Bills')}</dt><dd>{reportBills.length}</dd></div>
              <div><dt>{t('Nilai tagihan', 'Billed amount')}</dt><dd><Money amount={reportTotals.billed} /></dd></div>
              <div><dt>{t('Diterima bersih', 'Net receipts')}</dt><dd><Money amount={reportTotals.received - reportTotals.refunded} /></dd></div>
              <div><dt>{t('Belum dibayar', 'Unpaid')}</dt><dd><Money amount={reportTotals.outstanding} /></dd></div>
            </dl>
            {reportSpansMultipleDays && reportDays.length > 0 && <Surface variant="task" className="space-y-3">
              <div><h2 className="font-heading text-lg font-semibold">{t('Ringkasan harian', 'Daily summary')}</h2></div>
              <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--border)]" role="region" aria-label={t('Ringkasan laporan harian', 'Daily report summary')} tabIndex={0}>
                <table className="w-full min-w-[820px] text-sm text-left"><thead className="bg-[var(--background)]"><tr>{[t('Tanggal bisnis', 'Business date'), t('Tagihan', 'Bills'), t('Nilai tagihan', 'Billed amount'), t('Diterima', 'Received'), t('Pengembalian', 'Refunds'), t('Diterima bersih', 'Net receipts'), t('Belum dibayar', 'Outstanding')].map(heading => <th key={heading} scope="col" className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-[var(--border)]">{reportDays.map(day => <tr key={day.date}><th scope="row" className="px-4 py-3 font-medium tabular-nums">{day.date}</th><td className="px-4 py-3 tabular-nums">{day.count}</td><td className="px-4 py-3"><Money amount={day.billed} /></td><td className="px-4 py-3"><Money amount={day.received} /></td><td className="px-4 py-3"><Money amount={day.refunded} /></td><td className="px-4 py-3"><Money amount={day.received - day.refunded} /></td><td className="px-4 py-3"><Money amount={day.outstanding} /></td></tr>)}</tbody>
                </table>
              </div>
            </Surface>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Surface variant="task" className="space-y-3"><h2 className="font-heading text-lg font-semibold">{t("Rincian tagihan", "Bill details")}</h2><dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
                {[[t('Harga menu', 'Menu price'), reportTotals.subtotal], [t('Potongan', 'Discount'), -reportTotals.discount], [t('Biaya layanan', 'Service charge'), reportTotals.service], [t('Pajak', 'Tax'), reportTotals.tax], [t('Koreksi tagihan', 'Bill adjustment'), reportTotals.corrections], [t('Nilai tagihan setelah koreksi', 'Bill after adjustment'), reportTotals.billed]].map(([label, amount]) => <div key={label} className="py-3 flex justify-between gap-3"><dt>{label}</dt><dd><Money amount={Number(amount)} /></dd></div>)}
              </dl></Surface>
              <Surface variant="task" className="space-y-3"><h2 className="font-heading text-lg font-semibold">{t("Pembayaran", "Payment")}</h2><dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm"><div className="py-3 flex justify-between gap-3"><dt>{t("Pembayaran diterima", "Payments received")}</dt><dd><Money amount={reportTotals.received} /></dd></div><div className="py-3 flex justify-between gap-3"><dt>{t("Uang dikembalikan", "Refunds")}</dt><dd><Money amount={-reportTotals.refunded} /></dd></div><div className="py-3 flex justify-between gap-3 font-semibold"><dt>{t("Penerimaan bersih", "Net receipts")}</dt><dd><Money amount={reportTotals.received - reportTotals.refunded} /></dd></div></dl><p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("Pembayaran dan pengembalian mengikuti tagihan terpilih, termasuk transaksi di luar periode.", "Payments and refunds include transactions outside the period for the selected bills.")}</p></Surface>
            </div>
            <Surface variant="task" className="space-y-3">
              <h2 className="font-heading text-lg font-semibold">{t('Daftar tagihan', 'Bills')}</h2>
              {!reportBills.length ? <EmptyState title={t('Belum ada tagihan', 'No bills yet')} /> : <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--border)]" role="region" aria-label={reportPeriod === 'day' ? t('Daftar tagihan tanggal terpilih', 'Bills for selected date') : t('Daftar tagihan periode terpilih', 'Bills for selected period')} tabIndex={0}>
                <table className="w-full min-w-[620px] text-sm text-left"><thead className="bg-[var(--background)]"><tr>{(reportSpansMultipleDays ? [t('Tanggal bisnis', 'Business date')] : []).concat([t('Pemesan / meja', 'Customer / table'), 'Status', t('Nilai tagihan', 'Billed amount'), t('Diterima bersih', 'Net receipts'), t('Sisa', 'Remaining')]).map(heading => <th key={heading} scope="col" className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-[var(--border)]">{reportBills.map((bill: any) => <tr key={bill.id}>{reportSpansMultipleDays && <td className="px-4 py-3 tabular-nums">{bill.businessDate}</td>}<th scope="row" className="px-4 py-3 font-normal"><span className="block font-medium">{bill.ownerLabel}</span><span className="text-xs text-[var(--muted-foreground)]">{bill.tableLabel}</span></th><td className="px-4 py-3">{formatPaymentStateLabel(bill.paymentState, t).label}</td><td className="px-4 py-3"><Money amount={reportBilledAmount(bill)} /></td><td className="px-4 py-3"><Money amount={Number(bill.verifiedReceiptsIdr || 0) - Number(bill.refundedIdr || 0)} /></td><td className="px-4 py-3"><Money amount={bill.balanceIdr} /></td></tr>)}</tbody>
                </table>
              </div>}
            </Surface>
            <Surface variant="task" className="space-y-3"><h2 className="font-heading text-lg font-semibold">{t('Catatan shift kasir', 'Cashier shift notes')}</h2>{!reportShifts.length ? <p className="text-sm text-[var(--muted-foreground)]">{t('Tidak ada shift pada periode ini.', 'No shifts in this period.')}</p> : <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{reportShifts.map((shift: any) => <div key={shift.id} className="py-4 flex flex-wrap justify-between gap-4"><div><p className="text-sm font-semibold">{shift.drawerName}</p><p className="text-xs text-[var(--muted-foreground)] mt-1">{reportSpansMultipleDays && <><span className="tabular-nums">{shift.businessDate}</span> · </>}{shift.operatorName} · {shift.state === 'OPEN' ? t('Terbuka', 'Open') : t('Ditutup', 'Closed')}</p></div><dl className="flex flex-wrap gap-5 text-sm"><div><dt className="text-xs text-[var(--muted-foreground)]">{t('Perkiraan laci', 'Expected cash')}</dt><dd className="mt-1"><Money amount={shift.expectedCashIdr} /></dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">{t('Uang terhitung', 'Counted cash')}</dt><dd className="mt-1">{shift.countedCashIdr == null ? t('Belum ditutup', 'Not closed') : <Money amount={shift.countedCashIdr} />}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">{t('Selisih', 'Difference')}</dt><dd className="mt-1">{shift.varianceIdr == null ? t('Belum ditutup', 'Not closed') : <Money amount={shift.varianceIdr} signed />}</dd></div></dl></div>)}</div>}</Surface>
            </>}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 6: PENGATURAN PAJAK, PROMO & OUTLET                             */}
        {/* =================================================================== */}
        {sectionEnabled('pengaturan') && currentSection === 'pengaturan' && (
          <div
            key="pos-pengaturan"
            className="space-y-6"
          >


            {(canCashier || isModuleEnabled('ordering')) && <section aria-label={t("Alur pemesanan", "Ordering flow")} className="operation-record space-y-4">
              <div><h2 className="font-heading text-lg font-semibold">{t("Alur pemesanan", "Ordering flow")}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{t("Berlaku untuk pesanan yang diterima setelah pengaturan disimpan. Pesanan yang sudah diterima tetap memakai aturan semula.", "Applies to orders accepted after saving. Previously accepted orders keep their original rules.")}</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label htmlFor="dine-payment-policy">{t("Pembayaran makan di tempat", "Dine-in payment")}</Label><SelectField id="dine-payment-policy" value={policyEditing ? customPaymentPolicy : snapshot?.outlet?.paymentPolicy || 'PREPAY'} disabled={!canCashier && !isModuleEnabled('payments')} onChange={event => { editPolicy(); setCustomPaymentPolicy(event.target.value); }}><option value="PREPAY">{t("Bayar sebelum dibuat", "Pay before preparation")}</option><option value="PAY_LATER">{t("Bayar setelah makan", "Pay after dining")}</option></SelectField></div>
                <div className="space-y-1.5"><Label htmlFor="takeaway-payment-policy">{t("Pembayaran bawa pulang", "Takeaway payment")}</Label><SelectField id="takeaway-payment-policy" value={policyEditing ? customTakeawayPolicy : snapshot?.outlet?.takeawayPaymentPolicy || 'PREPAY'} disabled={!canCashier && !isModuleEnabled('payments')} onChange={event => { editPolicy(); setCustomTakeawayPolicy(event.target.value); }}><option value="PREPAY">{t("Bayar sebelum dibuat", "Pay before preparation")}</option><option value="PAY_LATER">{t("Bayar saat pengambilan", "Pay on pickup")}</option></SelectField></div>
              </div>
              {!canCashier && !isModuleEnabled('payments') && <p className="text-sm text-[var(--muted-foreground)]">{t("Pembayaran ditangani kasir di luar sistem. Staf dapat mengonfirmasi penerimaan pembayaran pada tagihan pesanan.", "Payment is handled by the cashier outside the system. Staff can confirm payment on the order bill.")}</p>}
              <label className="flex items-center gap-3 text-sm min-h-11"><input type="checkbox" className="h-4 w-4 accent-[var(--primary-ink)]" checked={policyEditing ? customAutoAccept : Boolean(snapshot?.outlet?.autoAcceptParticipant)} onChange={event => { editPolicy(); setCustomAutoAccept(event.target.checked); }} />{t("Terima otomatis pesanan tambahan tamu aktif", "Automatically accept additional orders from active guests")}</label>
              <p className="text-xs text-[var(--muted-foreground)]">{t("Pesanan pertama tetap menunggu konfirmasi staf. Tamu yang sudah diterima dapat menambah pesanan dalam kunjungan yang sama.", "The first order still requires staff confirmation. Accepted guests can place additional orders during the same visit.")}</p>
              <Button disabled={busy} onClick={async () => { try { await runStaffCommand('SETTINGS_PROMO_FEEDBACK_ACTION', { action: 'UPDATE_OUTLET_POLICY', paymentPolicy: !canCashier && !isModuleEnabled('payments') ? 'PAY_LATER' : policyEditing ? customPaymentPolicy : snapshot?.outlet?.paymentPolicy, takeawayPaymentPolicy: !canCashier && !isModuleEnabled('payments') ? 'PAY_LATER' : policyEditing ? customTakeawayPolicy : snapshot?.outlet?.takeawayPaymentPolicy, autoAcceptParticipant: policyEditing ? customAutoAccept : Boolean(snapshot?.outlet?.autoAcceptParticipant) }); setPolicyEditing(false); toast.success(t("Alur pemesanan disimpan. Pesanan berikutnya mengikuti pengaturan ini.", "Ordering settings saved. Future orders will use these settings.")); } catch { /* Displayed by runStaffCommand. */ } }}>{t("Simpan alur pemesanan", "Save ordering flow")}</Button>
            </section>}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 6 cols: Tax & Service Charge Config */}
              <section className="operation-record lg:col-span-6 space-y-4">
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
                          toast.success(t(`Skema biaya diperbarui: ${preset.label}`, `Charge scheme updated: ${preset.label}`));
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
                      toast.success(t("Pajak & layanan disimpan.", "Tax and service settings saved."));
                    }}
                  >
                    {t("Simpan", "Save")}
                  </Button>
                </div>
              </section>

              {/* Right 6 cols: Promo Rules & Customer Reviews */}
              {canMarketing && <section className="operation-record lg:col-span-6 space-y-6">
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
        {rejectingRequest && <div className="space-y-4"><p className="text-sm">{t("Pesanan", "Order")} {rejectingRequest.customerName} {t("belum akan dibuat. Alasan ini juga terlihat oleh pelanggan.", "will not be prepared. The customer will also see this reason.")}</p><div className="space-y-1.5"><Label htmlFor="order-reject-reason">{t("Alasan penolakan", "Reason for rejection")}</Label><Textarea id="order-reject-reason" value={rejectReason} maxLength={500} onChange={event => setRejectReason(event.target.value)} placeholder={t("Contoh: varian yang dipilih baru saja habis", "Example: the selected variant has just sold out")} /></div><InlineError message={modalActionError} /><div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setRejectingRequest(null)}>{t("Kembali", "Back")}</Button><Button variant="danger" disabled={busy || rejectReason.trim().length < 3} onClick={async () => { setModalActionError(''); try { await runStaffCommand('REJECT_ORDER_REQUEST', { orderRequestId: rejectingRequest.id, reason: rejectReason.trim() }); toast.success(t(`Pesanan ${rejectingRequest.customerName} ditolak dengan alasan yang tercatat.`, `Order for ${rejectingRequest.customerName} rejected with the recorded reason.`)); setRejectingRequest(null); } catch (caught) { setModalActionError(caught instanceof Error ? caught.message : t("Pesanan belum ditolak.", "The order was not rejected.")); } }}>{t("Konfirmasi penolakan", "Confirm rejection")}</Button></div></div>}
      </DialogModal>

      {/* ===================================================================== */}
      {/* MODAL 1: BUAT PESANAN BARU OLEH KASIR / PELAYAN                       */}
      {/* ===================================================================== */}
      <DialogModal open={newOrderModalOpen} onClose={() => { if (!busy) setNewOrderModalOpen(false); }} title={t("Pesanan baru", "New orders")} maxWidth="max-w-5xl">
        {newOrderModalOpen && <PosComposer snapshot={snapshot} busy={busy} actorId={activeStaff} actorName={currentStaffObj.userName} actorRole={currentStaffObj.role} onCommand={onCommand} onComplete={(billId) => { if (billId) { setSelectedBillId(billId); setBillSearch(''); setBillFilter('ALL'); setCashierTask('bills'); } setNewOrderModalOpen(false); toast.success(t("Pesanan dibuat. Periksa tagihan dan status pembayarannya.", "Order created. Check the bill and payment status.")); }} />}
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
                    toast.success(response?.result?.refundId ? t("Item dibatalkan dan pengembalian pembayaran tercatat.", "Item cancelled and refund recorded.") : t("Item dibatalkan dan tagihan telah dikoreksi.", "Item cancelled and bill adjusted."));
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
                  toast.success(t("Kategori baru berhasil ditambahkan.", "The new category was added."));
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
                toast.success(t("Menu baru berhasil ditambahkan ke katalog.", "The new item was added to the catalogue."));
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
                  toast.success(t(`Galeri foto ${editingPhotosItem.name} berhasil disimpan.`, `Photo gallery for ${editingPhotosItem.name} saved.`));
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
                  toast.success(t("Katalog CSV berhasil diimpor.", "The CSV catalogue was imported."));
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
              toast.success(t(`Voucher promo ${newPromoCode} berhasil diterbitkan.`, `Promotion voucher ${newPromoCode} published.`));
            }}
          >
            {t("Terbitkan voucher", "Publish voucher")}
          </Button>
        </div>
      </DialogModal>
    </div>
  );
}
