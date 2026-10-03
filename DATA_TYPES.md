# Zoho Books MCP: Data It Can Read

2026-10-03

The connector reads 21 groups of Zoho Books data through 224 read-only functions, for any of the organizations the connected Zoho account can see, one per request. It is based on [Zoho's Books API v3 documentation](https://www.zoho.com/books/api/v3/), plus Zoho's report endpoints, which were confirmed by testing.

## Data types

| Category | Data it can read |
| --- | --- |
| Sales | Customers and vendors (contacts, contact persons, addresses, cards, statements, tax info); invoices, including recurring invoices, retainer invoices and debit notes; estimates; sales orders; sales receipts; delivery challans; credit notes and their refunds; customer payments and refunds |
| Purchases | Bills and recurring bills, with the payments applied to them; purchase orders and purchase returns; vendor credits and refunds; vendor payments and refunds; expenses, recurring expenses and employees |
| Accounting and banking | Bank and credit card accounts, balances, statements and reconciliations; bank transactions and bank rules; chart of accounts and the transactions posted to each account; account registers and budget vs. actuals; manual and recurring journals; fixed assets with history and forecast depreciation; currency adjustments, opening balances and transaction locks |
| Reports | Seven of Zoho's dashboard reports, on an accrual or cash basis and for any date range: Profit and Loss, Balance Sheet, Cash Flow Statement, General Ledger, Trial Balance, Journal Report and Account Transactions |
| Setup and reference | Organization details; users; taxes and tax groups; currencies and exchange rates; items, item variants, categories and price lists; locations; reporting tags; projects, tasks, time entries and running timers |

## Limits

- Read-only: it cannot create, edit, update or delete anything in Books.
- Only seven of the roughly 56 dashboard reports are available as functions so far. Any other report would have to be rebuilt from the records above, and the figures may differ from Zoho's own.
- Custom module records are not included, because their only Zoho scope allows writing.
- It returns only what the connected Zoho account may see, and only for the organization named in each request.
- Every function was tried once on a test organization. What came back there depended on that account's permissions and data, so real client data is still to be checked.
