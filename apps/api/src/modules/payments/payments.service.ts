import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { isIP } from 'node:net';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity.js';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../database/entities/payment.entity.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

const KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type VnpayParams = Record<string, string>;

interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  ipnUrl: string;
  webAppUrl: string;
}

const VNPAY_SANDBOX_URL =
  'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async createPayment(
    userId: string,
    idempotencyKey: string | undefined,
    dto: CreatePaymentDto,
    clientIp = '127.0.0.1',
  ) {
    if (!idempotencyKey || !KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException('Thiếu Idempotency-Key hợp lệ');
    }
    const fingerprint = this.fingerprint(dto);
    return this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(Order);
      const order = await orders
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId AND order.userId = :userId', {
          orderId: dto.orderId,
          userId,
        })
        .getOne();
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

      const payments = manager.getRepository(Payment);
      const existing = await payments.findOne({
        where: { orderId: order.id, idempotencyKey },
      });
      if (existing) {
        if (existing.requestFingerprint !== fingerprint) {
          throw new ConflictException(
            'Idempotency-Key đã được dùng với yêu cầu thanh toán khác',
          );
        }
        return this.toPublicPayment(existing, order.status);
      }

      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.PAYMENT_FAILED
      ) {
        throw new ConflictException('Đơn hàng không ở trạng thái chờ thanh toán');
      }
      const pending = await payments.findOne({
        where: { orderId: order.id, status: PaymentStatus.PENDING },
      });
      if (pending) {
        throw new ConflictException(
          'Kết quả giao dịch chưa xác định; hãy tra cứu giao dịch trước khi thử lại',
        );
      }

      const payment = payments.create({
        orderId: order.id,
        transactionId: randomUUID().replaceAll('-', ''),
        amount: order.totalAmount,
        paymentMethod: dto.method,
        status: PaymentStatus.PENDING,
        idempotencyKey,
        requestFingerprint: fingerprint,
        bankCode: null,
        accountLast4: null,
        gatewayResponse: null,
        gatewayPaymentUrl: null,
      });

      if (order.totalAmount < 5000) {
        throw new BadRequestException(
          'VNPay Sandbox yêu cầu số tiền thanh toán tối thiểu 5.000 VND',
        );
      }
      const vnpayConfig = this.getVnpayConfig();
      payment.gatewayPaymentUrl = this.createVnpayPaymentUrl(
        payment,
        order,
        clientIp,
        vnpayConfig,
      );
      await payments.save(payment);
      return this.toPublicPayment(payment, order.status);
    });
  }

  async handleVnpayIpn(rawQuery: Record<string, unknown>) {
    const params = this.normalizeVnpayParams(rawQuery);
    const secret = this.configService.get<string>('VNPAY_HASH_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'VNPAY_HASH_SECRET phải được cấu hình để xác minh IPN',
      );
    }
    if (!params || !this.verifyVnpaySignature(params, secret)) {
      return this.vnpayIpnResponse('97', 'Invalid Checksum');
    }

    const config = this.getVnpayConfig();
    if (
      params.vnp_TmnCode !== config.tmnCode ||
      !params.vnp_TxnRef ||
      !params.vnp_Amount ||
      !params.vnp_ResponseCode ||
      !params.vnp_TransactionStatus
    ) {
      return this.vnpayIpnResponse('97', 'Invalid Checksum');
    }

    return this.dataSource.transaction(async (manager) => {
      const payments = manager.getRepository(Payment);
      const orders = manager.getRepository(Order);
      const payment = await payments.findOne({
        where: { transactionId: params.vnp_TxnRef },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment || payment.paymentMethod !== PaymentMethod.VNPAY) {
        return this.vnpayIpnResponse('01', 'Order not Found');
      }
      if (
        !/^\d+$/.test(params.vnp_Amount) ||
        Number(params.vnp_Amount) !== payment.amount * 100
      ) {
        return this.vnpayIpnResponse('04', 'Invalid Amount');
      }
      if (payment.status !== PaymentStatus.PENDING) {
        return this.vnpayIpnResponse('02', 'Order already confirmed');
      }

      const order = await orders
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId: payment.orderId })
        .getOne();
      if (!order) {
        return this.vnpayIpnResponse('01', 'Order not Found');
      }

      const success =
        params.vnp_ResponseCode === '00' &&
        params.vnp_TransactionStatus === '00';
      payment.status = success
        ? PaymentStatus.SUCCESS
        : PaymentStatus.FAILED;
      payment.gatewayResponse = `VNPAY_${params.vnp_ResponseCode}_${params.vnp_TransactionStatus}`;
      order.status = success
        ? OrderStatus.PAID
        : OrderStatus.PAYMENT_FAILED;
      await payments.save(payment);
      await orders.save(order);

      return this.vnpayIpnResponse('00', 'Confirm Success');
    });
  }

  async findMine(paymentId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(Order);
      const payments = manager.getRepository(Payment);
      const paymentReference = await payments
        .createQueryBuilder('payment')
        .innerJoin('payment.order', 'order')
        .select(['payment.id', 'payment.orderId'])
        .where('payment.id = :paymentId AND order.userId = :userId', {
          paymentId,
          userId,
        })
        .getOne();
      if (!paymentReference) {
        throw new NotFoundException('Không tìm thấy giao dịch');
      }

      const order = await orders.findOne({
        where: { id: paymentReference.orderId },
      });
      if (!order) throw new NotFoundException('Không tìm thấy giao dịch');
      const payment = await payments.findOne({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Không tìm thấy giao dịch');
      return this.toPublicPayment(payment, order.status);
    });
  }

  private getVnpayConfig(): VnpayConfig {
    const tmnCode = this.configService.get<string>('VNPAY_TMN_CODE');
    const hashSecret = this.configService.get<string>('VNPAY_HASH_SECRET');
    const ipnUrl = this.configService.get<string>('VNPAY_IPN_URL');
    const webAppUrl = this.configService.get<string>('WEB_APP_URL');
    if (!tmnCode || !hashSecret || !ipnUrl || !webAppUrl) {
      throw new InternalServerErrorException(
        'Cần cấu hình VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_IPN_URL và WEB_APP_URL',
      );
    }

    try {
      const checkout = new URL(VNPAY_SANDBOX_URL);
      const callback = new URL(ipnUrl);
      const webApp = new URL(webAppUrl);
      if (
        checkout.protocol !== 'https:' ||
        callback.protocol !== 'https:' ||
        !['http:', 'https:'].includes(webApp.protocol)
      ) {
        throw new Error('Unsupported VNPay URL protocol');
      }
    } catch {
      throw new InternalServerErrorException(
        'Cấu hình URL VNPay hoặc callback không hợp lệ',
      );
    }

    return { tmnCode, hashSecret, ipnUrl, webAppUrl };
  }

  private createVnpayPaymentUrl(
    payment: Payment,
    order: Order,
    clientIp: string,
    config: VnpayConfig,
  ) {
    const now = new Date();
    const params: VnpayParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: config.tmnCode,
      vnp_Amount: String(payment.amount * 100),
      vnp_CreateDate: this.formatVnpayDate(now),
      vnp_CurrCode: 'VND',
      vnp_IpAddr: this.normalizeClientIp(clientIp),
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan don hang ${order.orderCode}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: new URL(
        `/checkout/payment/${encodeURIComponent(order.id)}`,
        config.webAppUrl,
      ).toString(),
      vnp_TxnRef: payment.transactionId!,
      vnp_ExpireDate: this.formatVnpayDate(
        new Date(now.getTime() + 15 * 60 * 1000),
      ),
    };
    const signedQuery = this.serializeVnpayParams(params);
    const signature = createHmac('sha512', config.hashSecret)
      .update(signedQuery, 'utf8')
      .digest('hex');
    return `${VNPAY_SANDBOX_URL}?${signedQuery}&vnp_SecureHash=${signature}`;
  }

  private normalizeVnpayParams(rawQuery: Record<string, unknown>) {
    const params: VnpayParams = {};
    for (const [key, value] of Object.entries(rawQuery)) {
      if (!key.startsWith('vnp_') || typeof value !== 'string') return null;
      params[key] = value;
    }
    return params;
  }

  private verifyVnpaySignature(params: VnpayParams, secret: string) {
    const received = params.vnp_SecureHash;
    if (!received || !/^[\da-f]{128}$/i.test(received)) return false;
    const signedParams = { ...params };
    delete signedParams.vnp_SecureHash;
    delete signedParams.vnp_SecureHashType;
    const expected = createHmac('sha512', secret)
      .update(this.serializeVnpayParams(signedParams), 'utf8')
      .digest();
    const actual = Buffer.from(received, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private serializeVnpayParams(params: VnpayParams) {
    return Object.keys(params)
      .sort()
      .map(
        (key) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`,
      )
      .join('&');
  }

  private formatVnpayDate(date: Date) {
    const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return vietnamTime.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  }

  private normalizeClientIp(clientIp: string) {
    const normalized = clientIp.replace(/^::ffff:/, '');
    if (normalized === '::1' || !normalized) return '127.0.0.1';
    return isIP(normalized) ? normalized : '127.0.0.1';
  }

  private vnpayIpnResponse(RspCode: string, Message: string) {
    return { RspCode, Message };
  }

  private fingerprint(dto: CreatePaymentDto) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'JWT_SECRET phải được cấu hình trước khi thanh toán',
      );
    }
    return createHash('sha256')
      .update(
        JSON.stringify({
          orderId: dto.orderId,
          method: dto.method,
        }),
      )
      .digest('hex');
  }

  private toPublicPayment(payment: Payment, orderStatus: OrderStatus) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.paymentMethod,
      status: payment.status,
      transactionId: payment.transactionId,
      bankCode: payment.bankCode,
      maskedAccount: payment.accountLast4
        ? `****${payment.accountLast4}`
        : null,
      checkoutUrl:
        payment.paymentMethod === PaymentMethod.VNPAY &&
        payment.status === PaymentStatus.PENDING
          ? payment.gatewayPaymentUrl
          : null,
      orderStatus,
      createdAt: payment.createdAt,
    };
  }
}
