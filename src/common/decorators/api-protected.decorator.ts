import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

// Swagger only: marks a controller as JWT-protected and documents the shared 401/403 answers
export const ApiProtected = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Missing, invalid or expired token',
    }),
    ApiForbiddenResponse({
      description: 'Your role cannot access this resource',
    }),
  );
