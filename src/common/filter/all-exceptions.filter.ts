import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

//INTERCEPTOR: wraps every successful response in { success, statusCode, data, timeStamp }

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const raw = typeof body === 'string' ? body : (body as any).message;
      message = Array.isArray(raw) ? raw.join('; ') : raw;
    } else if (exception instanceof QueryFailedError) {
      const code =
        (exception as any).code ?? (exception as any).driverError?.code;
      ({ status, message } = this.mapDbError(code));
    }

    if (status >= 500) this.logger.error(exception); // the detail go to log, not to client

    res.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }

  private mapDbError(code?: string) {
    switch (code) {
      case '23505':
        return {
          status: 409,
          message: 'Ya existe un registro con ese valor único',
        };
      case '23503':
        return {
          status: 409,
          message: 'La operación viola una relación con otro registro',
        };
      case '23502':
        return { status: 400, message: 'Falta un campo obligatorio' };
      case '22P02':
        return { status: 400, message: 'Formato de dato inválido' };
      default:
        return { status: 500, message: 'Error interno del servidor' };
    }
  }
}
