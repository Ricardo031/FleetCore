import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateVehicleDto } from './create-vehicle.dto.js';
import { VehicleStatus } from '../../common/enums/vehicle-status.enums.js';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  // IN_MAINTENANCE is only set by the maintenance flow, never by hand
  @ApiPropertyOptional({
    enum: [VehicleStatus.AVAILABLE, VehicleStatus.INACTIVE],
  })
  @IsOptional()
  @IsIn([VehicleStatus.AVAILABLE, VehicleStatus.INACTIVE])
  status?: VehicleStatus.AVAILABLE | VehicleStatus.INACTIVE;
}
