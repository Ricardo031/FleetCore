import { Role } from '../enums/role.enums.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
