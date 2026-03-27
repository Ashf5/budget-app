# Backend Documentation

## Auth

### Overview
The authentication system is a custom JWT-based setup built with Express and TypeScript, backed by Supabase as the data store. It does **not** use Supabase Auth — instead, it manages users and tokens directly in two Supabase tables.

### Database Tables
- **`users`** — stores registered users. Columns: `id` (uuid, PK), `email` (text, unique), `password_hash` (text), `created_at`.
- **`refresh_tokens`** — stores issued refresh tokens for revocation support. Columns: `id` (uuid, PK), `user_id` (uuid, FK → users.id), `token` (text), `created_at`.

### Token Strategy
Two JWTs are issued per login/register:
- **Access token** — short-lived (15 minutes), signed with `JWT_SECRET`. Sent as a `Bearer` token in the `Authorization` header on protected requests.
- **Refresh token** — long-lived (7 days), signed with a separate `JWT_REFRESH_SECRET`. Stored in the `refresh_tokens` table so it can be invalidated server-side. Used to obtain a new access token without re-entering credentials.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create a new user, return access + refresh tokens |
| POST | `/auth/login` | Authenticate existing user, return access + refresh tokens |
| POST | `/auth/refresh` | Exchange a valid refresh token for a new access token |

### Key Files

| File | Purpose |
|------|---------|
| [server/src/routes/auth.ts](../server/src/routes/auth.ts) | Route handlers for register, login, refresh |
| [server/src/middleware/auth.ts](../server/src/middleware/auth.ts) | `verifyToken` middleware — reads Bearer header, verifies JWT, attaches `req.user` |
| [server/src/middleware/errorHandler.ts](../server/src/middleware/errorHandler.ts) | Global Express error handler |
| [server/src/db/supabase.ts](../server/src/db/supabase.ts) | Supabase client initialized with the service role key |
| [server/src/config.ts](../server/src/config.ts) | Centralizes env vars; throws on startup if any required vars are missing |

### Design Decisions
- **bcryptjs with cost factor 12** is used to hash passwords before storage. Cost 12 is a reasonable balance between security and latency for a Node server.
- **Separate refresh secret** (`JWT_REFRESH_SECRET`) ensures that a compromised access token secret cannot be used to forge refresh tokens, and vice versa.
- **Refresh tokens stored in Supabase** allows server-side revocation (e.g., logout, suspicious activity), unlike a purely stateless approach.
- **Custom users table over Supabase Auth** gives full control over the auth flow and avoids vendor lock-in on the auth provider.
