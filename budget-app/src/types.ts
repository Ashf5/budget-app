export interface Account {
  id: string
  name: string
  type: string
  currency: string
  balance_current: number | null
  balance_available: number | null
  source?: 'plaid' | 'salt_edge'
  institution_name?: string | null
}

export interface Transaction {
  id: string
  account_id: string
  amount: number
  currency: string
  merchant_name: string | null
  raw_description: string
  category: string | null
  date: string
  pending: boolean
}
