/**
 * Dữ liệu mẫu cho menu BrewLite.
 *
 * Giá là số nguyên VND theo BR-01. Phụ thu size: S +0đ, M +6.000đ, L +10.000đ.
 * Seed là idempotent: upsert theo khoá tự nhiên (`slug`), chạy lại không nhân đôi
 * dữ liệu (NFR-06).
 */

export interface SeedSize {
  sizeName: string;
  price: number;
  sortOrder: number;
}

export interface SeedProduct {
  /** Khoá tự nhiên ổn định, dùng để upsert idempotent. */
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  category: string;
  imageUrl: string;
  stockQuantity: number;
  isAvailable: boolean;
  sortOrder: number;
  sizes: SeedSize[];
  /** Slug của topping áp dụng cho món này. */
  toppingSlugs: string[];
}

export interface SeedTopping {
  slug: string;
  name: string;
  price: number;
  stockQuantity: number;
}

/** Phụ thu size dùng chung cho mọi món. */
const DEFAULT_SIZES: SeedSize[] = [
  { sizeName: 'S', price: 0, sortOrder: 1 },
  { sizeName: 'M', price: 6000, sortOrder: 2 },
  { sizeName: 'L', price: 10000, sortOrder: 3 },
];

export const SEED_TOPPINGS: SeedTopping[] = [
  { slug: 'tran-chau-den', name: 'Trân châu đen', price: 5000, stockQuantity: 100 },
  { slug: 'thach-tran-chau', name: 'Thạch trân châu', price: 4000, stockQuantity: 100 },
  { slug: 'sua-nuc', name: 'Sữa nước', price: 7000, stockQuantity: 80 },
  { slug: 'kem-pho-mai', name: 'Kem phô mai', price: 9000, stockQuantity: 60 },
  { slug: 'cafe-tran-chau', name: 'Cafe trân châu', price: 12000, stockQuantity: 40 },
];

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: 'bac-xiu-da',
    name: 'Bạc Xỉu Đá',
    description:
      'Cà phê đen đá pha sẵn, đậm và đậm chất, thêm chút sữa để dịu vị.',
    basePrice: 25000,
    category: 'Cà phê',
    imageUrl: '/images/menu/bac-xiu-da.jpg',
    stockQuantity: 40,
    isAvailable: true,
    sortOrder: 1,
    sizes: DEFAULT_SIZES,
    toppingSlugs: ['tran-chau-den', 'thach-tran-chau'],
  },
  {
    slug: 'ca-phe-den-da',
    name: 'Cà Phê Đen Đá',
    description: 'Cà phê đen nguyên chất pha phin truyền thống, không đường.',
    basePrice: 20000,
    category: 'Cà phê',
    imageUrl: '/images/menu/ca-phe-den-da.jpg',
    stockQuantity: 50,
    isAvailable: true,
    sortOrder: 2,
    sizes: DEFAULT_SIZES,
    toppingSlugs: ['sua-nuc'],
  },
  {
    slug: 'ca-phe-sua-da',
    name: 'Cà Phê Sữa Đá',
    description: 'Cà phê đen pha với sữa đặc, hương vị đậm dịu sữa.',
    basePrice: 28000,
    category: 'Cà phê',
    imageUrl: '/images/menu/ca-phe-sua-da.jpg',
    stockQuantity: 35,
    isAvailable: true,
    sortOrder: 3,
    sizes: DEFAULT_SIZES,
    toppingSlugs: ['tran-chau-den', 'sua-nuc'],
  },
  {
    slug: 'bach-xiu',
    name: 'Bạc Xỉu',
    description: 'Cà phê sữa đá kèm trân châu đen, dẻo và vị trân châu tươi.',
    basePrice: 39000,
    category: 'Cà phê',
    imageUrl: '/images/menu/bach-xiu.jpg',
    stockQuantity: 25,
    isAvailable: true,
    sortOrder: 4,
    sizes: DEFAULT_SIZES,
    toppingSlugs: ['tran-chau-den', 'cafe-tran-chau'],
  },
  {
    slug: 'tra-dau',
    name: 'Trà Đào',
    description: 'Trà đào pha lạnh, vị đào tươi thơm ngon, có thể thêm trân châu.',
    basePrice: 32000,
    category: 'Trà',
    imageUrl: '/images/menu/tra-dau.jpg',
    stockQuantity: 30,
    isAvailable: true,
    sortOrder: 5,
    sizes: DEFAULT_SIZES,
    toppingSlugs: ['tran-chau-den', 'thach-tran-chau'],
  },
  {
    slug: 'tra-vai',
    name: 'Trà Vải',
    description: 'Trà vải tươi mát, vị dịu ngọt, thích hợp cho ngày nắng.',
    basePrice: 30000,
    category: 'Trà',
    imageUrl: '/images/menu/tra-vai.jpg',
    stockQuantity: 28,
    isAvailable: true,
    sortOrder: 6,
    sizes: DEFAULT_SIZES,
    toppingSlugs: ['tran-chau-den'],
  },
  {
    slug: 'matcha-latte',
    name: 'Matcha Latte',
    description: 'Trà xanh matcha thượng hạng kết hợp sữa tươi, đậm và béo.',
    basePrice: 45000,
    category: 'Trà',
    imageUrl: '/images/menu/matcha-latte.jpg',
    stockQuantity: 15,
    isAvailable: true,
    sortOrder: 7,
    sizes: DEFAULT_SIZES,
    toppingSlugs: ['kem-pho-mai'],
  },
  {
    slug: 'soda-viet-mat',
    name: 'Soda Việt Quất',
    description: 'Soda việt quất chanh tươi, sủi bọt nhẹ, giải khát.',
    basePrice: 35000,
    category: 'Nước khác',
    imageUrl: '/images/menu/soda-viet-mat.jpg',
    stockQuantity: 20,
    isAvailable: true,
    sortOrder: 8,
    sizes: DEFAULT_SIZES,
    toppingSlugs: [],
  },
  {
    slug: 'nuoc-muong-mat-chanh',
    name: 'Nước Mứng Mật Chanh',
    description: 'Nước mứng mật ong pha chanh tươi, giải khát mùa hè.',
    basePrice: 25000,
    category: 'Nước khác',
    imageUrl: '/images/menu/nuoc-muong-mat-chanh.jpg',
    stockQuantity: 18,
    isAvailable: true,
    sortOrder: 9,
    sizes: DEFAULT_SIZES,
    toppingSlugs: [],
  },
  {
    slug: 'ca-phe-muong',
    name: 'Cà Phê Muống',
    description: 'Cà phê pha thêm chút muối, vị đậm đà đặc trưng miền Nam.',
    basePrice: 30000,
    category: 'Cà phê đặc sản',
    imageUrl: '/images/menu/ca-phe-muong.jpg',
    stockQuantity: 0,
    isAvailable: true,
    sortOrder: 10,
    sizes: DEFAULT_SIZES,
    toppingSlugs: ['sua-nuc'],
  },
  {
    slug: 'ca-phe-dak-la',
    name: 'Cà Phê Dắk Lê',
    description: 'Cà phê nhân dắk lê Đắk Lắk, hương vị đậm đà đặc trưng.',
    basePrice: 42000,
    category: 'Cà phê đặc sản',
    imageUrl: '/images/menu/ca-phe-dak-la.jpg',
    stockQuantity: 0,
    isAvailable: false,
    sortOrder: 11,
    sizes: DEFAULT_SIZES,
    toppingSlugs: [],
  },
];
