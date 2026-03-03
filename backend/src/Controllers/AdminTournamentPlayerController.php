<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use PDO;

class AdminTournamentPlayerController
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
    public function assignMany(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden asignar jugadores']);
            return;
        }

        $userId = (int)($input['user_id'] ?? 0);
        $groupNumber = (int)($input['group_number'] ?? 0);
        $tournamentIdsRaw = $input['tournament_ids'] ?? [];

        if ($userId <= 0 || $groupNumber <= 0 || !is_array($tournamentIdsRaw) || count($tournamentIdsRaw) === 0) {
            http_response_code(422);
            echo json_encode(['error' => 'user_id, group_number y tournament_ids son obligatorios']);
            return;
        }

        $tournamentIds = array_values(array_unique(array_map(static fn($id) => (int)$id, $tournamentIdsRaw)));
        $tournamentIds = array_values(array_filter($tournamentIds, static fn($id) => $id > 0));

        if (count($tournamentIds) === 0) {
            http_response_code(422);
            echo json_encode(['error' => 'Debes enviar al menos un torneo válido']);
            return;
        }

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('SELECT id FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuario no encontrado']);
            return;
        }

        $placeholders = implode(',', array_fill(0, count($tournamentIds), '?'));
        $stmt = $pdo->prepare("SELECT id FROM tournaments WHERE id IN ($placeholders)");
        $stmt->execute($tournamentIds);
        $existingTournamentIds = array_map(static fn($row) => (int)$row['id'], $stmt->fetchAll(PDO::FETCH_ASSOC));

        if (count($existingTournamentIds) !== count($tournamentIds)) {
            http_response_code(404);
            echo json_encode(['error' => 'Uno o más torneos no existen']);
            return;
        }

        $stmt = $pdo->prepare(
            'INSERT INTO tournament_players (tournament_id, user_id, group_number, created_at, updated_at)
             VALUES (:tournament_id, :user_id, :group_number, NOW(), NOW())
             ON DUPLICATE KEY UPDATE group_number = VALUES(group_number), updated_at = NOW()'
        );

        foreach ($tournamentIds as $tournamentId) {
            $stmt->execute([
                'tournament_id' => $tournamentId,
                'user_id' => $userId,
                'group_number' => $groupNumber,
            ]);
        }

        http_response_code(200);
        echo json_encode([
            'message' => 'Jugador asignado correctamente',
            'user_id' => $userId,
            'group_number' => $groupNumber,
            'tournament_ids' => $tournamentIds,
        ]);
    }
}

