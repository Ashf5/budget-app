# Salt Edge Integration

Salt Edge is used to connect Israeli bank accounts and credit card providers (Bank Hapoalim, Bank Leumi, Max, Isracard, Cal) to the budget app. It runs in parallel with the existing Plaid integration for US banks; both write to the same `accounts` and `transactions` tables, disambiguated by a `source` column.

Salt Edge has no official Node.js SDK. All API calls are made with Node's built-in `fetch` via a thin wrapper in `server/src/lib/saltEdge.ts`.

---

## Database Schema

### New tables

**`salt_edge_customers`** — one row per user; created once on first connect.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | UNIQUE — one customer per user |
| `customer_id` | text UNIQUE | Salt Edge's identifier for this customer |
| `created_at` | timestamptz | |

**`salt_edge_connections`** — one row per connected institution (mirrors `plaid_items`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `connection_id` | text UNIQUE | Salt Edge's connection identifier |
| `institution_name` | text | e.g. "Bank Hapoalim" |
| `last_fetched_at` | timestamptz | Updated after each sync |
| `created_at` | timestamptz | |

### Altered tables

**`accounts`** — added columns:

| Column | Type | Notes |
|--------|------|-------|
| `salt_edge_connection_id` | uuid FK → salt_edge_connections | nullable |
| `salt_edge_account_id` | text UNIQUE | nullable; upsert conflict key for Salt Edge rows |
| `source` | text NOT NULL DEFAULT 'plaid' | `'plaid'` or `'salt_edge'` |

`plaid_item_id` and `plaid_account_id` changed to nullable (were implicitly required).

**`transactions`** — added columns:

| Column | Type | Notes |
|--------|------|-------|
| `salt_edge_transaction_id` | text UNIQUE | nullable; upsert conflict key for Salt Edge rows |
| `source` | text NOT NULL DEFAULT 'plaid' | `'plaid'` or `'salt_edge'` |

`plaid_transaction_id` changed to nullable (Postgres UNIQUE constraints ignore NULLs, so existing rows are unaffected).

### Migration SQL

```sql
-- 1. salt_edge_customers
CREATE TABLE salt_edge_customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- 2. salt_edge_connections
CREATE TABLE salt_edge_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_id    text NOT NULL UNIQUE,
  institution_name text,
  last_fetched_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 3. Alter accounts
ALTER TABLE accounts
  ALTER COLUMN plaid_item_id    DROP NOT NULL,
  ALTER COLUMN plaid_account_id DROP NOT NULL,
  ADD COLUMN salt_edge_connection_id uuid REFERENCES salt_edge_connections(id) ON DELETE SET NULL,
  ADD COLUMN salt_edge_account_id    text UNIQUE,
  ADD COLUMN source                  text NOT NULL DEFAULT 'plaid';

-- 4. Alter transactions
ALTER TABLE transactions
  ALTER COLUMN plaid_transaction_id DROP NOT NULL,
  ADD COLUMN salt_edge_transaction_id text UNIQUE,
  ADD COLUMN source                   text NOT NULL DEFAULT 'plaid';
```

---

## API Endpoints

All endpoints (except `/webhook`) require `Authorization: Bearer <access_token>`.

| Method | Path | Body | Response | Description |
|--------|------|------|----------|-------------|
| POST | `/salt-edge/create-session` | `{}` | `{ connect_url }` | Creates a Salt Edge customer (if needed) and a connect session. Returns the widget URL. |
| POST | `/salt-edge/complete` | `{ connection_id }` | `{ success: true }` | Saves the connection after the user finishes the widget. Verifies ownership. |
| POST | `/salt-edge/sync` | `{}` | `{ synced: number }` | Fetches accounts and all transactions for every connection belonging to the user. |
| POST | `/salt-edge/webhook` | Salt Edge payload | `200 OK` | Async webhook receiver. ACKs immediately; processes `fetch.finished` events in the background. |

The existing `GET /plaid/accounts` and `GET /plaid/transactions` endpoints return **all** rows for the user regardless of `source`, so no new read endpoints are needed — the dashboard automatically shows both Plaid and Salt Edge data.

---

## Typical Connect Flow

1. User clicks **"+ Israeli Bank"** in the dashboard header.
2. Frontend calls `POST /salt-edge/create-session`.
3. Backend ensures a `salt_edge_customers` row exists for the user (creates one via `POST /customers` if not).
4. Backend calls `POST /connect_sessions/create` and returns `{ connect_url }`.
5. Frontend opens `connect_url` in a 500×700 popup window.
6. User selects their bank and authenticates inside the Salt Edge widget.
7. Salt Edge redirects the popup to the `returnTo` URL (`/dashboard?connection_id=<id>`).
8. Frontend polls `popup.closed`; when closed, reads `connection_id` from the popup's location.
9. Frontend calls `POST /salt-edge/complete` with `connection_id`.
10. Frontend calls `POST /salt-edge/sync`, then refreshes dashboard data.

**Popup blocked fallback:** If the browser blocks the popup, the user is redirected directly to `/dashboard?connection_id=<id>`. A `useEffect` in `DashboardPage` checks for this query param on mount and processes it the same way.

---

## Webhook Flow

Salt Edge fires a `POST` to the registered webhook URL when a connection's data fetch completes. The webhook handler:

1. ACKs with HTTP 200 immediately (Salt Edge retries on non-200).
2. Parses the payload asynchronously (fire-and-forget).
3. On `fetch.finished` or `connection.connected`: looks up the `user_id` from `salt_edge_connections` and calls the shared `syncSaltEdgeConnection` function.

**Webhook setup:**
- **Dev:** Run `npx ngrok http 3001`, then register `https://<ngrok-id>.ngrok.io/salt-edge/webhook` in the Salt Edge dashboard.
- **Prod:** Register `https://your-domain.com/salt-edge/webhook`.
- Set `SALT_EDGE_WEBHOOK_SECRET` to enable signature verification in production (skipped with a warning if absent).

---

## Key Files

| File | Purpose |
|------|---------|
| `server/src/lib/saltEdge.ts` | HTTP client wrapper — `saltEdge.createCustomer`, `createConnectSession`, `getConnection`, `getAccounts`, `getTransactions` |
| `server/src/routes/saltEdge.ts` | Express router — all four endpoints + shared `syncSaltEdgeConnection` helper |
| `server/src/config.ts` | Salt Edge env vars: `saltEdgeAppId`, `saltEdgeSecret`, `saltEdgeWebhookSecret`, `frontendUrl` |
| `src/pages/DashboardPage.tsx` | `openSaltEdgeWidget` function, redirect-fallback `useEffect`, "Israeli Bank" buttons |
| `src/components/AccountCard.tsx` | "Israeli Bank" badge for `source === 'salt_edge'` accounts |

---

## Environment Variables

Add to `server/.env`:

```
SALT_EDGE_APP_ID=<from Salt Edge dashboard>
SALT_EDGE_SECRET=<from Salt Edge dashboard>
SALT_EDGE_WEBHOOK_SECRET=<from Salt Edge dashboard, optional in dev>
FRONTEND_URL=http://localhost:5173
```

---

## Design Decisions

**Amount sign normalization.** Salt Edge uses positive = credit, which is the inverse of the Plaid convention stored in the DB (positive = debit). All Salt Edge amounts are negated on insert in `syncSaltEdgeConnection`. This keeps the existing UI display logic (negatives shown in green with `+` prefix) working correctly for both sources.

**Customer-per-user.** Salt Edge's "customer" is a user-level concept, unlike Plaid's per-item access token. A single customer is created once per user and reused across all their Israeli bank connections.

**Popup widget instead of full redirect.** Opening the Salt Edge widget in a popup keeps the parent SPA alive with its in-memory JWT auth state, avoiding a full page reload and token re-hydration from `localStorage`. The redirect-fallback `useEffect` handles the case where popups are blocked.

**Shared accounts/transactions tables.** Both Plaid and Salt Edge write to the same `accounts` and `transactions` tables, with a `source` discriminator column. The existing `GET /plaid/accounts` and `GET /plaid/transactions` endpoints query by `user_id` only, so they return all rows from both sources without any change.

**Upsert deduplication.** `salt_edge_account_id` and `salt_edge_transaction_id` are the upsert conflict keys for Salt Edge rows. This makes syncs idempotent — re-running sync never creates duplicates.

**No SDK.** Salt Edge has no official Node.js SDK. All API calls use Node's built-in `fetch`, encapsulated in `server/src/lib/saltEdge.ts` with typed request/response interfaces.
