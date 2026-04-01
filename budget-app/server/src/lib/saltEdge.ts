import { config } from '../config';

const BASE_URL = 'https://www.saltedge.com/api/v6';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SaltEdgeCustomer {
  customer_id: string;
  identifier: string;
}

export interface SaltEdgeConnectSession {
  connect_url: string;
  expires_at: string;
}

export interface SaltEdgeConnection {
  id: string;
  provider_id: string;
  provider_code: string;
  provider_name: string;
  customer_id: string;
  status: string;
}

export interface SaltEdgeAccount {
  id: string;
  connection_id: string;
  name: string;
  nature: string;   // 'account' | 'card' | 'savings' | 'checking' | 'bonus' | etc.
  balance: number;
  currency_code: string;
}

export interface SaltEdgeTransaction {
  id: string;
  account_id: string;
  amount: number;       // v6: negative = debit, positive = credit — negate on insert to match DB convention (positive = debit)
  currency_code: string;
  description: string;
  category: string;
  made_on: string;      // "YYYY-MM-DD"
  status: string;       // 'posted' | 'pending'
}

export interface SaltEdgeTransactionsPage {
  data: SaltEdgeTransaction[];
  meta: { next_id: string | null; next_page: string | null };
}

// ── HTTP client ────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  return {
    'App-id': config.saltEdgeAppId,
    'Secret': config.saltEdgeSecret,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify({ data: body }) : undefined,
  });

  const json = await res.json() as { data?: T; error?: { class: string; message: string } };

  if (!res.ok) {
    const msg = json.error ? `${json.error.class}: ${json.error.message}` : `Salt Edge error ${res.status}`;
    throw new Error(msg);
  }

  return json.data as T;
}

// ── API methods ────────────────────────────────────────────────────────────

export const saltEdge = {
  createCustomer(identifier: string): Promise<SaltEdgeCustomer> {
    return request<SaltEdgeCustomer>('POST', '/customers', { identifier });
  },

  createConnectSession(customerId: string, returnTo: string): Promise<SaltEdgeConnectSession> {
    return request<SaltEdgeConnectSession>('POST', '/connections/connect', {
      customer_id: customerId,
      consent: {
        scopes: ['accounts', 'transactions'],
        from_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      attempt: {
        fetch_scopes: ['accounts', 'transactions'],
        return_to: returnTo,
      },
    });
  },

  getConnection(connectionId: string): Promise<SaltEdgeConnection> {
    return request<SaltEdgeConnection>('GET', `/connections/${connectionId}`);
  },

  getAccounts(connectionId: string): Promise<SaltEdgeAccount[]> {
    return request<SaltEdgeAccount[]>('GET', `/accounts?connection_id=${connectionId}`);
  },

  async getTransactions(
    connectionId: string,
    accountId: string,
    fromId?: string,
  ): Promise<SaltEdgeTransactionsPage> {
    const params = new URLSearchParams({
      connection_id: connectionId,
      account_id: accountId,
    });
    if (fromId) params.set('from_id', fromId);

    const res = await fetch(`${BASE_URL}/transactions?${params}`, {
      method: 'GET',
      headers: authHeaders(),
    });

    const json = await res.json() as {
      data?: SaltEdgeTransaction[];
      meta?: { next_id: string | null; next_page: string | null };
      error?: { class: string; message: string };
    };

    if (!res.ok) {
      const msg = json.error ? `${json.error.class}: ${json.error.message}` : `Salt Edge error ${res.status}`;
      throw new Error(msg);
    }

    return {
      data: json.data ?? [],
      meta: json.meta ?? { next_id: null, next_page: null },
    };
  },
};
