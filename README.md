# IA Friday Tombola

Aplicacion web para las sesiones semanales de IA Friday del Innovation Lab. Permite:

- Registrar participantes (alta manual o importacion CSV/Excel) con su nivel de IA.
- Generar equipos balanceados por nivel de IA.
- Repartir los casos de uso con una tombola visual.
- Mostrar resultados en pantalla compartida.
- Evaluar equipos con jurados que entran por QR, con ranking en vivo.
- Guardar el historial de cada sorteo que se reemplaza o elimina.
- Llevar un calendario mensual de eventos internos y externos (de lunes a viernes, con feriados de Chile y porcentaje de ocupación), separado de las sesiones.

Solo los organizadores pueden entrar a la app. Los jurados no inician sesion: entran por su QR.

Documentacion adicional:

- [Guia de operacion](docs/operacion.md): cuentas de organizadores, preparar una sesion, jurados, solucion de problemas.
- [Arquitectura](docs/arquitectura.md): componentes, autenticacion, modelo de datos y despliegue.
- [docs/superpowers](docs/superpowers): plan y diseno originales del proyecto.

## Stack

- **Frontend:** React 19, TypeScript, Vite, TailwindCSS.
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Pydantic 2.
- **Base de datos:** SQLite en desarrollo, PostgreSQL (Neon) en produccion.
- **Despliegue:** Vercel (frontend y API como Python Function).

## Estructura

```txt
Tombola/
├── api/              Entrada de Vercel: monta la API y sirve frontend/dist
├── backend/
│   ├── app/          FastAPI: rutas, modelos, servicios y autenticacion
│   ├── tests/        Pruebas de API y reglas de negocio (pytest)
│   ├── requirements.txt       Dependencias de ejecucion
│   ├── requirements-dev.txt   Dependencias de desarrollo (pytest, ruff)
│   ├── ruff.toml              Configuracion de lint
│   └── pytest.ini             Configuracion de pytest
├── frontend/
│   └── src/          React + TypeScript (pantallas, componentes y cliente de API)
├── docs/             Operacion, arquitectura y documentos de diseno
├── .env.example      Variables de entorno de referencia
└── vercel.json       Build y rutas para Vercel
```

## Requisitos

- Python 3.12. Las versiones fijadas en `requirements.txt` tienen ruedas para 3.12; con 3.14 algunas no se instalan.
- Node.js 20 o superior con npm.

## Desarrollo local

### 1. Backend

Desde `backend/`:

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements-dev.txt
```

Crea `backend/.env` a partir de `backend/.env.example` con al menos:

```env
SESSION_SECRET=una_cadena_larga_aleatoria
ORGANIZER_EMAILS=tu_correo@ejemplo.com
```

Sin `DATABASE_URL` la app usa SQLite en `backend/data/ia_friday.db`, que se crea sola.

Ejecuta la API en el puerto **8002**. El proxy de Vite lo espera ahi:

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --reload
```

Comprueba que responde en `http://127.0.0.1:8002/health`.

Para poder iniciar sesion en local, fija la contrasena de tu organizador (ver [operacion](docs/operacion.md#crear-o-cambiar-la-contrasena-de-un-organizador)):

```bash
python -m app.set_organizer_password tu_correo@ejemplo.com
```

### 2. Frontend

Desde `frontend/`:

```bash
npm install
npm run dev
```

Abre `http://127.0.0.1:5173`.

`npm run dev` escucha en toda la red local, así que puedes probar el QR de jurados desde un celular conectado a la misma red Wi-Fi: la pantalla de evaluación muestra el enlace con la IP de tu PC. Si Windows pregunta por el firewall, permite Node.js en redes privadas.

Tambien puedes lanzar ambos desde la raiz con `npm run backend` y `npm run frontend` (el backend debe tener el entorno virtual activo).

## Variables de entorno

| Variable | Donde | Para que |
| --- | --- | --- |
| `SESSION_SECRET` | backend | Firma la cookie de sesion de los organizadores. Obligatoria. |
| `ORGANIZER_EMAILS` | backend | Correos que se agregan a la tabla `organizers` si aun no existen. |
| `DATABASE_URL` | backend | Cadena de conexion PostgreSQL (Neon). Sin ella se usa SQLite. |
| `ALLOWED_ORIGINS` | backend | Origenes permitidos por CORS. Solo hace falta si la API se consume desde otro dominio. |
| `PUBLIC_APP_URL` | backend | URL publica con la que se generan los QR de jurados. |
| `VITE_PUBLIC_APP_URL` | frontend | Igual que la anterior, para los QR que se generan desde el navegador. |
| `CLOUD_AI_URL`, `CLOUD_AI_API_KEY`, `CLOUD_AI_MODEL` | backend | IA generativa opcional para explicar el balance de equipos. |

La referencia completa esta en [`.env.example`](.env.example) y [`backend/.env.example`](backend/.env.example).

## Pruebas y lint

```bash
# Desde backend/
python -m pytest
python -m ruff check app tests

# Desde frontend/
npm run build
```

Desde la raiz hay atajos: `npm run test:backend`, `npm run lint:backend` y `npm run build`.

## Acceso de organizadores

- Los organizadores entran con correo y contrasena en la pantalla de inicio.
- Los usuarios viven en la tabla `organizers` de la base de datos. La contrasena se guarda como hash `scrypt`, nunca en texto plano.
- Para crear un organizador o cambiar su contrasena:

  ```bash
  python -m app.set_organizer_password correo@ejemplo.com
  ```

- Para quitar acceso sin borrar el registro, desactiva la fila en Neon:

  ```sql
  UPDATE organizers SET active = false WHERE email = 'correo@ejemplo.com';
  ```

El detalle y las consultas utiles estan en la [guia de operacion](docs/operacion.md).

## Despliegue en Vercel con Neon

1. Importa el repositorio en Vercel usando la **raiz** del proyecto (no `frontend`).
2. Configura estas variables en Vercel:
   - `DATABASE_URL`: cadena de conexion de Neon, con `?sslmode=require`.
   - `SESSION_SECRET`: cadena larga y aleatoria.
   - `ORGANIZER_EMAILS`: los correos de los organizadores.
   - `VITE_PUBLIC_APP_URL` y `PUBLIC_APP_URL`: la URL de produccion, por ejemplo `https://tombola-rust.vercel.app`.
3. Despliega. Las tablas se crean solas al arrancar la API.
4. Crea la contrasena de cada organizador (ver la seccion anterior, ejecutada contra la base de Neon).
5. Verifica la conexion en `https://tu-dominio.vercel.app/api/health/db`. Debe responder `{"status":"ok","dialect":"postgresql"}`.

Sin `DATABASE_URL`, Vercel guarda los datos en SQLite temporal. Ese almacenamiento se pierde en los redespliegues, asi que sirve solo para demos.

## IA generativa

La pantalla de equipos muestra una explicacion del balance. Sin configuracion, la app la calcula localmente a partir de promedios y puntajes.

Si defines `CLOUD_AI_URL` y `CLOUD_AI_API_KEY`, la app intenta primero la IA en la nube. Si esa llamada falla, vuelve automaticamente a la explicacion local.

```txt
React -> /api/sessions/{id}/teams/insights -> FastAPI -> IA cloud -> explicacion local si falla
```

El frontend nunca recibe la API key.

## Flujo de uso

1. Crear una sesion de IA Friday.
2. Agregar participantes a mano o importar CSV/Excel.
3. Cargar los casos de uso de la sesion.
4. Elegir el numero de equipos y generar equipos balanceados.
5. Ejecutar la tombola para repartir los casos.
6. Abrir la evaluacion y compartir el QR con los jurados.
7. Mostrar los resultados en pantalla compartida y marcar la sesion como completada.

Formato del CSV o Excel de participantes:

```csv
nombre,nivelIA
Ana Perez,3
Pedro Soto,1
Juan Diaz,5
```

`nivelIA` va de 0 a 5. Importar una lista **reemplaza** la lista completa de participantes; el sorteo anterior queda guardado en el historial.
