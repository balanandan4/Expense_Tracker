<?php
/**
 * Ledger — Expense Tracker with Budget Analysis (Project ETBA-2026)
 * Database Configuration Template
 *
 * SETUP INSTRUCTIONS FOR XAMPP:
 * 1. Copy this file to `config/database.php` (which is git-ignored).
 * 2. Update DB_HOST, DB_NAME, DB_USER, and DB_PASS for your local MySQL setup.
 * 3. Never commit `config/database.php` with real credentials to version control.
 */

declare(strict_types=1);

return [
    'host'     => getenv('LEDGER_DB_HOST') ?: '127.0.0.1',
    'port'     => (int) (getenv('LEDGER_DB_PORT') ?: 3306),
    'database' => getenv('LEDGER_DB_NAME') ?: 'ledger_etba',
    'username' => getenv('LEDGER_DB_USER') ?: 'root',
    'password' => getenv('LEDGER_DB_PASS') ?: '',
    'charset'  => 'utf8mb4',
    'timezone' => '+05:30', // Indian Standard Time (IST)
    'options'  => [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ],
];
