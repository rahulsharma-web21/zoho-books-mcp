import type { Endpoint } from "./registry.js";

// Zoho Books report endpoints (GET /reports/...). They need the ZohoBooks.reports.READ scope.
// Zoho does not document these in the public API pages; the paths and filters below were confirmed
// against a live organization (each returns the report with report_basis and applied_filter).

const periodFilters = ["filter_by", "from_date", "to_date", "cash_based"];

const PERIOD =
  " Period: set from_date and to_date (YYYY-MM-DD) for a custom range, or filter_by to one of " +
  "TransactionDate.Today|ThisWeek|ThisMonth|ThisQuarter|ThisYear|PreviousDay|PreviousWeek|PreviousMonth|PreviousQuarter|PreviousYear. " +
  "With no period given, this month is used (today for the balance sheet and trial balance). cash_based=true gives the cash basis; the default is accrual.";

export const reportEndpoints: Endpoint[] = [
  { name: "get_report_profit_and_loss", description: "Profit and Loss report." + PERIOD,
    path: "/reports/profitandloss", filters: periodFilters, customDateFilter: true },
  { name: "get_report_balance_sheet", description: "Balance Sheet report. It is as of to_date (or today). cash_based=true gives the cash basis." + PERIOD,
    path: "/reports/balancesheet", filters: periodFilters, customDateFilter: true, defaultPeriod: "TransactionDate.Today" },
  { name: "get_report_cash_flow", description: "Cash Flow Statement." + PERIOD,
    path: "/reports/cashflow", filters: periodFilters, customDateFilter: true },
  { name: "get_report_general_ledger", description: "General Ledger report." + PERIOD,
    path: "/reports/generalledger", filters: periodFilters, customDateFilter: true },
  { name: "get_report_trial_balance", description: "Trial Balance report." + PERIOD,
    path: "/reports/trialbalance", filters: periodFilters, customDateFilter: true, defaultPeriod: "TransactionDate.Today" },
  { name: "get_report_journal", description: "Journal report: journal entries for the period." + PERIOD,
    path: "/reports/journal", filters: periodFilters, paginated: true, customDateFilter: true },
  { name: "get_report_account_transactions", description: "Account Transactions report: transactions across accounts for the period." + PERIOD,
    path: "/reports/accounttransaction", filters: periodFilters, paginated: true, customDateFilter: true },
];
