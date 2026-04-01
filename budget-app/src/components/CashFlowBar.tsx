interface Props {
  income: number
  expenses: number
  isLoading: boolean
  month: string
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export default function CashFlowBar({ income, expenses, isLoading, month }: Props) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex justify-between">
          <div className="h-3 bg-gray-100 rounded w-24 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-20 animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-2 bg-gray-100 rounded animate-pulse" />
          <div className="h-2 bg-gray-100 rounded animate-pulse w-3/4" />
        </div>
      </div>
    )
  }

  const max = Math.max(income, expenses)
  const incomePercent = max > 0 ? (income / max) * 100 : 0
  const expensePercent = max > 0 ? (expenses / max) * 100 : 0
  const net = income - expenses
  const hasData = income > 0 || expenses > 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-gray-800">Cash Flow</span>
        <span className="text-xs text-gray-400">{month}</span>
      </div>

      {!hasData ? (
        <p className="text-sm text-gray-400 text-center py-4">No transactions this month yet.</p>
      ) : (
        <div className="space-y-3">
          {/* Income row */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-gray-600">Income</span>
              <span className="text-sm font-semibold text-emerald-600 tabular-nums">
                +{formatCurrency(income)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${incomePercent}%` }}
              />
            </div>
          </div>

          {/* Expense row */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-gray-600">Expenses</span>
              <span className="text-sm font-semibold text-rose-600 tabular-nums">
                -{formatCurrency(expenses)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${expensePercent}%` }}
              />
            </div>
          </div>

          {/* Net row */}
          <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400">Net this month</span>
            <span
              className={`text-sm font-semibold tabular-nums ${
                net >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {net >= 0 ? '+' : ''}{formatCurrency(net)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
