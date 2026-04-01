import { Router, Request, Response } from 'express';
import express from 'express';
import { saltEdge } from '../lib/saltEdge';
import { supabase } from '../db/supabase';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { config } from '../config';

export const saltEdgeRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Syncs all accounts and transactions for a single Salt Edge connection.
 * Extracted so both POST /sync and the webhook handler share the same logic.
 *
 * Amount sign normalization: Salt Edge uses positive = credit, which is the
 * inverse of the Plaid convention stored in the DB (positive = debit).
 * All Salt Edge amounts are negated on insert.
 */
async function syncSaltEdgeConnection(userId: string, connectionId: string): Promise<number> {
  const accounts = await saltEdge.getAccounts(connectionId);
  let totalSynced = 0;

  // Look up the DB row for this connection to get its UUID
  const { data: connRow } = await supabase
    .from('salt_edge_connections')
    .select('id')
    .eq('connection_id', connectionId)
    .single();

  for (const account of accounts) {
    // Upsert account — conflict on salt_edge_account_id
    await supabase.from('accounts').upsert(
      {
        user_id: userId,
        salt_edge_connection_id: connRow?.id ?? null,
        salt_edge_account_id: account.id,
        name: account.name,
        type: account.nature,
        currency: account.currency_code,
        balance_current: account.balance,
        balance_available: null,
        source: 'salt_edge',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'salt_edge_account_id' },
    );

    // Fetch the account's DB UUID for the transaction FK
    const { data: acctRow } = await supabase
      .from('accounts')
      .select('id')
      .eq('salt_edge_account_id', account.id)
      .single();

    if (!acctRow) continue;

    // Paginate through all transactions for this account
    let fromId: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const page = await saltEdge.getTransactions(connectionId, account.id, fromId);

      for (const tx of page.data) {
        await supabase.from('transactions').upsert(
          {
            user_id: userId,
            account_id: acctRow.id,
            salt_edge_transaction_id: tx.id,
            // Negate: Salt Edge positive=credit → store as negative (DB convention: positive=debit)
            amount: -tx.amount,
            currency: tx.currency_code,
            merchant_name: null,
            raw_description: tx.description,
            category: tx.category || null,
            date: tx.made_on,
            pending: tx.status === 'pending',
            source: 'salt_edge',
          },
          { onConflict: 'salt_edge_transaction_id' },
        );
        totalSynced++;
      }

      if (page.meta.next_id) {
        fromId = page.meta.next_id;
      } else {
        hasMore = false;
      }
    }
  }

  // Update last_fetched_at
  await supabase
    .from('salt_edge_connections')
    .update({ last_fetched_at: new Date().toISOString() })
    .eq('connection_id', connectionId);

  return totalSynced;
}

// ── POST /salt-edge/create-session ─────────────────────────────────────────
// Creates a Salt Edge customer for the user (if not yet created), then
// returns a connect_url for the user to open in a popup/redirect.

saltEdgeRouter.post('/create-session', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get or create Salt Edge customer
    let { data: customerRow } = await supabase
      .from('salt_edge_customers')
      .select('customer_id')
      .eq('user_id', req.user!.id)
      .single();

    if (!customerRow) {
      const customer = await saltEdge.createCustomer(req.user!.id);
      const { error } = await supabase.from('salt_edge_customers').insert({
        user_id: req.user!.id,
        customer_id: customer.customer_id,
      });
      if (error) {
        res.status(500).json({ error: 'Failed to save Salt Edge customer' });
        return;
      }
      customerRow = { customer_id: customer.customer_id };
    }

    const returnTo = `${config.frontendUrl}/dashboard`;
    const session = await saltEdge.createConnectSession(customerRow.customer_id, returnTo);

    res.json({ connect_url: session.connect_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create Salt Edge session';
    res.status(500).json({ error: message });
  }
});

// ── POST /salt-edge/complete ───────────────────────────────────────────────
// Called after the user returns from the Salt Edge widget.
// Body: { connection_id: string }

saltEdgeRouter.post('/complete', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { connection_id } = req.body as { connection_id?: string };

  if (!connection_id) {
    res.status(400).json({ error: 'connection_id is required' });
    return;
  }

  try {
    // Verify this connection belongs to the current user's customer
    const { data: customerRow } = await supabase
      .from('salt_edge_customers')
      .select('customer_id')
      .eq('user_id', req.user!.id)
      .single();

    if (!customerRow) {
      res.status(400).json({ error: 'No Salt Edge customer found for this user' });
      return;
    }

    const connection = await saltEdge.getConnection(connection_id);

    if (connection.customer_id !== customerRow.customer_id) {
      res.status(403).json({ error: 'Connection does not belong to this user' });
      return;
    }

    const { error } = await supabase.from('salt_edge_connections').insert({
      user_id: req.user!.id,
      connection_id,
      institution_name: connection.provider_name || null,
    });

    if (error) {
      // Already exists — not a fatal error
      if (!error.message.includes('duplicate') && !error.code?.includes('23505')) {
        res.status(500).json({ error: 'Failed to save connection' });
        return;
      }
    }

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to complete connection';
    res.status(500).json({ error: message });
  }
});

// ── POST /salt-edge/sync ───────────────────────────────────────────────────
// Manually triggers a full account and transaction sync for all of the
// user's Salt Edge connections.

saltEdgeRouter.post('/sync', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: connections, error } = await supabase
      .from('salt_edge_connections')
      .select('connection_id')
      .eq('user_id', req.user!.id);

    if (error || !connections) {
      res.status(500).json({ error: 'Failed to fetch connections' });
      return;
    }

    let totalSynced = 0;
    for (const conn of connections) {
      totalSynced += await syncSaltEdgeConnection(req.user!.id, conn.connection_id);
    }

    res.json({ synced: totalSynced });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    res.status(500).json({ error: message });
  }
});

// ── POST /salt-edge/webhook ────────────────────────────────────────────────
// Receives async notifications from Salt Edge (e.g. fetch.finished).
// No verifyToken — this is called by Salt Edge, not the user.
//
// WEBHOOK SETUP REQUIRED:
//   Dev:  expose local server with `npx ngrok http 3001`, then register
//         https://<ngrok-id>.ngrok.io/salt-edge/webhook in the Salt Edge dashboard
//   Prod: register https://your-domain.com/salt-edge/webhook
//   Set SALT_EDGE_WEBHOOK_SECRET for signature verification in production.

saltEdgeRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response) => {
    // ACK immediately — Salt Edge retries on non-200
    res.sendStatus(200);

    // Parse and process asynchronously (fire-and-forget)
    let payload: SaltEdgeWebhookPayload;
    try {
      payload = JSON.parse((req.body as Buffer).toString()) as SaltEdgeWebhookPayload;
    } catch {
      console.error('Salt Edge webhook: failed to parse payload');
      return;
    }

    processWebhook(payload).catch((err: unknown) => {
      console.error('Salt Edge webhook processing error:', err);
    });
  },
);

interface SaltEdgeWebhookPayload {
  meta: { version: string; type: string };
  data: { connection_id: string; customer_id: string };
}

async function processWebhook(payload: SaltEdgeWebhookPayload): Promise<void> {
  const eventType = payload.meta?.type;
  const connectionId = payload.data?.connection_id;

  if (!connectionId) return;

  if (eventType === 'fetch.finished' || eventType === 'connection.connected') {
    const { data: conn } = await supabase
      .from('salt_edge_connections')
      .select('user_id')
      .eq('connection_id', connectionId)
      .single();

    if (!conn) {
      console.warn('Salt Edge webhook: unknown connection_id', connectionId);
      return;
    }

    await syncSaltEdgeConnection(conn.user_id as string, connectionId);
  }
}
