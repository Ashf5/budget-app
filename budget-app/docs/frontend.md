# Frontend Documentation

## Overview

The frontend is a React 19 + TypeScript single-page application built with Vite. It consumes the Express backend API, handles JWT authentication client-side, and embeds the Plaid Link widget for bank account connection. Styling uses Tailwind CSS v4.

---

## Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 8 | Dev server and bundler |
| Tailwind CSS | v4 (via `@tailwindcss/vite`) | Utility-first styling |
| react-router-dom | v7 | Client-side routing |
| react-plaid-link | latest | Plaid Link widget wrapper |

---

## Project Structure

```
src/
├── types.ts                      — Shared TypeScript interfaces (Account, Transaction)
├── lib/
│   ├── api.ts                    — Fetch wrapper: auth headers, silent token refresh
│   └── analytics.ts              — Pure functions for cash flow analytics (income, expenses, top categories)
├── context/
│   └── AuthContext.tsx           — Global auth state (tokens, login, register, logout)
├── components/
│   ├── ProtectedRoute.tsx        — Route guard: redirects unauthenticated users to /login
│   ├── AccountCard.tsx           — Displays a single bank account with balance
│   ├── TransactionList.tsx       — Renders a transaction feed with category labels
│   ├── CashFlowBar.tsx           — Income vs. expense horizontal bar chart for current month
│   └── TopExpenses.tsx           — Ranked top-5 expense categories with proportion bars
└── pages/
    ├── LoginPage.tsx             — Email/password sign-in form
    ├── RegisterPage.tsx          — Registration form with confirm-password check
    └── DashboardPage.tsx         — Main app: cash flow analytics, accounts, activity feed, Plaid Link flow
```

---

## Routing

| Path | Component | Auth Required |
|------|-----------|---------------|
| `/login` | `LoginPage` | No |
| `/register` | `RegisterPage` | No |
| `/dashboard` | `DashboardPage` | Yes |
| `/` | `RootRedirect` | — redirects based on auth state |
| `*` | — | redirects to `/` |

`ProtectedRoute` wraps the dashboard route and redirects to `/login` if `isAuthenticated` is false. It waits for `isLoading` to be false before deciding, preventing a flash-to-login on hard refresh.

---

## Authentication

### Token Storage
- `accessToken` is held in React state (`AuthContext`) and in-memory in `api.ts`.
- `refreshToken` is stored only in `localStorage` and `api.ts`'s module-level variable — it is intentionally not put in React state to avoid leaking it into React DevTools.
- On mount, `AuthContext` reads both tokens from `localStorage` and restores the session without requiring a re-login.

### Silent Token Refresh
`api.ts` intercepts any `401` response and attempts to call `POST /auth/refresh` automatically. If the refresh succeeds, it retries the original request once and updates `localStorage` with the new access token. If the refresh fails, it calls the registered logout handler and throws `'Session expired'`.

### Key Files

| File | Purpose |
|------|---------|
| [src/lib/api.ts](../src/lib/api.ts) | `setTokens()` / `registerUnauthorizedHandler()` — token store shared with AuthContext |
| [src/context/AuthContext.tsx](../src/context/AuthContext.tsx) | `login`, `register`, `logout`; restores session on mount |
| [src/components/ProtectedRoute.tsx](../src/components/ProtectedRoute.tsx) | `<Outlet />` when authed, `<Navigate to="/login">` when not |

---

## Plaid Link Flow (Dashboard)

1. User clicks **"Connect Bank"** → `POST /plaid/create-link-token` → `link_token` stored in state
2. A `useEffect` watches `linkToken && ready` and calls `openWidget()` once the Plaid hook initializes with the new token
3. User completes the Plaid Link flow in the embedded widget
4. `onSuccess` callback fires → `POST /plaid/exchange-token` → `POST /plaid/sync` → accounts and transactions re-fetched
5. `onExit` callback resets `linkToken` to `null` so the next click generates a fresh token

> **Why `useEffect` for `openWidget()`?**
> `usePlaidLink` needs a re-render to initialize with the new token before `ready` becomes true. Calling `openWidget()` synchronously in the click handler would use a stale, uninitialized hook instance.

---

## Design System

The app uses a minimal, fintech-style design built entirely with Tailwind utility classes.

- **Colors:** White surfaces, `gray-50` page background, `indigo-600` for primary actions and accents
- **Cards:** `rounded-2xl`, `shadow-sm`, `border border-gray-100`
- **Buttons:** `rounded-lg` with `hover:`, `active:`, `disabled:opacity-50` states
- **Typography:** `font-semibold` headings, `text-sm` body, `text-xs` metadata/labels, `tabular-nums` for all currency values
- **Loading states:** Spinner (`animate-spin`) for async actions; skeleton shimmer placeholders for account cards
- **Empty state:** Dashed border card with call-to-action button
- **Error state:** Red banner (`bg-red-50 border-red-100`) with inline dismiss button

---

## Data Types

```typescript
interface Account {
  id: string
  name: string
  type: string              // "depository" | "credit" | "investment" | "loan" | "other"
  currency: string
  balance_current: number | null
  balance_available: number | null
}

interface Transaction {
  id: string
  account_id: string
  amount: number            // Positive = debit (money out), negative = credit (money in)
  currency: string
  merchant_name: string | null
  raw_description: string
  category: string | null   // Plaid personal_finance_category.primary
  date: string              // "YYYY-MM-DD"
  pending: boolean
}
```

> **Amount sign convention (Plaid):** Positive amounts are debits (money leaving the account); negative amounts are credits (money arriving). The UI shows negative amounts in green with a `+` prefix.

---

## Running the Frontend

```bash
cd budget-app
npm install
npm run dev       # starts on http://localhost:5173
```

The backend must be running on `http://localhost:3001` (see [backend.md](./backend.md)).

### Plaid Sandbox Test Credentials

When the Plaid Link widget opens in sandbox mode, use:
- **Username:** `user_good`
- **Password:** `pass_good`

---

## Design Decisions

- **No state management library** — React Context covers the only global state needed (auth tokens). The dashboard's accounts/transactions are local component state.
- **Native `fetch` over axios** — a thin wrapper in `api.ts` handles auth headers and token refresh without adding a dependency.
- **No form library** — login and register forms are simple controlled components with minimal fields; a form library would be overkill.
- **`verbatimModuleSyntax: true`** (enforced by `tsconfig.app.json`) — all type-only imports use `import type { Foo }` syntax throughout.
- **Tailwind v4 via `@tailwindcss/vite`** — no `tailwind.config.js` or `content` array needed; the plugin scans source files automatically.
- **No charting library** — `CashFlowBar` and `TopExpenses` use CSS horizontal bars with inline `style={{ width: '73%' }}` for dynamic percentages; avoids a heavy dependency for simple visuals.
- **All analytics are client-side** — `analytics.ts` contains pure functions with no React dependency. The dashboard fetches up to 200 current-month transactions and derives income/expense/category totals locally using `useMemo`.

---

## Cash Flow Analytics

The analytics layer (`src/lib/analytics.ts`) provides:

- **`getMonthStart()`** — returns `YYYY-MM-01` for the current calendar month (local time), used as the `startDate` query param for the monthly fetch.
- **`sumIncome(transactions)`** — sums `Math.abs(amount)` for all transactions where `amount < 0`, excluding transfers.
- **`sumExpenses(transactions)`** — sums `amount` for all transactions where `amount > 0`, excluding transfers.
- **`topExpenseCategories(transactions, n=5)`** — groups expense transactions by `category`, sums each group, returns top `n` sorted descending.
- **`CATEGORY_LABELS`** — shared lookup from Plaid category keys (e.g. `"FOOD_AND_DRINK"`) to human-readable labels. Imported by both `TransactionList` and `TopExpenses`.

Transfers (`TRANSFER_IN` / `TRANSFER_OUT`) are excluded from all calculations to avoid double-counting money moved between connected accounts.

The dashboard fires **three parallel fetches** on mount:
1. `GET /plaid/accounts` — for account cards and total balance
2. `GET /plaid/transactions?limit=10` — for the Recent Activity feed
3. `GET /plaid/transactions?limit=200&startDate=YYYY-MM-01` — for monthly analytics

The backend's `GET /plaid/transactions` endpoint accepts an optional `startDate=YYYY-MM-DD` query param that adds a Supabase `.gte('date', startDate)` clause, limiting results to on or after that date.
