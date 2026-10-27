import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';

//INTERCEPTOR: wraps every successful response in { success, statusCode, data, timeStamp }
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const res = ctx.switchToHttp().getResponse();
    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode: res.statusCode,
        data: data ?? null,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
