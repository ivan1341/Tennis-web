# Tennis-web

Aplicación para administrar torneos de tenis (backend PHP + frontend React).

## Probar con Docker

1. **Levantar backend y base de datos**
   ```bash
   docker compose up -d
   ```
   - API: http://localhost:8000  
   - phpMyAdmin: http://localhost:8080 (usuario `root` / `rootpassword` o `app_user` / `app_password`)  
   - MySQL: puerto 3306 (base de datos `tennis_web`)

2. **Levantar el frontend** (en otra terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Abre la URL que muestre Vite (p. ej. http://localhost:5173). La app usará por defecto la API en http://localhost:8000.

3. **Primer uso**  
   Crea un usuario desde la página de registro. Para tener un admin, inserta en la BD en la tabla `users` el campo `role = 'admin'` para ese usuario (o ejecuta un `UPDATE` desde phpMyAdmin).

## Sin Docker

- **Backend:** sirve la carpeta `backend/public` con PHP (p. ej. `php -S localhost:8000 -t backend/public` desde la raíz). Crea la base `tennis_web` y ejecuta `backend/sql/schema.sql`. Ajusta `backend/src/config.php` o usa variables de entorno.
- **Frontend:** en `frontend` crea `.env` con `VITE_API_BASE_URL=http://localhost:8000` (o la URL de tu backend) y ejecuta `npm run dev`.
