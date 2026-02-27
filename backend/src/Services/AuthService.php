<?php

declare(strict_types=1);

namespace App\Services;

use App\Database;
use DateInterval;
use DateTimeImmutable;
use PDO;

class AuthService
{
    public function authenticateFromRequest(): ?array
    {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return null;
        }

        $token = substr($authHeader, 7);
        if ($token === '') {
            return null;
        }

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare(
            'SELECT u.id, u.name, u.phone, u.role
             FROM auth_tokens t
             JOIN users u ON u.id = t.user_id
             WHERE t.token = :token AND t.expires_at > NOW()'
        );
        $stmt->execute(['token' => $token]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    public function createToken(int $userId): string
    {
        $token = bin2hex(random_bytes(32));

        $now = new DateTimeImmutable();
        $expiresAt = $now->add(new DateInterval('PT' . (TOKEN_TTL_HOURS * 60) . 'M'));

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO auth_tokens (user_id, token, expires_at, created_at)
             VALUES (:user_id, :token, :expires_at, NOW())'
        );
        $stmt->execute([
            'user_id' => $userId,
            'token' => $token,
            'expires_at' => $expiresAt->format('Y-m-d H:i:s'),
        ]);

        return $token;
    }

    public function revokeToken(string $token): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('DELETE FROM auth_tokens WHERE token = :token');
        $stmt->execute(['token' => $token]);
    }
}

