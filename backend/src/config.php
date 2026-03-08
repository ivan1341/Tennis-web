<?php

declare(strict_types=1);

/**
 * Configuración:
 * 1) Variables de entorno (recomendado para producción)
 * 2) Archivo local backend/config.local.php (no versionado)
 * 3) Valores por defecto seguros para desarrollo local
 */

/** @var array<string, string|int> $localConfig */
$localConfig = [];
$localConfigPath = dirname(__DIR__) . '/config.local.php';
if (file_exists($localConfigPath)) {
    $loaded = require $localConfigPath;
    if (is_array($loaded)) {
        /** @var array<string, string|int> $loaded */
        $localConfig = $loaded;
    }
}

/**
 * @param array<string, string|int> $config
 */
function configValue(string $key, string $default, array $config): string
{
    $env = getenv($key);
    if ($env !== false && $env !== '') {
        return (string)$env;
    }

    if (array_key_exists($key, $config) && $config[$key] !== '') {
        return (string)$config[$key];
    }

    return $default;
}

define('DB_HOST', configValue('DB_HOST', 'localhost', $localConfig));
define('DB_NAME', configValue('DB_NAME', 'tennis_web', $localConfig));
define('DB_USER', configValue('DB_USER', 'root', $localConfig));
define('DB_PASS', configValue('DB_PASS', '', $localConfig));
define('DB_CHARSET', 'utf8mb4');

define('TOKEN_TTL_HOURS', (int)configValue('TOKEN_TTL_HOURS', '12', $localConfig));
