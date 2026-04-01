# Plaid Integration Documentation

## Overview
Plaid is used to connect US bank accounts and pull live transaction and balance data. The integration uses Plaid Link (frontend) to obtain a public token, which is exchanged server-side for a persistent access token. Subsequent syncs use Plaid's cursor-based `/transactions/sync` endpoint for efficient incremental updates.

---

## Database Tables

- **`plaid_items`** — one row per connected institution. Columns: `id` (uuid, PK), `user_id` (uuid, FK → users.id), `access_token` (text), `item_id` (text), `institution_name` (text), `cursor` (text — sync cursor for incremental fetches), `created_at`.
- **`accounts`** — one row per bank account within an item. Columns: `id` (uuid, PK), `user_id` (uuid, FK), `plaid_item_id` (uuid, FK → plaid_items.id), `plaid_account_id` (text), `name` (text), `type` (text — checking/savings/credit), `currency` (text), `balance_current` (numeric), `balance_available` (numeric), `updated_at`.
- **`transactions`** — one row per transaction. Columns: `id` (uuid, PK), `user_id` (uuid, FK), `account_id` (uuid, FK → accounts.id), `plaid_transaction_id` (text, unique), `amount` (numeric), `currency` (text), `merchant_name` (text), `raw_description` (text), `category` (text — from Plaid's `personal_finance_category.primary`), `date` (date), `pending` (boolean), `created_at`.

---

## API Endpoints

All endpoints require a valid `Authorization: Bearer <access_token>` header.

### POST `/plaid/create-link-token`
Generates a short-lived Plaid Link token that the frontend uses to initialize the Plaid Link UI. Must be called fresh each time the user wants to connect a new account.

**Request:** No body required — uses the authenticated user's ID from the JWT.

**Response:**
```json
{ "link_token": "link-sandbox-..." }
```

---

### POST `/plaid/exchange-token`
Called immediately after the user completes the Plaid Link flow. Exchanges the one-time `public_token` (provided by Link's `onSuccess` callback) for a permanent `access_token`, then stores the item in Supabase. The access token is never returned to the client.

**Request body:**
```json
{
  "public_token": "public-sandbox-...",
  "institution_name": "Chase"
}
```

**Response:**
```json
{ "success": true }
```

---

### POST `/plaid/sync`
Fetches the latest data from Plaid for all of the user's linked items. For each item, calls Plaid's `/transactions/sync` using the stored cursor to fetch only new/modified/removed data since the last sync. Upserts accounts and transactions into Supabase, removes deleted transactions, then saves the updated cursor back. Safe to call repeatedly — idempotent.

**Request:** No body required.

**Response:**
```json
{ "synced": 42 }
```
`synced` is the count of transactions added or modified across all items.

---

### GET `/plaid/accounts`
Returns all bank accounts linked by the authenticated user, ordered by name. Balances reflect the most recent sync.

**Response:**
```json
[
  {
    "id": "uuid",
    "plaid_account_id": "...",
    "name": "Chase Checking",
    "type": "depository",
    "currency": "USD",
    "balance_current": 1234.56,
    "balance_available": 1200.00
  }
]
```

---

### GET `/plaid/transactions`
Returns paginated transactions for the authenticated user, sorted newest first.

**Query params:**
- `limit` — number of transactions to return (default: 50, max: 200)
- `offset` — number of transactions to skip (default: 0)
- `startDate` *(optional)* — ISO date string `YYYY-MM-DD`; when provided, only returns transactions on or after this date. Used by the dashboard to fetch current-month transactions for analytics.

**Response:**
```json
[
  {
    "id": "uuid",
    "account_id": "uuid",
    "amount": 12.50,
    "currency": "USD",
    "merchant_name": "Starbucks",
    "raw_description": "SQ *STARBUCKS",
    "category": "FOOD_AND_DRINK",
    "date": "2026-03-25",
    "pending": false
  }
]
```

---

## Typical Flow

1. **Frontend** calls `POST /plaid/create-link-token` → receives `link_token`
2. **Frontend** opens Plaid Link with that token; user connects their bank
3. **Frontend** receives `public_token` from Link's `onSuccess` callback, plus institution metadata
4. **Frontend** calls `POST /plaid/exchange-token` with `{ public_token, institution_name }` → access token stored server-side
5. **Server** (or user action) calls `POST /plaid/sync` → accounts and transactions populated in Supabase
6. **Frontend** calls `GET /plaid/accounts` and `GET /plaid/transactions` to display data

---

## Key Files

| File | Purpose |
|------|---------|
| [server/src/lib/plaid.ts](../server/src/lib/plaid.ts) | Plaid SDK client initialized with credentials from config |
| [server/src/routes/plaid.ts](../server/src/routes/plaid.ts) | Route handlers for all 5 Plaid endpoints |
| [server/src/config.ts](../server/src/config.ts) | `plaidClientId`, `plaidSecret`, `plaidEnv` sourced from env vars |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PLAID_CLIENT_ID` | Your Plaid app's client ID (from Plaid dashboard) |
| `PLAID_SECRET` | Sandbox/development/production secret for the target environment |
| `PLAID_ENV` | Plaid environment: `sandbox`, `development`, or `production` |

---

## Design Decisions

- **Cursor-based sync** (`/transactions/sync`) is used instead of `/transactions/get`. It tracks a per-item cursor in `plaid_items.cursor`, so each sync only fetches new/modified/removed transactions since the last run — no full re-fetch.
- **Access tokens stored in Supabase** (service role key access only). These are long-lived credentials and are never returned to the client after the exchange step.
- **`plaid_transaction_id` as upsert key** allows re-running sync idempotently — duplicate transactions are updated, not duplicated.
- **`personal_finance_category.primary`** from Plaid's enhanced categorization is stored as `category`. This can be overridden later by user reclassification rules (roadmap phase 1, section 4).
