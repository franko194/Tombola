# IA Friday Tombola: contexto para Claude Code

Lee esto primero en una sesión nueva. Resume lo que no se deduce del código. La documentación de uso está en [README.md](README.md), [docs/operacion.md](docs/operacion.md) y [docs/arquitectura.md](docs/arquitectura.md).

## Qué es

Aplicación web en español para las sesiones semanales internas "IA Friday": participantes con nivel de IA, equipos balanceados, tómbola que reparte casos de uso, jurados que votan desde el celular entrando por QR, historial de sorteos y calendario de visitas de clientes. Solo los organizadores inician sesión; los jurados son públicos y entran por su QR.

- Repositorio: https://github.com/franko194/Tombola (rama `main`).
- Producción: https://tombola-rust.vercel.app (Vercel) con Neon PostgreSQL (proyecto `tombola`, rama `production`, base `neondb`).
- Tags: `v0-original` (versión anterior a las mejoras, para volver atrás si algo falla) y `v1` (versión con login propio). `v1` se movió a mano al commit más reciente cuando el usuario lo pidió.

## Stack y comandos

- Backend: Python 3.12, FastAPI, SQLAlchemy 2 (`autoflush=False`), Pydantic 2. Frontend: React 19, TypeScript, Vite 6, TailwindCSS 3, lucide-react.
- El venv `backend/.venv` se creó con `uv` (`~/.local/bin/uv.exe`) y no trae `pip`. Para instalar: `uv pip install -p .venv/Scripts/python.exe -r requirements-dev.txt`.
- Desde `backend/`: `python -m pytest`, `python -m ruff check app tests`, y la API con `python -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --reload`.
- Desde `frontend/`: `npm run dev` (puerto 5173, proxy `/api` al puerto `BACKEND_PORT`, por defecto 8002), `npx tsc --noEmit -p .` y `npm run build`.
- Sin `DATABASE_URL` se usa SQLite en `backend/data/ia_friday.db` (ignorado por git).

## Cómo está armado (lo no obvio)

- Acceso de organizadores: correo y contraseña. Hash `scrypt` en `organizers.password_hash`, cookie firmada `ia_friday_organizer` (12 h) con `SESSION_SECRET`. `require_organizer` revisa `active` en cada petición. Hay rol administrador (`is_admin`) y la pantalla **Organizadores** (menú ☰) permite a cualquier admin crear usuarios, cambiar contraseñas y activar o desactivar cuentas. El primer admin se crea con `python -m app.set_organizer_password correo --admin`.
- Jurados: sin cuenta. Al identificarse reciben un `vote_token` que se guarda hasheado en `judge_vote_tokens` y viaja en la cabecera `X-Judge-Token`. Identificarse otra vez con el mismo nombre revoca el token anterior; por eso el backend exige `confirm_existing` (responde 409 "Judge name already registered" si no viene).
- Registro de jurados: `session_evaluations.registration_open` (por defecto verdadero). Abrir la votación lo pone en falso; el organizador lo reabre con `POST /sessions/{id}/evaluation/registration`. Quien ya estaba registrado puede volver a entrar aunque esté cerrado.
- Los votos viven en `team_scores`: una fila por sesión, jurado, equipo y criterio, con `score` y `comment`. El mismo comentario se copia en cada fila de criterio, y el reporte lo cuenta una vez por jurado y equipo (`services/evaluation_reports.py`). Los votos NO están en `sessions`.
- Los criterios por defecto se guardan en español (`DEFAULT_CRITERIA` en `routers/evaluation.py`). `migrate_criteria_names()` en `database.py` renombra al arrancar los que quedaron en inglés.
- Migraciones: `create_all` no agrega columnas a tablas existentes. Toda columna nueva en un modelo debe agregarse también en `migrate_added_columns()` (`database.py`) y tener una prueba en `tests/test_migrations.py`, o producción (Neon) fallará con 500.
- Errores de la API: el backend responde en inglés y `frontend/src/api/errors.ts` los traduce al español. Mensaje nuevo en el backend = entrada nueva en ese mapa. `api()` lanza `ApiError` con `status`.
- Ventanas de confirmación y formularios: `components/Dialogs.tsx` (`useDialogs().confirm` y `.form`). No uses `prompt()` ni `confirm()` nativos: el navegador integrado de Claude Desktop no soporta `prompt()`.
- Campos de contraseña: `components/PasswordInput.tsx` (ojo para mostrar u ocultar).

## Despliegue (Vercel + Neon)

- Vercel despliega `main` automáticamente a producción. Un push a `main` es una publicación real.
- `api/index.py` monta el backend en `/api` y sirve `frontend/dist`. El `requirements.txt` de la raíz debe ser una lista plana, sin `-r` ni referencias a `pyproject.toml` (eso rompió el despliegue una vez).
- Variables en Vercel: `DATABASE_URL`, `SESSION_SECRET`, `ORGANIZER_EMAILS`, `PUBLIC_APP_URL`, `VITE_PUBLIC_APP_URL`. Tras cambiarlas hay que redesplegar.
- Verifica la base con `https://tombola-rust.vercel.app/api/health/db`: debe decir `postgresql`.
- Existen otros dos proyectos de Vercel conectados al mismo repositorio (`tombola-a8p3` y `tombola-yhcx`) sin `DATABASE_URL`: usan SQLite temporal y pierden los datos al redesplegar. Hay que borrarlos o configurarles la misma variable (decisión del usuario, pendiente).

## Reglas de trabajo con este usuario

- Seguridad: no pidas ni aceptes `DATABASE_URL`, contraseñas ni tokens en el chat. El usuario pegó una vez la cadena de Neon con la contraseña; se rotó. No crees cuentas por defecto (por ejemplo admin/admin) en producción. Para consultar producción, el usuario ejecuta SQL en el editor de Neon y te pega el resultado.
- Git: no hagas commit, push, mover tags ni force-push sin que el usuario lo pida expresamente. Los mensajes de commit van en inglés.
- El usuario habla español y no es experto en Neon ni Git Bash: da pasos concretos, un comando por bloque, y di en qué terminal ejecutarlo (los comandos de `backend/` se corren en Git Bash).
- Todo el texto visible va en español correcto, con tildes y signos de apertura. El código y los comentarios van en inglés.
- Los archivos del repo usan finales de línea CRLF (Windows). Si una edición de varias líneas falla por eso, edita línea a línea o normaliza con un script que conserve los finales.
- Para probar en el navegador sin tocar los datos del usuario, usa una base SQLite temporal (`DATABASE_URL=sqlite:///...`) y bórrala al terminar.

## Estado al 2026-11-05

Hecho y verificado (53 pruebas, lint y build en verde): login propio, administración de organizadores, menú ☰, ortografía, calendario de clientes con día seleccionado, rediseño de votación para celular, aviso de nombre repetido, cierre de registro de jurados, ventanas propias, mostrar contraseña, buscador de sesiones y criterios en español.

Producción: el commit `1bdbb50` (último en `main`) se subió el 2026-11-05 y Vercel lo despliega solo; el tag `v1` sigue en `4882554`. Los votos sí se guardan en Neon (se confirmó con consultas SQL). Lo que parecía un fallo era buscar los votos en la tabla equivocada.

Pendiente:
- Borrar en Vercel `tombola-a8p3` y `tombola-yhcx` (lo hace el usuario).
- Ideas opcionales: toast con cierre automático, aviso cuando expira la sesión, límite de intentos en el login, normalizar tildes al comparar nombres de jurados ("José" y "Jose" cuentan como distintos).
