import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../database/entities/user.entity.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

interface LoginAttempt {
  count: number;
  startedAt: number;
}

const WINDOW_MS = 60_000;
const MAX_FAILURES = 5;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-user-password', 10);

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<string, LoginAttempt>();

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    this.validatePassword(dto.password);
    const email = this.normalizeEmail(dto.email);
    const fullName = dto.fullName.trim();
    if (fullName.length < 2) {
      throw new UnprocessableEntityException('Nhập họ tên hợp lệ');
    }

    if (await this.usersRepository.findOne({ where: { email } })) {
      throw new ConflictException('Email đã được đăng ký');
    }

    const user = this.usersRepository.create({
      email,
      fullName,
      passwordHash: await bcrypt.hash(dto.password, 12),
      role: UserRole.CUSTOMER,
    });

    try {
      await this.usersRepository.save(user);
    } catch (error) {
      if (this.isUniqueEmailViolation(error)) {
        throw new ConflictException('Email đã được đăng ký');
      }
      throw error;
    }

    return this.createSession(user);
  }

  async login(dto: LoginDto, ipAddress: string) {
    const email = this.normalizeEmail(dto.email);
    const key = `${ipAddress}:${email}`;
    this.assertNotRateLimited(key);
    const user = await this.usersRepository.findOne({ where: { email } });
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      this.recordFailure(key);
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    this.loginAttempts.delete(key);
    return this.createSession(user);
  }

  async findPublicUser(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true },
    });
    if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại');
    return user;
  }

  private async createSession(user: User) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken,
      expiresIn: '60m',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  private validatePassword(password: string) {
    const bytes = Buffer.byteLength(password, 'utf8');
    if (password.length < 8 || bytes > 72) {
      throw new UnprocessableEntityException(
        'Mật khẩu phải có ít nhất 8 ký tự và không vượt quá 72 byte UTF-8',
      );
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().normalize('NFC').toLowerCase();
  }

  private assertNotRateLimited(key: string) {
    const attempt = this.loginAttempts.get(key);
    if (!attempt) return;
    if (Date.now() - attempt.startedAt >= WINDOW_MS) {
      this.loginAttempts.delete(key);
      return;
    }
    if (attempt.count >= MAX_FAILURES) {
      throw new HttpException(
        'Đăng nhập sai quá nhiều lần; vui lòng thử lại sau một phút',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(key: string) {
    const attempt = this.loginAttempts.get(key);
    if (!attempt || Date.now() - attempt.startedAt >= WINDOW_MS) {
      this.loginAttempts.set(key, { count: 1, startedAt: Date.now() });
      return;
    }
    attempt.count += 1;
  }

  private isUniqueEmailViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'driverError' in error &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      'code' in error.driverError &&
      error.driverError.code === '23505'
    );
  }
}
