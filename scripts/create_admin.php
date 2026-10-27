<?php
/**
 * Ledger — Expense Tracker with Budget Analysis (Project ETBA-2026)
 * First Administrator Provisioning Script (CLI Only)
 *
 * SECURITY RATIONALE:
 * This project never ships a hardcoded or publicly known default administrator
 * password. Run this script from the command line in XAMPP to create or promote
 * the initial administrator account securely:
 *
 * Usage:
 *   php scripts/create_admin.php "Admin Name" "admin@domain.edu" "StrongPassword#2026"
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden: This script may only be executed from the command line.');
}

require_once dirname(__DIR__) . '/app/Core/Database.php';

use App\Core\Database;

if ($argc < 4) {
    fwrite(STDERR, "Usage: php scripts/create_admin.php \"<Full Name>\" \"<Email>\" \"<Password>\"\n");
    exit(1);
}

$name = trim($argv[1]);
$email = strtolower(trim($argv[2]));
$password = $argv[3];

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Error: Invalid email format.\n");
    exit(1);
}

if (strlen($password) < 8 || !preg_match('/[A-Z]/', $password) || !preg_match('/[0-9]/', $password)) {
    fwrite(STDERR, "Error: Password must be at least 8 characters and include at least 1 uppercase letter and 1 number.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$pdo = Database::getConnection();

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('
        INSERT INTO users (name, email, password_hash, role, status)
        VALUES (:name, :email, :hash, \'admin\', \'active\')
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            password_hash = VALUES(password_hash),
            role = \'admin\',
            status = \'active\'
    ');
    $stmt->execute([
        ':name'  => $name,
        ':email' => $email,
        ':hash'  => $hash,
    ]);

    $adminId = (int) ($pdo->lastInsertId() ?: $pdo->query("SELECT id FROM users WHERE email = " . $pdo->quote($email))->fetchColumn());

    $auditStmt = $pdo->prepare('
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata_json)
        VALUES (:actor, :action, :type, :tid, :meta)
    ');
    $auditStmt->execute([
        ':actor'  => $adminId,
        ':action' => 'ADMIN_PROVISIONED_CLI',
        ':type'   => 'user',
        ':tid'    => (string) $adminId,
        ':meta'   => json_encode(['email' => $email, 'method' => 'cli_script']),
    ]);

    $pdo->commit();
    fwrite(STDOUT, "Success: Administrator account provisioned for {$email} (User ID: {$adminId}).\n");
} catch (Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, "Failed to provision administrator: " . $e->getMessage() . "\n");
    exit(1);
}
