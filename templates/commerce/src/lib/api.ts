import type { Bootstrap, CartLine, Coupon, CreateOrderInput, Order, Product, Quote, QuoteInput, StaffSnapshot, StoreConfig } from '../shared/contracts';

export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); this.name = 'ApiError'; }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(body?.error?.message || 'Permintaan belum berhasil. Coba lagi.', body?.error?.code || 'REQUEST_FAILED', response.status);
  return body as T;
}
const send = <T>(path: string, data: unknown, method = 'POST') => request<T>(path, { method, body: JSON.stringify(data) });
export const api = {
  bootstrap: () => request<Bootstrap>('/bootstrap'),
  configure: (data: { level?: string; preset?: string }) => send<Bootstrap>('/demo/config', data),
  resetDemo: () => send<Bootstrap>('/session/demo', { reset: true }),
  quote: (data: QuoteInput) => send<Quote>('/quote', data),
  order: (data: CreateOrderInput) => send<Order>('/orders', data),
  orderAttempt: (key: string) => request<{ order: Order | null }>(`/orders/attempt/${encodeURIComponent(key)}`),
  orders: () => request<{ orders: Order[] }>('/orders/my'),
  orderAction: (id: string, action: string, data: Record<string, unknown> = {}) => send<Order>(`/orders/${encodeURIComponent(id)}/actions`, { action, ...data }),
  simulatePayment: (orderId: string, status: 'paid' | 'failed') => send<Order>('/demo/payment', { orderId, status }),
  staff: () => request<StaffSnapshot>('/staff/snapshot'),
  login: (password: string, role = 'owner') => send<Bootstrap>('/staff/login', { password, role }),
  retryPayment: (id: string) => send<Order>(`/orders/${encodeURIComponent(id)}/payment`, {}),
  reconcilePayment: (id: string) => send<Order>(`/orders/${encodeURIComponent(id)}/reconcile`, {}),
  logout: () => send<unknown>('/logout', {}),
  staffAction: (id: string, action: string, data: Record<string, unknown> = {}) => send<Order>(`/staff/orders/${encodeURIComponent(id)}/actions`, { action, ...data }),
  saveProduct: (product: Partial<Product>, isNew: boolean) => send<{ product: Product }>(isNew ? '/staff/products' : `/staff/products/${encodeURIComponent(product.id!)}`, product, isNew ? 'POST' : 'PUT'),
  inventory: (variantId: string, delta: number, reason: string) => send<unknown>('/staff/inventory', { variantId, delta, reason }),
  coupon: (coupon: Partial<Coupon>) => send<unknown>('/staff/coupons', coupon),
  settings: (config: Partial<StoreConfig>) => send<unknown>('/staff/settings', config, 'PUT'),
  wishlist: (productId: string) => send<{ wishlist: string[] }>('/wishlist', { productId }),
  review: (data: { productId: string; orderId: string; rating: number; comment: string }) => send<unknown>('/reviews', data),
};
export type { CartLine };
