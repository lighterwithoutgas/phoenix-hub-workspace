# Phoenix Hub Workspace

Arabic RTL internal workspace for Phoenix Hub: teams, tasks, projects, announcements, notifications, approvals, comments, and role-based permissions.

Built with Next.js 14, TypeScript, Tailwind CSS, React Hook Form, Zod, Recharts, Lucide, and MongoDB.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

By default the app runs in mock mode with seeded browser `localStorage` data, so no backend is required for local demos.

## Scripts

```bash
npm run dev          # local development
npm run build        # production build
npm run start        # serve production build
npm run lint         # eslint
npm run test         # domain logic and RBAC checks
npm run seed:mongo   # seed MongoDB with the demo workspace
```

## Demo Accounts

Use any non-empty password in mock mode and Mongo demo mode.

| Email | Role |
| --- | --- |
| `owner@phoenixhub.org` | owner |
| `admin@phoenixhub.org` | admin |
| `leader@phoenixhub.org` | team leader |
| `member@phoenixhub.org` | member |
| `viewer@phoenixhub.org` | viewer |

## Data Modes

Mock mode:

```env
NEXT_PUBLIC_USE_MOCK_DATA=true
```

Data stays in each browser's `localStorage`. This is best for fast testing and demos.

Mongo mode:

```env
NEXT_PUBLIC_USE_MOCK_DATA=false
MONGODB_URI=mongodb+srv://...
MONGODB_DB=phoenix_hub
```

Data is stored in MongoDB through Next.js API routes. The Mongo URI is server-side only and is never exposed to the browser.

## Mongo Setup

1. Create a MongoDB Atlas cluster or use a local MongoDB instance.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_USE_MOCK_DATA=false`.
4. Set `MONGODB_URI` and optionally `MONGODB_DB`.
5. Seed initial data:

```bash
npm run seed:mongo
```

6. Run the app:

```bash
npm run dev
```

## Deploy

For Firebase App Hosting, keep `apphosting.yaml`, then add these backend environment variables in the Firebase Console:

```env
NEXT_PUBLIC_USE_MOCK_DATA=false
MONGODB_URI=<your MongoDB connection string>
MONGODB_DB=phoenix_hub
```

For Vercel, Render, Railway, or any Node host, add the same environment variables and deploy the Next.js app normally.

## Architecture

```text
src/
  app/
    api/
      auth/login/          Mongo-backed login endpoint
      workspace/           Mongo-backed workspace load/persist endpoint
    login/                 auth screen
    (app)/                 authenticated app shell and feature pages
  components/              UI and feature components
  lib/
    api/                   browser API client
    mongo/                 server-only Mongo client and repository
    mock/                  seed data and localStorage store
    permissions.ts         RBAC and visibility rules
    workspace-context.tsx  client state and user actions
tests/                     domain logic checks
scripts/
  seed-mongo.ts            Mongo seed script
```

## Current Auth Note

Mongo mode currently matches the old demo behavior: login is email-based and accepts any non-empty password for active users in the database. Before real public/team deployment, replace `/api/auth/login` with real password hashing or an auth provider, then move mutations to operation-specific server endpoints for stronger server-side enforcement.
