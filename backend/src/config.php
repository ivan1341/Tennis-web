<?php

declare(strict_types=1);

// Configuración: usa variables de entorno en Docker, valores por defecto en local.

define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'tennis_web');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');

define('TOKEN_TTL_HOURS', 12);
