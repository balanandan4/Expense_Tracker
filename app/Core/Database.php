<?php
/**
 * Ledger — Expense Tracker with Budget Analysis (Project ETBA-2026)
 * PDO Database Connection Singleton & Security Helpers
 */

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use RuntimeException;

final class Database
{
    private static ?PDO $instance = null;

    public static function getConnection(): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $configFile = dirname(__DIR__, 2) . '/config/database.php';
        if (!file_exists($configFile)) {
            $configFile = dirname(__DIR__, 2) . '/config/database.example.php';
        }

        $config = require $configFile;
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $config['host'],
            $config['port'],
            $config['database'],
            $config['charset']
        );

        try {
            $pdo = new PDO($dsn, $config['username'], $config['password'], $config['options']);
            if (!empty($config['timezone'])) {
                $stmt = $pdo->prepare('SET time_zone = :tz');
                $stmt->execute([':tz' => $config['timezone']]);
            }
            self::$instance = $pdo;
            return $pdo;
        } catch (PDOException $e) {
            error_log('[Ledger DB Error] ' . $e->getMessage());
            throw new RuntimeException('Database connection failed. Verify config/database.php and MySQL service.');
        }
    }
}

final class Security
{
    public static function startSecureSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['SERVER_PORT'] ?? null) == 443);

        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $isHttps,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        session_name('LEDGER_ETBA_SESSID');
        session_start();
    }

    public static function regenerateSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }
    }

    public static function csrfToken(): string
    {
        self::startSecureSession();
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    public static function verifyCsrfToken(?string $token): bool
    {
        self::startSecureSession();
        if (empty($_SESSION['csrf_token']) || empty($token)) {
            return false;
        }
        return hash_equals($_SESSION['csrf_token'], $token);
    }

    public static function escape(?string $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    public static function formatInr(float|string $amount): string
    {
        $num = (float) $amount;
        $isNegative = $num < 0;
        $abs = abs($num);
        $parts = explode('.', number_format($abs, 2, '.', ''));
        $intPart = $parts[0];
        $decPart = $parts[1] ?? '00';

        if (strlen($intPart) > 3) {
            $lastThree = substr($intPart, -3);
            $otherNumbers = substr($intPart, 0, -3);
            $otherNumbers = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $otherNumbers);
            $formatted = $otherNumbers . ',' . $lastThree . '.' . $decPart;
        } else {
            $formatted = $intPart . '.' . $decPart;
        }

        return ($isNegative ? '−₹' : '₹') . $formatted;
    }
}
