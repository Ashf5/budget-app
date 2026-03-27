# Phase 1: The Cash Flow Foundation
**Goal**: To establish a real-time, automated ledger that identifies every source of income and every point of expenditure across US and Israeli accounts.

## 1. Automated "In-and-Out" Sync
The engine that replaces manual entry with a live feed of your global financial activity.

### US Financial Bridge (Plaid)
* Live connection to US checking, savings, and credit card accounts.
* Automatic pull of historical transaction data (30–90 days) to establish an immediate baseline of spending habits.

### Israeli Financial Bridge (Salt Edge)
* Live connection to Israeli banks and major credit card providers (Max, Isracard, Cal).
* Direct monitoring of Israeli checking accounts for local utility bills and standing orders (Hora'ot Keva).

### Source Attribution
* Automatic identification of "**Income**" vs "**Transfer**." The system must distinguish between a paycheck arriving and a simple move of money between your own accounts to avoid "double-counting" income.

## 2. Multi-Currency Reconciliation
Because money "**in**" is often in a different currency than money "**out**," this layer provides a single language for your budget.

### The "Base Currency" Toggle
A global setting to view your entire cash flow in either USD or ILS.

### Point-of-Impact Conversion
Every transaction is tagged with the exchange rate from the actual day it occurred, ensuring your "**Money Out**" reports are accurate to the cent, even months later.

### Cross-Border Transfer Matching
A feature to link a USD "**Out**" (wire transfer) with an ILS "**In**" (receipt in an Israeli account), marking them as a single "**Internal Transfer**" rather than new income/expense.

## 3. Inflow Tracking (The "In")
A dedicated view of who is paying you and how often.

### Income Source Identification
Automatic grouping of deposits by employer or client name (e.g., identifying "**Company X**" as a recurring income source).

### Deposit Frequency Alerts
A notification or indicator when an expected recurring deposit (like a monthly salary) has landed in either country.

### Net vs. Gross Awareness
Ability to tag specific inflows as "**Contractor Gross**" to distinguish them from "**Tax-Clear**" income.

<h2>4. Outflow Tracking & Categorization (The "Out")</h2>
A granular look at where the money goes, allowing you to "clean up" the data.

### Automated Merchant Labeling
Transforming cryptic bank strings (e.g., IZ *WOLT ENTS) into clean, recognizable merchant names (**Wolt**).

### Smart Classification
Automatic assignment of charges into buckets like "**Housing**," "**Groceries**," "**Family**," or "**Business**."

### The "Reclassification" Command Center
* A simple interface to change a transaction's category.
* "**Remember This**" Rules: A feature that allows you to set a rule (e.g., "**Any charge from 'Amazon' should always be 'Household Supplies'**") to automate future classification.
* **Transaction Splitting**: The ability to take a single large charge (like a supermarket run) and split it into two different categories (e.g., **80% Groceries, 20% Baby Supplies**).

## 5. The "Cash Flow" Dashboard
The primary screen designed to answer: "**Where do I stand right now?**"

### The Income/Expense Bar
A visual comparison of money in vs. money out for the current month.

### Account Totals (Unified)
A list of all bank balances (US and Israel) converted into one total sum.

### Top Expense Sources
A list of the top 5 merchants or categories where money is leaving most rapidly.

### Recent Activity Feed
A unified list of the last 10 transactions across all global accounts, regardless of currency.
