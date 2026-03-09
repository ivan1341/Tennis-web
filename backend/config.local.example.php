<?php

declare(strict_types=1);

/**
 * Copia este archivo como backend/config.local.php
 * y coloca tus credenciales reales.
 *
 * IMPORTANTE: config.local.php está en .gitignore.
 */
return [
    'DB_HOST' => 'localhost',
    'DB_NAME' => 'tennis_web',
    'DB_USER' => 'db_user',
    'DB_PASS' => 'db_password',
    'TOKEN_TTL_HOURS' => 12,
    'APP_STORAGE_DIR' => __DIR__ . '/storage',
    'MAX_REGULATION_PDF_BYTES' => 10485760,
];
