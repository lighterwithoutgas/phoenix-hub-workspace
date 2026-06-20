# Phoenix Hub Workspace

Arabic RTL internal workspace for Phoenix Hub: teams, tasks, projects, announcements, notifications, approvals, comments, invitations, and role-based permissions.

Built with Next.js 14, TypeScript, Tailwind CSS, React Hook Form, Zod, Recharts, Lucide, Nodemailer, and MongoDB.

## Quick Start

Create `.env.local` with your real MongoDB and email settings:

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DB=phoenix_hub

OFFICIAL_OWNER_EMAIL=owner@example.com
OFFICIAL_OWNER_NAME="Owner Name"
OFFICIAL_OWNER_PASSWORD=change-this-password

EMAIL_PROVIDER=gmail
EMAIL_FROM="Phoenix Hub <your-gmail@gmail.com>"
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then run:

```bash
npm install
npm run reset:mongo:official
npm run dev
```

Open `http://localhost:3000` and sign in with `OFFICIAL_OWNER_EMAIL` and `OFFICIAL_OWNER_PASSWORD`.

## Scripts

```bash
npm run dev                    # local development
npm run build                  # production build
npm run start                  # serve production build
npm run lint                   # eslint
npm run test                   # TypeScript validation
npm run reset:mongo:official   # clear MongoDB and create the official owner
```

## Data

The app uses MongoDB only. No browser-stored sample workspace is included.

## Deploy

For Vercel, Firebase App Hosting, Render, Railway, or any Node host, add the same environment variables from `.env.local` to the hosting provider.

For production, set:

```env
NEXT_PUBLIC_APP_URL=https://your-real-domain-or-vercel-url
```

Invite emails use `NEXT_PUBLIC_APP_URL` to generate the accept-invite link.

## Architecture

```text
src/
  app/
    api/
      auth/login/             Mongo-backed login endpoint
      invitations/accept/     invitation acceptance and password setup
      invitations/send/       invitation email sender
      workspace/              Mongo-backed workspace load/persist endpoint
    accept-invite/            invited-user password setup
    login/                    auth screen
    (app)/                    authenticated app shell and feature pages
  components/                 UI and feature components
  lib/
    api/                      browser API client
    auth/                     password hashing and verification
    mongo/                    server-only Mongo client and repository
    permissions.ts            RBAC and visibility rules
    session.ts                browser session id storage
    workspace-context.tsx     client state and user actions
scripts/
  reset-mongo-official.ts     official workspace reset script
```
