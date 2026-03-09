<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use App\Services\AuthService;
use PDO;

class AuthController
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
    public function register(array $input): void
    {
        $name = trim((string)($input['name'] ?? ''));
        $phone = trim((string)($input['phone'] ?? ''));
        $password = (string)($input['password'] ?? '');

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
            'role' => 'user',
        ]);

        $userId = (int)$pdo->lastInsertId();

        $authService = new AuthService();
        $token = $authService->createToken($userId);

        http_response_code(201);
        echo json_encode([
            'token' => $token,
            'user' => [
                'id' => $userId,
                'name' => $name,
                'phone' => $phone,
                'role' => 'user',
            ],
        ]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function login(array $input): void
    {
        $phone = trim((string)($input['phone'] ?? ''));
        $password = (string)($input['password'] ?? '');

        if ($phone === '' || $password === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Teléfono y contraseña son obligatorios']);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT id, name, phone, password_hash, role FROM users WHERE phone = :phone');
        $stmt->execute(['phone' => $phone]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, (string)$user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Credenciales inválidas']);
            return;
        }

        $authService = new AuthService();
        $token = $authService->createToken((int)$user['id']);

        http_response_code(200);
        echo json_encode([
            'token' => $token,
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'phone' => $user['phone'],
                'role' => $user['role'],
            ],
        ]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function logout(array $input): void
    {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;

        if ($authHeader && str_starts_with($authHeader, 'Bearer ')) {
            $token = substr($authHeader, 7);
            $authService = new AuthService();
            $authService->revokeToken($token);
        }

        http_response_code(204);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function me(array $input): void
    {
        if ($this->user === null) {
            http_response_code(401);
            echo json_encode(['error' => 'No autenticado']);
            return;
        }

        http_response_code(200);
        echo json_encode(['user' => $this->user]);
    }
}

