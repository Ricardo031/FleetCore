import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
//Mark a route as public: the global JwtAuthGuard will not require a token to access it
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
