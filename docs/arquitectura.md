# Arquitectura

## Vista general

```txt
Navegador (organizador)                 Navegador (jurado, desde QR)
        │  cookie firmada                       │  token del jurado
        ▼                                       ▼
┌───────────────────────────────────────────────────────────┐
│ Vercel                                                    │
│  frontend/dist   React + Vite (SPA)                       │
│  api/index.py    FastAPI montada en /api                  │
└───────────────────────────┬───────────────────────────────┘
                            │ SQLAlchemy
                            ▼
                 PostgreSQL en Neon (produccion)
                 SQLite en backend/data (desarrollo)
```

En desarrollo, Vite sirve el frontend en el puerto 5173 y reenvia `/api` a FastAPI en el puerto 8002, quitando el prefijo `/api`.

En produccion, `api/index.py` monta la API en `/api` y sirve los archivos de `frontend/dist`. Las rutas `/judge/:token` se reescriben a `index.html` en [vercel.json](../vercel.json).

## Componentes

### Backend (`backend/app`)

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `main.py` | Crea la app, configura CORS y registra los routers. Las rutas de organizador usan la dependencia `require_organizer`. |
| `auth.py` | Contrasenas (`scrypt`), cookie firmada con HMAC y dependencia de autorizacion. |
| `database.py` | Motor de base de datos, sesiones, creacion de tablas, migraciones ligeras y siembra de organizadores. |
| `models.py` | Modelos SQLAlchemy. |
| `schemas.py` | Modelos Pydantic de entrada y salida. |
| `routers/` | Un archivo por recurso: sesiones, participantes, casos, equipos, resultados, evaluacion, clientes, IA y autenticacion. |
| `services/` | Logica de negocio: balance de equipos, asignacion de casos, historial, reportes e insights de IA. |
| `set_organizer_password.py` | Comando para crear o cambiar la contrasena de un organizador. |

### Frontend (`frontend/src`)

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `App.tsx` | Enrutado por estado: verifica la sesion, decide entre login, sesiones, calendario, jurado o la app de la sesion. |
| `api/client.ts` | Cliente HTTP. Ante un 401 emite el evento `auth:expired` para volver al login. |
| `api/resources.ts` | Funciones de cada recurso de la API. |
| `pages/` | Una pantalla por pestaña y las pantallas de login, calendario y jurado. |
| `lib/` | Utilidades: geometria de la ruleta de la tombola, avisos antes de reemplazar sorteos y URLs publicas. |

## Autenticacion

### Organizadores

1. El organizador envia correo y contrasena a `POST /auth/login`.
2. La API busca un organizador activo con ese correo y compara la contrasena contra `password_hash` (`scrypt`, con comparacion en tiempo constante).
3. Si coincide, responde con una cookie `ia_friday_organizer` firmada con `SESSION_SECRET`, `httponly`, `secure`, `SameSite=Lax`, que dura 12 horas.
4. Cada peticion a una ruta de organizador valida la firma y la expiracion, y vuelve a consultar que el correo siga activo en `organizers`. Por eso desactivar una fila revoca el acceso de inmediato.

Los mensajes de error no distinguen entre correo inexistente y contrasena incorrecta.

### Jurados

- Las rutas `/judge/{token}` son publicas. El `token` de la evaluacion identifica la sesion, no a la persona.
- Al identificarse con su nombre, el jurado recibe un `vote_token` aleatorio. La base guarda solo su hash SHA-256.
- Votar o leer los propios votos exige el encabezado `X-Judge-Token`. Sin el token correcto la API responde 403.

## Modelo de datos

| Tabla | Contenido |
| --- | --- |
| `sessions` | Sesiones de IA Friday: nombre, fecha, estado. |
| `participants` | Personas de cada sesion con su nivel de IA (0 a 5). |
| `use_cases` | Casos de uso de cada sesion. |
| `teams` y `team_members` | Equipos generados y sus integrantes. |
| `assignments` | Caso asignado a cada equipo. |
| `result_snapshots` | Copias de resultados ya publicados de una sesion. |
| `draw_history` | Copia de los sorteos reemplazados o eliminados, con nota opcional. |
| `judges` | Jurados por nombre. |
| `session_judges` | Jurados que participan en la evaluacion de una sesion. |
| `session_evaluations` | Evaluacion de cada sesion, con su token publico, estado (abierta o cerrada) y si el registro de jurados sigue abierto. |
| `evaluation_criteria` | Criterios de evaluacion de cada sesion. |
| `team_scores` | Puntajes de cada jurado a cada equipo por criterio. |
| `judge_vote_tokens` | Hash del token de voto de cada jurado en cada sesion. |
| `organizers` | Correos autorizados, contrasena (hash), estado activo. |
| `client_visits` | Visitas de clientes para el calendario. Independiente de las sesiones. |

Las tablas se crean con `Base.metadata.create_all` al arrancar. Las columnas que se agregan a tablas existentes requieren un cambio manual o una migracion en `database.py`; hoy existen `migrate_assignments_allow_repeated_use_cases` y `migrate_organizers_add_password_hash`.

## Reglas de negocio importantes

- **Importar participantes reemplaza la lista completa.** Antes de hacerlo se archiva el sorteo vigente.
- **Cambios que borran sorteos archivan antes.** Editar o eliminar participantes y casos, regenerar equipos, reasignar casos o eliminar una sesion guardan una copia en `draw_history`.
- **Los equipos se balancean por nivel de IA** con reparto en serpentina (snake draft), para que la suma de niveles por equipo quede lo mas pareja posible.
- **La asignacion de casos es aleatoria**, y un mismo caso puede repetirse entre equipos cuando hay mas equipos que casos.

## Decisiones de diseno

- **Login propio con contrasena en Neon, sin proveedor externo.** Vercel no ofrece login para usuarios de una app. Con cinco organizadores, una tabla con hash `scrypt` es suficiente y no depende de cuentas de Google.
- **Sin recuperacion de contrasena por correo.** La recuperacion la hace quien administra con `python -m app.set_organizer_password`. Evita integrar un servicio de correo.
- **Sin limite de intentos de login.** Es un riesgo aceptable para un grupo chico y cerrado. Si el acceso se abre a mas personas, conviene agregar un limite por IP o por correo.
- **Un solo token de evaluacion por sesion**, compartido en el QR. La identidad del jurado se verifica con su token de voto, no con el token publico.

## Pruebas

- `backend/tests/` cubre la API con `TestClient` sobre SQLite: flujo de sesion, importacion, historial, jurados, clientes y autenticacion.
- `backend/tests/test_team_balancer.py` y `test_usecase_assigner.py` cubren la logica de equipos y asignacion.
- El frontend se valida con `tsc` y `vite build`. No hay pruebas de interfaz automatizadas todavia.
