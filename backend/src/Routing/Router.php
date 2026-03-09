<?php

declare(strict_types=1);

namespace App\Routing;

use App\Services\AuthService;

class Router
{
    /** @var array<string, array<int, array{handler: callable, roles: array<int, string>}>> */
    private array $routes = [];

    /**
     * @param callable|string[] $handler
     * @param string[] $roles
     */
    public function get(string $path, $handler, array $roles = []): void
    {
        $this->addRoute('GET', $path, $handler, $roles);
    }

    /**
     * @param callable|string[] $handler
     * @param string[] $roles
     */
    public function post(string $path, $handler, array $roles = []): void
    {
        $this->addRoute('POST', $path, $handler, $roles);
    }

    /**
     * @param callable|string[] $handler
     * @param string[] $roles
     */
    public function put(string $path, $handler, array $roles = []): void
    {
        $this->addRoute('PUT', $path, $handler, $roles);
    }

    /**
     * @param callable|string[] $handler
     * @param string[] $roles
     */
    public function delete(string $path, $handler, array $roles = []): void
    {
        $this->addRoute('DELETE', $path, $handler, $roles);
    }

    /**
     * @param callable|string[] $handler
     * @param string[] $roles
     */
    private function addRoute(string $method, string $path, $handler, array $roles = []): void
    {
        $this->routes[$method][] = [
            'handler' => $handler,
            'roles' => $roles,
            'path' => rtrim($path, '/') ?: '/',
        ];
    }

    public function dispatch(string $method, string $path): void
    {
        $method = strtoupper($method);
        $path = rtrim($path, '/') ?: '/';

        $routes = $this->routes[$method] ?? [];

        foreach ($routes as $route) {
            if ($route['path'] === $path) {
                $handler = $route['handler'];
                $roles = $route['roles'];

                $authUser = null;
                if (!empty($roles) || str_starts_with($path, '/api')) {
                    $authService = new AuthService();
                    $authUser = $authService->authenticateFromRequest();

                    if (!empty($roles) && (!isset($authUser['role']) || !in_array($authUser['role'], $roles, true))) {
                        http_response_code(403);
                        echo json_encode(['error' => 'Forbidden']);
                        return;
                    }
                }

                $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
                if (stripos($contentType, 'multipart/form-data') !== false) {
                    $input = $_POST;
                } else {
                    $input = json_decode(file_get_contents('php://input') ?: '[]', true) ?? [];
                }

                if (is_array($handler) && is_string($handler[0])) {
                    $className = $handler[0];
                    $methodName = $handler[1];
                    $instance = new $className($authUser);
                    $instance->{$methodName}($input);
                    return;
                }

                if (is_callable($handler)) {
                    $handler($input, $authUser);
                    return;
                }
            }
        }

        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
    }
}

