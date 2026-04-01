-- Migration 001: Salt Edge integration
-- Creates salt_edge_customers and salt_edge_connections tables,
-- and extends accounts + transactions to support both Plaid and Salt Edge.

-- 1. salt_edge_customers (one row per user)
CREATE TABLE IF NOT EXISTS salt_edge_customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- 2. salt_edge_connections (one row per connected institution)
CREATE TABLE IF NOT EXISTS salt_edge_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_id    text NOT NULL UNIQUE,
  institution_name text,
  last_fetched_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 3. Extend accounts to support Salt Edge alongside Plaid
ALTER TABLE accounts
  ALTER COLUMN plaid_item_id    DROP NOT NULL,
  ALTER COLUMN plaid_account_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS salt_edge_connection_id uuid REFERENCES salt_edge_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS salt_edge_account_id    text UNIQUE,
  ADD COLUMN IF NOT EXISTS source                  text NOT NULL DEFAULT 'plaid';

-- 4. Extend transactions to support Salt Edge alongside Plaid
ALTER TABLE transactions
  ALTER COLUMN plaid_transaction_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS salt_edge_transaction_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS source                   text NOT NULL DEFAULT 'plaid';
