# Agri Opportunity API

Local-first REST API for the NextStep SA Expo app. It uses TypeScript, Express, SQLite, bcrypt password hashing, and short-lived bearer authentication tokens. Opportunity records are publicly readable; profile, saved items, application tracking, and notifications require an account. Admin routes require a user whose database role is `admin`.

The initial opportunity rows are illustrative demo data. They are not verified real vacancies.

## Requirements and startup

Use Node.js 20 or newer.

```powershell
cd APP\BACKEND
npm install
Copy-Item .env.example .env
```

Set `JWT_SECRET` in `.env` to a random secret of at least 32 characters before starting. Do not commit `.env`.

```powershell
npm run dev
```

The API listens on port 3000 by default. Check `http://localhost:3000/api/health`.
The SQLite database is created at `data/agri-opportunity.sqlite`.

## Connect the Expo app

Set `EXPO_PUBLIC_API_URL` in `APP\FRONTEND\.env` to the API base URL ending in `/api`. For example:

```text
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

For a physical phone, use the computer's LAN IP address instead of `localhost` and ensure both devices can reach each other. Restart Expo after changing the variable. Use HTTPS and a restricted `CORS_ORIGINS` value for hosted deployments.

## Routes

| Method | Route | Access |
|---|---|---|
| GET | `/api/health` | Public |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/opportunities` | Public |
| GET | `/api/opportunities/:id` | Public |
| GET | `/api/me` | Signed in |
| GET, PUT | `/api/me/profile` | Signed in |
| GET | `/api/me/saved` | Signed in |
| POST, DELETE | `/api/me/saved/:opportunityId` | Signed in |
| GET | `/api/me/applications` | Signed in |
| POST | `/api/me/applications/:opportunityId` | Signed in |
| PATCH | `/api/me/applications/:id` | Signed in |
| GET | `/api/me/notifications` | Signed in |
| PATCH | `/api/me/notifications/read-all` | Signed in |
| PATCH | `/api/me/notifications/:id/read` | Signed in |
| GET | `/api/admin/opportunities` | Admin |
| PUT, DELETE | `/api/admin/opportunities/:id` | Admin |

Auth routes are rate limited. Registration requires a password of at least 8 characters. Admin access is not self-assigned; set a trusted account's `users.role` to `admin` using a controlled database administration process. Never expose the SQLite file or database credentials publicly.

## Checks

```powershell
npm run typecheck
npm run build
```
