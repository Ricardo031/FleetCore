import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interface/jwt-payload.interface.js';

export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as JwtPayload;
    return field ? user?.[field] : user;
  },
);
