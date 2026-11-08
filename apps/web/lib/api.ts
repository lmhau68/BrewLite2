import { getAccessToken } from './auth';
import type {
  AuthSession,
  Order,
  OrderStatus,
  PaymentSummary,
  Product,
  ProductDetail,
  PublicUser,
} from './types';

/**
 * URL của COMP-API.
 *
 * Biến `NEXT_PUBLIC_*` được nhúng lúc build (ADR-008), nên đổi URL API phải
 * build lại image. Mặc định trỏ về API chạy cùng Docker Compose.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Lỗi API đã được chuẩn hoá, mang theo mã HTTP để giao diện hiển thị
 * thông báo phù hợp (FR-14).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  authenticated?: boolean;
  idempotencyKey?: string;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }
  if (options.authenticated) {
    const token = getAccessToken();
    if (!token) throw new ApiError('Vui lòng đăng nhập để tiếp tục.', 401);
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      signal: options.signal,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
    });
  } catch (error) {
    // Lỗi mạng hoặc request bị huỷ.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(
      'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.',
      0,
    );
  }

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };

    if (Array.isArray(body.message)) {
      return body.message.join(', ');
    }

    if (typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // Body không phải JSON, dùng thông báo mặc định bên dưới.
  }

  return `Máy chủ trả về lỗi ${response.status}.`;
}

interface ProductQuery {
  category?: string;
  /** Lấy cả món đã hết hàng hoặc ngừng bán. */
  includeUnavailable?: boolean;
}

/**
 * Lấy danh sách món trong menu (FR-01).
 *
 * `category` lọc theo danh mục, `includeUnavailable` mặc định `false` nên
 * menu chính chỉ hiện món còn bán.
 */
export function fetchProducts(
  query: ProductQuery = {},
  signal?: AbortSignal,
): Promise<Product[]> {
  const params = new URLSearchParams();

  if (query.category) {
    params.set('category', query.category);
  }

  if (query.includeUnavailable) {
    params.set('includeUnavailable', 'true');
  }

  const search = params.toString();

  return request<Product[]>(`/products${search ? `?${search}` : ''}`, {
    signal,
  });
}

/**
 * Lấy chi tiết một món kèm size và topping hỗ trợ (FR-02).
 */
export function fetchProductDetail(
  id: string,
  signal?: AbortSignal,
): Promise<ProductDetail> {
  return request<ProductDetail>(`/products/${encodeURIComponent(id)}`, {
    signal,
  });
}

export function registerAccount(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  return request<AuthSession>('/auth/register', {
    method: 'POST',
    body: input,
  });
}

export function loginAccount(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', { method: 'POST', body: input });
}

export function fetchCurrentUser(): Promise<PublicUser> {
  return request<PublicUser>('/auth/me', { authenticated: true });
}

export function createOrder(
  items: Array<{
    productId: string;
    sizeId?: string;
    toppingIds: string[];
    quantity: number;
  }>,
  idempotencyKey: string,
): Promise<Order> {
  return request<Order>('/orders', {
    method: 'POST',
    authenticated: true,
    idempotencyKey,
    body: { items },
  });
}

export function fetchOrders(): Promise<Order[]> {
  return request<Order[]>('/orders', { authenticated: true });
}

export function fetchOrder(orderId: string): Promise<Order> {
  return request<Order>(`/orders/${encodeURIComponent(orderId)}`, {
    authenticated: true,
  });
}

export function fetchStaffOrders(): Promise<Order[]> {
  return request<Order[]>('/staff/orders', { authenticated: true });
}

export function updateStaffOrder(
  orderId: string,
  status: OrderStatus,
): Promise<Order> {
  return request<Order>(
    `/staff/orders/${encodeURIComponent(orderId)}/status`,
    { method: 'PATCH', authenticated: true, body: { status } },
  );
}

export function submitPayment(
  input: {
    orderId: string;
    method: 'WALLET' | 'CARD';
    bankCode?: string;
    accountNumber?: string;
  },
  idempotencyKey: string,
): Promise<PaymentSummary> {
  return request<PaymentSummary>('/payments', {
    method: 'POST',
    authenticated: true,
    idempotencyKey,
    body: input,
  });
}

export function fetchPayment(paymentId: string): Promise<PaymentSummary> {
  return request<PaymentSummary>(
    `/payments/${encodeURIComponent(paymentId)}`,
    { authenticated: true },
  );
}
