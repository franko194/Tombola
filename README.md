# IA Friday Tombola

Aplicacion web reusable para sesiones semanales de IA Friday. Permite registrar participantes, cargar casos de uso, generar equipos balanceados por nivel de IA, repartir casos mediante una tombola visual y mostrar resultados en pantalla compartida.

## Stack

- Frontend: React, TypeScript, Vite, TailwindCSS
- Backend: Python, FastAPI, SQLAlchemy
- Base de datos: SQLite local o PostgreSQL en produccion

## Backend

Instalar dependencias:

```bash
cd backend
python -m pip install -r requirements.txt
```

Ejecutar API:

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Health check:

```txt
http://127.0.0.1:8000/health
```

Health check de base de datos:

```txt
http://127.0.0.1:8000/health/db
```

## Frontend

Instalar dependencias:

```bash
cd frontend
npm.cmd install
```

Ejecutar web:

```bash
cd frontend
npm.cmd run dev
```

URL local:

```txt
http://127.0.0.1:5173
```

## Deploy en Vercel

El repositorio incluye configuracion para desplegar frontend y API en Vercel:

- Frontend: React/Vite desde `frontend/`.
- API: FastAPI como Python Function desde `api/index.py`.
- Configuracion: `vercel.json` en la raiz.

En Vercel importa el repositorio desde GitHub y usa la raiz del proyecto. No selecciones `frontend` como Root Directory.

Por defecto, el build de produccion usa la API del backend. Si no configuras `DATABASE_URL`, el backend guarda en SQLite temporal dentro de Vercel. Esto permite crear sesiones, participantes, casos, equipos, sorteos y resultados sin configurar una base de datos externa.

Importante: en Vercel ese almacenamiento temporal puede perderse al redeploy o cuando la funcion serverless cambia de instancia. Sirve para demo, pero no para persistencia permanente.

Para persistencia real, configura PostgreSQL con esta variable:

```env
DATABASE_URL=postgresql://usuario:password@host:puerto/database?sslmode=require
```

Con esto cualquier PC que abra la URL de Vercel vera los mismos datos, porque React llama a la API en `/api` y FastAPI guarda todo en PostgreSQL.

Despues de configurar `DATABASE_URL`, haz un redeploy y prueba:

```txt
https://tu-dominio.vercel.app/api/health/db
```

Debe responder algo como:

```json
{"status":"ok","dialect":"postgresql"}
```

Si quieres volver al modo sin backend y guardar solo en el navegador, configura:

```env
VITE_DATA_MODE=local
```

## IA generativa

La pantalla de equipos puede generar una explicacion inteligente del balance.

Sin configurar nada, la app usa una explicacion local calculada desde promedios y scores.

Para usar IA cloud, agrega estas variables en el backend:

```env
CLOUD_AI_URL=https://tu-endpoint-cloud.example.com/api
CLOUD_AI_API_KEY=tu_api_key_de_ia
CLOUD_AI_MODEL=minimax-m3:cloud
```

La app siempre intenta primero `CLOUD_AI_URL` con `CLOUD_AI_API_KEY`. Si esa llamada falla, vuelve automaticamente a la explicacion local.

El frontend nunca usa la API key directamente. La llamada es:

```txt
React -> /api/sessions/{id}/teams/insights -> FastAPI -> IA cloud -> fallback local si falla
```

## Evaluacion con jurados

Cada sesion puede abrir una evaluacion independiente para la fecha del IA Friday.

Criterios de evaluacion:

- Presentation & Communication
- Usability & Desing
- Innovation
- Impact and Relevance
- Technical Quiality

Escala:

- 1: Very Bad
- 2: Insufficient
- 3: Acceptable
- 4: Good
- 5: Very Good

Flujo:

1. Al entrar al dashboard de una sesion, la app prepara un QR de jurados.
2. Comparte el QR o link con los jurados desde el inicio.
3. Cada jurado entra a `/judge/{token}` y se identifica con nombre aunque la votacion aun no este abierta.
4. Genera equipos y asigna casos.
5. Abre la pestaña `Evaluacion` y presiona `Abrir votacion`.
6. Los jurados actualizan la pantalla y puntuan equipos.
7. El organizador ve ranking en vivo y puede cerrar la evaluacion.

Los jurados son globales por email, pero sus votos se guardan por sesion. Si un jurado no viene, simplemente queda pendiente; si llega un jurado nuevo, se registra desde el QR y queda asociado a esa fecha.

## Importacion

CSV o Excel deben incluir estas columnas:

```csv
nombre,nivelIA
Ana Perez,3
Pedro Soto,1
Juan Diaz,5
```

`nivelIA` debe estar entre 0 y 5.

## Flujo de uso

1. Crear una sesion de IA Friday.
2. Agregar participantes manualmente o importar CSV/Excel.
3. Cargar casos de uso nuevos para la sesion.
4. Seleccionar numero de equipos.
5. Generar equipos balanceados.
6. Ejecutar la tombola.
7. Abrir resultados para pantalla compartida.
8. Marcar la sesion como completada.
