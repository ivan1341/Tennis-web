<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use PDO;

class MatchResultController
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
        $tournamentId = (int)($_GET['tournament_id'] ?? 0);
        $roundNumber = (int)($_GET['round_number'] ?? 0);

        if ($tournamentId <= 0 || $roundNumber <= 0) {
            http_response_code(422);
            echo json_encode(['error' => 'tournament_id y round_number son obligatorios']);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'SELECT mr.id, mr.tournament_id, mr.round_number, mr.group_number,
                    mr.player_one_id, mr.player_two_id, mr.player_one_score, mr.player_two_score,
                    p1.name AS player_one_name, p2.name AS player_two_name
             FROM match_results mr
             INNER JOIN users p1 ON p1.id = mr.player_one_id
             INNER JOIN users p2 ON p2.id = mr.player_two_id
             WHERE mr.tournament_id = :tournament_id AND mr.round_number = :round_number
             ORDER BY mr.group_number ASC, p1.name ASC, p2.name ASC'
        );
        $stmt->execute([
            'tournament_id' => $tournamentId,
            'round_number' => $roundNumber,
        ]);

        http_response_code(200);
        echo json_encode(['results' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function save(array $input): void
    {
        if ($this->user === null) {
            http_response_code(401);
            echo json_encode(['error' => 'No autenticado']);
            return;
        }

        $tournamentId = (int)($input['tournament_id'] ?? 0);
        $roundNumber = (int)($input['round_number'] ?? 0);
        $groupNumber = (int)($input['group_number'] ?? 0);
        $playerOneId = (int)($input['player_one_id'] ?? 0);
        $playerTwoId = (int)($input['player_two_id'] ?? 0);
        $playerOneScore = (int)($input['player_one_score'] ?? -1);
        $playerTwoScore = (int)($input['player_two_score'] ?? -1);

        if ($tournamentId <= 0 || $roundNumber <= 0 || $groupNumber <= 0 || $playerOneId <= 0 || $playerTwoId <= 0) {
            http_response_code(422);
            echo json_encode(['error' => 'Datos del partido incompletos']);
            return;
        }

        if ($playerOneId === $playerTwoId) {
            http_response_code(422);
            echo json_encode(['error' => 'Un jugador no puede jugar contra sí mismo']);
            return;
        }

        if ($playerOneScore < 0 || $playerTwoScore < 0) {
            http_response_code(422);
            echo json_encode(['error' => 'Los resultados deben ser números positivos']);
            return;
        }

        $authUserId = (int)$this->user['id'];
        $authRole = (string)$this->user['role'];
        $isParticipant = $authUserId === $playerOneId || $authUserId === $playerTwoId;
        if (!$isParticipant && $authRole !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo jugadores del partido o admin pueden editar resultados']);
            return;
        }

        $orderedPlayerOne = min($playerOneId, $playerTwoId);
        $orderedPlayerTwo = max($playerOneId, $playerTwoId);

        $normalizedPlayerOneScore = $orderedPlayerOne === $playerOneId ? $playerOneScore : $playerTwoScore;
        $normalizedPlayerTwoScore = $orderedPlayerTwo === $playerTwoId ? $playerTwoScore : $playerOneScore;

        $pdo = Database::getConnection();

        // Validate both players belong to this tournament and group.
        $stmt = $pdo->prepare(
            'SELECT user_id
             FROM tournament_players
             WHERE tournament_id = :tournament_id
               AND group_number = :group_number
               AND (user_id = :player_one_id OR user_id = :player_two_id)'
        );
        $stmt->execute([
            'tournament_id' => $tournamentId,
            'group_number' => $groupNumber,
            'player_one_id' => $orderedPlayerOne,
            'player_two_id' => $orderedPlayerTwo,
        ]);

        $assignedPlayers = $stmt->fetchAll(PDO::FETCH_COLUMN);
        if (count($assignedPlayers) !== 2) {
            http_response_code(422);
            echo json_encode(['error' => 'Los jugadores no pertenecen al grupo seleccionado']);
            return;
        }

        $stmt = $pdo->prepare(
            'INSERT INTO match_results
                (tournament_id, round_number, group_number, player_one_id, player_two_id, player_one_score, player_two_score, edited_by_user_id, created_at, updated_at)
             VALUES
                (:tournament_id, :round_number, :group_number, :player_one_id, :player_two_id, :player_one_score, :player_two_score, :edited_by_user_id, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                player_one_score = VALUES(player_one_score),
                player_two_score = VALUES(player_two_score),
                edited_by_user_id = VALUES(edited_by_user_id),
                updated_at = NOW()'
        );

        $stmt->execute([
            'tournament_id' => $tournamentId,
            'round_number' => $roundNumber,
            'group_number' => $groupNumber,
            'player_one_id' => $orderedPlayerOne,
            'player_two_id' => $orderedPlayerTwo,
            'player_one_score' => $normalizedPlayerOneScore,
            'player_two_score' => $normalizedPlayerTwoScore,
            'edited_by_user_id' => $authUserId,
        ]);

        http_response_code(200);
        echo json_encode(['message' => 'Resultado guardado']);
    }
}

