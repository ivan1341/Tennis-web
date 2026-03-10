<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;
use PDO;

class TournamentRoundController
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
        if ($tournamentId <= 0) {
            http_response_code(422);
            echo json_encode(['error' => 'tournament_id es obligatorio']);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'SELECT id, tournament_id, round_number, start_date, end_date
             FROM tournament_rounds
             WHERE tournament_id = :tournament_id
             ORDER BY round_number ASC'
        );
        $stmt->execute(['tournament_id' => $tournamentId]);

        http_response_code(200);
        echo json_encode(['rounds' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function store(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden crear rondas']);
            return;
        }

        $tournamentId = (int)($input['tournament_id'] ?? 0);
        $startDate = (string)($input['start_date'] ?? '');
        $endDate = (string)($input['end_date'] ?? '');

        if ($tournamentId <= 0 || $startDate === '' || $endDate === '') {
            http_response_code(422);
            echo json_encode(['error' => 'tournament_id, start_date y end_date son obligatorios']);
            return;
        }

        if ($startDate > $endDate) {
            http_response_code(422);
            echo json_encode(['error' => 'La fecha de inicio no puede ser mayor a la fecha fin']);
            return;
        }

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare(
            'SELECT id, start_date, end_date
             FROM tournaments
             WHERE id = :id'
        );
        $stmt->execute(['id' => $tournamentId]);
        $tournament = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$tournament) {
            http_response_code(404);
            echo json_encode(['error' => 'Torneo no encontrado']);
            return;
        }

        if ($startDate < (string)$tournament['start_date'] || $endDate > (string)$tournament['end_date']) {
            http_response_code(422);
            echo json_encode(['error' => 'Las fechas de la ronda deben estar dentro de las fechas del torneo']);
            return;
        }

        $stmt = $pdo->prepare(
            'SELECT COUNT(*) AS total
             FROM tournament_rounds
             WHERE tournament_id = :tournament_id
               AND :start_date <= end_date
               AND :end_date >= start_date'
        );
        $stmt->execute([
            'tournament_id' => $tournamentId,
            'start_date' => $startDate,
            'end_date' => $endDate,
        ]);
        $overlapCount = (int)($stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);
        if ($overlapCount > 0) {
            http_response_code(422);
            echo json_encode(['error' => 'Las fechas de la ronda se traslapan con otra ronda existente']);
            return;
        }

        $stmt = $pdo->prepare('SELECT COALESCE(MAX(round_number), 0) AS max_round FROM tournament_rounds WHERE tournament_id = :tournament_id');
        $stmt->execute(['tournament_id' => $tournamentId]);
        $maxRound = (int)($stmt->fetch(PDO::FETCH_ASSOC)['max_round'] ?? 0);
        $nextRound = $maxRound + 1;

        $stmt = $pdo->prepare(
            'INSERT INTO tournament_rounds (tournament_id, round_number, start_date, end_date, created_at, updated_at)
             VALUES (:tournament_id, :round_number, :start_date, :end_date, NOW(), NOW())'
        );
        $stmt->execute([
            'tournament_id' => $tournamentId,
            'round_number' => $nextRound,
            'start_date' => $startDate,
            'end_date' => $endDate,
        ]);

        $stmt = $pdo->prepare(
            'UPDATE tournaments
             SET rounds_count = :rounds_count,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            'rounds_count' => $nextRound,
            'id' => $tournamentId,
        ]);

        http_response_code(201);
        echo json_encode([
            'round' => [
                'id' => (int)$pdo->lastInsertId(),
                'tournament_id' => $tournamentId,
                'round_number' => $nextRound,
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
        ]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function destroy(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden eliminar rondas']);
            return;
        }

        $tournamentId = (int)($input['tournament_id'] ?? 0);
        $roundNumber = (int)($input['round_number'] ?? 0);
        if ($tournamentId <= 0 || $roundNumber <= 0) {
            http_response_code(422);
            echo json_encode(['error' => 'tournament_id y round_number son obligatorios']);
            return;
        }

        $pdo = Database::getConnection();
        $maxStmt = $pdo->prepare(
            'SELECT COALESCE(MAX(round_number), 0) AS max_round
             FROM tournament_rounds
             WHERE tournament_id = :tournament_id'
        );
        $maxStmt->execute(['tournament_id' => $tournamentId]);
        $maxRound = (int)($maxStmt->fetch(PDO::FETCH_ASSOC)['max_round'] ?? 0);
        if ($maxRound === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'No hay rondas para este torneo']);
            return;
        }
        if ($roundNumber !== $maxRound) {
            http_response_code(422);
            echo json_encode(['error' => 'Solo se puede eliminar la última ronda']);
            return;
        }

        $pdo->beginTransaction();
        try {
            $deleteRoundStmt = $pdo->prepare(
                'DELETE FROM tournament_rounds
                 WHERE tournament_id = :tournament_id
                   AND round_number = :round_number'
            );
            $deleteRoundStmt->execute([
                'tournament_id' => $tournamentId,
                'round_number' => $roundNumber,
            ]);
            if ($deleteRoundStmt->rowCount() === 0) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['error' => 'Ronda no encontrada']);
                return;
            }

            $deleteResultsStmt = $pdo->prepare(
                'DELETE FROM match_results
                 WHERE tournament_id = :tournament_id
                   AND round_number = :round_number'
            );
            $deleteResultsStmt->execute([
                'tournament_id' => $tournamentId,
                'round_number' => $roundNumber,
            ]);

            $clearWithdrawalsStmt = $pdo->prepare(
                'UPDATE tournament_players
                 SET withdrawn_round_number = NULL, updated_at = NOW()
                 WHERE tournament_id = :tournament_id
                   AND withdrawn_round_number = :round_number'
            );
            $clearWithdrawalsStmt->execute([
                'tournament_id' => $tournamentId,
                'round_number' => $roundNumber,
            ]);

            $updateTournamentStmt = $pdo->prepare(
                'UPDATE tournaments
                 SET rounds_count = :rounds_count, updated_at = NOW()
                 WHERE id = :id'
            );
            $updateTournamentStmt->execute([
                'rounds_count' => max(0, $maxRound - 1),
                'id' => $tournamentId,
            ]);

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['error' => 'No se pudo eliminar la ronda']);
            return;
        }

        http_response_code(200);
        echo json_encode(['message' => 'Ronda eliminada correctamente']);
    }
}

