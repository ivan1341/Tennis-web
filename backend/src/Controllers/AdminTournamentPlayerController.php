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
            'INSERT INTO tournament_players (tournament_id, user_id, group_number, position_index, created_at, updated_at)
             VALUES (:tournament_id, :user_id, :group_number, :position_index, NOW(), NOW())
             ON DUPLICATE KEY UPDATE group_number = VALUES(group_number), position_index = VALUES(position_index), updated_at = NOW()'
        );

        foreach ($tournamentIds as $tournamentId) {
            $stmtTournament = $pdo->prepare('SELECT groups_count FROM tournaments WHERE id = :id');
            $stmtTournament->execute(['id' => $tournamentId]);
            $tournament = $stmtTournament->fetch(PDO::FETCH_ASSOC);

            if (!$tournament) {
                http_response_code(404);
                echo json_encode(['error' => 'Torneo no encontrado']);
                return;
            }

            $groupsCount = (int)($tournament['groups_count'] ?? 0);
            if ($groupNumber > $groupsCount) {
                http_response_code(422);
                echo json_encode(['error' => 'El grupo seleccionado no existe en uno de los torneos']);
                return;
            }

            $stmtCurrent = $pdo->prepare(
                'SELECT group_number
                 FROM tournament_players
                 WHERE tournament_id = :tournament_id AND user_id = :user_id'
            );
            $stmtCurrent->execute([
                'tournament_id' => $tournamentId,
                'user_id' => $userId,
            ]);
            $currentGroup = (int)($stmtCurrent->fetch(PDO::FETCH_ASSOC)['group_number'] ?? 0);

            if ($currentGroup !== $groupNumber) {
                $stmtGroupSize = $pdo->prepare(
                    'SELECT COUNT(*) AS total
                     FROM tournament_players
                     WHERE tournament_id = :tournament_id
                       AND group_number = :group_number'
                );
                $stmtGroupSize->execute([
                    'tournament_id' => $tournamentId,
                    'group_number' => $groupNumber,
                ]);

                $groupSize = (int)($stmtGroupSize->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);
                if ($groupSize >= 5) {
                    http_response_code(422);
                    echo json_encode(['error' => 'Cada grupo puede tener máximo 5 jugadores']);
                    return;
                }
            }

            $stmtPos = $pdo->prepare(
                'SELECT COALESCE(MAX(position_index), 0) AS max_position
                 FROM tournament_players
                 WHERE tournament_id = :tournament_id
                   AND group_number = :group_number'
            );
            $stmtPos->execute([
                'tournament_id' => $tournamentId,
                'group_number' => $groupNumber,
            ]);
            $nextPosition = (int)($stmtPos->fetch(PDO::FETCH_ASSOC)['max_position'] ?? 0) + 1;

            $stmt->execute([
                'tournament_id' => $tournamentId,
                'user_id' => $userId,
                'group_number' => $groupNumber,
                'position_index' => $nextPosition,
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

    /**
     * @param array<string, mixed> $input
     */
    public function sync(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden editar participantes']);
            return;
        }

        $tournamentId = (int)($input['tournament_id'] ?? 0);
        $playersRaw = $input['players'] ?? [];

        if ($tournamentId <= 0 || !is_array($playersRaw)) {
            http_response_code(422);
            echo json_encode(['error' => 'tournament_id y players son obligatorios']);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT id, groups_count FROM tournaments WHERE id = :id');
        $stmt->execute(['id' => $tournamentId]);
        $tournament = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$tournament) {
            http_response_code(404);
            echo json_encode(['error' => 'Torneo no encontrado']);
            return;
        }
        $groupsCount = (int)($tournament['groups_count'] ?? 0);

        /** @var array<int, array{user_id:int,group_number:int,position_index:int}> $players */
        $players = [];
        $seenUsers = [];
        $groupCounts = [];
        foreach ($playersRaw as $raw) {
            if (!is_array($raw)) {
                http_response_code(422);
                echo json_encode(['error' => 'Formato inválido en players']);
                return;
            }

            $userId = (int)($raw['user_id'] ?? 0);
            $groupNumber = (int)($raw['group_number'] ?? 0);
            $positionIndex = (int)($raw['position_index'] ?? 0);
            if ($userId <= 0 || $groupNumber <= 0 || $positionIndex <= 0) {
                http_response_code(422);
                echo json_encode(['error' => 'Cada jugador requiere user_id, group_number y position_index']);
                return;
            }
            if ($groupNumber > $groupsCount) {
                http_response_code(422);
                echo json_encode(['error' => 'Un jugador fue asignado a un grupo inexistente']);
                return;
            }
            if (in_array($userId, $seenUsers, true)) {
                http_response_code(422);
                echo json_encode(['error' => 'No se puede repetir un jugador en la misma ronda']);
                return;
            }
            $seenUsers[] = $userId;
            $groupCounts[$groupNumber] = ($groupCounts[$groupNumber] ?? 0) + 1;
            if ($groupCounts[$groupNumber] > 5) {
                http_response_code(422);
                echo json_encode(['error' => 'Cada grupo puede tener máximo 5 jugadores']);
                return;
            }

            $players[] = [
                'user_id' => $userId,
                'group_number' => $groupNumber,
                'position_index' => $positionIndex,
            ];
        }

        if (count($players) > 0) {
            $placeholders = implode(',', array_fill(0, count($players), '?'));
            $stmt = $pdo->prepare("SELECT id FROM users WHERE id IN ($placeholders)");
            $stmt->execute(array_map(static fn($p) => $p['user_id'], $players));
            $existingUsers = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if (count($existingUsers) !== count($players)) {
                http_response_code(422);
                echo json_encode(['error' => 'Hay usuarios inválidos en la lista']);
                return;
            }
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('DELETE FROM tournament_players WHERE tournament_id = :tournament_id');
            $stmt->execute(['tournament_id' => $tournamentId]);

            if (count($players) > 0) {
                usort(
                    $players,
                    static fn($a, $b) => $a['group_number'] <=> $b['group_number'] ?: $a['position_index'] <=> $b['position_index']
                );

                $normalized = [];
                $currentGroup = 0;
                $position = 0;
                foreach ($players as $player) {
                    if ($player['group_number'] !== $currentGroup) {
                        $currentGroup = $player['group_number'];
                        $position = 1;
                    } else {
                        $position += 1;
                    }
                    $normalized[] = [
                        'user_id' => $player['user_id'],
                        'group_number' => $player['group_number'],
                        'position_index' => $position,
                    ];
                }

                $stmt = $pdo->prepare(
                    'INSERT INTO tournament_players (tournament_id, user_id, group_number, position_index, created_at, updated_at)
                     VALUES (:tournament_id, :user_id, :group_number, :position_index, NOW(), NOW())'
                );
                foreach ($normalized as $player) {
                    $stmt->execute([
                        'tournament_id' => $tournamentId,
                        'user_id' => $player['user_id'],
                        'group_number' => $player['group_number'],
                        'position_index' => $player['position_index'],
                    ]);
                }
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['error' => 'No se pudo guardar la distribución de participantes']);
            return;
        }

        http_response_code(200);
        echo json_encode(['message' => 'Participantes actualizados correctamente']);
    }
}

