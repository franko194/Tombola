# IA Friday Tombola

Aplicacion web reusable para sesiones semanales de IA Friday. Permite registrar participantes, cargar casos de uso, generar equipos balanceados por nivel de IA, asignar casos mediante una tombola visual y mostrar resultados en pantalla compartida.

## Stack

- Frontend: React, TypeScript, Vite, TailwindCSS
- Backend: Python, FastAPI, SQLAlchemy
- Base de datos: SQLite

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

