-- ============================================================================
-- LEDGER — EXPENSE TRACKER WITH BUDGET ANALYSIS (PROJECT REF: ETBA-2026)
-- Database Schema: MySQL 8.0+ / MariaDB 10.6+
-- Character Set: utf8mb4 (Full Unicode & Indian Rupee ₹ symbol support)
-- Timezone Convention: Asia/Kolkata (IST, UTC+05:30) or UTC stored consistently
-- Monetary Precision: DECIMAL(12,2) — Never FLOAT/DOUBLE
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `ledger_etba`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `ledger_etba`;

-- ----------------------------------------------------------------------------
-- 1. TABLE: users
-- Stores registered users and administrators.
-- Role cannot be self-assigned during public registration; defaults to 'user'.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role_status` (`role`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. TABLE: categories
-- Stores administrator-managed expense categories.
-- Soft deactivation via `is_active` preserves historical transaction integrity.
-- Case-insensitive uniqueness on `name` via utf8mb4_unicode_ci collation.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name`),
  KEY `idx_categories_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. TABLE: transactions
-- Stores both income and expense entries belonging to a specific user.
-- For 'income': `income_source` is populated, `category_id` and `payment_method` are NULL.
-- For 'expense': `category_id` and `payment_method` are required.
-- `amount` uses DECIMAL(12,2) and must be strictly > 0.00.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `type` ENUM('income', 'expense') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `category_id` INT UNSIGNED DEFAULT NULL,
  `income_source` VARCHAR(100) DEFAULT NULL,
  `description` VARCHAR(255) NOT NULL,
  `transaction_date` DATE NOT NULL,
  `payment_method` ENUM('Cash', 'UPI', 'Debit card', 'Credit card', 'Bank transfer', 'Other') DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tx_user_date` (`user_id`, `transaction_date`),
  KEY `idx_tx_user_type_date` (`user_id`, `type`, `transaction_date`),
  KEY `idx_tx_category` (`category_id`),
  CONSTRAINT `fk_tx_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tx_category`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_tx_amount_positive`
    CHECK (`amount` > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. TABLE: budgets
-- Monthly category budget targets per user.
-- `budget_month` is stored in 'YYYY-MM' format (CHAR(7)).
-- Enforces unique combination of (user_id, category_id, budget_month).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `budgets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `category_id` INT UNSIGNED NOT NULL,
  `budget_month` CHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
  `budget_amount` DECIMAL(12,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budgets_user_cat_month` (`user_id`, `category_id`, `budget_month`),
  KEY `idx_budgets_user_month` (`user_id`, `budget_month`),
  CONSTRAINT `fk_budgets_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_budgets_category`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_budget_amount_positive`
    CHECK (`budget_amount` > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. TABLE: system_settings
-- Stores safe, administrator-configurable application settings
-- (e.g., budget warning threshold %, maintenance banner, max login attempts).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` VARCHAR(64) NOT NULL,
  `setting_value` VARCHAR(255) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `updated_by` INT UNSIGNED DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`),
  CONSTRAINT `fk_settings_updated_by`
    FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. TABLE: audit_logs
-- Immutable log of administrative actions (user status changes, category edits,
-- system setting updates, authorized admin inspections).
-- Never stores plaintext passwords, password hashes, or session tokens.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_user_id` INT UNSIGNED NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50) NOT NULL,
  `target_id` VARCHAR(64) DEFAULT NULL,
  `metadata_json` JSON DEFAULT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_actor_time` (`actor_user_id`, `timestamp`),
  KEY `idx_audit_action` (`action`),
  CONSTRAINT `fk_audit_actor`
    FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. TABLE: login_attempts
-- Tracks failed authentication attempts for login throttling & lockout defense.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(190) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `attempted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `was_successful` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_login_email_time` (`email`, `attempted_at`),
  KEY `idx_login_ip_time` (`ip_address`, `attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- REQUIRED DEFAULT CATEGORIES & SYSTEM SETTINGS
-- ----------------------------------------------------------------------------
INSERT INTO `categories` (`name`, `description`, `is_active`) VALUES
  ('Food', 'Groceries, dining out, cloud kitchens, and daily meals', 1),
  ('Travel', 'Metro card, fuel, auto/cab rides, train and flight tickets', 1),
  ('Shopping', 'Apparel, electronics, household items, and personal care', 1),
  ('Bills', 'Electricity, broadband, mobile recharge, rent, and water bills', 1),
  ('Healthcare', 'Medicines, doctor consultations, diagnostics, and insurance', 1),
  ('Entertainment', 'OTT subscriptions, movies, books, events, and hobbies', 1),
  ('Education', 'Course fees, textbooks, certifications, and academic supplies', 1),
  ('Other', 'Miscellaneous and uncategorized personal expenses', 1)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`);

INSERT INTO `system_settings` (`setting_key`, `setting_value`, `description`) VALUES
  ('budget_warning_threshold', '80', 'Percentage of monthly category budget at which approaching-limit warnings trigger (50-99)'),
  ('currency_code', 'INR', 'Primary system currency code (ISO 4217)'),
  ('currency_symbol', '₹', 'Primary system currency display symbol'),
  ('login_max_attempts', '5', 'Maximum failed login attempts allowed within the lockout window'),
  ('login_lockout_minutes', '15', 'Lockout duration in minutes after exceeding max failed login attempts'),
  ('allow_registration', '1', 'Whether new public user account registrations are enabled (1 = Yes, 0 = No)')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`);
