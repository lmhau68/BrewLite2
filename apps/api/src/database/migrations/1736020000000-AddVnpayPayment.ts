import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVnpayPayment1736020000000 implements MigrationInterface {
  name = 'AddVnpayPayment1736020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'VNPAY';
      ALTER TABLE "payments"
        ADD COLUMN "gateway_payment_url" text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ hasVnpayPayments }] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM "payments" WHERE "payment_method" = 'VNPAY'
      ) AS "hasVnpayPayments"
    `);
    if (hasVnpayPayments) {
      throw new Error('Cannot remove VNPay while VNPay payment records exist');
    }

    await queryRunner.query(`
      ALTER TABLE "payments" DROP COLUMN "gateway_payment_url";
      CREATE TYPE "payment_method_old" AS ENUM ('WALLET', 'CARD');
      ALTER TABLE "payments"
        ALTER COLUMN "payment_method" TYPE "payment_method_old"
        USING "payment_method"::text::"payment_method_old";
      DROP TYPE "payment_method";
      ALTER TYPE "payment_method_old" RENAME TO "payment_method";
    `);
  }
}
