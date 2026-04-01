import type { Transaction } from '../types'

export const CATEGORY_LABELS: Record<string, string> = {
  FOOD_AND_DRINK: 'Food & Drink',
  TRAVEL: 'Travel',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  INCOME: 'Income',
  LOAN_PAYMENTS: 'Loan Payment',
  BANK_FEES: 'Bank Fees',
  ENTERTAINMENT: 'Entertainment',
  GENERAL_MERCHANDISE: 'Shopping',
  HOME_IMPROVEMENT: 'Home',
  MEDICAL: 'Medical',
  PERSONAL_CARE: 'Personal Care',
  GENERAL_SERVICES: 'Services',
  GOVERNMENT_AND_NON_PROFIT: 'Government',
  UTILITIES: 'Utilities',
  RENT_AND_UTILITIES: 'Rent & Utilities',
  OTHER: 'Other',
}

const TRANSFER_CATEGORIES = new Set(['TRANSFER_IN', 'TRANSFER_OUT'])

export interface ExpenseGroup {
  key: string
  label: string
  total: number
  count: number
}

export function getMonthStart(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

export function sumIncome(transactions: Transaction[]): number {
  return transactions
    .filter(tx => !TRANSFER_CATEGORIES.has(tx.category ?? '') && tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
}

export function sumExpenses(transactions: Transaction[]): number {
  return transactions
    .filter(tx => !TRANSFER_CATEGORIES.has(tx.category ?? '') && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0)
}

export function topExpenseCategories(transactions: Transaction[], n = 5): ExpenseGroup[] {
  const map = new Map<string, { total: number; count: number }>()

  for (const tx of transactions) {
    if (tx.amount <= 0) continue
    if (TRANSFER_CATEGORIES.has(tx.category ?? '')) continue
    const key = tx.category ?? 'OTHER'
    const entry = map.get(key) ?? { total: 0, count: 0 }
    entry.total += tx.amount
    entry.count += 1
    map.set(key, entry)
  }

  return Array.from(map.entries())
    .map(([key, { total, count }]) => ({
      key,
      label: CATEGORY_LABELS[key] ?? key,
      total,
      count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n)
}
