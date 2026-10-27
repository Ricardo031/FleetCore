import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// GUARD: validates the x-api-key header against API_KEYS (an environment variable, with keys separated by commas)
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly validKeys: string[];

  constructor(config: ConfigService) {
    this.validKeys = (config.get<string>('API_KEYS') ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
  }

  canActivate(ctx: ExecutionContext): boolean {
    const key = ctx.switchToHttp().getRequest().headers['x-api-key'];
    if (!key) throw new UnauthorizedException('API key not provided');
    if (typeof key !== 'string' || !this.validKeys.includes(key)) {
      throw new UnauthorizedException('Invalid API key');
    }
    return true;
  }
}
