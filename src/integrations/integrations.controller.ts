import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ApiKeyGuard } from '../common/guards/apiKey.guard.js';

@ApiTags('Integrations')
@ApiSecurity('x-api-key')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @ApiOperation({
    summary: 'Completed maintenance history of a vehicle (x-api-key)',
    description:
      'For external partners. Uses the x-api-key header instead of a JWT.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key' })
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  @Public() // skips the global JWT guard: partners authenticate with an API key
  @UseGuards(ApiKeyGuard) // requires a valid x-api-key header
  @Get('vehicles/:plate/history')
  vehicleHistory(@Param('plate') plate: string) {
    return this.integrations.getVehicleHistory(plate);
  }
}
