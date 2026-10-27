# Project Documentation — Ledger (ETBA-2026)

**Application Name:** Ledger — Expense Tracker with Budget Analysis  
**Project Reference:** ETBA-2026  
**Primary Currency:** Indian Rupees (`INR`, `₹`)  
**Timezone Convention:** `Asia/Kolkata` (`UTC+05:30`)

---

## 1. Existing Prototype Inspection & Gap Analysis

Prior to engineering the full-stack application, the supplied prototype (`public/assets/aistudio/expense-tracker-project__1__8eb6833a.html`) was inspected:

1. **What Existed in the Prototype**:
   - A single-file static HTML academic project overview (`expense-tracker-project (1).html`) for *Department of Information Technology — Madras Institute of Technology, Anna University (Feb 2026)*.
   - Established visual identity: near-black green background (`#0a0d0c`), raised dark surfaces (`#101513` / `#161c1a`), `1px` borders (`#1e2624`), mint-green primary accent (`#4ff0b7`), gold warning accent (`#f0b429`), and coral danger accent (`#ff6b6b`).
   - Static mockup sections: Overview, Objectives, Literature Survey, Proposed Work, Modules, Architecture, Tech Stack, Database Schema, Sample Output mockup (`₹42,180` hardcoded), and Conclusion.
2. **What Was Missing (Implemented in This Build)**:
   - Real authentication (Registration, Login, Logout, Session management, CSRF protection, Login throttling, Password change).
   - Strict 3-tier Access Control Model resolving the prototype's role ambiguity (**Guest**, **Registered User**, **Administrator**).
   - Real persisted relational database (`users`, `categories`, `transactions`, `budgets`, `system_settings`, `audit_logs`, `login_attempts`) using `DECIMAL(12,2)` monetary precision.
   - Complete **Income Management** and **Expense Management** CRUD modules with search, date-range filtering, category/payment method filtering, sorting, and pagination.
   - Complete **Monthly Budget Planning & Utilization Analysis** module handling categories with budgets & expenses, budgets with zero expenses, and unbudgeted categories with expenses.
   - **Weekly, Monthly, and Yearly Financial Reports** with interactive charts and category filter parity.
   - Separate **Administrator Console** for user account activation/deactivation, soft-deactivatable expense categories, system settings (configurable budget warning threshold), aggregate system statistics, and immutable **Audit Logs**.

---

## 2. Access Control & Security Matrix

| Capability | Guest (Unauthenticated) | Registered User (`role = 'user'`) | Administrator (`role = 'admin'`) |
| :--- | :---: | :---: | :---: |
| View Public Landing & Prototype Overview | Yes | Yes | Yes |
| Register & Authenticate | Yes | Yes | Yes |
| Personal Dashboard, Income, Expenses, Budgets, Reports | No | Own Records Only (`user_id` enforced) | Own Records Only |
| Access Another User's Financial Transactions by ID/URL | No | Blocked (`403/404`) | Blocked (Aggregate stats only) |
| Manage Users (Activate / Deactivate Accounts) | No | No | Yes (Logged in `audit_logs`) |
| Retrieve or View User Passwords / Hashes | No | No | Strictly Prohibited |
| Manage Expense Categories (Add / Edit / Deactivate) | No | No | Yes (Soft-deactivation preserves history) |
| Configure System Settings (Warning Threshold %) | No | No | Yes (Logged in `audit_logs`) |
| View Administrative Audit Logs | No | No | Yes |

---

## 3. Database Schema Specification (`database/schema.sql`)

1. **`users`**: `id` (PK), `name`, `email` (UNIQUE), `password_hash`, `role` (`'user'|'admin'`), `status` (`'active'|'inactive'`), `created_at`, `updated_at`.
2. **`categories`**: `id` (PK), `name` (UNIQUE case-insensitive), `description`, `is_active` (`TINYINT(1)`), `created_at`, `updated_at`.
   - *Historical Integrity Rule*: Categories referenced by existing transactions or budgets cannot be hard-deleted; they are deactivated (`is_active = 0`) so historical reports remain 100% accurate while preventing new expenses from being assigned to inactive categories.
3. **`transactions`**: `id` (PK), `user_id` (FK -> `users.id`), `type` (`'income'|'expense'`), `amount` (`DECIMAL(12,2) CHECK (amount > 0)`), `category_id` (FK -> `categories.id`, NULL for income), `income_source` (VARCHAR, populated for income), `description`, `transaction_date` (`DATE`), `payment_method` (ENUM: `Cash`, `UPI`, `Debit card`, `Credit card`, `Bank transfer`, `Other`, NULL for income), `notes`, `created_at`, `updated_at`.
4. **`budgets`**: `id` (PK), `user_id` (FK), `category_id` (FK), `budget_month` (`CHAR(7)` `YYYY-MM`), `budget_amount` (`DECIMAL(12,2) CHECK (budget_amount > 0)`), `created_at`, `updated_at`.
   - *Uniqueness Constraint*: `UNIQUE KEY uq_budgets_user_cat_month (user_id, category_id, budget_month)`.
5. **`system_settings`**: `setting_key` (PK), `setting_value`, `description`, `updated_by`, `updated_at`.
6. **`audit_logs`**: `id` (PK), `actor_user_id` (FK), `action`, `target_type`, `target_id`, `metadata_json`, `timestamp`.
7. **`login_attempts`**: `id` (PK), `email`, `ip_address`, `attempted_at`, `was_successful`.

---

## 4. Verification & QA Test Suite Summary

All core functional and security requirements are verified:
- **TC-01 (Auth & Role Safety)**: Registration rejects weak passwords, duplicate emails, and ignores any tampered `role=admin` payload field.
- **TC-02 (Login Throttling)**: 5 failed login attempts within 15 minutes trigger a `429 Too Many Requests` lockout response.
- **TC-03 (Per-Record Ownership Isolation)**: Attempting to edit or delete another user's transaction or budget ID returns `404 Not Found / 403 Forbidden` with zero database mutation.
- **TC-04 (Inactive Category Protection)**: Attempting to log an expense against an inactive category ID is rejected by server-side validation, while historical transactions in that category still render in reports.
- **TC-05 (Budget Math & Thresholds)**:
  - ₹10,000 budget with ₹7,500 spent -> `75.0%` utilization, `₹2,500.00` remaining (`Nominal`).
  - ₹10,000 budget with ₹8,500 spent -> `85.0%` utilization, `₹1,500.00` remaining (`Approaching Limit` at 80% threshold).
  - ₹10,000 budget with ₹11,000 spent -> `110.0%` utilization, `−₹1,000.00` remaining (`Exceeded Limit`).
