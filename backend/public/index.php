<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../src/bootstrap.php';

use App\Routing\Router;

$router = new Router();

// Auth routes
$router->post('/api/auth/register', [App\Controllers\AuthController::class, 'register']);
$router->post('/api/auth/login', [App\Controllers\AuthController::class, 'login']);
$router->post('/api/auth/logout', [App\Controllers\AuthController::class, 'logout']);
$router->get('/api/auth/me', [App\Controllers\AuthController::class, 'me']);

// Admin user routes
$router->post('/api/admin/users', [App\Controllers\AdminUserController::class, 'store'], ['admin']);
$router->put('/api/admin/users', [App\Controllers\AdminUserController::class, 'update'], ['admin']);
$router->get('/api/admin/users', [App\Controllers\AdminUserController::class, 'index'], ['admin']);
$router->put('/api/admin/users/password', [App\Controllers\AdminUserController::class, 'resetPassword'], ['admin']);

// Tournament routes
$router->get('/api/tournaments', [App\Controllers\TournamentController::class, 'index']);
$router->get('/api/tournament-players', [App\Controllers\TournamentController::class, 'players']);
$router->get('/api/tournament-rounds', [App\Controllers\TournamentRoundController::class, 'index']);
$router->get('/api/tournament-regulations/file', [App\Controllers\TournamentRegulationController::class, 'file']);
$router->get('/api/match-results', [App\Controllers\MatchResultController::class, 'index']);
$router->post('/api/match-results', [App\Controllers\MatchResultController::class, 'save']);
$router->get('/api/settings/contact', [App\Controllers\SettingsController::class, 'getContact']);
$router->post('/api/admin/tournaments', [App\Controllers\TournamentController::class, 'store'], ['admin']);
$router->put('/api/admin/tournaments', [App\Controllers\TournamentController::class, 'update'], ['admin']);
$router->delete('/api/admin/tournaments', [App\Controllers\TournamentController::class, 'destroy'], ['admin']);
$router->post('/api/admin/tournament-rounds', [App\Controllers\TournamentRoundController::class, 'store'], ['admin']);
$router->delete('/api/admin/tournament-rounds', [App\Controllers\TournamentRoundController::class, 'destroy'], ['admin']);
$router->post('/api/admin/tournament-regulations', [App\Controllers\TournamentRegulationController::class, 'upload'], ['admin']);
$router->post('/api/admin/tournament-players', [App\Controllers\AdminTournamentPlayerController::class, 'assignMany'], ['admin']);
$router->put('/api/admin/tournament-players/sync', [App\Controllers\AdminTournamentPlayerController::class, 'sync'], ['admin']);
$router->put('/api/admin/tournament-players/withdraw', [App\Controllers\AdminTournamentPlayerController::class, 'withdraw'], ['admin']);
$router->put('/api/admin/settings/contact', [App\Controllers\SettingsController::class, 'setContact'], ['admin']);

// Dispatch request
$router->dispatch($_SERVER['REQUEST_METHOD'], parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');

