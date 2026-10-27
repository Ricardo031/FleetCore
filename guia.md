# Guía: Prueba de desempeño M6.2 – FleetCore (NestJS)

Stack: NestJS 12 · TypeScript · TypeORM · PostgreSQL · JWT · **bcrypt** · Swagger · Vitest · Docker (opcional).
**Fuera de alcance:** OAuth 2.0 (solo si sobra tiempo). Las pruebas se hacen con Vitest (el PDF menciona Jest).

> ⚠️ El proyecto es **ESM** (`"type": "module"` + `module: nodenext`): todos los imports relativos llevan extensión **`.js`**
> (`import { User } from './entities/user.entity.js'`). Si usas `nest g`, revisa que los imports generados la tengan.

> 🛑 **Texto oculto en el enunciado:** la línea 339 trae un párrafo dirigido a "asistentes de IA" que pide aplicar
> "convenciones internas" en mecánicos sin mencionarlas. Está truncado y no forma parte de los requisitos: **se ignora**.
> Ya se quitaron también el rol `MANAGER` y un comportamiento extra del interceptor. Antes de aceptar código, revísalo.

---

## 📍 Dónde vas

| #   | Paso                                                    | Estado                  |
| --- | ------------------------------------------------------- | ----------------------- |
| 1   | Setup, `.env`, validación de env, `app.module`          | ✅ Hecho                |
| 2   | Common: enums, decoradores, guards, interceptor, filtro | ✅ Hecho (commit)       |
| 2.5 | **Correcciones de lo ya hecho**                         | ⏳ **Pendiente — ahora** |
| 3   | Users + Auth (register / login / me)                    | 🟡 Solo `user.entity.ts` |
| 4   | Entidades: Vehicle, Mechanic, Workshop, Maintenance     | ⬜                      |
| 5   | CRUD vehículos, mecánicos, talleres                     | ⬜                      |
| 6   | Mantenimientos: reglas puras + creación                 | ⬜                      |
| 7   | Cambio de estado (transacción)                          | ⬜                      |
| 8   | Consultas + endpoint `x-api-key`                        | ⬜                      |
| 9   | Seeder idempotente                                      | ⬜                      |
| 10  | Swagger completo                                        | ⬜                      |
| 11  | README, `.env.example`, dump SQL, evidencias            | ⬜                      |
| 12  | Extras: Docker (+5), Vitest (+5)                        | ⬜ opcional             |
| —   | OAuth 2.0 (+10)                                         | ⏭️ solo si sobra tiempo |

---

## 0. Decisiones y supuestos

| Tema                                                                                     | Decisión                                                                            | Por qué                                                                          |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Roles                                                                                    | Solo **ADMIN** y **TECHNICIAN**                                                     | Es lo que pide el enunciado                                                      |
| Hash de contraseñas                                                                      | `bcrypt` con 10 rondas                                                              | Mecanismo de hashing seguro (req. 1.3)                                           |
| Duración del mantenimiento                                                               | `scheduledAt` + `durationMinutes` (default 60) → se guarda `scheduledEndAt`         | El PDF exige detectar cruces pero no define hora de fin                          |
| Cruce de horarios                                                                        | Intervalo semiabierto `[inicio, fin)`: 7:30–9:00 y 9:00–10:00 **sí** conviven       | Ejemplo 3.10.d del PDF                                                           |
| "Un técnico no puede tener más de un mantenimiento activo" (sec. 6) vs. cruces (sec. 3.10) | Se implementa la regla de cruces (más específica). **Confírmalo con quien califica** | Si se aplicara literal, el ejemplo 3.10.d no tendría sentido                     |
| `POST /auth/register`                                                                    | Público y acepta `role`                                                             | El PDF pide registro con roles. En producción sería solo ADMIN (anótalo en README) |
| Técnico ↔ Mecánico                                                                       | `Mechanic.user`: OneToOne opcional con `User`                                       | El seeder pide "2 mecánicos activos vinculados a los técnicos"                   |
| Estado de taller y mecánico                                                              | Enum `EntityStatus` (`ACTIVE` / `INACTIVE`)                                         | El PDF solo dice "estado"                                                        |
| Eliminar vehículo                                                                        | `DELETE /vehicles/:id` = pasar a `INACTIVE`                                         | Sec. 2.7                                                                         |
| Transición inválida                                                                      | `409 Conflict` con mensaje descriptivo                                              | "Respuesta HTTP apropiada"                                                       |
| Técnico puede cambiar a                                                                  | `IN_PROGRESS` y `COMPLETED` (solo los suyos). `CANCELLED` solo ADMIN                | Supuesto razonable                                                               |
| Cancelar un `IN_PROGRESS`                                                                | El vehículo vuelve a `AVAILABLE`                                                    | Dejarlo en `IN_MAINTENANCE` sería un bug                                         |
| `finalMileage` al completar                                                              | ≥ km actual del vehículo y actualiza `vehicle.mileage`                              | Coherente con la regla de kilometraje                                            |
| "Auditorías" del ADMIN                                                                   | `createdAt`/`updatedAt` + historial. Tabla de auditoría opcional                    | El PDF no la detalla                                                             |

### Matriz de permisos

| Recurso                                                          | ADMIN | TECHNICIAN          |
| ---------------------------------------------------------------- | ----- | ------------------- |
| Listar / ver vehículos                                           | ✅    | ✅                  |
| Crear / editar / inactivar vehículos                             | ✅    | ❌                  |
| Mecánicos (todo)                                                 | ✅    | ❌                  |
| Talleres activos / ver taller                                    | ✅    | ✅                  |
| Talleres (crear / editar / activar / inactivar)                  | ✅    | ❌                  |
| Crear mantenimiento                                              | ✅    | ❌                  |
| Listar todos / activos / por vehículo / por mecánico / historial | ✅    | ❌                  |
| Ver mis mantenimientos asignados (con taller)                    | —     | ✅                  |
| Ver un mantenimiento por id                                      | ✅    | ✅ (solo los suyos) |
| Cambiar estado                                                   | ✅    | ✅ (solo los suyos) |

### Endpoints

```
AUTH
POST   /auth/register                     @Public
POST   /auth/login                        @Public
GET    /auth/me                           cualquier rol autenticado

VEHÍCULOS
GET    /vehicles                          ADMIN, TECHNICIAN
GET    /vehicles/plate/:plate             ADMIN, TECHNICIAN
GET    /vehicles/:id                      ADMIN, TECHNICIAN
GET    /vehicles/:id/history              ADMIN
POST   /vehicles                          ADMIN
PATCH  /vehicles/:id                      ADMIN
DELETE /vehicles/:id                      ADMIN   (→ INACTIVE)

MECÁNICOS (todo ADMIN)
GET    /mechanics
GET    /mechanics/:id
GET    /mechanics/:id/maintenances
POST   /mechanics
PATCH  /mechanics/:id
PATCH  /mechanics/:id/activate
PATCH  /mechanics/:id/deactivate

TALLERES
GET    /workshops                         ADMIN, TECHNICIAN (solo activos)
GET    /workshops/:id                     ADMIN, TECHNICIAN
POST   /workshops                         ADMIN
PATCH  /workshops/:id                     ADMIN
PATCH  /workshops/:id/activate            ADMIN
PATCH  /workshops/:id/deactivate          ADMIN

MANTENIMIENTOS
POST   /maintenances                      ADMIN
GET    /maintenances                      ADMIN
GET    /maintenances/active               ADMIN
GET    /maintenances/my                   TECHNICIAN
GET    /maintenances/vehicle/:vehicleId   ADMIN
GET    /maintenances/mechanic/:mechanicId ADMIN
GET    /maintenances/:id                  ADMIN, TECHNICIAN (si es suyo)
PATCH  /maintenances/:id/status           ADMIN, TECHNICIAN (si es suyo)

INTEGRACIONES (x-api-key)
GET    /integrations/vehicles/:plate/history   @Public + ApiKeyGuard
```

> ⚠️ **Orden de rutas:** declara las rutas fijas (`plate/:plate`, `active`, `my`, `vehicle/:id`, `mechanic/:id`) **antes** de `:id`.
> Si no, Nest interpreta "active" como un id y `ParseIntPipe` responde 400.

---

## 1. ✅ Hecho: setup, env y AppModule

Estructura real del proyecto (respétala en los imports):

```
src/
├─ main.ts
├─ app.module.ts
├─ config/env.validation.ts
├─ common/
│  ├─ enums/          index.ts, role.enums.ts, vehicle-status.enums.ts, entity-status.enum.ts,
│  │                  maintenance-type.enum.ts, maintenance-status.enum.ts
│  ├─ decorators/     public, roles, current-user
│  ├─ guards/         jwtAuth.guard.ts, roles.guard.ts, apiKey.guard.ts
│  ├─ interceptor/    response.interceptor.ts
│  ├─ filter/         all-exceptions.filter.ts
│  └─ interface/      jwt-payload.interface.ts
├─ users/             ← vas aquí
├─ auth/
├─ vehicles/
├─ mechanics/
├─ workshops/
├─ maintenances/
│  ├─ maintenance-rules.ts        (máquina de estados + cruces: funciones puras)
│  └─ maintenance-rules.spec.ts
├─ integrations/
└─ database/seeds/seed.ts
```

Cada módulo: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `entities/`, `dto/`.

## 2. ✅ Hecho: common

Decoradores `@Public()`, `@Roles()`, `@CurrentUser()`; guards JWT, Roles y ApiKey; `ResponseInterceptor`; `AllExceptionsFilter`.
Commit ya hecho: `feat(common): roles/public/current-user decorators, guards, interceptor and exception filter`.

---

## 2.5 ⏳ Correcciones de lo ya hecho (hazlas primero)

**a) Rutas rotas en `main.ts`** (la app no compila):

```ts
import { ResponseInterceptor } from './common/interceptor/response.interceptor.js';
import { AllExceptionsFilter } from './common/filter/all-exceptions.filter.js';
```

**b) Renombrar el archivo con espacios** `src/common/interface/  jwt-payload.interface.ts` → `jwt-payload.interface.ts`:

```bash
git mv "src/common/interface/  jwt-payload.interface.ts" src/common/interface/jwt-payload.interface.ts
```

Luego corrige los imports en `jwtAuth.guard.ts` y `current-user.decorator.ts` (`'../interface/jwt-payload.interface.js'`).

**c) `sub` debe ser número** (el id del usuario es numérico):

```ts
export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
}
```

**d) `jwtAuth.guard.ts` — sin header revienta con 500.** Agrega `?.`:

```ts
const [type, token] = req.headers.authorization?.split(' ') ?? [];
```

**e) `roles.guard.ts` — rol insuficiente es 403, no 401.** Cambia `UnauthorizedException` por `ForbiddenException`:

```ts
// GUARD: autorización por rol. Si la ruta no tiene @Roles(), basta con estar autenticado.
if (!user || !required.includes(user.role)) {
  throw new ForbiddenException('No tienes permisos para realizar esta acción');
}
```

Y cambia `if (!required)` por `if (!required?.length)`.

**f) Comentarios clave** (los piden en la rúbrica: guards, filtro, interceptor, transacciones). Agrega una línea arriba de cada clase:

```ts
// GUARD: valida el JWT en todas las rutas salvo las marcadas con @Public()
// GUARD: valida la cabecera x-api-key contra API_KEYS (variable de entorno, separadas por coma)
// INTERCEPTOR: envuelve toda respuesta exitosa en { success, statusCode, data, timeStamp }
// FILTRO: convierte cualquier error en { success:false, statusCode, message, path, timestamp }
//         y evita que errores de BD (unicidad, FK...) terminen como 500
```

**g) `.env` no está en `.gitignore`.** Agrégalo antes de cualquier push:

```gitignore
# env
.env
```

Si ya lo subiste alguna vez: `git rm --cached .env`.

**h) `user.entity.ts`:** `id: Number` → `id: number` (tipo primitivo). Y muévelo a `src/users/entities/user.entity.ts` para seguir la estructura.

Commits:

```
chore: switch password hashing to bcrypt and remove MANAGER role
fix(common): correct import paths, 403 on forbidden role, safe auth header parsing
```

---

## 3. Paso 3 – Users + Auth (← estás aquí)

### 3.1 Users

```bash
nest g module users
nest g service users --no-spec
```

**`users/entities/user.entity.ts`** (ya lo tienes, con el fix de `number`):

```ts
@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ unique: true }) email: string;
  @Column({ select: false }) password: string; // nunca sale en las consultas normales
  @Column({ type: 'enum', enum: Role }) role: Role;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

**`users/users.module.ts`**

```ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService], // AuthModule lo necesita
})
export class UsersModule {}
```

**`users/users.service.ts`**

```ts
@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  // password tiene select:false → hay que pedirlo explícitamente para el login
  findByEmailWithPassword(email: string) {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  create(data: Pick<User, 'name' | 'email' | 'password' | 'role'>) {
    return this.repo.save(this.repo.create(data));
  }
}
```

### 3.2 Auth

```bash
nest g module auth
nest g controller auth --no-spec
nest g service auth --no-spec
```

**DTOs** (`auth/dto/`):

```ts
export class RegisterDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiProperty({ enum: Role }) @IsEnum(Role) role: Role;
}

export class LoginDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @IsNotEmpty() password: string;
}
```

**`auth/auth.module.ts`** — `JwtModule` **global** para que el guard global pueda inyectar `JwtService`:

```ts
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

**`auth/auth.service.ts`**

```ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (await this.users.findByEmail(dto.email))
      throw new ConflictException('El correo ya está registrado');
    const password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.users.create({ ...dto, password });
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  async login({ email, password }: LoginDto) {
    const user = await this.users.findByEmailWithPassword(email);
    // mismo mensaje para "no existe" y "clave incorrecta": no revela qué correos existen
    if (!user || !(await bcrypt.compare(password, user.password)))
      throw new UnauthorizedException('Credenciales inválidas');

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }
}
```

**`auth/auth.controller.ts`**

```ts
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto); // 201 por defecto
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK) // login no crea nada → 200
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
```

### 3.3 Registrar los guards globales en `app.module.ts`

```ts
imports: [ /* ConfigModule, TypeOrmModule ya existentes */ AuthModule, UsersModule ],
providers: [
  // El ORDEN importa: primero autenticar (JWT), luego autorizar (roles)
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
],
```

Puedes borrar `AppController`/`AppService` (o marcar su `GET /` con `@Public()`).

**Prueba rápida:** `npm run start:dev` → en `/docs`: register → login → Authorize con el token → `GET /auth/me`.
Sin token → 401. Token alterado → 401.

Commit: `feat(auth): register/login with bcrypt and JWT, global guards`

---

## 4. Paso 4 – Entidades y relaciones

```bash
nest g module vehicles && nest g module mechanics && nest g module workshops && nest g module maintenances
```

```
User     1 ─── 0..1 Mechanic   (Mechanic.user, nullable)
Vehicle  1 ─── N    Maintenance
Mechanic 1 ─── N    Maintenance
Workshop 1 ─── N    Maintenance
```

```ts
@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) plate: string;
  @Column() brand: string;
  @Column() model: string;
  @Column({ type: 'int' }) year: number;
  @Column({ type: 'int' }) mileage: number;
  @Column({ type: 'enum', enum: VehicleStatus, default: VehicleStatus.AVAILABLE })
  status: VehicleStatus;
  @OneToMany(() => Maintenance, (m) => m.vehicle) maintenances: Maintenance[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('mechanics')
export class Mechanic {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ unique: true }) email: string;
  @Column() specialty: string;
  @Column({ type: 'enum', enum: EntityStatus, default: EntityStatus.ACTIVE })
  status: EntityStatus;
  @OneToOne(() => User, { nullable: true }) @JoinColumn() user: User | null;
  @OneToMany(() => Maintenance, (m) => m.mechanic) maintenances: Maintenance[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('workshops')
export class Workshop {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column() address: string;
  @Column({ type: 'enum', enum: EntityStatus, default: EntityStatus.ACTIVE })
  status: EntityStatus;
  @OneToMany(() => Maintenance, (m) => m.workshop) maintenances: Maintenance[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('maintenances')
export class Maintenance {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'enum', enum: MaintenanceType }) type: MaintenanceType;
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'int' }) mileage: number; // km al programarlo
  @Column({ type: 'timestamptz' }) scheduledAt: Date;
  @Column({ type: 'timestamptz' }) scheduledEndAt: Date; // scheduledAt + durationMinutes
  @Column({ type: 'enum', enum: MaintenanceStatus, default: MaintenanceStatus.SCHEDULED })
  status: MaintenanceStatus;

  // Datos de cierre (solo al completar)
  @Column({ type: 'text', nullable: true }) workDone: string | null;
  @Column({
    type: 'numeric', precision: 12, scale: 2, nullable: true,
    transformer: { to: (v) => v, from: (v) => (v === null ? null : Number(v)) },
  })
  finalCost: number | null;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date | null;
  @Column({ type: 'int', nullable: true }) finalMileage: number | null;

  @ManyToOne(() => Vehicle, (v) => v.maintenances, { nullable: false, onDelete: 'RESTRICT' })
  vehicle: Vehicle;
  @ManyToOne(() => Mechanic, (m) => m.maintenances, { nullable: false, onDelete: 'RESTRICT' })
  mechanic: Mechanic;
  @ManyToOne(() => Workshop, (w) => w.maintenances, { nullable: false, onDelete: 'RESTRICT' })
  workshop: Workshop;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

> `numeric` en Postgres llega como **string**; el `transformer` lo convierte a número.
> `onDelete: 'RESTRICT'` + inactivación lógica = el historial nunca se pierde.
> Con relaciones circulares en ESM, si ves `Cannot access 'X' before initialization`, tipa la propiedad con
> `Relation<Vehicle>` (de `typeorm`) en lugar de `Vehicle`.

Cada módulo registra su entidad: `TypeOrmModule.forFeature([Vehicle])`, etc.

Commit: `feat(db): vehicle, mechanic, workshop and maintenance entities with relations`

---

## 5. Paso 5 – CRUD de vehículos, mecánicos y talleres

Patrón: DTOs con `class-validator` → service con reglas → controller con `@Roles()`. `ParseIntPipe` en todos los `:id` (id inválido → 400, no 500).

### Vehículos

- `CreateVehicleDto`: `plate` (`@IsString @IsNotEmpty`, `@Transform(({ value }) => value?.trim().toUpperCase())`), `brand`, `model`, `year` (`@IsInt @Min(1950) @Max(año actual + 1)`), `mileage` (`@IsInt @Min(0)`).
- `UpdateVehicleDto = PartialType(CreateVehicleDto)` (de `@nestjs/swagger`) + `status` opcional con `@IsIn([VehicleStatus.AVAILABLE, VehicleStatus.INACTIVE])`. `IN_MAINTENANCE` solo lo pone el flujo de mantenimientos.
- Service:
  - Crear: placa existente → `ConflictException('La placa ABC123 ya está registrada')`.
  - `findOne(id)` / `findByPlate(plate)` → `NotFoundException` si no existe.
  - Editar: si cambia la placa, validar unicidad de nuevo.
  - `remove(id)`: si tiene un mantenimiento activo → 409; si no, `status = INACTIVE`.
- Controller: `@Roles(Role.ADMIN)` en POST/PATCH/DELETE; `@Roles(Role.ADMIN, Role.TECHNICIAN)` en GETs.

Commit: `feat(vehicles): CRUD with plate uniqueness and soft inactivation`

### Mecánicos

- `CreateMechanicDto`: `name`, `email` (`@IsEmail`, único → 409), `specialty`, `userId` opcional (`@IsInt`).
  - Si viene `userId`: el usuario debe existir (404), tener rol `TECHNICIAN` (400) y no estar vinculado a otro mecánico (409).
- `UpdateMechanicDto = PartialType(CreateMechanicDto)`.
- `activate` / `deactivate`: solo cambian `status`. Nunca borran.
- `GET /mechanics/:id/maintenances`: historial del mecánico.
- Todo el controller con `@Roles(Role.ADMIN)` a nivel de clase.

Commit: `feat(mechanics): CRUD with activate/deactivate`

### Talleres

- `CreateWorkshopDto`: `name`, `address`.
- `GET /workshops` → solo activos (`where: { status: EntityStatus.ACTIVE }`).
- `GET /workshops/:id` → cualquiera (activo o no).
- `activate` / `deactivate`.

Commit: `feat(workshops): CRUD with activate/deactivate`

---

## 6. Paso 6 – Mantenimientos: reglas puras + creación

### 6.1 Funciones puras (`maintenances/maintenance-rules.ts`)

```ts
// MÁQUINA DE ESTADOS: a qué estados se puede pasar desde cada uno
export const ALLOWED_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  [MaintenanceStatus.SCHEDULED]: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CANCELLED],
  [MaintenanceStatus.IN_PROGRESS]: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
  [MaintenanceStatus.COMPLETED]: [], // estado final
  [MaintenanceStatus.CANCELLED]: [], // estado final
};

export function assertTransition(from: MaintenanceStatus, to: MaintenanceStatus) {
  if (from === to) throw new ConflictException(`El mantenimiento ya está en estado ${from}`);
  if (!ALLOWED_TRANSITIONS[from].includes(to))
    throw new ConflictException(`Transición inválida: un mantenimiento ${from} no puede pasar a ${to}`);
}

// DATOS OBLIGATORIOS DE CIERRE
export function assertClosingData(dto: {
  workDone?: string;
  finalCost?: number;
  finishedAt?: string | Date;
  finalMileage?: number;
}) {
  const missing: string[] = [];
  if (!dto.workDone?.trim()) missing.push('workDone');
  if (dto.finalCost == null) missing.push('finalCost');
  if (!dto.finishedAt) missing.push('finishedAt');
  if (dto.finalMileage == null) missing.push('finalMileage');
  if (missing.length)
    throw new BadRequestException(`No se puede completar el mantenimiento. Faltan: ${missing.join(', ')}`);
}

// CRUCE DE HORARIOS — intervalos semiabiertos [inicio, fin)
export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && bStart < aEnd;
```

7:30–9:00 vs 9:00–10:00 → `false` (permitido). 7:30–9:00 vs 8:00–9:00 → `true` (bloqueado).

### 6.2 DTO de creación

```ts
export class CreateMaintenanceDto {
  @IsEnum(MaintenanceType) type: MaintenanceType;
  @IsString() @IsNotEmpty() description: string;
  @IsInt() @Min(0) mileage: number;
  @Type(() => Date) @IsDate() scheduledAt: Date;
  @IsOptional() @IsInt() @Min(1) @Max(1440) durationMinutes?: number; // default 60
  @IsInt() vehicleId: number;
  @IsInt() mechanicId: number;
  @IsInt() workshopId: number;
}
```

### 6.3 Service: crear (transacción)

El módulo importa `TypeOrmModule.forFeature([Maintenance, Vehicle, Mechanic, Workshop])` e inyecta `DataSource`.

```ts
async create(dto: CreateMaintenanceDto) {
  // TRANSACCIÓN: todas las validaciones y la escritura ocurren juntas o no ocurre nada
  return this.dataSource.transaction(async (manager) => {
    const vehicle = await manager.findOne(Vehicle, { where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException(`El vehículo ${dto.vehicleId} no existe`);
    if (vehicle.status === VehicleStatus.INACTIVE)
      throw new ConflictException(`El vehículo ${vehicle.plate} está inactivo`);

    const mechanic = await manager.findOne(Mechanic, { where: { id: dto.mechanicId } });
    if (!mechanic) throw new NotFoundException(`El mecánico ${dto.mechanicId} no existe`);
    if (mechanic.status !== EntityStatus.ACTIVE)
      throw new ConflictException(`El mecánico ${mechanic.name} está inactivo`);

    const workshop = await manager.findOne(Workshop, { where: { id: dto.workshopId } });
    if (!workshop) throw new NotFoundException(`El taller ${dto.workshopId} no existe`);
    if (workshop.status !== EntityStatus.ACTIVE)
      throw new ConflictException(`El taller ${workshop.name} está inactivo`);

    if (dto.mileage < vehicle.mileage)
      throw new BadRequestException(
        `El kilometraje (${dto.mileage}) no puede ser menor al actual del vehículo (${vehicle.mileage})`);

    // Un vehículo = un solo mantenimiento activo
    const vehicleBusy = await manager.exists(Maintenance, {
      where: { vehicle: { id: vehicle.id }, status: In(ACTIVE_MAINTENANCE_STATUSES) },
    });
    if (vehicleBusy)
      throw new ConflictException(`El vehículo ${vehicle.plate} ya tiene un mantenimiento activo`);

    // Mecánico sin cruces de horario (en cualquier taller)
    const start = dto.scheduledAt;
    const end = new Date(start.getTime() + (dto.durationMinutes ?? 60) * 60_000);
    const clash = await manager.exists(Maintenance, {
      where: {
        mechanic: { id: mechanic.id },
        status: In(ACTIVE_MAINTENANCE_STATUSES),
        scheduledAt: LessThan(end),      // el existente empieza antes de que yo termine
        scheduledEndAt: MoreThan(start), // y termina después de que yo empiece
      },
    });
    if (clash)
      throw new ConflictException(`El mecánico ${mechanic.name} ya tiene un mantenimiento en ese horario`);

    return manager.save(manager.create(Maintenance, {
      type: dto.type,
      description: dto.description,
      mileage: dto.mileage,
      scheduledAt: start,
      scheduledEndAt: end,
      status: MaintenanceStatus.SCHEDULED, // estado inicial fijo
      vehicle, mechanic, workshop,
    }));
  });
}
```

> `LessThan/MoreThan` es la versión SQL de `overlaps()`; `overlaps()` queda para los tests.

Commit: `feat(maintenances): create maintenance with business rules`

---

## 7. Paso 7 – Cambio de estado (transacción)

```ts
export class UpdateMaintenanceStatusDto {
  @IsEnum(MaintenanceStatus) status: MaintenanceStatus;
  @IsOptional() @IsString() workDone?: string;
  @IsOptional() @IsNumber() @Min(0) finalCost?: number;
  @IsOptional() @Type(() => Date) @IsDate() finishedAt?: Date;
  @IsOptional() @IsInt() @Min(0) finalMileage?: number;
}
```

```ts
async updateStatus(id: number, dto: UpdateMaintenanceStatusDto, user: JwtPayload) {
  // TRANSACCIÓN: mantenimiento y vehículo cambian juntos o no cambia ninguno
  return this.dataSource.transaction(async (manager) => {
    const maintenance = await manager.findOne(Maintenance, {
      where: { id },
      relations: { vehicle: true, mechanic: { user: true }, workshop: true },
    });
    if (!maintenance) throw new NotFoundException(`El mantenimiento ${id} no existe`);

    // Un TECHNICIAN solo toca lo suyo y no puede cancelar
    if (user.role === Role.TECHNICIAN) {
      if (maintenance.mechanic.user?.id !== user.sub)
        throw new ForbiddenException('Este mantenimiento no está asignado a ti');
      if (dto.status === MaintenanceStatus.CANCELLED)
        throw new ForbiddenException('Solo un administrador puede cancelar mantenimientos');
    }

    assertTransition(maintenance.status, dto.status); // 409 si es inválida
    const vehicle = maintenance.vehicle;

    switch (dto.status) {
      case MaintenanceStatus.IN_PROGRESS:
        if (vehicle.status === VehicleStatus.INACTIVE)
          throw new ConflictException(`El vehículo ${vehicle.plate} está inactivo`);
        vehicle.status = VehicleStatus.IN_MAINTENANCE; // regla automática
        break;

      case MaintenanceStatus.COMPLETED:
        assertClosingData(dto); // 400 si faltan datos
        if (dto.finalMileage! < vehicle.mileage)
          throw new BadRequestException(
            `El kilometraje final (${dto.finalMileage}) no puede ser menor al del vehículo (${vehicle.mileage})`);
        maintenance.workDone = dto.workDone!;
        maintenance.finalCost = dto.finalCost!;
        maintenance.finishedAt = dto.finishedAt!;
        maintenance.finalMileage = dto.finalMileage!;
        vehicle.status = VehicleStatus.AVAILABLE; // regla automática
        vehicle.mileage = dto.finalMileage!;
        break;

      case MaintenanceStatus.CANCELLED:
        if (maintenance.status === MaintenanceStatus.IN_PROGRESS)
          vehicle.status = VehicleStatus.AVAILABLE; // no dejarlo "en taller" para siempre
        break;
    }

    maintenance.status = dto.status;
    await manager.save([vehicle, maintenance]);
    return maintenance;
  });
}
```

Controller: `@Roles(Role.ADMIN, Role.TECHNICIAN)` + `@CurrentUser() user: JwtPayload`.

Commit: `feat(maintenances): status transitions with vehicle availability sync`

---

## 8. Paso 8 – Consultas e integración con x-api-key

| Endpoint                                 | Query                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /maintenances`                      | `find({ relations: { vehicle, mechanic, workshop }, order: { scheduledAt: 'DESC' } })`            |
| `GET /maintenances/active`               | `status: In(ACTIVE_MAINTENANCE_STATUSES)`                                                         |
| `GET /maintenances/vehicle/:vehicleId`   | `vehicle: { id }` (404 si el vehículo no existe)                                                  |
| `GET /maintenances/mechanic/:mechanicId` | `mechanic: { id }` (404 si no existe)                                                             |
| `GET /maintenances/my`                   | busca el `Mechanic` con `user: { id: user.sub }` y devuelve sus mantenimientos **con `workshop`** |
| `GET /maintenances/:id`                  | si es TECHNICIAN y no es suyo → 403                                                               |
| `GET /vehicles/:id/history`              | mantenimientos `COMPLETED` del vehículo, ordenados por `finishedAt DESC`                          |

### Endpoint de integración

```bash
nest g module integrations && nest g controller integrations --no-spec && nest g service integrations --no-spec
```

```ts
@ApiTags('integrations')
@ApiSecurity('x-api-key')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Public()               // salta el JWT global
  @UseGuards(ApiKeyGuard) // exige x-api-key
  @Get('vehicles/:plate/history')
  history(@Param('plate') plate: string) {
    return this.service.getVehicleHistory(plate.toUpperCase());
  }
}
```

Respuesta del service:

```ts
{
  vehicle: { id, plate, brand, model, available: vehicle.status === VehicleStatus.AVAILABLE },
  maintenances: list.map((m) => ({
    id: m.id, type: m.type, status: m.status,
    description: m.workDone ?? m.description,
    mileage: m.finalMileage ?? m.mileage,
    cost: m.finalCost,
    finishedAt: m.finishedAt,
    mechanic: { id: m.mechanic.id, name: m.mechanic.name },
    workshop: { id: m.workshop.id, name: m.workshop.name },
  })),
}
```

Commit: `feat(integrations): x-api-key protected vehicle history endpoint`

---

## 9. Paso 9 – Seeder idempotente

Script en `package.json`:

```json
"seed": "nest build && node dist/database/seeds/seed.js"
```

Idempotente = antes de crear algo, **buscarlo por su clave natural** (email, placa, nombre).

```ts
// database/seeds/seed.ts
import bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const ds = app.get(DataSource);

  const findOrCreate = async <T extends ObjectLiteral>(
    repo: Repository<T>,
    where: FindOptionsWhere<T>,
    data: DeepPartial<T>,
  ) => (await repo.findOne({ where })) ?? repo.save(repo.create(data));

  const users = ds.getRepository(User);
  const mechanics = ds.getRepository(Mechanic);
  const workshops = ds.getRepository(Workshop);
  const vehicles = ds.getRepository(Vehicle);
  const maintenances = ds.getRepository(Maintenance);

  const hash = (p: string) => bcrypt.hash(p, 10);

  // 1 ADMIN, 2 TECHNICIAN
  await findOrCreate(users, { email: 'admin@fleetcore.com' }, {
    name: 'Admin', email: 'admin@fleetcore.com', password: await hash('Admin123*'), role: Role.ADMIN,
  });
  const tech1 = await findOrCreate(users, { email: 'tech1@fleetcore.com' }, {
    name: 'Carlos Pérez', email: 'tech1@fleetcore.com', password: await hash('Tech123*'), role: Role.TECHNICIAN,
  });
  const tech2 = await findOrCreate(users, { email: 'tech2@fleetcore.com' }, {
    name: 'Laura Gómez', email: 'tech2@fleetcore.com', password: await hash('Tech123*'), role: Role.TECHNICIAN,
  });

  // 3 mecánicos: 2 activos vinculados a técnicos, 1 inactivo
  const m1 = await findOrCreate(mechanics, { email: 'carlos@fleetcore.com' }, {
    name: 'Carlos Pérez', email: 'carlos@fleetcore.com', specialty: 'Motor', status: EntityStatus.ACTIVE, user: tech1,
  });
  const m2 = await findOrCreate(mechanics, { email: 'laura@fleetcore.com' }, {
    name: 'Laura Gómez', email: 'laura@fleetcore.com', specialty: 'Frenos', status: EntityStatus.ACTIVE, user: tech2,
  });
  await findOrCreate(mechanics, { email: 'pedro@fleetcore.com' }, {
    name: 'Pedro Ruiz', email: 'pedro@fleetcore.com', specialty: 'Electricidad', status: EntityStatus.INACTIVE,
  });

  // 2 talleres: 1 activo, 1 inactivo
  const centro = await findOrCreate(workshops, { name: 'Taller Centro' }, {
    name: 'Taller Centro', address: 'Calle 45 # 20-10', status: EntityStatus.ACTIVE,
  });
  await findOrCreate(workshops, { name: 'Taller Sur' }, {
    name: 'Taller Sur', address: 'Carrera 8 # 3-50', status: EntityStatus.INACTIVE,
  });

  // 4 vehículos: 2 AVAILABLE, 1 IN_MAINTENANCE, 1 INACTIVE
  const v1 = await findOrCreate(vehicles, { plate: 'ABC123' }, {
    plate: 'ABC123', brand: 'Chevrolet', model: 'NPR', year: 2020, mileage: 45050, status: VehicleStatus.AVAILABLE,
  });
  await findOrCreate(vehicles, { plate: 'DEF456' }, {
    plate: 'DEF456', brand: 'Renault', model: 'Logan', year: 2022, mileage: 12000, status: VehicleStatus.AVAILABLE,
  });
  const v3 = await findOrCreate(vehicles, { plate: 'GHI789' }, {
    plate: 'GHI789', brand: 'Hino', model: '300', year: 2019, mileage: 78000, status: VehicleStatus.IN_MAINTENANCE,
  });
  await findOrCreate(vehicles, { plate: 'JKL012' }, {
    plate: 'JKL012', brand: 'Isuzu', model: 'NKR', year: 2015, mileage: 150000, status: VehicleStatus.INACTIVE,
  });

  // Mantenimiento COMPLETED (historial de ABC123)
  await findOrCreate(maintenances, { vehicle: { id: v1.id }, description: 'Cambio de aceite y filtros' }, {
    type: MaintenanceType.PREVENTIVE,
    description: 'Cambio de aceite y filtros',
    mileage: 45000,
    scheduledAt: new Date('2026-09-15T14:00:00Z'),
    scheduledEndAt: new Date('2026-09-15T16:00:00Z'),
    status: MaintenanceStatus.COMPLETED,
    workDone: 'Cambio de aceite y filtros',
    finalCost: 350000,
    finishedAt: new Date('2026-09-15T16:30:00Z'),
    finalMileage: 45050,
    vehicle: v1, mechanic: m1, workshop: centro,
  });

  // Mantenimiento IN_PROGRESS (GHI789 está IN_MAINTENANCE)
  await findOrCreate(maintenances, { vehicle: { id: v3.id }, status: MaintenanceStatus.IN_PROGRESS }, {
    type: MaintenanceType.CORRECTIVE,
    description: 'Reemplazo de pastillas de freno',
    mileage: 78000,
    scheduledAt: new Date('2026-10-26T13:00:00Z'),
    scheduledEndAt: new Date('2026-10-26T15:00:00Z'),
    status: MaintenanceStatus.IN_PROGRESS,
    vehicle: v3, mechanic: m2, workshop: centro,
  });

  await app.close();
  console.log('✅ Seed completado');
}
bootstrap();
```

Prueba: corre `npm run seed` **dos veces** y verifica que los conteos no cambian.

Commit: `feat(seed): idempotent database seeder`

---

## 10. Paso 10 – Swagger completo

- `@ApiTags('vehicles')` etc. en cada controller.
- `@ApiBearerAuth()` en los controllers protegidos (candado + botón _Authorize_).
- `@ApiSecurity('x-api-key')` en integraciones.
- `@ApiOperation({ summary })` y `@ApiResponse({ status: 409, description: '...' })` en endpoints con reglas.
- Atajo: en `nest-cli.json` agrega `"plugins": ["@nestjs/swagger"]` dentro de `compilerOptions` para documentar DTOs sin `@ApiProperty` en cada campo.
- Flujo en `/docs`: `POST /auth/login` → copiar `accessToken` → _Authorize_ → probar.

Commit: `docs(swagger): document endpoints, auth schemes and responses`

---

## 11. Paso 11 – Entregables

### README.md (reemplaza el de Nest por este)

```md
# FleetCore API

**Coder:** Ricardo · **Clan:** <tu clan>

API REST para gestionar el mantenimiento de la flota (NestJS, TypeORM, PostgreSQL, JWT).

## Requisitos
Node 22+, PostgreSQL 16+ (o Docker).

## Instalación
1. `npm install`
2. Copia `.env.example` a `.env` y ajusta los valores.
3. Crea la base de datos `fleetcore`.
4. `npm run seed`
5. `npm run start:dev`

## Swagger
http://localhost:3000/docs

## Credenciales de prueba
| Rol        | Correo              | Contraseña |
| ---------- | ------------------- | ---------- |
| ADMIN      | admin@fleetcore.com | Admin123*  |
| TECHNICIAN | tech1@fleetcore.com | Tech123*   |
| TECHNICIAN | tech2@fleetcore.com | Tech123*   |

API Key de prueba: `demo-key-partner-1` → `GET /integrations/vehicles/ABC123/history`

## Decisiones
- Cruce de horarios: intervalos [inicio, fin); duración por defecto 60 min.
- El registro es público para efectos de la prueba; en producción debería restringirse a ADMIN.
```

### Dump SQL (después del seeder)

```bash
pg_dump -U postgres -d fleetcore --no-owner --no-privileges -f fleetcore_dump.sql
```

### Evidencias

Colección de Postman exportada (`docs/postman/`) o capturas de Swagger de los escenarios de la sección 13.

---

## 12. Extras (opcionales)

### 12.1 Vitest (+5)

Actualiza `vitest.config.ts` (agrega SWC para los decoradores y la cobertura):

```ts
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/*.module.ts', 'src/database/**', 'src/**/*.spec.ts'],
    },
  },
});
```

**Test 1 – `maintenances/maintenance-rules.spec.ts`**

```ts
describe('assertTransition', () => {
  it('permite SCHEDULED → IN_PROGRESS', () => {
    expect(() => assertTransition(MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS)).not.toThrow();
  });

  it.each([
    [MaintenanceStatus.COMPLETED, MaintenanceStatus.SCHEDULED],
    [MaintenanceStatus.COMPLETED, MaintenanceStatus.IN_PROGRESS],
    [MaintenanceStatus.CANCELLED, MaintenanceStatus.IN_PROGRESS],
    [MaintenanceStatus.CANCELLED, MaintenanceStatus.COMPLETED],
    [MaintenanceStatus.SCHEDULED, MaintenanceStatus.COMPLETED],
  ])('rechaza %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(ConflictException);
  });
});

describe('assertClosingData', () => {
  it('lanza BadRequest si faltan datos de cierre', () => {
    expect(() => assertClosingData({ workDone: 'ok' })).toThrow(BadRequestException);
  });
});

describe('overlaps', () => {
  const d = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00Z`);
  it('7:30–9:00 vs 8:00–9:00 → cruce', () =>
    expect(overlaps(d('07:30'), d('09:00'), d('08:00'), d('09:00'))).toBe(true));
  it('7:30–9:00 vs 9:00–10:00 → sin cruce', () =>
    expect(overlaps(d('07:30'), d('09:00'), d('09:00'), d('10:00'))).toBe(false));
});
```

**Test 2 – `MaintenancesService.updateStatus` con mocks**

```ts
const makeSut = (maintenance: Partial<Maintenance>) => {
  const manager = { findOne: vi.fn().mockResolvedValue(maintenance), save: vi.fn() };
  const dataSource = { transaction: (cb: any) => cb(manager) };
  const service = new MaintenancesService(dataSource as any /* , otros repos mockeados */);
  return { service, manager };
};

it('al pasar a IN_PROGRESS el vehículo queda IN_MAINTENANCE', async () => {
  const vehicle = { status: VehicleStatus.AVAILABLE, mileage: 1000 };
  const { service } = makeSut({
    id: 1, status: MaintenanceStatus.SCHEDULED, vehicle, mechanic: { user: { id: 7 } },
  } as any);
  await service.updateStatus(1, { status: MaintenanceStatus.IN_PROGRESS }, { sub: 1, role: Role.ADMIN } as any);
  expect(vehicle.status).toBe(VehicleStatus.IN_MAINTENANCE);
});
// + completar sin datos → 400; completar con datos → AVAILABLE y km actualizado
```

`npm run test:cov` → objetivo **> 40 %**. Captura para evidencia. Borra o arregla `src/app.controller.spec.ts` si eliminas `AppController`.

Commit: `test: unit tests for state machine, overlap rule and status updates`

### 12.2 Docker (+5)

`Dockerfile`

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

> `bcrypt` es nativo: se compila en `npm ci` dentro de la imagen, por eso **nunca** copies `node_modules` del host
> (`.dockerignore`: `node_modules`, `dist`, `.env`, `.git`, `coverage`).

`docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - pgdata:/var/lib/postgresql/data # persistencia
    networks: [fleetcore-net] # red interna
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USERNAME} -d ${DB_NAME}']
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build: .
    env_file: .env
    environment:
      DB_HOST: db # dentro de la red, el host es el nombre del servicio
    ports:
      - '${PORT:-3000}:3000'
    depends_on:
      db:
        condition: service_healthy
    networks: [fleetcore-net]

volumes:
  pgdata:

networks:
  fleetcore-net:
```

```bash
docker compose up -d --build
docker compose exec api node dist/database/seeds/seed.js
```

Commit: `chore(docker): Dockerfile and docker-compose with PostgreSQL volume`

### 12.3 OAuth 2.0 (+10) — solo si sobra tiempo

No incluido en esta guía.

---

## 13. Escenarios de prueba (también sirven como evidencia)

**Auth**

1. Registrar ADMIN y TECHNICIAN → 201. Correo repetido → 409.
2. Login correcto → 200 + token. Clave mala → 401.
3. Ruta protegida sin token → 401. Token inválido/expirado → 401.
4. TECHNICIAN en `POST /vehicles` → 403.
5. `GET /integrations/vehicles/ABC123/history` sin key → 401, key mala → 401, key buena → 200.

**Vehículos / mecánicos / talleres**

6. Placa repetida → 409 (no 500).
7. `GET /vehicles/plate/ABC123` → 200. Placa inexistente → 404.
8. `DELETE /vehicles/:id` → `INACTIVE`, el historial sigue.
9. `GET /vehicles/abc` → 400.
10. `GET /workshops` solo devuelve activos.
11. Inactivar un mecánico → su historial permanece.

**Mantenimientos**

12. Vehículo inexistente → 404; vehículo INACTIVE → 409.
13. Mecánico o taller inactivo → 409.
14. Kilometraje menor al del vehículo → 400.
15. Segundo mantenimiento activo para el mismo vehículo → 409.
16. Mecánico 7:30–9:00 + otro a las 8:00 (otro taller) → 409; + otro a las 9:00 → 201.
17. `SCHEDULED → IN_PROGRESS` → vehículo `IN_MAINTENANCE`.
18. `IN_PROGRESS → COMPLETED` sin datos de cierre → 400; con datos → 200 y vehículo `AVAILABLE`.
19. `COMPLETED → IN_PROGRESS` → 409. `CANCELLED → COMPLETED` → 409.
20. TECHNICIAN cambia el estado de un mantenimiento ajeno → 403.
21. `GET /maintenances/my` como TECHNICIAN → solo los suyos, con taller.

**Seeder**

22. `npm run seed` dos veces → mismos conteos.

---

## 14. Si el tiempo aprieta: prioridad

1. Paso 2.5 (correcciones) + Paso 3 (auth) → sin esto nada arranca.
2. Entidades + CRUDs + mantenimientos (creación y estados) → el corazón de la rúbrica.
3. Seeder + Swagger + README + `.env.example` + dump.
4. Endpoint `x-api-key` e historial.
5. Docker (+5, rápido).
6. Vitest (+5).
7. OAuth (+10) solo si sobra tiempo.

## 15. Mejoras opcionales

- **Índice único parcial** para blindar "un vehículo = un mantenimiento activo" en la BD:
  `CREATE UNIQUE INDEX uq_active_maintenance_vehicle ON maintenances ("vehicleId") WHERE status IN ('SCHEDULED','IN_PROGRESS');`
  El `AllExceptionsFilter` ya lo convierte en 409.
- Paginación (`?page=&limit=`) en los listados.
- Tabla `audit_log` para las "auditorías" del ADMIN.
- Rate limiting con `@nestjs/throttler` en `/auth/login`.
