import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enums.js';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
//> `SetMetadata` only **stores** information. It is the guardian, using `Reflector`, that reads it.
