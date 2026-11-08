import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity.js';
import {
  OrderItem,
  ToppingSnapshot,
} from '../../database/entities/order-item.entity.js';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import { Topping } from '../../database/entities/topping.entity.js';
import { User } from '../../database/entities/user.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

const KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}

  async createOrder(
    userId: string,
    idempotencyKey: string | undefined,
    dto: CreateOrderDto,
  ) {
    if (!idempotencyKey || !KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException('Thiếu Idempotency-Key hợp lệ');
    }

    const fingerprint = this.fingerprint(dto);
    try {
      return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
        const users = manager.getRepository(User);
        const user = await users.findOne({
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new NotFoundException('Không tìm thấy tài khoản');

        const orders = manager.getRepository(Order);
        const existing = await orders.findOne({
          where: { userId, idempotencyKey },
          relations: { items: true },
        });
        if (existing) {
          if (existing.requestFingerprint !== fingerprint) {
            throw new ConflictException(
              'Idempotency-Key đã được dùng với giỏ hàng khác',
            );
          }
          return this.toPublicOrder(existing);
        }

        const productRepo = manager.getRepository(Product);
        const toppingRepo = manager.getRepository(Topping);
        const itemRepo = manager.getRepository(OrderItem);
        const itemSnapshots: Array<Partial<OrderItem>> = [];
        let totalAmount = 0;

        for (const requestedItem of dto.items) {
          const product = await productRepo
            .createQueryBuilder('product')
            .setLock('pessimistic_write')
            .where('product.id = :id', { id: requestedItem.productId })
            .getOne();
          if (!product) {
            throw new UnprocessableEntityException('Sản phẩm không còn tồn tại');
          }
          if (!product.isAvailable || product.stockQuantity < requestedItem.quantity) {
            throw new ConflictException(
              `Sản phẩm "${product.name}" không đủ tồn kho`,
            );
          }

          const options = await productRepo.findOne({
            where: { id: product.id },
            relations: { sizes: true, toppings: true },
          });
          if (!options) throw new NotFoundException('Không tìm thấy sản phẩm');

          let sizeName: string | null = null;
          let unitPrice = product.basePrice;
          if (options.sizes.length > 0) {
            const size = options.sizes.find(
              (candidate) => candidate.id === requestedItem.sizeId,
            );
            if (!size) {
              throw new UnprocessableEntityException(
                `Kích thước không hợp lệ cho "${product.name}"`,
              );
            }
            sizeName = size.sizeName;
            unitPrice += size.price;
          } else if (requestedItem.sizeId) {
            throw new UnprocessableEntityException(
              `Sản phẩm "${product.name}" không có lựa chọn kích thước`,
            );
          }

          const supportedToppings = new Map(
            options.toppings.map((topping) => [topping.id, topping]),
          );
          const toppingSnapshots: ToppingSnapshot[] = [];
          for (const toppingId of [...(requestedItem.toppingIds ?? [])].sort()) {
            const supported = supportedToppings.get(toppingId);
            if (!supported) {
              throw new UnprocessableEntityException(
                `Topping không hợp lệ cho "${product.name}"`,
              );
            }
            const topping = await toppingRepo
              .createQueryBuilder('topping')
              .setLock('pessimistic_write')
              .where('topping.id = :id', { id: toppingId })
              .getOne();
            if (!topping || topping.stockQuantity < requestedItem.quantity) {
              throw new ConflictException(
                `Topping "${supported.name}" không đủ tồn kho`,
              );
            }
            topping.stockQuantity -= requestedItem.quantity;
            await toppingRepo.save(topping);
            unitPrice += topping.price;
            toppingSnapshots.push({
              id: topping.id,
              name: topping.name,
              price: topping.price,
            });
          }

          product.stockQuantity -= requestedItem.quantity;
          await productRepo.save(product);
          const subtotal = unitPrice * requestedItem.quantity;
          totalAmount += subtotal;
          itemSnapshots.push({
            productId: product.id,
            productName: product.name,
            sizeId: requestedItem.sizeId ?? null,
            sizeName,
            toppingsSnapshot: toppingSnapshots,
            quantity: requestedItem.quantity,
            unitPrice,
            subtotal,
          });
        }

        const order = orders.create({
          orderCode: `BL-${randomUUID().slice(0, 8).toUpperCase()}`,
          userId,
          status: OrderStatus.PENDING,
          totalAmount,
          idempotencyKey,
          requestFingerprint: fingerprint,
        });
        await orders.save(order);
        const items = itemSnapshots.map((item) =>
          itemRepo.create({ ...item, orderId: order.id }),
        );
        await itemRepo.save(items);
        order.items = items;
        return this.toPublicOrder(order);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const existing = await this.ordersRepository.findOne({
          where: { userId, idempotencyKey },
          relations: { items: true },
        });
        if (existing?.requestFingerprint === fingerprint) {
          return this.toPublicOrder(existing);
        }
        if (existing) {
          throw new ConflictException(
            'Idempotency-Key đã được dùng với giỏ hàng khác',
          );
        }
      }
      throw error;
    }
  }

  async listMine(userId: string) {
    const orders = await this.ordersRepository.find({
      where: { userId },
      relations: { items: true, payments: true },
      order: { createdAt: 'DESC' },
    });
    return orders.map((order) => this.toPublicOrder(order));
  }

  async findMine(orderId: string, userId: string) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId, userId },
      relations: { items: true, payments: true },
      order: { payments: { createdAt: 'DESC' } },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return this.toPublicOrder(order);
  }

  async listForStaff() {
    const orders = await this.ordersRepository.find({
      relations: { items: true, payments: true, user: true },
      order: { createdAt: 'ASC' },
    });
    return orders.map((order) => this.toPublicOrder(order, true));
  }

  async updateStatus(orderId: string, status: OrderStatus) {
    return this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(Order);
      const order = await orders.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

      const allowedNext = this.allowedNextStatuses(order.status);
      if (!allowedNext.includes(status)) {
        throw new ConflictException(
          `Không thể chuyển đơn từ ${order.status} sang ${status}`,
        );
      }

      if (status === OrderStatus.CANCELLED) {
        const items = await manager.getRepository(OrderItem).find({
          where: { orderId },
        });
        const pendingPayment = await manager.getRepository(Payment).findOne({
          where: { orderId, status: PaymentStatus.PENDING },
        });
        if (pendingPayment) {
          throw new ConflictException(
            'Không thể hủy khi kết quả thanh toán chưa xác định',
          );
        }
        await this.restoreInventory(manager, items);
      }

      order.status = status;
      await orders.save(order);
      const updated = await orders.findOneOrFail({
        where: { id: orderId },
        relations: { items: true, payments: true },
      });
      return this.toPublicOrder(updated);
    });
  }

  private allowedNextStatuses(status: OrderStatus): OrderStatus[] {
    switch (status) {
      case OrderStatus.PENDING:
      case OrderStatus.PAYMENT_FAILED:
        return [OrderStatus.CANCELLED];
      case OrderStatus.PAID:
        return [OrderStatus.PREPARING];
      case OrderStatus.PREPARING:
        return [OrderStatus.READY];
      case OrderStatus.READY:
        return [OrderStatus.COMPLETED];
      case OrderStatus.COMPLETED:
      case OrderStatus.CANCELLED:
        return [];
    }
  }

  private async restoreInventory(
    manager: EntityManager,
    items: OrderItem[],
  ) {
    for (const item of items) {
      await manager.increment(Product, { id: item.productId }, 'stockQuantity', item.quantity);
      for (const topping of item.toppingsSnapshot) {
        await manager.increment(Topping, { id: topping.id }, 'stockQuantity', item.quantity);
      }
    }
  }

  private fingerprint(dto: CreateOrderDto) {
    return createHash('sha256')
      .update(
        JSON.stringify(
          dto.items.map((item) => ({
            productId: item.productId,
            sizeId: item.sizeId ?? null,
            toppingIds: [...(item.toppingIds ?? [])].sort(),
            quantity: item.quantity,
          })),
        ),
      )
      .digest('hex');
  }

  private isUniqueViolation(error: unknown) {
    return (
      error instanceof QueryFailedError &&
      'code' in error.driverError &&
      error.driverError.code === '23505'
    );
  }

  private toPublicOrder(order: Order, includeCustomer = false) {
    return {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      items: order.items?.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        toppings: item.toppingsSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
      payments: order.payments?.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.paymentMethod,
        status: payment.status,
        transactionId: payment.transactionId,
        bankCode: payment.bankCode,
        maskedAccount: payment.accountLast4
          ? `****${payment.accountLast4}`
          : null,
        createdAt: payment.createdAt,
      })),
      ...(includeCustomer && order.user
        ? {
            customer: {
              id: order.user.id,
              email: order.user.email,
              fullName: order.user.fullName,
            },
          }
        : {}),
    };
  }
}
