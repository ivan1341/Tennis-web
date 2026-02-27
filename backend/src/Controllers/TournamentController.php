<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use PDO;

class TournamentController
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
    public function index(array $input): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->query(
            'SELECT id, name, start_date, end_date, participants_count, groups_count, rounds_count
             FROM tournaments
             ORDER BY start_date DESC'
        );
        $tournaments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode(['tournaments' => $tournaments]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function store(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden crear torneos']);
            return;
        }

        $name = trim((string)($input['name'] ?? ''));
        $startDate = (string)($input['start_date'] ?? '');
        $endDate = (string)($input['end_date'] ?? '');
        $participants = (int)($input['participants_count'] ?? 0);
        $groups = (int)($input['groups_count'] ?? 0);
        $rounds = (int)($input['rounds_count'] ?? 0);

        if ($name === '' || $startDate === '' || $endDate === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nombre y fechas de inicio/fin son obligatorios']);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO tournaments (name, start_date, end_date, participants_count, groups_count, rounds_count, created_at, updated_at)
             VALUES (:name, :start_date, :end_date, :participants_count, :groups_count, :rounds_count, NOW(), NOW())'
        );
        $stmt->execute([
            'name' => $name,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'participants_count' => $participants,
            'groups_count' => $groups,
            'rounds_count' => $rounds,
        ]);

        $id = (int)$pdo->lastInsertId();

        http_response_code(201);
        echo json_encode([
            'tournament' => [
                'id' => $id,
                'name' => $name,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'participants_count' => $participants,
                'groups_count' => $groups,
                'rounds_count' => $rounds,
            ],
        ]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function update(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden editar torneos']);
            return;
        }

        $id = (int)($input['id'] ?? 0);
        $name = trim((string)($input['name'] ?? ''));
        $startDate = (string)($input['start_date'] ?? '');
        $endDate = (string)($input['end_date'] ?? '');
        $participants = (int)($input['participants_count'] ?? 0);
        $groups = (int)($input['groups_count'] ?? 0);
        $rounds = (int)($input['rounds_count'] ?? 0);

        if ($id <= 0 || $name === '' || $startDate === '' || $endDate === '') {
            http_response_code(422);
            echo json_encode(['error' => 'ID, nombre y fechas de inicio/fin son obligatorios']);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'UPDATE tournaments
             SET name = :name,
                 start_date = :start_date,
                 end_date = :end_date,
                 participants_count = :participants_count,
                 groups_count = :groups_count,
                 rounds_count = :rounds_count,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'name' => $name,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'participants_count' => $participants,
            'groups_count' => $groups,
            'rounds_count' => $rounds,
        ]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Torneo no encontrado']);
            return;
        }

        http_response_code(200);
        echo json_encode([
            'tournament' => [
                'id' => $id,
                'name' => $name,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'participants_count' => $participants,
                'groups_count' => $groups,
                'rounds_count' => $rounds,
            ],
        ]);
    }
}

