import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCheckoutSchema1736010000000 implements MigrationInterface {
  name = 'CreateCheckoutSchema1736010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'STAFF', 'MANAGER');
      CREATE TYPE "order_status" AS ENUM (
        'PENDING', 'PAID', 'PAYMENT_FAILED', 'PREPARING',
        'READY', 'COMPLETED', 'CANCELLED'
      );
      CREATE TYPE "payment_method" AS ENUM ('WALLET', 'CARD');
      CREATE TYPE "payment_status" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL,
        "password_hash" varchar(100) NOT NULL,
        "full_name" varchar(120) NOT NULL,
        "role" "user_role" NOT NULL DEFAULT 'CUSTOMER',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      );

      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_code" varchar(40) NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "order_status" NOT NULL DEFAULT 'PENDING',
        "total_amount" integer NOT NULL,
        "idempotency_key" varchar(100) NOT NULL,
        "request_fingerprint" varchar(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_orders_order_code" UNIQUE ("order_code"),
        CONSTRAINT "UQ_orders_user_idempotency" UNIQUE ("user_id", "idempotency_key"),
        CONSTRAINT "CHK_orders_total_non_negative" CHECK ("total_amount" >= 0),
        CONSTRAINT "FK_orders_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "product_name" varchar(200) NOT NULL,
        "size_id" uuid,
        "size_name" varchar(20),
        "toppings_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "quantity" integer NOT NULL,
        "unit_price" integer NOT NULL,
        "subtotal" integer NOT NULL,
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_order_items_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "CHK_order_items_prices_non_negative" CHECK (
          "unit_price" >= 0 AND "subtotal" >= 0
        ),
        CONSTRAINT "FK_order_items_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE RESTRICT
      );

      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "transaction_id" varchar(100),
        "amount" integer NOT NULL,
        "payment_method" "payment_method" NOT NULL,
        "status" "payment_status" NOT NULL DEFAULT 'PENDING',
        "idempotency_key" varchar(100) NOT NULL,
        "request_fingerprint" varchar(64) NOT NULL,
        "bank_code" varchar(10),
        "account_last4" varchar(4),
        "gateway_response" varchar(200),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_transaction_id" UNIQUE ("transaction_id"),
        CONSTRAINT "UQ_payments_order_idempotency" UNIQUE ("order_id", "idempotency_key"),
        CONSTRAINT "CHK_payments_amount_non_negative" CHECK ("amount" >= 0),
        CONSTRAINT "CHK_payments_bank_code" CHECK (
          "bank_code" IS NULL OR "bank_code" IN ('VCB', 'TCB', 'MB', 'ACB')
        ),
        CONSTRAINT "CHK_payments_account_last4" CHECK (
          "account_last4" IS NULL OR "account_last4" ~ '^[0-9]{4}$'
        ),
        CONSTRAINT "FK_payments_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE RESTRICT
      );

      CREATE INDEX "IDX_orders_user_created" ON "orders" ("user_id", "created_at");
      CREATE INDEX "IDX_order_items_order" ON "order_items" ("order_id");
      CREATE INDEX "IDX_payments_order_status" ON "payments" ("order_id", "status");
      CREATE UNIQUE INDEX "UQ_payments_one_pending_per_order"
        ON "payments" ("order_id") WHERE "status" = 'PENDING';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "payments";
      DROP TABLE "order_items";
      DROP TABLE "orders";
      DROP TABLE "users";
      DROP TYPE "payment_status";
      DROP TYPE "payment_method";
      DROP TYPE "order_status";
      DROP TYPE "user_role";
    `);
  }
}
