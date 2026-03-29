import type { Account } from '../types'

interface Props {
  account: Account
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  depository: 'Bank',
  credit: 'Credit',
  investment: 'Investment',
  loan: 'Loan',
  other: 'Other',
}

export default function AccountCard({ account }: Props) {
  const formatCurrency = (value: number | null) => {
    if (value === null) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: account.currency,
    }).format(value)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-0.5">
            {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
          </p>
          <p className="text-sm font-medium text-gray-800">{account.name}</p>
        </div>
        <span className="text-xs text-gray-400 font-mono uppercase">{account.currency}</span>
      </div>

      <p className="text-2xl font-semibold text-gray-900 tabular-nums">
        {formatCurrency(account.balance_current)}
      </p>

      {account.balance_available !== null &&
        account.balance_available !== account.balance_current && (
          <p className="text-xs text-gray-400 mt-1">
            {formatCurrency(account.balance_available)} available
          </p>
        )}
    </div>
  )
}
