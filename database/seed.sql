-- ============================================================================
-- LEDGER — EXPENSE TRACKER WITH BUDGET ANALYSIS (PROJECT REF: ETBA-2026)
-- Optional Demonstration Seed Data: database/seed.sql
--
-- IMPORTANT SECURITY & USAGE NOTE:
-- 1. All records in this file are clearly marked [DEMO] and belong to a
--    demonstration student account (`sanjay.demo@mitindia.edu`).
-- 2. Do NOT import this file in production.
-- 3. Administrator accounts are provisioned via `php scripts/create_admin.php`
--    so that no publicly known default admin password is ever shipped.
-- ============================================================================

USE `ledger_etba`;

START TRANSACTION;

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `status`)
VALUES (
  101,
  'Sanjay N (Demo Account)',
  'sanjay.demo@mitindia.edu',
  '$2y$12$LockedDemoAccountUseCliScriptOrRegisterNewUserAccount00000',
  'user',
  'active'
) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `budgets` (`user_id`, `category_id`, `budget_month`, `budget_amount`)
SELECT 101, `id`, '2026-10',
  CASE `name`
    WHEN 'Food' THEN 8000.00
    WHEN 'Travel' THEN 3000.00
    WHEN 'Shopping' THEN 5000.00
    WHEN 'Bills' THEN 6500.00
    WHEN 'Healthcare' THEN 2500.00
    WHEN 'Entertainment' THEN 1500.00
    WHEN 'Education' THEN 6000.00
    ELSE 2000.00
  END
FROM `categories`
WHERE `name` IN ('Food', 'Travel', 'Shopping', 'Bills', 'Healthcare', 'Entertainment', 'Education')
ON DUPLICATE KEY UPDATE `budget_amount` = VALUES(`budget_amount`);

INSERT INTO `transactions`
  (`user_id`, `type`, `amount`, `category_id`, `income_source`, `description`, `transaction_date`, `payment_method`, `notes`)
VALUES
  (101, 'income', 45000.00, NULL, 'Salary', '[DEMO] Monthly Software Engineering Stipend', '2026-10-01', NULL, 'Credited via NEFT'),
  (101, 'income', 8500.00, NULL, 'Scholarship', '[DEMO] Merit Academic Scholarship Grant', '2026-10-05', NULL, 'Semester grant installment'),
  (101, 'expense', 2450.00, (SELECT id FROM categories WHERE name='Food'), NULL, '[DEMO] Nilgiris Supermarket Monthly Groceries', '2026-10-03', 'UPI', 'Rice, pulses, dairy, vegetables'),
  (101, 'expense', 650.00, (SELECT id FROM categories WHERE name='Travel'), NULL, '[DEMO] Chennai Metro Rail Smart Card Recharge', '2026-10-04', 'UPI', 'Monthly commute Chromepet to Guindy'),
  (101, 'expense', 2180.00, (SELECT id FROM categories WHERE name='Bills'), NULL, '[DEMO] TANGEDCO Bi-Monthly Electricity Bill', '2026-10-06', 'Bank transfer', 'Consumer service connection'),
  (101, 'expense', 999.00, (SELECT id FROM categories WHERE name='Bills'), NULL, '[DEMO] ACT Fibernet Broadband Plan', '2026-10-07', 'UPI', '150 Mbps unlimited student plan'),
  (101, 'expense', 3500.00, (SELECT id FROM categories WHERE name='Education'), NULL, '[DEMO] NPTEL / Cloud Architecture Certification Fee', '2026-10-10', 'Debit card', 'Exam registration and reference book'),
  (101, 'expense', 199.00, (SELECT id FROM categories WHERE name='Entertainment'), NULL, '[DEMO] Netflix Mobile Subscription', '2026-10-12', 'UPI', 'Monthly auto-pay'),
  (101, 'expense', 3120.00, (SELECT id FROM categories WHERE name='Food'), NULL, '[DEMO] Campus Mess & Canteen Dining', '2026-10-15', 'UPI', 'First half-month meal charges'),
  (101, 'expense', 2890.00, (SELECT id FROM categories WHERE name='Bills'), NULL, '[DEMO] Shared Hostel / Apartment Maintenance & Water', '2026-10-18', 'Bank transfer', 'October share'),
  (101, 'expense', 1840.00, (SELECT id FROM categories WHERE name='Shopping'), NULL, '[DEMO] USB-C Hub and Notebook Supplies', '2026-10-20', 'Debit card', 'Purchased at Anna Salai electronics store');

COMMIT;
