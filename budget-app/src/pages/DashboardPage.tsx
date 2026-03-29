import { useState, useEffect, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import AccountCard from '../components/AccountCard'
import TransactionList from '../components/TransactionList'
import type { Account, Transaction } from '../types'

export default function DashboardPage() {
  const { logout } = useAuth()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [isLinkLoading, setIsLinkLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoadingData(true)
    try {
      const [accts, txns] = await Promise.all([
        api.get<Account[]>('/plaid/accounts'),
        api.get<Transaction[]>('/plaid/transactions?limit=50&offset=0'),
      ])
      setAccounts(accts)
      setTransactions(txns)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const openPlaidLink = async () => {
    setIsLinkLoading(true)
    try {
      const { link_token } = await api.post<{ link_token: string }>(
        '/plaid/create-link-token',
        {},
      )
      setLinkToken(link_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start bank connection')
    } finally {
      setIsLinkLoading(false)
    }
  }

  const { open: openWidget, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: async (public_token, metadata) => {
      try {
        await api.post('/plaid/exchange-token', {
          public_token,
          institution_name: metadata.institution?.name ?? null,
        })
        setIsSyncing(true)
        await api.post('/plaid/sync', {})
        await fetchData()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect bank')
      } finally {
        setLinkToken(null)
        setIsSyncing(false)
      }
    },
    onExit: () => {
      setLinkToken(null)
    },
  })

  useEffect(() => {
    if (linkToken && ready) {
      openWidget()
    }
  }, [linkToken, ready, openWidget])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await api.post('/plaid/sync', {})
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  const totalBalance = accounts.reduce(
    (sum, a) => sum + (a.balance_current ?? 0),
    0,
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-900">Budget</span>
          </div>

          <div className="flex items-center gap-2">
            {accounts.length > 0 && (
              <button
                onClick={handleSync}
                disabled={isSyncing || isLoadingData}
                className="flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-lg
                           border border-gray-200 text-gray-600 hover:bg-gray-50
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isSyncing ? 'Syncing…' : 'Sync'}
              </button>
            )}
            <button
              onClick={openPlaidLink}
              disabled={isLinkLoading || isSyncing}
              className="text-sm px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg
                         hover:bg-indigo-700 active:bg-indigo-800
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLinkLoading ? 'Loading…' : '+ Connect Bank'}
            </button>
            <button
              onClick={logout}
              className="text-sm px-3 py-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 ml-4 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Summary card */}
        {accounts.length > 0 && !isLoadingData && (
          <div className="bg-indigo-600 rounded-2xl p-6 text-white">
            <p className="text-sm font-medium text-indigo-200 mb-1">Total Balance</p>
            <p className="text-4xl font-semibold tabular-nums">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalBalance)}
            </p>
            <p className="text-sm text-indigo-300 mt-2">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected
            </p>
          </div>
        )}

        {/* Accounts */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Accounts
          </h2>
          {isLoadingData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-24 animate-pulse">
                  <div className="h-2.5 bg-gray-100 rounded w-1/3 mb-3" />
                  <div className="h-7 bg-gray-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">No accounts connected</p>
              <p className="text-sm text-gray-400 mb-5">Link a bank account to see your balances and transactions.</p>
              <button
                onClick={openPlaidLink}
                disabled={isLinkLoading}
                className="bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg
                           hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isLinkLoading ? 'Loading…' : 'Connect your bank'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {accounts.map(acct => (
                <AccountCard key={acct.id} account={acct} />
              ))}
            </div>
          )}
        </section>

        {/* Transactions */}
        {(accounts.length > 0 || transactions.length > 0) && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Recent Transactions
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4">
              <TransactionList transactions={transactions} isLoading={isLoadingData} />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
