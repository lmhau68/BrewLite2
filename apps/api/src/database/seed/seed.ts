import bcrypt from 'bcryptjs';
import { DataSource, EntityManager } from 'typeorm';
import { User, UserRole } from '../entities/user.entity.js';
import { Product } from '../entities/product.entity.js';
import { ProductSize } from '../entities/product-size.entity.js';
import { Topping } from '../entities/topping.entity.js';
import { SEED_PRODUCTS, SEED_TOPPINGS } from './data.js';

/**
 * Nạp dữ liệu menu và tài khoản nhân viên demo nếu được cấu hình.
 *
 * Idempotent: dùng `upsert` theo khoá tự nhiên `slug`, nên chạy lại nhiều lần
 * không nhân đôi dữ liệu (NFR-06). Chạy trong một transaction để không để lại
 * trạng thái dở dang.
 */
export async function seedDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const toppings = await upsertToppings(manager);

    for (const seedProduct of SEED_PRODUCTS) {
      const productId = await upsertProduct(manager, seedProduct);

      await replaceSizes(manager, productId, seedProduct.sizes);
      await replaceToppingLinks(manager, productId, seedProduct.toppingSlugs, toppings);
    }

    await seedStaffAccount(manager);
  });
}

async function seedStaffAccount(manager: EntityManager): Promise<void> {
  const configuredEmail = process.env['SEED_STAFF_EMAIL'];
  const password = process.env['SEED_STAFF_PASSWORD'];
  if (!configuredEmail && !password) return;
  if (!configuredEmail || !password) {
    throw new Error('SEED_STAFF_EMAIL và SEED_STAFF_PASSWORD phải được cấu hình cùng nhau');
  }

  const email = configuredEmail.trim().normalize('NFC').toLowerCase();
  const fullName = process.env['SEED_STAFF_NAME']?.trim() || 'BrewLite Staff';
  if (
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72 ||
    fullName.length < 2 ||
    fullName.length > 120
  ) {
    throw new Error('Thông tin tài khoản nhân viên seed không hợp lệ');
  }

  const users = manager.getRepository(User);
  const existing = await users.findOne({ where: { email } });
  if (existing) {
    if (existing.role === UserRole.CUSTOMER) {
      throw new Error('Email seed nhân viên đã thuộc về tài khoản khách hàng');
    }
    return;
  }

  await users.save(
    users.create({
      email,
      fullName,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.STAFF,
    }),
  );
}

async function upsertToppings(
  manager: EntityManager,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (const seedTopping of SEED_TOPPINGS) {
    await manager.upsert(
      Topping,
      {
        slug: seedTopping.slug,
        name: seedTopping.name,
        price: seedTopping.price,
        stockQuantity: seedTopping.stockQuantity,
      },
      { conflictPaths: ['slug'] },
    );

    // Đọc lại để lấy `id` thật, tránh phụ thuộc vào hình dạng `identifiers`.
    const topping = await manager.findOne(Topping, {
      where: { slug: seedTopping.slug },
    });

    if (topping) {
      result.set(seedTopping.slug, topping.id);
    }
  }

  return result;
}

async function upsertProduct(
  manager: EntityManager,
  seedProduct: (typeof SEED_PRODUCTS)[number],
): Promise<string> {
  await manager.upsert(
    Product,
    {
      slug: seedProduct.slug,
      name: seedProduct.name,
      description: seedProduct.description,
      basePrice: seedProduct.basePrice,
      category: seedProduct.category,
      imageUrl: seedProduct.imageUrl,
      stockQuantity: seedProduct.stockQuantity,
      isAvailable: seedProduct.isAvailable,
      sortOrder: seedProduct.sortOrder,
    },
    { conflictPaths: ['slug'] },
  );

  const product = await manager.findOne(Product, {
    where: { slug: seedProduct.slug },
  });

  if (!product) {
    throw new Error(`Không nạp được sản phẩm ${seedProduct.slug}`);
  }

  return product.id;
}

async function replaceSizes(
  manager: EntityManager,
  productId: string,
  sizes: (typeof SEED_PRODUCTS)[number]['sizes'],
): Promise<void> {
  await manager.delete(ProductSize, { productId });

  if (sizes.length === 0) {
    return;
  }

  await manager.insert(
    ProductSize,
    sizes.map((size) => ({
      productId,
      sizeName: size.sizeName,
      price: size.price,
      sortOrder: size.sortOrder,
    })),
  );
}

async function replaceToppingLinks(
  manager: EntityManager,
  productId: string,
  toppingSlugs: string[],
  toppings: Map<string, string>,
): Promise<void> {
  await manager
    .createQueryBuilder()
    .delete()
    .from('product_toppings')
    .where('product_id = :productId', { productId })
    .execute();

  const toppingIds = toppingSlugs
    .map((slug) => toppings.get(slug))
    .filter((id): id is string => Boolean(id));

  if (toppingIds.length === 0) {
    return;
  }

  await manager
    .createQueryBuilder()
    .insert()
    .into('product_toppings')
    .values(
      toppingIds.map((toppingId) => ({
        product_id: productId,
        topping_id: toppingId,
      })),
    )
    .execute();
}
