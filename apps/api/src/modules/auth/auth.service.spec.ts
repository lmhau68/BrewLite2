import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User, UserRole } from '../../database/entities/user.entity.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let user: User;
  const jwtService = { signAsync: vi.fn().mockResolvedValue('signed-token') };

  beforeEach(() => {
    user = Object.assign(new User(), {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'customer@example.com',
      fullName: 'BrewLite Customer',
      passwordHash: '',
      role: UserRole.CUSTOMER,
    });
    usersRepository = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((input: Partial<User>) => Object.assign(new User(), input)),
      save: vi.fn(async (entity: User) => {
        user = entity;
        return entity;
      }),
    };
    jwtService.signAsync.mockClear();
    service = new AuthService(
      usersRepository as unknown as Repository<User>,
      jwtService as unknown as JwtService,
    );
  });

  it('registers only a customer and returns a JWT session', async () => {
    const session = await service.register({
      fullName: '  BrewLite Customer  ',
      email: ' CUSTOMER@example.com ',
      password: 'strong-password',
    });

    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'customer@example.com',
        fullName: 'BrewLite Customer',
        role: UserRole.CUSTOMER,
      }),
    );
    expect(user.passwordHash).not.toBe('strong-password');
    expect(session).toMatchObject({
      accessToken: 'signed-token',
      expiresIn: '60m',
      user: { role: UserRole.CUSTOMER },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: user.id, role: UserRole.CUSTOMER }),
    );
  });

  it('rejects duplicate email addresses', async () => {
    usersRepository.findOne.mockResolvedValueOnce(user);

    await expect(
      service.register({
        fullName: 'Another Customer',
        email: user.email,
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('uses the same authentication error for an unknown account', async () => {
    await expect(
      service.login({ email: 'missing@example.com', password: 'wrong' }, '127.0.0.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
