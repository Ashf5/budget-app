import type { ExpenseGroup } from '../lib/analytics'

interface Props {
  groups: ExpenseGroup[]
  isLoading: boolean
}

export default function TopExpenses({ groups, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="h-3 bg-gray-100 rounded w-28 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-gray-100 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 bg-gray-100 rounded animate-pulse" />
                <div className="h-1 bg-gray-100 rounded animate-pulse w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const totalShown = groups.reduce((sum, g) => sum + g.total, 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="mb-4">
        <span className="text-sm font-semibold text-gray-800">Top Expenses</span>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No expense data this month.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {groups.map((group, i) => {
            const proportion = totalShown > 0 ? (group.total / totalShown) * 100 : 0
            return (
              <li key={group.key} className="flex items-center gap-3 py-2.5">
                {/* Rank badge */}
                <span className="w-5 h-5 rounded-full bg-gray-100 text-xs text-gray-400 font-medium flex items-center justify-center shrink-0">
                  {i + 1}
                </span>

                {/* Label + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{group.label}</span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(group.total)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                      style={{ width: `${proportion}%` }}
                    />
                  </div>
                </div>

                {/* Transaction count */}
                <span className="text-xs text-gray-400 shrink-0 w-12 text-right">
                  {group.count} txn{group.count !== 1 ? 's' : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
