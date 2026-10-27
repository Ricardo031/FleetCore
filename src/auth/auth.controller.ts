import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { LoginDto, RegisterDto } from './dto/auth.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../common/interface/jwt-payload.interface.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({ summary: 'Register a user (ADMIN or TECHNICIAN)' })
  @ApiBadRequestResponse({ description: 'Invalid data' })
  @ApiConflictResponse({ description: 'Email already registered' })
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto); // 201 for default
  }

  @ApiOperation({
    summary: 'Log in and get a JWT',
    description: 'Copy `accessToken` and paste it in the Authorize button.',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiOperation({ summary: 'Data of the authenticated user (from the token)' })
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or expired token' })
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
