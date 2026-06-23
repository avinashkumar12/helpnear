# HelperNear Monorepo

A platform to find verified local workers (plumbers, electricians, maids, etc.) nearby.

## Structure

```
helpernear/
├── helpernear-backend/   # NestJS API + Prisma + PostgreSQL
└── helpernear-landing/   # Vanilla HTML/CSS/JS frontend (landing + app + admin)
```

## Quick Start

### Backend
```bash
cd helpernear-backend
npm install
cp .env.example .env   # fill in DATABASE_URL
npx prisma db push
npx prisma generate
npx ts-node -r dotenv/config prisma/seed.ts
npm run start:dev
```

### Frontend
Served automatically by NestJS `ServeStaticModule` from `helpernear-landing/`.

## URLs (local)
| URL | Description |
|-----|-------------|
| http://localhost:3000 | Landing page |
| http://localhost:3000/app | Customer app |
| http://localhost:3000/admin | Admin panel |
| http://localhost:3000/api/docs | Swagger API docs |

## Test Credentials
- **Admin:** `admin@helpernear.com` / `Admin@123`
- **OTP login:** any seeded phone, OTP = `8989`
