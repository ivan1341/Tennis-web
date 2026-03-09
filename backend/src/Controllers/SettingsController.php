<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;

class SettingsController
{
    /** @var array<string, mixed>|null */
    private ?array $user;

    /**
     * @param array<string, mixed>|null $user
     */
    public function __construct(?array $user = null)
    {
        $this->user = $user;
    }

    /**
     * @param array<string, mixed> $input
     */
    public function getContact(array $input): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT setting_value FROM app_settings WHERE setting_key = :key LIMIT 1');
        $stmt->execute(['key' => 'contact_email']);
        $value = $stmt->fetchColumn();
        $email = is_string($value) && $value !== '' ? $value : 'info@escaleramundet.com';

        http_response_code(200);
        echo json_encode(['contact_email' => $email]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function setContact(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden editar la configuración']);
            return;
        }

        $email = trim((string)($input['contact_email'] ?? ''));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(422);
            echo json_encode(['error' => 'Debes ingresar un correo válido']);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO app_settings (setting_key, setting_value, created_at, updated_at)
             VALUES (:key, :value, NOW(), NOW())
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()'
        );
        $stmt->execute([
            'key' => 'contact_email',
            'value' => $email,
        ]);

        http_response_code(200);
        echo json_encode([
            'message' => 'Contacto actualizado correctamente',
            'contact_email' => $email,
        ]);
    }
}

