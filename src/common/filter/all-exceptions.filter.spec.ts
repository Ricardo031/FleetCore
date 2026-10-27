import {
  ArgumentsHost,
  CallHandler,
  ExecutionContext,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { firstValueFrom, of } from 'rxjs';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { ResponseInterceptor } from '../interceptor/response.interceptor.js';

// Captures what the filter writes with res.status(...).json(...)
const makeHost = () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ url: '/vehicles' }),
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;
  return { host, res };
};

const dbError = (code: string) =>
  new QueryFailedError('INSERT ...', [], Object.assign(new Error(), { code }));

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('keeps the status and message of an HttpException', () => {
    const { host, res } = makeHost();
    filter.catch(new NotFoundException('Vehicle 9 not found'), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        message: 'Vehicle 9 not found',
        path: '/vehicles',
        timestamp: expect.any(String),
      }),
    );
  });

  it.each([
    ['23505', 409], // unique violation
    ['23503', 409], // foreign key violation
    ['23502', 400], // not null violation
    ['22P02', 400], // invalid text representation
  ])('maps DB error %s to %i instead of 500', (code, status) => {
    const { host, res } = makeHost();
    filter.catch(dbError(code), host);
    expect(res.status).toHaveBeenCalledWith(status);
  });

  it('hides unknown errors behind a generic 500', () => {
    const { host, res } = makeHost();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {}); // keep test output clean
    filter.catch(new Error('secret stack detail'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });
});

describe('ResponseInterceptor', () => {
  it('wraps the handler result in the uniform success format', async () => {
    const ctx = {
      switchToHttp: () => ({ getResponse: () => ({ statusCode: 201 }) }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of({ id: 1 }) };

    const body = await firstValueFrom(
      new ResponseInterceptor().intercept(ctx, next),
    );
    expect(body).toEqual({
      success: true,
      statusCode: 201,
      data: { id: 1 },
      timestamp: expect.any(String),
    });
  });
});
