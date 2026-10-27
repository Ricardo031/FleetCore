import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { JwtPayload } from '../interface/  jwt-payload.interface.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const [type, token] = req.headers.authorization.split(' ') ?? [];

    if (type !== 'Bearer' || !token)
      throw new UnauthorizedException('Token not provided');

    try {
      req.user = await this.jwt.verifyAsync<JwtPayload>(token); // fail if token is invalid
    } catch {
      throw new UnauthorizedException('Token is invalid');
    }

    return true;
  }
}
