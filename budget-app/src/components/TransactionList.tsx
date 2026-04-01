import type { Transaction } from '../types'
import { CATEGORY_LABELS } from '../lib/analytics'

interface Props {
  transactions: Transaction[]
  isLoading: boolean
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TransactionList({ transactions, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-10 text-center">No transactions yet.</p>
    )
  }

  return (
    <ul className="divide-y divide-gray-50">
      {transactions.map(tx => {
        const isCredit = tx.amount < 0
        const label = tx.merchant_name ?? tx.raw_description
        const category = tx.category ? (CATEGORY_LABELS[tx.category] ?? tx.category) : null

        return (
          <li key={tx.id} className="flex items-center gap-4 py-3.5">
            {/* Date */}
            <span className="text-xs text-gray-400 w-10 shrink-0 tabular-nums">
              {formatDate(tx.date)}
            </span>

            {/* Description */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {category && (
                  <span className="text-xs text-gray-400">{category}</span>
                )}
                {tx.pending && (
                  <span className="text-xs text-amber-500 font-medium">Pending</span>
                )}
              </div>
            </div>

            {/* Amount */}
            <span
              className={`text-sm font-semibold tabular-nums shrink-0 ${
                isCredit ? 'text-emerald-600' : 'text-gray-800'
              }`}
            >
              {isCredit ? '+' : ''}
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: tx.currency,
              }).format(Math.abs(tx.amount))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
