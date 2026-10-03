# Zoho Books MCP: Read-Only Audit

2026-10-03

None of the connector's 224 functions can create, edit or delete anything in Zoho Books. Each one is a read-only (GET) call to the Zoho Books API v3, and the code has no other way to send data to Books.

The list below is grouped by module with the OAuth scope each group needs. Granting only the READ scopes makes Zoho itself refuse any write, even if the code were changed later.

## Scopes to grant

Use these 21 READ scopes when generating the code in the Zoho API Console. Each name comes from the scope line on Zoho's own API page for that module, except ZohoBooks.reports.READ, which Zoho does not document and which was confirmed by testing.

```text
ZohoBooks.contacts.READ,ZohoBooks.invoices.READ,ZohoBooks.estimates.READ,ZohoBooks.salesorders.READ,ZohoBooks.deliverychallans.READ,ZohoBooks.creditnotes.READ,ZohoBooks.customerpayments.READ,ZohoBooks.bills.READ,ZohoBooks.purchaseorders.READ,ZohoBooks.purchasereturns.READ,ZohoBooks.debitnotes.READ,ZohoBooks.vendorpayments.READ,ZohoBooks.expenses.READ,ZohoBooks.banking.READ,ZohoBooks.accountants.READ,ZohoBooks.fixedasset.READ,ZohoBooks.projects.READ,ZohoBooks.items.READ,ZohoBooks.categories.READ,ZohoBooks.reports.READ,ZohoBooks.settings.READ
```

Do not grant ZohoBooks.custommodules.ALL; the connector refuses any token that carries it. Zoho's Custom Modules page lists only that scope, and it includes write access. For that reason the two functions that read custom module records were removed, and every remaining function works with READ scopes. Zoho's pages do not mention a single ZohoBooks.fullaccess.READ scope, so the explicit list is used.

The project handoff planned only 6 of these scopes: invoices, contacts, expenses, bills, items and settings. Counted by module, those enable 109 of the 224 functions. Decision: grant all 21 READ scopes, which enables all 224 functions. None of them can write, update, edit or delete anything in Books.

## Function inventory

All 224 functions, grouped by module with the scope each needs. Every name starts with list_ or get_, which is the first check for a read-only tool.

| Module | Scope (ZohoBooks.) | Count | Functions |
| --- | --- | --- | --- |
| Contacts and contact persons | contacts.READ | 28 | list_contacts, get_contact, get_contact_by_reference, list_contact_addresses, get_contact_addresses, list_contact_comments, get_contact_statement, get_contact_statement_email, get_contact_email, list_contact_credit_refunds, list_contact_payment_refunds, get_contact_unused_retainer_payments, get_contact_unused_credits, list_contact_bank_accounts, get_contact_bank_account, list_all_contact_bank_accounts, list_contact_cards, get_contact_card, get_contact_card_count, list_card_recurring_invoices, list_all_contact_persons, list_contact_persons, get_contact_person, get_contact_tax_info, get_contact_income_and_expense, get_contact_profit_and_loss, get_contact_inventory_summary, get_contact_opening_balances |
| Invoices, recurring and retainer invoices, debit notes, sales receipts | invoices.READ | 29 | list_sales_receipts, get_sales_receipt, list_invoices, get_invoice, get_invoice_email, get_invoice_payment_reminder, list_invoice_templates, list_invoice_payments, list_invoice_credits_applied, get_invoice_document, list_invoice_comments, get_invoice_dashboard, get_invoice_custom_fields, get_invoice_tracking_details, get_invoice_sms, get_invoice_metadata, list_e_invoices, get_e_invoice, list_customer_debit_notes, list_recurring_invoices, get_recurring_invoice, list_recurring_invoice_comments, get_recurring_invoices_dashboard, list_recurring_invoice_children, list_retainer_invoices, get_retainer_invoice, get_retainer_invoice_email, list_retainer_invoice_templates, list_retainer_invoice_comments |
| Estimates | estimates.READ | 5 | list_estimates, get_estimate, get_estimate_email, list_estimate_templates, list_estimate_comments |
| Sales orders | salesorders.READ | 5 | list_sales_orders, get_sales_order, get_sales_order_email, list_sales_order_templates, list_sales_order_comments |
| Delivery challans | deliverychallans.READ | 3 | list_delivery_challans, get_delivery_challan, list_delivery_challan_templates |
| Credit notes | creditnotes.READ | 16 | list_credit_notes, get_credit_note, get_credit_note_email, get_credit_note_mail_content, get_credit_note_email_history, list_credit_note_templates, list_credit_note_invoices, list_credit_note_comments, list_all_credit_note_refunds, list_credit_note_refunds, get_credit_note_refund, get_credit_note_refund_by_id, get_credit_note_document, get_credit_note_custom_fields, list_credit_note_e_invoices, get_credit_note_e_invoice |
| Customer payments | customerpayments.READ | 4 | list_customer_payments, get_customer_payment, list_customer_payment_refunds, get_customer_payment_refund |
| Bills and recurring bills | bills.READ | 8 | list_bills, get_bill, list_bill_payments, list_bill_comments, get_bill_from_purchase_orders, list_recurring_bills, get_recurring_bill, list_recurring_bill_comments |
| Purchase orders | purchaseorders.READ | 5 | list_purchase_orders, get_purchase_order, get_purchase_order_email, list_purchase_order_templates, list_purchase_order_comments |
| Purchase returns | purchasereturns.READ | 2 | list_purchase_returns, get_purchase_return |
| Vendor credits | debitnotes.READ | 7 | list_vendor_credits, get_vendor_credit, list_vendor_credit_bills, list_vendor_credit_refunds, get_vendor_credit_refund, list_all_vendor_credit_refunds, list_vendor_credit_comments |
| Vendor payments | vendorpayments.READ | 5 | list_vendor_payments, get_vendor_payment, list_vendor_payment_refunds, get_vendor_payment_refund, get_vendor_payment_email |
| Expenses, recurring expenses, employees | expenses.READ | 8 | list_expenses, get_expense, list_expense_comments, list_employees, list_recurring_expenses, get_recurring_expense, list_recurring_expense_children, list_recurring_expense_comments |
| Banking: accounts, transactions, rules | banking.READ | 22 | list_bank_accounts, get_bank_account, list_bank_account_balances, get_bank_accounts_overview, get_bank_account_balance, get_bank_account_balance_breakdown, get_bank_account_overview, get_bank_statement_summary, get_last_imported_statement, list_bank_statements, list_unreviewed_statement_transactions, list_bank_account_transactions, list_bank_account_subaccounts, list_bank_reconciliations, get_bank_reconciliation, get_bank_account_preferences, list_bank_transactions, get_bank_transaction, list_matching_transactions, list_bank_rules, get_bank_rule, list_bank_match_filters |
| Accounting: chart of accounts, registers, journals, currency adjustments, locks | accountants.READ | 16 | list_chart_of_accounts, get_chart_account, list_account_transactions, list_register_transactions, get_register_budget_vs_actuals, list_journals, get_journal, list_journal_credits, list_recurring_journals, get_recurring_journal, list_recurring_journal_children, get_transaction_journal, list_base_currency_adjustments, get_base_currency_adjustment, list_transaction_locks, get_transaction_lock |
| Fixed assets | fixedasset.READ | 5 | list_fixed_assets, get_fixed_asset, get_fixed_asset_history, get_fixed_asset_forecast, list_fixed_asset_types |
| Projects and time entries | projects.READ | 11 | list_projects, get_project, list_project_users, get_project_user, list_project_comments, list_project_invoices, list_project_tasks, get_project_task, list_time_entries, get_time_entry, get_running_timer |
| Items, item masters, item variants | items.READ | 6 | list_items, get_item, list_item_masters, get_item_master, list_item_variants, get_item_variant |
| Item categories | categories.READ | 2 | list_categories, get_category |
| Reports: P&L, balance sheet, cash flow, general ledger, trial balance, journal, account transactions | reports.READ | 7 | get_report_profit_and_loss, get_report_balance_sheet, get_report_cash_flow, get_report_general_ledger, get_report_trial_balance, get_report_journal, get_report_account_transactions |
| Setup: organizations, users, taxes, currencies, locations, tags, price lists, tasks, opening balances, custom-module definitions | settings.READ | 30 | list_organizations, get_organization, list_organizations_for_user, get_organization_address, list_custom_modules, get_custom_module, get_opening_balance, get_opening_balance_details, list_taxes, get_tax, get_tax_group, list_tax_authorities, get_tax_authority, list_tax_exemptions, get_tax_exemption, list_currencies, get_currency, list_exchange_rates, get_exchange_rate, list_tasks, get_task, list_task_comments, list_users, get_user, get_current_user, list_price_lists, list_price_list_items, list_locations, list_reporting_tags, list_reporting_tag_options |

## What Claude can report on

Claude can build most reports from this data: it pulls records through the functions above, then totals, groups and compares them. Examples are overdue invoices by customer, monthly sales, expenses by category, bills due this month and a customer statement.

Seven of Zoho's own dashboard reports are available as functions, with Zoho's own figures, on an accrual or cash basis and for any date range: Profit and Loss, Balance Sheet, Cash Flow Statement, General Ledger, Trial Balance, Journal Report and Account Transactions. Testing found about 35 more report endpoints that exist but are not added yet.

- The Zoho dashboard shows about 56 reports. Any report that is not a function would have to be rebuilt from transactions, and the figures can differ from Zoho's own (cash vs. accrual basis, taxes, currency adjustments, opening balances). Check them against Zoho before relying on them.
- Results arrive in pages, so a large organization needs date or status filters.
- A report can only draw on modules whose scopes were granted.
- Reports stay outside Books: the connector cannot save, schedule or send them from Zoho.

## How read-only is enforced, and open items

Seven independent checks keep this connector read-only and limited to Zoho Books:

1. Every function calls one helper, zohoBooksGet in src/zoho.ts, which sends GET requests only. The single POST in the code is the OAuth login-token request.
2. All 224 names start with list_ or get_, and none is a create, update, delete, send or approve action.
3. IDs are placed in a URL only if they are plain letters, numbers, _ or -, and filters are limited to the names Zoho documents or that testing confirmed.
4. With only the READ scopes above, Zoho refuses any write request on its side.
5. Credentials and requests go only to Zoho's own accounts and API domains, and every request path must sit inside /books/v3, the Zoho Books API.
6. At run time the connector refuses any token that carries a scope other than ZohoBooks.<module>.READ, so a token that includes CRM, Desk, Projects or any write scope is rejected.
7. Every request names one organization, which must be on the live list of organizations the account can reach (optionally narrowed by an allowed list), and every result states which organization it came from.

Open items:

- Every function was called once against a test organization (Dummy). Roughly 92 returned data or an empty result, 85 reached the right endpoint but had no record to fetch, 38 were blocked by that account's role in the organization, and 7 are switched off there (for example delivery challans and e-invoicing). Two could not be verified: get_invoice_metadata and get_custom_module. Results on real client data are still to be checked. The scope check in item 6 passed against a real token.
- Some functions return draft email, SMS or statement text, for example get_invoice_email. They only return the text and send nothing.
- The seven report functions use endpoints that Zoho does not document. Their paths and filters were confirmed by testing and could change without notice.
- The Zoho account can see 17 client organizations, and the connector can read any of them, one per request. Who may use the connector, and whether to narrow it to an allowed list, still needs to be decided. ZOHO_ORG_ID is an optional default and is currently the Dummy test organization; clearing it makes every request name its organization.
- This audit covers this connector only. Other Zoho connectors enabled in Claude, such as the official Zoho Books, CRM and Projects connectors, are separate and include create, update and delete tools.
