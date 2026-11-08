import type { Product } from './types';

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

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
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

  return request<Product[]>(`/products${search ? `?${search}` : ''}`, signal);
}
