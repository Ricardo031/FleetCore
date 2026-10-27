# FleetCore API

REST API to manage the maintenance of a vehicle fleet. Built with **NestJS + TypeScript + TypeORM + PostgreSQL**.

## Coder info

- **Name:** Ricardo Torres
- **Clan:** Node.js / Nest.js

## What does it do?

FleetCore keeps track of the maintenance of the company vehicles. With this API you can:

- Manage **vehicles** (plates, mileage, status, and so on).
- Manage **mechanics** and **workshops**.
- Create **preventive** and **corrective maintenances** and assign a mechanic and a workshop to each one.
- Move a maintenance through its states: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- Update the vehicle status automatically when a maintenance starts or finishes.
- Check the maintenance history of a vehicle.

Users log in with email and password and get a **JWT**. There are 2 roles: `ADMIN` and `TECHNICIAN`. There's also an endpoint for external partners that uses an **API key** instead of a token.

## Requirements

- Node.js 20 or higher
- PostgreSQL 14 or higher (or Docker, if you want to use the compose file)
- npm (pnpm also works fine)

## 1. Install

Clone the repo and install the dependencies:

```bash
npm install
```

## 2. Environment variables

Copy the example file and use it as your own `.env`:

```bash
cp .env.example .env
```

This is what each variable means:

| Variable         | Description                                   | Example                                 |
| ---------------- | --------------------------------------------- | --------------------------------------- |
| `PORT`           | Port where the API runs                       | `3020`                                  |
| `DB_HOST`        | PostgreSQL host                               | `localhost`                             |
| `DB_PORT`        | PostgreSQL port                               | `5440`                                  |
| `DB_USERNAME`    | PostgreSQL user                               | `postgres`                              |
| `DB_PASSWORD`    | PostgreSQL password                           | `postgres`                              |
| `DB_NAME`        | Database name                                 | `fleetcore`                             |
| `JWT_SECRET`     | Secret used to sign the tokens                | `change-me`                             |
| `JWT_EXPIRES_IN` | How long the token lives                      | `1h`                                    |
| `API_KEYS`       | Valid API keys for partners (comma separated) | `demo-key-partner-1,demo-key-partner-2` |

Note: `DB_PORT=5440` is the port used by the PostgreSQL from `docker-compose.yml`. If you run your own local PostgreSQL, it's usually `5432`.
You should change the `JWT_SECRET` to a random string. using the command:

```bash
openssl rand -hex 32
```

## 3. Create the database

You only need an empty database. TypeORM creates the tables by itself (`synchronize: true`), so this is enough:

```bash
createdb fleetcore
```

Or with psql:

```sql
CREATE DATABASE fleetcore;
```

## 4. Run the project

```bash
# normal start
npm run start

# watch mode (recommended while developing)
npm run start:dev

# production
npm run build
npm run start:prod
```

## 5. Run the seeder

The seeder fills the database with test data so you can play with the API right away:

```bash
npm run seed
```

You can run it as many times as you want. It won't create duplicates.

What it creates:

- 1 `ADMIN` user and 2 `TECHNICIAN` users.
- 3 mechanics (2 active and linked to the technicians, 1 inactive).
- 2 workshops (1 active, 1 inactive).
- 4 vehicles (2 `AVAILABLE`, 1 `IN_MAINTENANCE`, 1 `INACTIVE`).
- 2 maintenances: 1 `COMPLETED` (so you can see the history) and 1 `IN_PROGRESS`.

## 6. Test credentials

After running the seeder, log in with any of these:

| Role         | Email                 | Password    |
| ------------ | --------------------- | ----------- |
| `ADMIN`      | `admin@fleetcore.com` | `Admin123*` |
| `TECHNICIAN` | `tech1@fleetcore.com` | `Tech123*`  |
| `TECHNICIAN` | `tech2@fleetcore.com` | `Tech123*`  |

You can also register new users with `POST /auth/register` (role `ADMIN` or `TECHNICIAN`).

## 7. Swagger

Once the app is running, open:

```
http://localhost:3020/docs
```

Use the `PORT` you set in your `.env`. If you changed it, just change the port in the URL.

How to test a protected endpoint:

1. Call `POST /auth/login` with one of the emails above and copy the `accessToken`.
2. Click the **Authorize** button in Swagger and paste the token.
3. Done, now you can call the protected endpoints.

For the partner endpoint (`GET /integrations/vehicles/:plate/history`) you don't use a token. Use the API key instead: click **Authorize** and put one of the keys from `API_KEYS` in the `x-api-key` field.

## Run with Docker (optional)

You don't need to install PostgreSQL. The compose file starts the database and the API for you:

```bash
docker compose up -d --build
```

- API and Swagger: `http://localhost:3010/docs`
- PostgreSQL: `localhost:5440` (user `postgres`, password `postgres`, database `fleetcore`)

If you want to change those host ports, use `API_HOST_PORT` and `DB_HOST_PORT`:

```bash
API_HOST_PORT=3020 DB_HOST_PORT=5450 docker compose up -d
```

The data is saved in the `fleetcore_pgdata` volume, so it survives a restart. To wipe everything and start over:

```bash
docker compose down -v
```

## Main endpoints

| Method   | Route                                       | Who                   |
| -------- | ------------------------------------------- | --------------------- |
| `GET`    | `/`                                         | Public                |
| `POST`   | `/auth/register`                            | Public                |
| `POST`   | `/auth/login`                               | Public                |
| `GET`    | `/auth/me`                                  | Any logged user       |
| `POST`   | `/vehicles`                                 | `ADMIN`               |
| `GET`    | `/vehicles`                                 | `ADMIN`, `TECHNICIAN` |
| `GET`    | `/vehicles/:id`, `/vehicles/plate/:plate`   | `ADMIN`, `TECHNICIAN` |
| `PATCH`  | `/vehicles/:id`                             | `ADMIN`               |
| `DELETE` | `/vehicles/:id`                             | `ADMIN`               |
| `POST`   | `/mechanics`                                | `ADMIN`               |
| `GET`    | `/mechanics`, `/mechanics/:id`              | `ADMIN`               |
| `GET`    | `/mechanics/:id/maintenances`               | `ADMIN`               |
| `PATCH`  | `/mechanics/:id`                            | `ADMIN`               |
| `PATCH`  | `/mechanics/:id/activate`, `.../deactivate` | `ADMIN`               |
| `POST`   | `/workshops`                                | `ADMIN`               |
| `GET`    | `/workshops`, `/workshops/:id`              | `ADMIN`, `TECHNICIAN` |
| `PATCH`  | `/workshops/:id`                            | `ADMIN`               |
| `PATCH`  | `/workshops/:id/activate`, `.../deactivate` | `ADMIN`               |
| `POST`   | `/maintenances`                             | `ADMIN`               |
| `PATCH`  | `/maintenances/:id/status`                  | `ADMIN`, `TECHNICIAN` |
| `GET`    | `/integrations/vehicles/:plate/history`     | `x-api-key` header    |

## How the responses look

All the successful responses go through an interceptor, so they always have the same shape:

```json
{
  "success": true,
  "statusCode": 200,
  "data": "Hello World!",
  "timeStamp": "2026-10-27T14:55:21.623Z"
}
```

Errors go through a custom exception filter and always include the status code, the message, the path and the date.

## Project structure

```
src/
  auth/            login, register and the JWT
  users/           user entity
  vehicles/        vehicle CRUD
  mechanics/       mechanic CRUD
  workshops/       workshop CRUD
  maintenances/    maintenances and the status rules
  integrations/    endpoint for partners (API key)
  database/seeds/  the seeder
  common/          guards, decorators, interceptor, filter and enums
```
