import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { ApiKeyGuard } from './apiKey.guard.js';
import { JwtAuthGuard } from './jwtAuth.guard.js';
import { Role } from '../enums/role.enums.js';

const contextWith = (req: object) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

// Reflector that always answers the given metadata value
const reflectorReturning = (value: unknown) =>
  ({ getAllAndOverride: () => value }) as unknown as Reflector;

describe('RolesGuard', () => {
  it('lets any authenticated user in when the route has no @Roles()', () => {
    const guard = new RolesGuard(reflectorReturning(undefined));
    expect(
      guard.canActivate(contextWith({ user: { role: Role.TECHNICIAN } })),
    ).toBe(true);
  });

  it('allows a user with a required role', () => {
    const guard = new RolesGuard(reflectorReturning([Role.ADMIN]));
    expect(guard.canActivate(contextWith({ user: { role: Role.ADMIN } }))).toBe(
      true,
    );
  });

  it('rejects a user without the required role with 403', () => {
    const guard = new RolesGuard(reflectorReturning([Role.ADMIN]));
    expect(() =>
      guard.canActivate(contextWith({ user: { role: Role.TECHNICIAN } })),
    ).toThrow(ForbiddenException);
  });
});

describe('ApiKeyGuard', () => {
  const guard = new ApiKeyGuard({ get: () => 'key-1, key-2' } as any);
  const withKey = (key?: string) =>
    contextWith({ headers: key ? { 'x-api-key': key } : {} });

  it('accepts a configured key', () => {
    expect(guard.canActivate(withKey('key-2'))).toBe(true);
  });

  it('rejects a missing key with 401', () => {
    expect(() => guard.canActivate(withKey())).toThrow('API key not provided');
  });

  it('rejects a wrong key with 401', () => {
    expect(() => guard.canActivate(withKey('nope'))).toThrow(
      UnauthorizedException,
    );
  });
});

describe('JwtAuthGuard', () => {
  const payload = { sub: 1, email: 'a@t.com', role: Role.ADMIN };
  const jwt = {
    verifyAsync: vi.fn(async (token: string) => {
      if (token !== 'good') throw new Error('invalid');
      return payload;
    }),
  };
  const guardFor = (isPublic: boolean) =>
    new JwtAuthGuard(reflectorReturning(isPublic), jwt as any);

  it('skips the check on @Public() routes', async () => {
    await expect(
      guardFor(true).canActivate(contextWith({ headers: {} })),
    ).resolves.toBe(true);
  });

  it('rejects a request without token with 401', async () => {
    await expect(
      guardFor(false).canActivate(contextWith({ headers: {} })),
    ).rejects.toThrow('Token not provided');
  });

  it('rejects an invalid or expired token with 401', async () => {
    const req = { headers: { authorization: 'Bearer bad' } };
    await expect(guardFor(false).canActivate(contextWith(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('puts the token payload in request.user', async () => {
    const req: { headers: object; user?: unknown } = {
      headers: { authorization: 'Bearer good' },
    };
    await expect(guardFor(false).canActivate(contextWith(req))).resolves.toBe(
      true,
    );
    expect(req.user).toEqual(payload);
  });
});
