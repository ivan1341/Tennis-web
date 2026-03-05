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
                    mr.player_one_id, mr.player_two_id,
                    mr.set1_player_one_games, mr.set1_player_two_games,
                    mr.set2_player_one_games, mr.set2_player_two_games,
                    mr.set3_player_one_games, mr.set3_player_two_games,
                    mr.is_walkover,
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
        $set1PlayerOneGames = (int)($input['set1_player_one_games'] ?? -1);
        $set1PlayerTwoGames = (int)($input['set1_player_two_games'] ?? -1);
        $set2PlayerOneGames = (int)($input['set2_player_one_games'] ?? -1);
        $set2PlayerTwoGames = (int)($input['set2_player_two_games'] ?? -1);
        $set3PlayerOneGames = (int)($input['set3_player_one_games'] ?? -1);
        $set3PlayerTwoGames = (int)($input['set3_player_two_games'] ?? -1);
        $isWalkover = filter_var($input['is_walkover'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;

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

        if (
            $set1PlayerOneGames < 0 || $set1PlayerTwoGames < 0 ||
            $set2PlayerOneGames < 0 || $set2PlayerTwoGames < 0 ||
            $set3PlayerOneGames < 0 || $set3PlayerTwoGames < 0
        ) {
            http_response_code(422);
            echo json_encode(['error' => 'Los resultados deben ser números positivos']);
            return;
        }

        if ($set1PlayerOneGames === $set1PlayerTwoGames || $set2PlayerOneGames === $set2PlayerTwoGames) {
            http_response_code(422);
            echo json_encode(['error' => 'Set 1 y Set 2 deben tener ganador']);
            return;
        }

        // Set 3 is optional: 0-0 means not played.
        if ($set3PlayerOneGames === $set3PlayerTwoGames && $set3PlayerOneGames !== 0) {
            http_response_code(422);
            echo json_encode(['error' => 'Set 3 debe tener ganador o quedar en 0-0']);
            return;
        }

        $playerOneSetsWon = 0;
        $playerTwoSetsWon = 0;
        $setPairs = [
            [$set1PlayerOneGames, $set1PlayerTwoGames],
            [$set2PlayerOneGames, $set2PlayerTwoGames],
            [$set3PlayerOneGames, $set3PlayerTwoGames],
        ];
        foreach ($setPairs as [$gamesOne, $gamesTwo]) {
            if ($gamesOne === 0 && $gamesTwo === 0) {
                continue;
            }
            if ($gamesOne > $gamesTwo) {
                $playerOneSetsWon += 1;
            } elseif ($gamesTwo > $gamesOne) {
                $playerTwoSetsWon += 1;
            }
        }

        if ($playerOneSetsWon === $playerTwoSetsWon) {
            http_response_code(422);
            echo json_encode(['error' => 'Debe existir un ganador en sets']);
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

        $normalizedSet1PlayerOneGames = $orderedPlayerOne === $playerOneId ? $set1PlayerOneGames : $set1PlayerTwoGames;
        $normalizedSet1PlayerTwoGames = $orderedPlayerTwo === $playerTwoId ? $set1PlayerTwoGames : $set1PlayerOneGames;
        $normalizedSet2PlayerOneGames = $orderedPlayerOne === $playerOneId ? $set2PlayerOneGames : $set2PlayerTwoGames;
        $normalizedSet2PlayerTwoGames = $orderedPlayerTwo === $playerTwoId ? $set2PlayerTwoGames : $set2PlayerOneGames;
        $normalizedSet3PlayerOneGames = $orderedPlayerOne === $playerOneId ? $set3PlayerOneGames : $set3PlayerTwoGames;
        $normalizedSet3PlayerTwoGames = $orderedPlayerTwo === $playerTwoId ? $set3PlayerTwoGames : $set3PlayerOneGames;

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
            'SELECT id
             FROM match_results
             WHERE tournament_id = :tournament_id
               AND round_number = :round_number
               AND group_number = :group_number
               AND player_one_id = :player_one_id
               AND player_two_id = :player_two_id'
        );
        $stmt->execute([
            'tournament_id' => $tournamentId,
            'round_number' => $roundNumber,
            'group_number' => $groupNumber,
            'player_one_id' => $orderedPlayerOne,
            'player_two_id' => $orderedPlayerTwo,
        ]);
        $existingResultId = (int)($stmt->fetch(PDO::FETCH_ASSOC)['id'] ?? 0);
        if ($existingResultId > 0 && $authRole !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'El resultado ya fue enviado. Solo el administrador puede editarlo.']);
            return;
        }

        $stmt = $pdo->prepare(
            'INSERT INTO match_results
                (tournament_id, round_number, group_number, player_one_id, player_two_id, set1_player_one_games, set1_player_two_games, set2_player_one_games, set2_player_two_games, set3_player_one_games, set3_player_two_games, is_walkover, edited_by_user_id, created_at, updated_at)
             VALUES
                (:tournament_id, :round_number, :group_number, :player_one_id, :player_two_id, :set1_player_one_games, :set1_player_two_games, :set2_player_one_games, :set2_player_two_games, :set3_player_one_games, :set3_player_two_games, :is_walkover, :edited_by_user_id, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                set1_player_one_games = VALUES(set1_player_one_games),
                set1_player_two_games = VALUES(set1_player_two_games),
                set2_player_one_games = VALUES(set2_player_one_games),
                set2_player_two_games = VALUES(set2_player_two_games),
                set3_player_one_games = VALUES(set3_player_one_games),
                set3_player_two_games = VALUES(set3_player_two_games),
                is_walkover = VALUES(is_walkover),
                edited_by_user_id = VALUES(edited_by_user_id),
                updated_at = NOW()'
        );

        $stmt->execute([
            'tournament_id' => $tournamentId,
            'round_number' => $roundNumber,
            'group_number' => $groupNumber,
            'player_one_id' => $orderedPlayerOne,
            'player_two_id' => $orderedPlayerTwo,
            'set1_player_one_games' => $normalizedSet1PlayerOneGames,
            'set1_player_two_games' => $normalizedSet1PlayerTwoGames,
            'set2_player_one_games' => $normalizedSet2PlayerOneGames,
            'set2_player_two_games' => $normalizedSet2PlayerTwoGames,
            'set3_player_one_games' => $normalizedSet3PlayerOneGames,
            'set3_player_two_games' => $normalizedSet3PlayerTwoGames,
            'is_walkover' => $isWalkover,
            'edited_by_user_id' => $authUserId,
        ]);

        http_response_code(200);
        echo json_encode(['message' => 'Resultado guardado']);
    }
}

