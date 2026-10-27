# Guía completa: Prueba de desempeño M6.2 – FleetCore (NestJS)

Stack: NestJS · TypeScript · TypeORM · PostgreSQL · JWT · argon2 · Swagger · Vitest · Docker.
Se excluye OAuth 2.0. Las pruebas unitarias se hacen con Vitest (el PDF menciona Jest).

Esta guía está pensada para que escribas el código tú, paso a paso. Cada paso trae el **qué**, el **por qué** y el código clave. Los snippets son la base; adáptalos a tus nombres.

---

## 0. Decisiones y supuestos (confírmalos con quien aplica la prueba)

| Tema                                                                                                | Decisión de esta guía                                                                | Por qué                                                                                                   |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Duración del mantenimiento                                                                          | `scheduledAt` + `durationMinutes` (default 60) → se guarda también `scheduledEndAt`  | El PDF exige detectar cruces de horario pero no define hora de fin                                        |
| Cruce de horarios                                                                                   | Intervalo semiabierto `[inicio, fin)`: 7:30–9:00 y 9:00–10:00 **sí** conviven        | Ejemplo 3.10.d del PDF                                                                                    |
| "Un técnico no puede tener más de un mantenimiento activo" (sec. 6) vs. regla de cruces (sec. 3.10) | Se implementa la regla de cruces (más específica)                                    | Si se aplicara literal, el ejemplo 3.10.d no tendría sentido                                              |
| Roles                                                                                               | ADMIN, TECHNICIAN, MANAGER (MANAGER = solo lectura)                                  | El PDF lista MANAGER en una página y no en otra; implementarlo no hace daño                               |
| `POST /auth/register`                                                                               | Público y acepta `role`                                                              | El PDF pide "registro de usuarios con roles". En producción sería solo ADMIN; déjalo anotado en el README |
| Técnico ↔ Mecánico                                                                                  | `Mechanic.user` es una relación OneToOne opcional con `User`                         | El seeder pide "2 mecánicos activos vinculados a los técnicos"                                            |
| Estados de taller y mecánico                                                                        | Enum `ACTIVE` / `INACTIVE`                                                           | El PDF solo dice "estado"                                                                                 |
| Eliminación de vehículo                                                                             | `DELETE /vehicles/:id` = pasar a `INACTIVE` (no se borra la fila)                    | Sec. 2.7                                                                                                  |
| Transición inválida                                                                                 | `409 Conflict` con mensaje descriptivo                                               | "Respuesta HTTP apropiada"                                                                                |
| Técnico puede cambiar a                                                                             | `IN_PROGRESS` y `COMPLETED` (solo sus mantenimientos). `CANCELLED` solo ADMIN        | Supuesto razonable                                                                                        |
| Si se cancela un mantenimiento `IN_PROGRESS`                                                        | El vehículo vuelve a `AVAILABLE`                                                     | El PDF no lo dice, pero dejarlo en `IN_MAINTENANCE` sería un bug                                          |
| `finalMileage` al completar                                                                         | Debe ser ≥ kilometraje actual del vehículo y actualiza `vehicle.mileage`             | Coherente con la regla de kilometraje                                                                     |
| "Auditorías" del ADMIN                                                                              | Se cubre con `createdAt`/`updatedAt` + historial. Una tabla de auditoría es opcional | El PDF no la detalla                                                                                      |

### Matriz de permisos

| Recurso                                                          | ADMIN | MANAGER | TECHNICIAN          |
| ---------------------------------------------------------------- | ----- | ------- | ------------------- |
| Listar / ver vehículos                                           | ✅    | ✅      | ✅                  |
| Crear / editar / inactivar vehículos                             | ✅    | ❌      | ❌                  |
| Mecánicos (leer)                                                 | ✅    | ✅      | ❌                  |
| Mecánicos (crear / editar / activar / inactivar)                 | ✅    | ❌      | ❌                  |
| Talleres activos / ver taller                                    | ✅    | ✅      | ✅                  |
| Talleres (crear / editar / activar / inactivar)                  | ✅    | ❌      | ❌                  |
| Crear mantenimiento                                              | ✅    | ❌      | ❌                  |
| Listar todos / activos / por vehículo / por mecánico / historial | ✅    | ✅      | ❌                  |
| Ver mis mantenimientos asignados (con taller)                    | —     | —       | ✅                  |
| Cambiar estado                                                   | ✅    | ❌      | ✅ (solo los suyos) |

### Endpoints

```
AUTH
POST   /auth/register                 @Public
POST   /auth/login                    @Public
GET    /auth/me                       cualquier rol autenticado

VEHÍCULOS
GET    /vehicles                      ADMIN, MANAGER, TECHNICIAN
GET    /vehicles/:id                  ADMIN, MANAGER, TECHNICIAN
GET    /vehicles/plate/:plate         ADMIN, MANAGER, TECHNICIAN
POST   /vehicles                      ADMIN
PATCH  /vehicles/:id                  ADMIN
DELETE /vehicles/:id                  ADMIN   (→ INACTIVE)
GET    /vehicles/:id/history          ADMIN, MANAGER

MECÁNICOS
GET    /mechanics                     ADMIN, MANAGER
GET    /mechanics/:id                 ADMIN, MANAGER
POST   /mechanics                     ADMIN
PATCH  /mechanics/:id                 ADMIN
PATCH  /mechanics/:id/activate        ADMIN
PATCH  /mechanics/:id/deactivate      ADMIN
GET    /mechanics/:id/maintenances    ADMIN, MANAGER

TALLERES
GET    /workshops                     (solo activos) todos los roles
GET    /workshops/:id                 todos los roles
POST   /workshops                     ADMIN
PATCH  /workshops/:id                 ADMIN
PATCH  /workshops/:id/activate        ADMIN
PATCH  /workshops/:id/deactivate      ADMIN

MANTENIMIENTOS
POST   /maintenances                  ADMIN
GET    /maintenances                  ADMIN, MANAGER
GET    /maintenances/active           ADMIN, MANAGER
GET    /maintenances/my               TECHNICIAN
GET    /maintenances/vehicle/:vehicleId   ADMIN, MANAGER
GET    /maintenances/mechanic/:mechanicId ADMIN, MANAGER
GET    /maintenances/:id              ADMIN, MANAGER, TECHNICIAN (si es suyo)
PATCH  /maintenances/:id/status       ADMIN, TECHNICIAN (si es suyo)

INTEGRACIONES (x-api-key)
GET    /integrations/vehicles/:plate/history   @Public + ApiKeyGuard
```

> ⚠️ **Orden de rutas:** en el controller de mantenimientos declara `active`, `my`, `vehicle/:id` y `mechanic/:id` **antes** de `:id`. Si no, Nest interpretará "active" como un id y obtendrás un 400.

---

## 1. Setup del proyecto

```bash
npm i -g @nestjs/cli
nest new fleetcore            # npm
cd fleetcore

npm i @nestjs/config @nestjs/typeorm typeorm pg @nestjs/jwt argon2 \
      class-validator class-transformer @nestjs/swagger

# Pruebas con Vitest (SWC es necesario por los decoradores de Nest)
npm i -D vitest @vitest/coverage-v8 unplugin-swc @swc/core
```

`package.json` → scripts a agregar:

```json
"seed": "nest build && node dist/database/seeds/seed.js",
"test": "vitest run",
"test:cov": "vitest run --coverage"
```

> El seeder se ejecuta desde `dist` para evitar problemas de ts-node con la configuración de módulos del proyecto. Funciona igual dentro de Docker.

Commit inicial: `chore: init NestJS project`

---

## 2. Estructura de carpetas

```
src/
├─ main.ts
├─ app.module.ts
├─ config/
│  └─ env.validation.ts
├─ common/
│  ├─ enums/            (role, vehicle-status, maintenance-*, entity-status)
│  ├─ decorators/       (public, roles, current-user)
│  ├─ guards/           (jwt-auth, roles, api-key)
│  ├─ interceptors/     (response.interceptor.ts)
│  ├─ filters/          (all-exceptions.filter.ts)
│  └─ interfaces/       (jwt-payload.interface.ts)
├─ auth/
├─ users/
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

---

## 3. Variables de entorno

`.env.example` (se entrega) y `.env` (NO se sube; agrégalo al `.gitignore`):

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=fleetcore
JWT_SECRET=cambia-este-secreto
JWT_EXPIRES_IN=1h
API_KEYS=demo-key-partner-1,demo-key-partner-2
```

Validación para que la app **falle al arrancar** si falta algo (criterio 1.6):

```ts
// config/env.validation.ts
const REQUIRED = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'API_KEYS',
];

export function validateEnv(env: Record<string, unknown>) {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length)
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  return env;
}
```

---

## 4. Paso 1 – Base: AppModule y main.ts

```ts
// app.module.ts (resumen)
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: Number(config.get('DB_PORT')),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true, // solo para la prueba; en producción: migraciones
      }),
    }),
    AuthModule,
    UsersModule,
    VehiclesModule,
    MechanicsModule,
    WorkshopsModule,
    MaintenancesModule,
    IntegrationsModule,
  ],
  providers: [
    // El ORDEN importa: primero autenticar (JWT), luego autorizar (roles)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

```ts
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta campos no declarados en el DTO
      forbidNonWhitelisted: true, // 400 si mandan campos extra
      transform: true, // convierte tipos (query params, @Type)
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const swagger = new DocumentBuilder()
    .setTitle('FleetCore API')
    .setDescription('Gestión de mantenimiento de flota')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

Swagger quedará en `http://localhost:3000/docs`.

Commit: `feat: base config, TypeORM connection and Swagger setup`

---

## 5. Paso 2 – Common (enums, decoradores, guards, interceptor, filter)

### 5.1 Enums

```ts
export enum Role {
  ADMIN = 'ADMIN',
  TECHNICIAN = 'TECHNICIAN',
  MANAGER = 'MANAGER',
}
export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  IN_MAINTENANCE = 'IN_MAINTENANCE',
  INACTIVE = 'INACTIVE',
}
export enum EntityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
} // mecánicos y talleres
export enum MaintenanceType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
}
export enum MaintenanceStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
export const ACTIVE_MAINTENANCE_STATUSES = [
  MaintenanceStatus.SCHEDULED,
  MaintenanceStatus.IN_PROGRESS,
];
```

```ts
// interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
}
```

### 5.2 Decoradores personalizados (mínimo 3: @Public, @Roles, @CurrentUser)

```ts
// public.decorator.ts — marca rutas que NO requieren JWT
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// roles.decorator.ts — declara los roles permitidos
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// current-user.decorator.ts — extrae el usuario que dejó el JwtAuthGuard en la request
export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as JwtPayload;
    return field ? user?.[field] : user;
  },
);
```

> `SetMetadata` solo **guarda** información. Quien la lee es el guard con `Reflector`.

### 5.3 JwtAuthGuard (global)

```ts
// GUARD: valida el JWT en TODAS las rutas salvo las marcadas con @Public()
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token)
      throw new UnauthorizedException('Token no proporcionado');

    try {
      req.user = await this.jwt.verifyAsync<JwtPayload>(token); // falla si es inválido o expiró
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    return true;
  }
}
```

### 5.4 RolesGuard (global)

```ts
// GUARD: autorización por rol. Si la ruta no tiene @Roles(), basta con estar autenticado.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta acción',
      );
    }
    return true;
  }
}
```

### 5.5 ApiKeyGuard (solo para integraciones)

```ts
// GUARD: valida la cabecera x-api-key contra API_KEYS (variable de entorno, separadas por coma)
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly validKeys: string[];

  constructor(config: ConfigService) {
    this.validKeys = (config.get<string>('API_KEYS') ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }

  canActivate(ctx: ExecutionContext): boolean {
    const key = ctx.switchToHttp().getRequest().headers['x-api-key'];
    if (!key) throw new UnauthorizedException('API Key no proporcionada');
    if (typeof key !== 'string' || !this.validKeys.includes(key)) {
      throw new UnauthorizedException('API Key inválida');
    }
    return true;
  }
}
```

Se usa así: `@Public()` (salta el JWT global) + `@UseGuards(ApiKeyGuard)`.

### 5.6 Interceptor de respuesta uniforme

```ts
// INTERCEPTOR: envuelve toda respuesta exitosa en { success, statusCode, data, timestamp }
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const res = ctx.switchToHttp().getResponse();
    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode: res.statusCode,
        data: data ?? null,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### 5.7 Exception Filter global

```ts
// FILTRO: convierte CUALQUIER error en { success:false, statusCode, message, path, timestamp }
// y evita que errores de BD (unicidad, FK, etc.) terminen como 500.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const raw = typeof body === 'string' ? body : (body as any).message;
      message = Array.isArray(raw) ? raw.join('; ') : raw; // ValidationPipe devuelve arrays
    } else if (exception instanceof QueryFailedError) {
      const code =
        (exception as any).code ?? (exception as any).driverError?.code;
      ({ status, message } = this.mapDbError(code));
    }

    if (status >= 500) this.logger.error(exception); // el detalle va al log, no al cliente

    res.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }

  private mapDbError(code?: string) {
    switch (code) {
      case '23505':
        return {
          status: 409,
          message: 'Ya existe un registro con ese valor único',
        };
      case '23503':
        return {
          status: 409,
          message: 'La operación viola una relación con otro registro',
        };
      case '23502':
        return { status: 400, message: 'Falta un campo obligatorio' };
      case '22P02':
        return { status: 400, message: 'Formato de dato inválido' };
      default:
        return { status: 500, message: 'Error interno del servidor' };
    }
  }
}
```

Imports: `import type { Request, Response } from 'express'` y `QueryFailedError` de `typeorm`.

> Aun así, **valida unicidad a mano** antes de insertar (placa, correos) para dar mensajes claros ("La placa ABC123 ya está registrada"). El filtro es la red de seguridad ante condiciones de carrera.

Commit: `feat(common): roles/public/current-user decorators, guards, interceptor and exception filter`

---

## 6. Paso 3 – Auth y usuarios

**User entity**

```ts
@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ unique: true }) email: string;
  @Column({ select: false }) password: string; // nunca sale en las consultas
  @Column({ type: 'enum', enum: Role }) role: Role;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

**AuthModule**: registra `JwtModule` como **global** para que el guard global pueda inyectar `JwtService`.

```ts
JwtModule.registerAsync({
  global: true,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get('JWT_SECRET'),
    signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') },
  }),
});
```

**RegisterDto**: `name` (`@IsString @IsNotEmpty`), `email` (`@IsEmail`), `password` (`@MinLength(8)`), `role` (`@IsEnum(Role)`).

**AuthService**

```ts
async register(dto: RegisterDto) {
  if (await this.users.findByEmail(dto.email)) throw new ConflictException('El correo ya está registrado');
  const password = await argon2.hash(dto.password);           // argon2id por defecto
  const user = await this.users.create({ ...dto, password });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async login({ email, password }: LoginDto) {
  const user = await this.users.findByEmailWithPassword(email); // addSelect('user.password')
  // mismo mensaje para "no existe" y "clave incorrecta": no revela qué correos existen
  if (!user || !(await argon2.verify(user.password, password))) {
    throw new UnauthorizedException('Credenciales inválidas');
  }
  const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
  return { accessToken: await this.jwt.signAsync(payload), user: { id: user.id, email: user.email, role: user.role } };
}
```

Controller: `register` y `login` con `@Public()`; `GET /auth/me` con `@CurrentUser()`.

Commit: `feat(auth): register/login with argon2 and JWT`

---

## 7. Paso 4 – Entidades y relaciones

```
User 1 ─── 0..1 Mechanic        (Mechanic.user, nullable)
Vehicle  1 ─── N Maintenance
Mechanic 1 ─── N Maintenance
Workshop 1 ─── N Maintenance
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
  @Column({
    type: 'enum',
    enum: VehicleStatus,
    default: VehicleStatus.AVAILABLE,
  })
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
}

@Entity('workshops')
export class Workshop {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column() address: string;
  @Column({ type: 'enum', enum: EntityStatus, default: EntityStatus.ACTIVE })
  status: EntityStatus;
  @OneToMany(() => Maintenance, (m) => m.workshop) maintenances: Maintenance[];
}

@Entity('maintenances')
export class Maintenance {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'enum', enum: MaintenanceType }) type: MaintenanceType;
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'int' }) mileage: number; // km al programarlo
  @Column({ type: 'timestamptz' }) scheduledAt: Date;
  @Column({ type: 'timestamptz' }) scheduledEndAt: Date; // scheduledAt + durationMinutes
  @Column({
    type: 'enum',
    enum: MaintenanceStatus,
    default: MaintenanceStatus.SCHEDULED,
  })
  status: MaintenanceStatus;

  // Datos de cierre (solo al completar)
  @Column({ type: 'text', nullable: true }) workDone: string | null;
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: { to: (v) => v, from: (v) => (v === null ? null : Number(v)) },
  })
  finalCost: number | null;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date | null;
  @Column({ type: 'int', nullable: true }) finalMileage: number | null;

  @ManyToOne(() => Vehicle, (v) => v.maintenances, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  vehicle: Vehicle;
  @ManyToOne(() => Mechanic, (m) => m.maintenances, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  mechanic: Mechanic;
  @ManyToOne(() => Workshop, (w) => w.maintenances, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  workshop: Workshop;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

> `numeric` en Postgres llega como **string**; el `transformer` lo convierte a número para que el JSON salga como `350000` y no `"350000.00"`.
> `onDelete: 'RESTRICT'` + inactivación lógica = el historial nunca se pierde.

Commit: `feat(db): entities and relations`

---

## 8. Paso 5 – CRUD de vehículos, mecánicos y talleres

Patrón de cada módulo: DTOs con `class-validator` → service con validaciones de negocio → controller con `@Roles()`.

### Vehículos

- `CreateVehicleDto`: `plate` (`@IsString @IsNotEmpty`, normaliza a mayúsculas con `@Transform`), `brand`, `model`, `year` (`@IsInt @Min(1950) @Max(año actual + 1)`), `mileage` (`@IsInt @Min(0)`), `status` opcional.
- `UpdateVehicleDto = PartialType(CreateVehicleDto)` (de `@nestjs/swagger`, para que Swagger conserve los campos).
- Reglas del service:
  - Crear: si la placa existe → `ConflictException('La placa ABC123 ya está registrada')`.
  - Buscar por id o placa → `NotFoundException` si no existe.
  - Editar: no permitir poner `IN_MAINTENANCE` a mano (solo lo cambia el flujo de mantenimientos); usa `@IsIn([AVAILABLE, INACTIVE])` en el DTO de actualización de estado.
  - `DELETE`: pasa a `INACTIVE`. Si tiene un mantenimiento activo → `409`.
- Usa `ParseIntPipe` en todos los `:id` (id inválido → 400, no 500).

### Mecánicos

- `CreateMechanicDto`: `name`, `email` (único), `specialty`, `userId` opcional (para vincular al técnico).
- `activate` / `deactivate`: cambian `status`. Nunca borran nada.
- `GET /mechanics/:id/maintenances`: historial del mecánico.

### Talleres

- `GET /workshops` devuelve **solo activos** (`where: { status: ACTIVE }`).
- `activate` / `deactivate`.
- `GET /workshops/:id` devuelve cualquiera (activo o no).

Commits (uno por módulo):
`feat(vehicles): CRUD with plate uniqueness and soft inactivation`
`feat(mechanics): CRUD with activate/deactivate`
`feat(workshops): CRUD with activate/deactivate`

---

## 9. Paso 6 – Mantenimientos: reglas puras + creación

### 9.1 Funciones puras (fáciles de probar con Vitest)

```ts
// maintenances/maintenance-rules.ts

// MÁQUINA DE ESTADOS
export const ALLOWED_TRANSITIONS: Record<
  MaintenanceStatus,
  MaintenanceStatus[]
> = {
  [MaintenanceStatus.SCHEDULED]: [
    MaintenanceStatus.IN_PROGRESS,
    MaintenanceStatus.CANCELLED,
  ],
  [MaintenanceStatus.IN_PROGRESS]: [
    MaintenanceStatus.COMPLETED,
    MaintenanceStatus.CANCELLED,
  ],
  [MaintenanceStatus.COMPLETED]: [], // estado final
  [MaintenanceStatus.CANCELLED]: [], // estado final
};

export function assertTransition(
  from: MaintenanceStatus,
  to: MaintenanceStatus,
) {
  if (from === to)
    throw new ConflictException(`El mantenimiento ya está en estado ${from}`);
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new ConflictException(
      `Transición inválida: un mantenimiento ${from} no puede pasar a ${to}`,
    );
  }
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
  if (missing.length) {
    throw new BadRequestException(
      `No se puede completar el mantenimiento. Faltan: ${missing.join(', ')}`,
    );
  }
}

// CRUCE DE HORARIOS — intervalos semiabiertos [inicio, fin)
export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && bStart < aEnd;
```

Con `[inicio, fin)`: 7:30–9:00 y 9:00–10:00 → `false` (permitido); 7:30–9:00 y 8:00–9:00 → `true` (bloqueado).

### 9.2 DTO de creación

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

### 9.3 Service: crear (dentro de transacción)

```ts
async create(dto: CreateMaintenanceDto) {
  // TRANSACCIÓN: o se guardan todas las validaciones+escritura, o nada
  return this.dataSource.transaction(async (manager) => {
    const vehicle  = await manager.findOne(Vehicle,  { where: { id: dto.vehicleId } });
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
    if (vehicleBusy) throw new ConflictException(`El vehículo ${vehicle.plate} ya tiene un mantenimiento activo`);

    // Mecánico sin cruces de horario (en cualquier taller)
    const start = dto.scheduledAt;
    const end = new Date(start.getTime() + (dto.durationMinutes ?? 60) * 60_000);
    const clash = await manager.exists(Maintenance, {
      where: {
        mechanic: { id: mechanic.id },
        status: In(ACTIVE_MAINTENANCE_STATUSES),
        scheduledAt: LessThan(end),       // el existente empieza antes de que yo termine
        scheduledEndAt: MoreThan(start),  // y termina después de que yo empiece
      },
    });
    if (clash) throw new ConflictException(`El mecánico ${mechanic.name} ya tiene un mantenimiento en ese horario`);

    const maintenance = manager.create(Maintenance, {
      type: dto.type, description: dto.description, mileage: dto.mileage,
      scheduledAt: start, scheduledEndAt: end,
      status: MaintenanceStatus.SCHEDULED,          // estado inicial fijo
      vehicle, mechanic, workshop,
    });
    return manager.save(maintenance);
  });
}
```

> Los `LessThan/MoreThan` de arriba son la versión SQL de `overlaps()`. Mantén `overlaps()` como referencia y para los tests.

Commit: `feat(maintenances): create maintenance with business rules`

---

## 10. Paso 7 – Cambio de estado (transacción)

```ts
// DTO
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

    assertTransition(maintenance.status, dto.status);   // 409 si es inválida
    const vehicle = maintenance.vehicle;

    switch (dto.status) {
      case MaintenanceStatus.IN_PROGRESS:
        if (vehicle.status === VehicleStatus.INACTIVE)
          throw new ConflictException(`El vehículo ${vehicle.plate} está inactivo`);
        vehicle.status = VehicleStatus.IN_MAINTENANCE;          // regla automática
        break;

      case MaintenanceStatus.COMPLETED:
        assertClosingData(dto);                                  // 400 si faltan datos
        if (dto.finalMileage! < vehicle.mileage)
          throw new BadRequestException(
            `El kilometraje final (${dto.finalMileage}) no puede ser menor al del vehículo (${vehicle.mileage})`);
        maintenance.workDone = dto.workDone!;
        maintenance.finalCost = dto.finalCost!;
        maintenance.finishedAt = dto.finishedAt!;
        maintenance.finalMileage = dto.finalMileage!;
        vehicle.status = VehicleStatus.AVAILABLE;                // regla automática
        vehicle.mileage = dto.finalMileage!;
        break;

      case MaintenanceStatus.CANCELLED:
        if (maintenance.status === MaintenanceStatus.IN_PROGRESS)
          vehicle.status = VehicleStatus.AVAILABLE;              // no dejarlo "en taller" para siempre
        break;
    }

    maintenance.status = dto.status;
    await manager.save([vehicle, maintenance]);
    return maintenance;
  });
}
```

Commit: `feat(maintenances): status transitions with vehicle availability sync`

---

## 11. Paso 8 – Consultas e integración con x-api-key

### Consultas del módulo de mantenimientos

| Endpoint                                 | Query                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /maintenances`                      | `find({ relations: {vehicle, mechanic, workshop}, order: { scheduledAt: 'DESC' } })`              |
| `GET /maintenances/active`               | `status: In(ACTIVE_MAINTENANCE_STATUSES)`                                                         |
| `GET /maintenances/vehicle/:vehicleId`   | `vehicle: { id }` (404 si el vehículo no existe)                                                  |
| `GET /maintenances/mechanic/:mechanicId` | `mechanic: { id }` (404 si no existe)                                                             |
| `GET /maintenances/my`                   | busca el `Mechanic` con `user: { id: user.sub }` y devuelve sus mantenimientos **con `workshop`** |
| `GET /vehicles/:id/history`              | mantenimientos del vehículo, preferiblemente `COMPLETED`, ordenados por `finishedAt DESC`         |

### Endpoint de integración (formato del ejemplo del PDF)

```ts
@ApiTags('integrations')
@ApiSecurity('x-api-key')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Public() // salta el JWT global
  @UseGuards(ApiKeyGuard) // exige x-api-key
  @Get('vehicles/:plate/history')
  history(@Param('plate') plate: string) {
    return this.service.getVehicleHistory(plate);
  }
}
```

El service arma la respuesta del ejemplo mapeando los campos:

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

## 12. Paso 9 – Seeder idempotente

Idempotente = antes de crear algo, **buscarlo por su clave natural** (email, placa, nombre).

```ts
// database/seeds/seed.ts
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
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

  const hash = (p: string) => argon2.hash(p);

  // 1 ADMIN, 2 TECHNICIAN (+ 1 MANAGER opcional)
  const admin = await findOrCreate(
    users,
    { email: 'admin@fleetcore.com' },
    {
      name: 'Admin',
      email: 'admin@fleetcore.com',
      password: await hash('Admin123*'),
      role: Role.ADMIN,
    },
  );
  const tech1 = await findOrCreate(
    users,
    { email: 'tech1@fleetcore.com' },
    {
      name: 'Carlos Pérez',
      email: 'tech1@fleetcore.com',
      password: await hash('Tech123*'),
      role: Role.TECHNICIAN,
    },
  );
  const tech2 = await findOrCreate(
    users,
    { email: 'tech2@fleetcore.com' },
    {
      name: 'Laura Gómez',
      email: 'tech2@fleetcore.com',
      password: await hash('Tech123*'),
      role: Role.TECHNICIAN,
    },
  );
  await findOrCreate(
    users,
    { email: 'manager@fleetcore.com' },
    {
      name: 'Manager',
      email: 'manager@fleetcore.com',
      password: await hash('Manager123*'),
      role: Role.MANAGER,
    },
  );

  // 3 mecánicos: 2 activos vinculados a técnicos, 1 inactivo
  const m1 = await findOrCreate(
    mechanics,
    { email: 'carlos@fleetcore.com' },
    {
      name: 'Carlos Pérez',
      email: 'carlos@fleetcore.com',
      specialty: 'Motor',
      status: EntityStatus.ACTIVE,
      user: tech1,
    },
  );
  const m2 = await findOrCreate(
    mechanics,
    { email: 'laura@fleetcore.com' },
    {
      name: 'Laura Gómez',
      email: 'laura@fleetcore.com',
      specialty: 'Frenos',
      status: EntityStatus.ACTIVE,
      user: tech2,
    },
  );
  await findOrCreate(
    mechanics,
    { email: 'pedro@fleetcore.com' },
    {
      name: 'Pedro Ruiz',
      email: 'pedro@fleetcore.com',
      specialty: 'Electricidad',
      status: EntityStatus.INACTIVE,
    },
  );

  // 2 talleres: 1 activo, 1 inactivo
  const centro = await findOrCreate(
    workshops,
    { name: 'Taller Centro' },
    {
      name: 'Taller Centro',
      address: 'Calle 45 # 20-10',
      status: EntityStatus.ACTIVE,
    },
  );
  await findOrCreate(
    workshops,
    { name: 'Taller Sur' },
    {
      name: 'Taller Sur',
      address: 'Carrera 8 # 3-50',
      status: EntityStatus.INACTIVE,
    },
  );

  // 4 vehículos: 2 AVAILABLE, 1 IN_MAINTENANCE, 1 INACTIVE
  const v1 = await findOrCreate(
    vehicles,
    { plate: 'ABC123' },
    {
      plate: 'ABC123',
      brand: 'Chevrolet',
      model: 'NPR',
      year: 2020,
      mileage: 45050,
      status: VehicleStatus.AVAILABLE,
    },
  );
  await findOrCreate(
    vehicles,
    { plate: 'DEF456' },
    {
      plate: 'DEF456',
      brand: 'Renault',
      model: 'Logan',
      year: 2022,
      mileage: 12000,
      status: VehicleStatus.AVAILABLE,
    },
  );
  const v3 = await findOrCreate(
    vehicles,
    { plate: 'GHI789' },
    {
      plate: 'GHI789',
      brand: 'Hino',
      model: '300',
      year: 2019,
      mileage: 78000,
      status: VehicleStatus.IN_MAINTENANCE,
    },
  );
  await findOrCreate(
    vehicles,
    { plate: 'JKL012' },
    {
      plate: 'JKL012',
      brand: 'Isuzu',
      model: 'NKR',
      year: 2015,
      mileage: 150000,
      status: VehicleStatus.INACTIVE,
    },
  );

  // Mantenimiento COMPLETED (historial de ABC123)
  await findOrCreate(
    maintenances,
    { vehicle: { id: v1.id }, description: 'Cambio de aceite y filtros' },
    {
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
      vehicle: v1,
      mechanic: m1,
      workshop: centro,
    },
  );

  // Mantenimiento IN_PROGRESS (GHI789 está IN_MAINTENANCE)
  await findOrCreate(
    maintenances,
    { vehicle: { id: v3.id }, status: MaintenanceStatus.IN_PROGRESS },
    {
      type: MaintenanceType.CORRECTIVE,
      description: 'Reemplazo de pastillas de freno',
      mileage: 78000,
      scheduledAt: new Date('2026-10-26T13:00:00Z'),
      scheduledEndAt: new Date('2026-10-26T15:00:00Z'),
      status: MaintenanceStatus.IN_PROGRESS,
      vehicle: v3,
      mechanic: m2,
      workshop: centro,
    },
  );

  await app.close();
  console.log('✅ Seed completado');
}
bootstrap();
```

Prueba de idempotencia: corre `npm run seed` **dos veces** y verifica en la BD que los conteos no cambian.

> Credenciales de prueba para el README: `admin@fleetcore.com / Admin123*`, `tech1@fleetcore.com / Tech123*`, `tech2@fleetcore.com / Tech123*`, `manager@fleetcore.com / Manager123*`.

Commit: `feat(seed): idempotent database seeder`

---

## 13. Paso 10 – Swagger completo

- `@ApiTags('vehicles')` etc. en cada controller.
- `@ApiBearerAuth()` en los controllers protegidos (para el candado y el botón _Authorize_).
- `@ApiSecurity('x-api-key')` en el endpoint de integraciones.
- `@ApiOperation({ summary })` y `@ApiResponse({ status: 409, description: '...' })` en los endpoints con reglas de negocio.
- Tip: activar el plugin de Swagger en `nest-cli.json` (`"plugins": ["@nestjs/swagger"]`) documenta los DTOs automáticamente.
- Flujo de prueba en `/docs`: `POST /auth/login` → copiar `accessToken` → _Authorize_ → probar.

Commit: `docs(swagger): document endpoints, auth schemes and responses`

---

## 14. Paso 11 – Pruebas unitarias con Vitest

`vitest.config.ts`:

```ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/**/*.module.ts',
        'src/database/**',
        'src/**/*.spec.ts',
      ],
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
```

### Test 1: máquina de estados y cruces (funciones puras)

```ts
// maintenances/maintenance-rules.spec.ts
import { describe, it, expect } from 'vitest';

describe('assertTransition', () => {
  it('permite SCHEDULED → IN_PROGRESS', () => {
    expect(() =>
      assertTransition(
        MaintenanceStatus.SCHEDULED,
        MaintenanceStatus.IN_PROGRESS,
      ),
    ).not.toThrow();
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
    expect(() => assertClosingData({ workDone: 'ok' })).toThrow(
      BadRequestException,
    );
  });
});

describe('overlaps', () => {
  const d = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00Z`);
  it('7:30–9:00 vs 8:00–9:00 → cruce', () =>
    expect(overlaps(d('07:30'), d('09:00'), d('08:00'), d('09:00'))).toBe(
      true,
    ));
  it('7:30–9:00 vs 9:00–10:00 → sin cruce', () =>
    expect(overlaps(d('07:30'), d('09:00'), d('09:00'), d('10:00'))).toBe(
      false,
    ));
});
```

### Test 2: `MaintenancesService.updateStatus` con mocks

Idea: reemplaza `DataSource.transaction` para que ejecute el callback con un `manager` falso.

```ts
const makeSut = (maintenance: Partial<Maintenance>) => {
  const manager = {
    findOne: vi.fn().mockResolvedValue(maintenance),
    save: vi.fn(),
  };
  const dataSource = { transaction: (cb: any) => cb(manager) };
  const service = new MaintenancesService(
    dataSource as any /* , otros repos mockeados */,
  );
  return { service, manager };
};

it('al pasar a IN_PROGRESS el vehículo queda IN_MAINTENANCE', async () => {
  const vehicle = { status: VehicleStatus.AVAILABLE, mileage: 1000 };
  const { service } = makeSut({
    id: 1,
    status: MaintenanceStatus.SCHEDULED,
    vehicle,
    mechanic: { user: { id: 7 } },
  } as any);
  await service.updateStatus(1, { status: MaintenanceStatus.IN_PROGRESS }, {
    sub: 1,
    role: Role.ADMIN,
  } as any);
  expect(vehicle.status).toBe(VehicleStatus.IN_MAINTENANCE);
});

it('completar sin datos de cierre lanza 400', async () => {
  /* ... */
});
it('al completar el vehículo queda AVAILABLE y actualiza kilometraje', async () => {
  /* ... */
});
```

Ejecutar: `npm run test:cov`. Objetivo: **> 40 %** de cobertura (el reporte sale por consola y en `coverage/`). Haz una captura para la evidencia.

Commit: `test: unit tests for state machine, overlap rule and status updates`

---

## 15. Paso 12 – Docker (5 puntos extra)

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

`.dockerignore`: `node_modules`, `dist`, `.env`, `.git`, `coverage`.

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

Comandos:

```bash
docker compose up -d --build
docker compose exec api node dist/database/seeds/seed.js     # seeder dentro del contenedor
docker compose logs -f api
```

> No marques la red como `internal: true`: bloquearía la publicación del puerto de la API hacia tu máquina.

Commit: `chore(docker): Dockerfile and docker-compose with PostgreSQL volume`

---

## 16. Paso 13 – Entregables

### README.md (plantilla)

```md
# FleetCore API

**Coder:** Ricardo Torres · **Clan:** <tu clan>

API REST para gestionar el mantenimiento de la flota (NestJS, TypeORM, PostgreSQL, JWT).

## Requisitos

Node 22+, PostgreSQL 16+ (o Docker).

## Instalación

1. `npm install`
2. Copia `.env.example` a `.env` y ajusta los valores.
3. Crea la base de datos `fleetcore`.
4. `npm run seed`
5. `npm run start:dev`

## Con Docker

`docker compose up -d --build` y luego `docker compose exec api node dist/database/seeds/seed.js`

## Swagger

http://localhost:3000/docs

## Credenciales de prueba

| Rol        | Correo                | Contraseña  |
| ---------- | --------------------- | ----------- |
| ADMIN      | admin@fleetcore.com   | Admin123*   |
| TECHNICIAN | tech1@fleetcore.com   | Tech123*    |
| TECHNICIAN | tech2@fleetcore.com   | Tech123*    |
| MANAGER    | manager@fleetcore.com | Manager123* |

API Key de prueba (integraciones): `demo-key-partner-1` → `GET /integrations/vehicles/ABC123/history`

## Pruebas

`npm run test` · `npm run test:cov`

## Decisiones

- Cruce de horarios: intervalos [inicio, fin); la duración por defecto es de 60 min.
- El registro es público para efectos de la prueba; en producción debería restringirse a ADMIN.
```

### Dump SQL (después de correr el seeder)

```bash
# Local
pg_dump -U postgres -d fleetcore --no-owner --no-privileges -f fleetcore_dump.sql

# Con Docker
docker compose exec db pg_dump -U postgres fleetcore --no-owner --no-privileges > fleetcore_dump.sql
```

### Evidencias

Colección de **Bruno** exportada (carpeta `docs/bruno/`) y/o capturas de Swagger de los escenarios de la sección 17.

### Commits sugeridos (uno por funcionalidad)

```
chore: init NestJS project
feat: base config, TypeORM connection and Swagger setup
feat(common): decorators, guards, interceptor and exception filter
feat(auth): register/login with argon2 and JWT
feat(db): entities and relations
feat(vehicles): CRUD with plate uniqueness and soft inactivation
feat(mechanics): CRUD with activate/deactivate
feat(workshops): CRUD with activate/deactivate
feat(maintenances): create maintenance with business rules
feat(maintenances): status transitions with vehicle availability sync
feat(integrations): x-api-key protected vehicle history endpoint
feat(seed): idempotent database seeder
docs(swagger): document endpoints and auth schemes
test: unit tests with Vitest
chore(docker): Dockerfile and docker-compose
docs: README, .env.example and SQL dump
```

---

## 17. Escenarios de prueba (úsalos también como evidencia)

**Auth**

1. Registrar usuario con cada rol → 201.
2. Registrar correo repetido → 409.
3. Login correcto → 200 + token. Login con clave mala → 401.
4. Ruta protegida sin token → 401. Con token inválido/expirado → 401.
5. TECHNICIAN en `POST /vehicles` → 403.
6. `GET /integrations/vehicles/ABC123/history` sin key → 401, con key mala → 401, con key buena → 200.

**Vehículos / mecánicos / talleres** 7. Crear vehículo con placa repetida → 409 (no 500). 8. `GET /vehicles/plate/ABC123` → 200. Placa inexistente → 404. 9. `DELETE /vehicles/:id` → queda `INACTIVE` y su historial sigue existiendo. 10. `GET /vehicles/abc` → 400 (ParseIntPipe). 11. `GET /workshops` solo devuelve activos. 12. Inactivar un mecánico → su historial permanece.

**Mantenimientos** 13. Crear con vehículo inexistente → 404; vehículo INACTIVE → 409. 14. Crear con mecánico o taller inactivo → 409. 15. Kilometraje menor al del vehículo → 400. 16. Segundo mantenimiento activo para el mismo vehículo → 409. 17. Mecánico 7:30–9:00 + otro a las 8:00 (otro taller) → 409. + otro a las 9:00 → 201. 18. `SCHEDULED → IN_PROGRESS` → vehículo `IN_MAINTENANCE`. 19. `IN_PROGRESS → COMPLETED` sin datos de cierre → 400; con datos → 200 y vehículo `AVAILABLE`. 20. `COMPLETED → IN_PROGRESS` → 409. `CANCELLED → COMPLETED` → 409. 21. TECHNICIAN cambia el estado de un mantenimiento ajeno → 403. 22. `GET /maintenances/my` como TECHNICIAN devuelve solo los suyos con el taller.

**Seeder** 23. `npm run seed` dos veces → mismos conteos.

---

## 18. Si el tiempo aprieta: prioridad

1. Pasos 1–4 (base, common, auth, entidades) → es la base de todo.
2. CRUDs + mantenimientos con reglas + cambio de estado (el corazón de la rúbrica).
3. Seeder idempotente + Swagger + README + `.env.example` + dump.
4. Guard `x-api-key` e historial.
5. Docker (5 pts, rápido de hacer).
6. Vitest (5 pts): con los dos archivos de la sección 14 se alcanza la cobertura pedida.

## 19. Mejoras opcionales (si sobra tiempo)

- **Índice único parcial** para blindar "un vehículo = un mantenimiento activo" a nivel de BD (ante condiciones de carrera):
  `CREATE UNIQUE INDEX uq_active_maintenance_vehicle ON maintenances ("vehicleId") WHERE status IN ('SCHEDULED','IN_PROGRESS');` — el `AllExceptionsFilter` ya lo convertiría en 409.
- Paginación (`?page=&limit=`) en los listados.
- Tabla `audit_log` (quién cambió qué y cuándo) para la parte de "auditorías" del ADMIN.
- Rate limiting con `@nestjs/throttler` en `/auth/login`.
