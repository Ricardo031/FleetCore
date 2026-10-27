import { Role } from '../enums/role.enums.js';

export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
}
