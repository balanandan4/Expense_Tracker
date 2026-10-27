# Ledger — Expense Tracker with Budget Analysis (Project ETBA-2026)

A complete, database-connected personal finance management web application engineered for tracking Indian Rupee (`INR`, `₹`) income and expenses, planning monthly category budgets, monitoring real-time budget utilization thresholds, generating weekly/monthly/yearly financial reports, and administering system categories, users, and audit logs.

---

## 1. Architecture & Dual-Runtime Support

This repository supports **two execution modes** out of the box:

1. **XAMPP Local Deployment (PHP 8.2+ & MySQL 8.0+ / MariaDB)**
   - **Database Schema & Seed**: `database/schema.sql` and `database/seed.sql`
   - **PDO Configuration**: `config/database.example.php` (copy to `config/database.php`)
   - **Backend Core & Controllers**: `app/Core/Database.php`, `app/Controllers/ApiController.php`
   - **CLI First-Admin Provisioning**: `scripts/create_admin.php`
   - **Apache Security Rules**: `.htaccess` (blocks public access to `.sql`, `config/`, `app/`, and `scripts/`)

2. **Interactive Full-Stack Cloud Preview (Port 3000)**
   - Runs live in the browser preview using `server.ts` (Express REST API with file-backed transactional relational storage mirroring the exact `schema.sql` tables, constraints, `DECIMAL(12,2)` arithmetic, password hashing, CSRF tokens, login throttling, and RBAC) + Gemini financial intelligence (`@google/genai`).

---

## 2. Local XAMPP Setup Instructions

### Step 1: Place Project in XAMPP `htdocs`
Copy or clone this repository into your XAMPP web root:
```bash
C:\xampp\htdocs\ledger\
# or on Linux/macOS:
/opt/lampp/htdocs/ledger/
```

### Step 2: Start Apache and MySQL
Open the **XAMPP Control Panel** and start both **Apache** and **MySQL**.

### Step 3: Import the MySQL Schema
Open **phpMyAdmin** (`http://localhost/phpmyadmin`) or run via MySQL CLI:
```bash
mysql -u root -p < database/schema.sql
```
*(Optional)* To load clearly marked `[DEMO]` transactions for testing:
```bash
mysql -u root -p ledger_etba < database/seed.sql
```

### Step 4: Configure Database Credentials
Copy `config/database.example.php` to `config/database.php` and set your MySQL credentials:
```php
return [
    'host'     => '127.0.0.1',
    'port'     => 3306,
    'database' => 'ledger_etba',
    'username' => 'root',
    'password' => '',
    'charset'  => 'utf8mb4',
    'timezone' => '+05:30',
];
```

### Step 5: Provision the First Administrator Account (Secure CLI Procedure)
In accordance with security best practices, Ledger **never ships a publicly known default administrator password** in SQL dumps. To create or promote your first administrator account, run:
```bash
php scripts/create_admin.php "System Administrator" "admin@mitindia.edu" "YourStrongPass#2026"
```

---

## 3. Core Financial Formulas & Business Rules

- **Period Net Savings**:
  $$\text{Net Savings} = \text{Total Income} - \text{Total Expenses}$$
  *(Explicitly labelled as a period-based net figure, never a bank account balance).*
- **Monthly Category Budget Remaining**:
  $$\text{Budget Remaining} = \text{Budget Amount} - \text{Actual Category Spending}$$
- **Monthly Category Budget Utilization (%)**:
  $$\text{Utilization (\%)} = \left(\frac{\text{Actual Category Spending}}{\text{Budget Amount}}\right) \times 100 \quad (\text{where } \text{Budget Amount} > 0)$$
- **Threshold Warnings**:
  - **Normal (`< Threshold`, default `< 80%`)**: Nominal spending pace.
  - **Approaching Limit (`>= Threshold` and `< 100%`)**: Amber warning indicator.
  - **Reached / Exceeded (`>= 100%`)**: Coral overspending alert with exact over-budget amount (`−₹...`).
