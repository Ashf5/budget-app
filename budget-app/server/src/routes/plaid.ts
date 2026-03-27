import { Router, Response } from 'express';
import { CountryCode, Products } from 'plaid';
import { plaidClient } from '../lib/plaid';
import { supabase } from '../db/supabase';
import { verifyToken, AuthRequest } from '../middleware/auth';

export const plaidRouter = Router();

// POST /plaid/create-link-token
plaidRouter.post('/create-link-token', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.user!.id },
      client_name: 'Budget App',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// POST /plaid/exchange-token
plaidRouter.post('/exchange-token', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { public_token, institution_name } = req.body;

  if (!public_token) {
    res.status(400).json({ error: 'public_token is required' });
    return;
  }

  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = response.data;

    const { error } = await supabase.from('plaid_items').insert({
      user_id: req.user!.id,
      access_token,
      item_id,
      institution_name: institution_name || null,
    });

    if (error) {
      res.status(500).json({ error: 'Failed to save Plaid item' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// POST /plaid/sync
plaidRouter.post('/sync', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: items, error: itemsError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', req.user!.id);

    if (itemsError || !items) {
      res.status(500).json({ error: 'Failed to fetch Plaid items' });
      return;
    }

    let totalSynced = 0;

    for (const item of items) {
      let cursor = item.cursor || undefined;
      let hasMore = true;

      while (hasMore) {
        const syncResponse = await plaidClient.transactionsSync({
          access_token: item.access_token,
          cursor,
        });

        const { added, modified, removed, next_cursor, has_more, accounts } = syncResponse.data;

        // Upsert accounts
        for (const account of accounts) {
          const { data: existingAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('plaid_account_id', account.account_id)
            .single();

          if (existingAccount) {
            await supabase
              .from('accounts')
              .update({
                balance_current: account.balances.current,
                balance_available: account.balances.available,
                updated_at: new Date().toISOString(),
              })
              .eq('plaid_account_id', account.account_id);
          } else {
            await supabase.from('accounts').insert({
              user_id: req.user!.id,
              plaid_item_id: item.id,
              plaid_account_id: account.account_id,
              name: account.name,
              type: account.type,
              currency: account.balances.iso_currency_code || 'USD',
              balance_current: account.balances.current,
              balance_available: account.balances.available,
            });
          }
        }

        // Upsert added/modified transactions
        for (const tx of [...added, ...modified]) {
          const { data: accountRow } = await supabase
            .from('accounts')
            .select('id')
            .eq('plaid_account_id', tx.account_id)
            .single();

          if (!accountRow) continue;

          await supabase.from('transactions').upsert({
            user_id: req.user!.id,
            account_id: accountRow.id,
            plaid_transaction_id: tx.transaction_id,
            amount: tx.amount,
            currency: tx.iso_currency_code || 'USD',
            merchant_name: tx.merchant_name || null,
            raw_description: tx.name,
            category: tx.personal_finance_category?.primary || null,
            date: tx.date,
            pending: tx.pending,
          }, { onConflict: 'plaid_transaction_id' });

          totalSynced++;
        }

        // Remove deleted transactions
        for (const tx of removed) {
          await supabase
            .from('transactions')
            .delete()
            .eq('plaid_transaction_id', tx.transaction_id);
        }

        cursor = next_cursor;
        hasMore = has_more;
      }

      // Save updated cursor
      await supabase
        .from('plaid_items')
        .update({ cursor })
        .eq('id', item.id);
    }

    res.json({ synced: totalSynced });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// GET /plaid/accounts
plaidRouter.get('/accounts', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('name');

    if (error) {
      res.status(500).json({ error: 'Failed to fetch accounts' });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// GET /plaid/transactions
plaidRouter.get('/transactions', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch transactions' });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});
