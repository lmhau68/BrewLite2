import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo schema cho menu: `products`, `product_sizes`, `toppings`,
 * `product_toppings` (quan hệ nhiều-nhiều giữa sản phẩm và topping).
 *
 * Tiền lưu bằng số nguyên VND và tồn kho không âm, theo BR-01/BR-02 và ADR-003.
 */
export class CreateProductsSchema1736000000000 implements MigrationInterface {
  name = 'CreateProductsSchema1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(200) NOT NULL,
        "slug" varchar(200) NOT NULL,
        "description" text,
        "base_price" integer NOT NULL,
        "category" varchar(100) NOT NULL,
        "image_url" varchar(500),
        "stock_quantity" integer NOT NULL DEFAULT 0,
        "is_available" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_products_slug" UNIQUE ("slug"),
        CONSTRAINT "CHK_products_stock_non_negative" CHECK ("stock_quantity" >= 0),
        CONSTRAINT "CHK_products_base_price_non_negative" CHECK ("base_price" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "product_sizes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "size_name" varchar(20) NOT NULL,
        "price" integer NOT NULL DEFAULT 0,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_product_sizes_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_product_sizes_price_non_negative" CHECK ("price" >= 0),
        CONSTRAINT "FK_product_sizes_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "toppings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "slug" varchar(100) NOT NULL,
        "price" integer NOT NULL DEFAULT 0,
        "stock_quantity" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_toppings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_toppings_slug" UNIQUE ("slug"),
        CONSTRAINT "CHK_toppings_price_non_negative" CHECK ("price" >= 0),
        CONSTRAINT "CHK_toppings_stock_non_negative" CHECK ("stock_quantity" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "product_toppings" (
        "product_id" uuid NOT NULL,
        "topping_id" uuid NOT NULL,
        CONSTRAINT "PK_product_toppings" PRIMARY KEY ("product_id", "topping_id"),
        CONSTRAINT "FK_product_toppings_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_toppings_topping" FOREIGN KEY ("topping_id")
          REFERENCES "toppings"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_products_category" ON "products" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_is_available" ON "products" ("is_available")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_sizes_product_id" ON "product_sizes" ("product_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "product_toppings"`);
    await queryRunner.query(`DROP TABLE "toppings"`);
    await queryRunner.query(`DROP TABLE "product_sizes"`);
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
