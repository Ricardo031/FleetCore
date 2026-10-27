import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { Role } from '../common/enums/role.enums.js';

const makeService = (storedUser: object | null = null) => {
  const users = {
    findByEmail: vi.fn(async () => storedUser),
    findByEmailWithPassword: vi.fn(async () => storedUser),
    create: vi.fn(async (data: object) => ({ id: 1, ...data })),
  };
  const jwt = { signAsync: vi.fn(async () => 'signed.jwt.token') };
  return { service: new AuthService(users as any, jwt as any), users, jwt };
};

const registerDto = {
  name: 'Carlos',
  email: 'carlos@t.com',
  password: 'Tech123*',
  role: Role.TECHNICIAN,
};

describe('AuthService.register', () => {
  it('stores a bcrypt hash, never the plain password, and does not return it', async () => {
    const { service, users } = makeService();
    const result = await service.register(registerDto);

    const saved = users.create.mock.calls[0][0] as { password: string };
    expect(saved.password).not.toBe('Tech123*');
    await expect(bcrypt.compare('Tech123*', saved.password)).resolves.toBe(
      true,
    );
    expect(result).not.toHaveProperty('password');
  });

  it('rejects an email that is already registered (409)', async () => {
    const { service } = makeService({ id: 1 });
    await expect(service.register(registerDto)).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('AuthService.login', () => {
  const storedUser = async () => ({
    id: 1,
    name: 'Admin',
    email: 'admin@t.com',
    role: Role.ADMIN,
    password: await bcrypt.hash('Admin123*', 4),
  });

  it('returns a JWT signed with sub, email and role', async () => {
    const { service, jwt } = makeService(await storedUser());
    const result = await service.login({
      email: 'admin@t.com',
      password: 'Admin123*',
    });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 1,
      email: 'admin@t.com',
      role: Role.ADMIN,
    });
  });

  it('rejects a wrong password (401)', async () => {
    const { service } = makeService(await storedUser());
    await expect(
      service.login({ email: 'admin@t.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown email with the same 401', async () => {
    const { service } = makeService(null);
    await expect(
      service.login({ email: 'nobody@t.com', password: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
