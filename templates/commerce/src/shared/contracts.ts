export type CommerceLevel = 'catalog' | 'whatsapp' | 'store' | 'advanced';
export type CommerceFeature = 'promotions' | 'taxes' | 'serviceFees' | 'customerAccounts' | 'loyaltyPoints' | 'membershipTiers';
export type CommerceModules = Partial<Record<CommerceFeature, boolean>>;
export interface PricingConfig { taxBps: number; taxIncluded: boolean; serviceFeeBps: number }
export interface LoyaltyConfig { earnSpendIdr: number; pointValueIdr: number; minRedeemPoints: number; silverSpendIdr: number; goldSpendIdr: number }
export interface LoyaltySummary { id: string; email: string; name: string; points: number; tier: 'Member' | 'Silver' | 'Gold'; completedSpend: number; verificationRequired: boolean }

export type StaffRole = 'owner' | 'operations' | 'viewer';
export type PaymentMethod = 'manual' | 'cod' | 'midtrans';
export type OrderStatus = 'awaiting_payment' | 'confirmed' | 'processing' | 'shipped' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending' | 'pending_verification' | 'paid' | 'failed' | 'refund_due' | 'refunded';
export type ReturnStatus = 'none' | 'requested' | 'approved' | 'rejected' | 'received' | 'refunded';

export interface Variant { id: string; productId: string; name: string; sku: string; price: number; stock: number; options: Record<string, string> }
export interface Product { id: string; slug: string; name: string; description: string; category: string; price: number; compareAtPrice?: number; images: string[]; material: string; featured: boolean; active: boolean; variants: Variant[]; createdAt: string }
export interface Category { id: string; name: string; description: string }
export interface ShippingMethod { id: string; name: string; description: string; fee: number; estimatedDays: string; requiresAddress: boolean }
export interface PaymentOption { id: PaymentMethod; name: string; description: string; available: boolean; demo: boolean }
export interface Capabilities { catalog: boolean; cart: boolean; whatsapp: boolean; checkout: boolean; orders: boolean; inventory: boolean; coupons: boolean; gateway: boolean; returns: boolean; reviews: boolean; wishlist: boolean; reports: boolean; taxes: boolean; serviceFees: boolean; customerAccounts: boolean; loyaltyPoints: boolean; membershipTiers: boolean }
export interface StoreConfig { schemaVersion?: number; appearance?: { layout?: string; palette?: string; card?: string; button?: string }; brand: { name: string; tagline: string; description: string; whatsapp: string; email: string; address: string }; level: CommerceLevel; preset: string; modules?: CommerceModules; pricing?: PricingConfig; loyalty?: LoyaltyConfig; currency: 'IDR'; bank: { name: string; accountNumber: string; accountHolder: string }; shippingNote: string; shippingMethods?: ShippingMethod[]; returnDays: number }
export interface Customer { name: string; phone: string; email?: string; address?: string; city?: string; postalCode?: string }
export interface CartLine { variantId: string; quantity: number }
export interface QuoteInput { items: CartLine[]; shippingMethodId?: string; couponCode?: string; redeemPoints?: number }
export interface OrderLine { variantId: string; productId: string; name: string; variantName: string; image: string; unitPrice: number; quantity: number; subtotal: number }
export interface Quote { items: OrderLine[]; subtotal: number; discount: number; shippingFee: number; taxAmount: number; taxIncluded: boolean; serviceFee: number; pointsRedeemed: number; pointsDiscount: number; total: number; couponCode: string | null; shippingMethod: ShippingMethod }
export interface CreateOrderInput extends QuoteInput { customer: Customer; paymentMethod: PaymentMethod; idempotencyKey: string; expectedTotal?: number; note?: string }
export interface TimelineEvent { id: string; action: string; label: string; note: string; createdAt: string; actor: string }
export interface Order extends Quote { id: string; number: string; trackingCode?: string; status: OrderStatus; paymentStatus: PaymentStatus; paymentMethod: PaymentMethod; returnStatus: ReturnStatus; customer: Customer; note: string; paymentReference: string; carrier: string; trackingNumber: string; returnReason: string; createdAt: string; updatedAt: string; expiresAt: string | null; paymentUrl: string | null; timeline: TimelineEvent[] }
export interface Coupon { code: string; kind: 'percentage' | 'fixed'; value: number; minSpend: number; maxDiscount: number; active: boolean; useLimit: number; usedCount: number; expiresAt: string | null }
export interface InventoryMovement { id: string; variantId: string; productName: string; variantName: string; delta: number; reason: string; orderId: string | null; createdAt: string }
export interface Review { id: string; productId: string; orderId: string; author: string; rating: number; comment: string; createdAt: string }
export interface AuditEvent { id: string; action: string; entityId: string; detail: string; actor: string; createdAt: string }
export interface Metrics { revenue: number; orders: number; pendingOrders: number; lowStock: number; customers: number; averageOrderValue: number; refunded: number }
export interface Bootstrap { config: StoreConfig; capabilities: Capabilities; products: Product[]; categories: Category[]; shippingMethods: ShippingMethod[]; paymentMethods: PaymentOption[]; demo: boolean; session: { role: 'customer' | StaffRole; authenticated: boolean }; loyalty: LoyaltySummary | null; wishlist: string[]; reviews: Review[] }
export interface StaffCustomer extends Customer { orderCount: number; totalSpent: number; lastOrderAt: string }
export interface StaffSnapshot { orders: Order[]; pagination: { limit: number; total: number; hasMore: boolean }; products: Product[]; customers: StaffCustomer[]; coupons: Coupon[]; inventory: InventoryMovement[]; audit: AuditEvent[]; metrics: Metrics; role: StaffRole; config: StoreConfig; capabilities: Capabilities }
export type CustomerOrderAction = 'cancel' | 'payment-evidence' | 'request-return' | 'confirm-received';
export type StaffOrderAction = 'confirm-payment' | 'process' | 'ship' | 'complete' | 'cancel' | 'approve-return' | 'reject-return' | 'receive-return' | 'refund';
export interface ApiErrorBody { error: { code: string; message: string }; requestId: string }
