<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use PDO;

class AdminUserController
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

    private function isValidPhone(string $phone): bool
    {
        return (bool)preg_match('/^\d{1,10}$/', $phone);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function store(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden crear usuarios']);
            return;
        }

        $name = trim((string)($input['name'] ?? ''));
        $phone = trim((string)($input['phone'] ?? ''));
        $password = (string)($input['password'] ?? '');
        $role = (string)($input['role'] ?? 'user');

        if ($name === '' || $phone === '' || $password === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nombre, teléfono y contraseña son obligatorios']);
            return;
        }
        if (!$this->isValidPhone($phone)) {
            http_response_code(422);
            echo json_encode(['error' => 'El teléfono debe contener solo números y máximo 10 dígitos']);
            return;
        }

        if (!in_array($role, ['admin', 'user'], true)) {
            $role = 'user';
        }

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = :phone');
        $stmt->execute(['phone' => $phone]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'El teléfono ya está registrado']);
            return;
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);

        $stmt = $pdo->prepare(
            'INSERT INTO users (name, phone, password_hash, role, created_at, updated_at)
             VALUES (:name, :phone, :password_hash, :role, NOW(), NOW())'
        );
        $stmt->execute([
            'name' => $name,
            'phone' => $phone,
            'password_hash' => $hash,
            'role' => $role,
        ]);

        $userId = (int)$pdo->lastInsertId();

        http_response_code(201);
        echo json_encode([
            'id' => $userId,
            'name' => $name,
            'phone' => $phone,
            'role' => $role,
        ]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function index(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden ver usuarios']);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->query(
            'SELECT id, name, phone, role, created_at, updated_at
             FROM users
             ORDER BY created_at DESC'
        );

        http_response_code(200);
        echo json_encode(['users' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function update(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden editar usuarios']);
            return;
        }

        $userId = (int)($input['id'] ?? 0);
        $name = trim((string)($input['name'] ?? ''));
        $phone = trim((string)($input['phone'] ?? ''));
        $role = (string)($input['role'] ?? 'user');

        if ($userId <= 0 || $name === '' || $phone === '') {
            http_response_code(422);
            echo json_encode(['error' => 'id, nombre y teléfono son obligatorios']);
            return;
        }
        if (!$this->isValidPhone($phone)) {
            http_response_code(422);
            echo json_encode(['error' => 'El teléfono debe contener solo números y máximo 10 dígitos']);
            return;
        }

        if (!in_array($role, ['admin', 'user'], true)) {
            $role = 'user';
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT id FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuario no encontrado']);
            return;
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = :phone AND id <> :id');
        $stmt->execute([
            'phone' => $phone,
            'id' => $userId,
        ]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'El teléfono ya está registrado']);
            return;
        }

        $stmt = $pdo->prepare(
            'UPDATE users
             SET name = :name, phone = :phone, role = :role, updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $userId,
            'name' => $name,
            'phone' => $phone,
            'role' => $role,
        ]);

        http_response_code(200);
        echo json_encode([
            'id' => $userId,
            'name' => $name,
            'phone' => $phone,
            'role' => $role,
        ]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function resetPassword(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden resetear contraseñas']);
            return;
        }

        $userId = (int)($input['user_id'] ?? 0);
        $password = (string)($input['password'] ?? '');

        if ($userId <= 0 || $password === '') {
            http_response_code(422);
            echo json_encode(['error' => 'user_id y password son obligatorios']);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT id FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuario no encontrado']);
            return;
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare(
            'UPDATE users
             SET password_hash = :password_hash, updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $userId,
            'password_hash' => $hash,
        ]);

        http_response_code(200);
        echo json_encode(['message' => 'Contraseña actualizada correctamente']);
    }
}

