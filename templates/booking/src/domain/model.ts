/** Shared public contracts. Secret/session persistence types live only in worker/. */
export const LEVELS = ["catalog", "whatsapp", "booking", "full"] as const;
export const PRESETS = [
  "medical",
  "aesthetic",
  "detailing",
  "consulting",
] as const;
export const LAYOUTS = [
  "appointment-first",
  "editorial",
  "service-market",
  "minimal-professional",
] as const;
export const PALETTES = ["sage", "rose", "slate", "ochre"] as const;
export type Level = (typeof LEVELS)[number];
export type Preset = (typeof PRESETS)[number];
export type Layout = (typeof LAYOUTS)[number];
export type Palette = (typeof PALETTES)[number];
export type Language = "id" | "en";
export type Localized = { id: string; en: string };
export type Role = "customer" | "owner" | "operations" | "viewer";
export const BOOKING_STATES = [
  "requested",
  "pending_confirmation",
  "awaiting_payment",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "expired",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATES)[number];
export type PaymentStatus =
  | "not_required"
  | "unpaid"
  | "pending"
  | "partial"
  | "paid"
  | "failed"
  | "refund_due"
  | "refunded";
export interface Capabilities {
  catalog: boolean;
  cms: boolean;
  whatsapp: boolean;
  booking: boolean;
  payments: boolean;
  tickets: boolean;
  reports: boolean;
}
export function capabilities(level: Level): Capabilities {
  const booking = level === "booking" || level === "full";
  return {
    catalog: true,
    cms: true,
    whatsapp: level !== "catalog",
    booking,
    payments: level === "full",
    tickets: level === "full",
    reports: level === "full",
  };
}
export type ResourceKind =
  | "practitioner"
  | "therapist"
  | "room"
  | "bay"
  | "professional";
/** Local wall-clock minutes, start inclusive and end exclusive. Sunday = 0. */
export interface AvailabilityRule {
  weekday: number;
  start: number;
  end: number;
}
export interface Business {
  name: string;
  headline: Localized;
  description: Localized;
  email: string;
  whatsapp: string;
  heroImage: string;
  heroAlt: Localized;
  address: string;
  example: boolean;
  faqs: { question: Localized; answer: Localized }[];
}
export interface BusinessSettings {
  preset: Preset;
  level: Level;
  layout: Layout;
  palette: Palette;
  language: Language;
  typography: "sans" | "serif";
  timezone: string;
  currency: "IDR";
  brand: Business;
  policy: {
    manualConfirmation: boolean;
    holdMinutes: number;
    paymentMinutes: number;
    minNoticeMinutes: number;
    horizonDays: number;
    cancellationHours: number;
    refundPercent: number;
    checkInEarlyMinutes: number;
    depositPercent: number;
    onlineRequired: boolean;
    text: Localized;
  };
}
export interface Location {
  id: string;
  preset: Preset;
  name: string;
  address: string;
  timezone: string;
  capacity: number;
  schedule: AvailabilityRule[];
  active: boolean;
}
export interface ServiceCategory {
  id: string;
  name: Localized;
}
export interface Service {
  id: string;
  preset: Preset;
  category: string;
  name: Localized;
  description: Localized;
  image: string;
  duration: number;
  bufferBefore: number;
  bufferAfter: number;
  price: number;
  priceMax?: number;
  capacity: number;
  locationIds: string[];
  active: boolean;
  featured: boolean;
  packageItems: Localized[];
}
export interface Practitioner {
  name: string;
  specialty: Localized;
  bio: Localized;
  initials: string;
  example: boolean;
}
export interface Resource {
  id: string;
  preset: Preset;
  name: string;
  kind: ResourceKind;
  locationId: string;
  serviceIds: string[];
  capacity: number;
  active: boolean;
  schedule: AvailabilityRule[];
  profile?: Practitioner;
}
export interface BlackoutPeriod {
  id: string;
  preset: Preset;
  resourceId: string;
  locationId: string;
  start: number;
  end: number;
  reason: string;
}
export interface Customer {
  name: string;
  phone: string;
  email: string;
}
export interface BookingItem {
  serviceId: string;
  name: Localized;
  duration: number;
  unitPrice: number;
  quantity: 1;
}
export interface BookingEvent {
  id: string;
  action: string;
  actor: string;
  note: string;
  at: number;
  internal: boolean;
}
export interface Payment {
  id: string;
  amount: number;
  provider: string;
  status: string;
  checkoutUrl: string | null;
  createdAt: number;
  reference: string;
}
export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  status: "requested" | "pending" | "confirmed" | "failed";
  reference: string;
  createdAt: number;
}
export interface Ticket {
  id: string;
  payload: string;
  usedAt: number | null;
  validUntil: number;
}
export interface Booking {
  id: string;
  reference: string;
  preset: Preset;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  customer: Customer;
  item: BookingItem;
  locationId: string;
  locationName: string;
  timezone: string;
  practitionerId: string;
  practitionerName: string;
  startsAt: number;
  endsAt: number;
  expiresAt: number | null;
  total: number;
  dueNow: number;
  paidAmount: number;
  refundedAmount: number;
  refundEligible: number;
  options: Record<string, string>;
  paymentMethod: "location" | "online";
  createdAt: number;
  updatedAt: number;
  version: number;
  events: BookingEvent[];
  payments: Payment[];
  refunds: Refund[];
  ticket: Ticket | null;
  accessToken?: string;
}
export interface BookingInput {
  serviceId: string;
  locationId: string;
  practitionerId?: string;
  startsAt: number;
  options: Record<string, string>;
  customer: Customer;
  paymentMethod: "location" | "online";
  idempotencyKey: string;
  expectedTotal: number;
}
export interface Selection {
  serviceId: string;
  locationId: string;
  practitionerId?: string;
  options: Record<string, string>;
}
export interface Slot {
  startsAt: number;
  endsAt: number;
  label: string;
  offset: string;
  practitionerId: string;
  practitionerName: string;
}
export interface Quote {
  total: number;
  duration: number;
  dueNow: number;
  paymentRequired: boolean;
}
export interface Bootstrap {
  demo: boolean;
  config: BusinessSettings;
  capabilities: Capabilities;
  categories: ServiceCategory[];
  services: Service[];
  resources: Resource[];
  locations: Location[];
  role: Role;
  paymentConfigured: boolean;
  ticketConfigured: boolean;
  revision: number;
}
export interface StaffSnapshot extends Bootstrap {
  blackouts: BlackoutPeriod[];
  metrics: {
    appointments: number;
    confirmed: number;
    pending: number;
    received: number;
    refunded: number;
    refundDue: number;
  };
}
export interface BookingPage {
  bookings: Booking[];
  total: number;
  limit: number;
  offset: number;
}
