<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database;

class TournamentRegulationController
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
    public function upload(array $input): void
    {
        if ($this->user === null || ($this->user['role'] ?? null) !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Solo administradores pueden subir reglamentos']);
            return;
        }

        $tournamentId = (int)($input['tournament_id'] ?? 0);
        if ($tournamentId <= 0) {
            http_response_code(422);
            echo json_encode(['error' => 'tournament_id es obligatorio']);
            return;
        }

        if (!isset($_FILES['regulation_pdf']) || !is_array($_FILES['regulation_pdf'])) {
            http_response_code(422);
            echo json_encode(['error' => 'El archivo regulation_pdf es obligatorio']);
            return;
        }

        $file = $_FILES['regulation_pdf'];
        $uploadError = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($uploadError !== UPLOAD_ERR_OK) {
            http_response_code(422);
            echo json_encode(['error' => 'No se pudo subir el archivo PDF']);
            return;
        }

        $tmpName = (string)($file['tmp_name'] ?? '');
        $originalName = (string)($file['name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            http_response_code(422);
            echo json_encode(['error' => 'Archivo inválido']);
            return;
        }

        $size = (int)($file['size'] ?? 0);
        if ($size <= 0 || $size > MAX_REGULATION_PDF_BYTES) {
            http_response_code(422);
            echo json_encode(['error' => 'El PDF es inválido o supera el tamaño permitido (10 MB)']);
            return;
        }

        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $mimeType = mime_content_type($tmpName) ?: '';
        if ($extension !== 'pdf' || $mimeType !== 'application/pdf') {
            http_response_code(422);
            echo json_encode(['error' => 'Solo se permiten archivos PDF']);
            return;
        }

        $pdo = Database::getConnection();
        $existsStmt = $pdo->prepare('SELECT id FROM tournaments WHERE id = :id');
        $existsStmt->execute(['id' => $tournamentId]);
        if (!$existsStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Torneo no encontrado']);
            return;
        }

        $targetDir = rtrim(APP_STORAGE_DIR, '/\\') . DIRECTORY_SEPARATOR . 'tournament-regulations';
        if (!is_dir($targetDir) && !mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
            http_response_code(500);
            echo json_encode(['error' => 'No se pudo preparar el directorio de reglamentos']);
            return;
        }

        $fileName = sprintf('tournament_%d.pdf', $tournamentId);
        $absolutePath = $targetDir . DIRECTORY_SEPARATOR . $fileName;
        $relativePath = 'tournament-regulations/' . $fileName;

        if (!move_uploaded_file($tmpName, $absolutePath)) {
            http_response_code(500);
            echo json_encode(['error' => 'No se pudo guardar el PDF']);
            return;
        }

        $updateStmt = $pdo->prepare(
            'UPDATE tournaments
             SET regulation_pdf_path = :path, updated_at = NOW()
             WHERE id = :id'
        );
        $updateStmt->execute([
            'path' => $relativePath,
            'id' => $tournamentId,
        ]);

        http_response_code(200);
        echo json_encode([
            'message' => 'Reglamento actualizado correctamente',
            'regulation_pdf_url' => $this->buildFileUrl($tournamentId),
        ]);
    }

    /**
     * @param array<string, mixed> $input
     */
    public function file(array $input): void
    {
        $tournamentId = (int)($_GET['tournament_id'] ?? 0);
        if ($tournamentId <= 0) {
            http_response_code(422);
            echo json_encode(['error' => 'tournament_id es obligatorio']);
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT name, regulation_pdf_path FROM tournaments WHERE id = :id');
        $stmt->execute(['id' => $tournamentId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Torneo no encontrado']);
            return;
        }

        $relativePath = (string)($row['regulation_pdf_path'] ?? '');
        if ($relativePath === '') {
            http_response_code(404);
            echo json_encode(['error' => 'Este torneo no tiene reglamento cargado']);
            return;
        }

        $absolutePath = rtrim(APP_STORAGE_DIR, '/\\') . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath);
        if (!file_exists($absolutePath) || !is_readable($absolutePath)) {
            http_response_code(404);
            echo json_encode(['error' => 'No se encontró el archivo del reglamento']);
            return;
        }

        $safeName = preg_replace('/[^a-zA-Z0-9_-]+/', '_', (string)($row['name'] ?? 'reglamento'));
        $downloadName = sprintf('reglamento_%s.pdf', $safeName);

        header('Content-Type: application/pdf');
        header('Content-Length: ' . (string)filesize($absolutePath));
        header('Content-Disposition: inline; filename="' . $downloadName . '"');
        readfile($absolutePath);
    }

    private function buildFileUrl(int $tournamentId): string
    {
        $host = (string)($_SERVER['HTTP_HOST'] ?? '');
        $path = sprintf('/api/tournament-regulations/file?tournament_id=%d', $tournamentId);
        if ($host === '') {
            return $path;
        }
        $https = (string)($_SERVER['HTTPS'] ?? '');
        $scheme = ($https !== '' && $https !== 'off') ? 'https' : 'http';
        return sprintf('%s://%s%s', $scheme, $host, $path);
    }
}

