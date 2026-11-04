# Guia de operacion

Esta guia es para quien administra la app: organizadores, jurados y datos. Para instalar el proyecto en tu PC, ver el [README](../README.md).

## Primer despliegue

Checklist para dejar la app lista en Vercel con Neon:

- [ ] Base de datos PostgreSQL creada en Neon.
- [ ] `DATABASE_URL`, `SESSION_SECRET`, `ORGANIZER_EMAILS`, `PUBLIC_APP_URL` y `VITE_PUBLIC_APP_URL` configuradas en Vercel.
- [ ] Redespliegue hecho despues de configurar las variables.
- [ ] `https://tu-dominio.vercel.app/api/health/db` responde `"dialect":"postgresql"`.
- [ ] Contrasena fijada para cada organizador.
- [ ] Inicio de sesion probado en el dominio de produccion.

## Crear o cambiar la contrasena de un organizador

Desde `backend/`, con `DATABASE_URL` apuntando a la base que usa la app (Neon en produccion):

```bash
python -m app.set_organizer_password correo@ejemplo.com
```

El comando pide la contrasena dos veces (minimo 8 caracteres). Si el correo no existe en la tabla, lo crea. Sirve tanto para dar acceso nuevo como para resetear una contrasena olvidada.

Tambien puedes revisar la tabla en la consola de Neon:

```sql
SELECT email, active, password_hash IS NOT NULL AS tiene_contrasena FROM organizers ORDER BY email;
```

## Quitar o restaurar el acceso

El acceso se revisa en cada peticion, asi que el cambio surte efecto de inmediato:

```sql
-- Quitar acceso
UPDATE organizers SET active = false WHERE email = 'correo@ejemplo.com';

-- Restaurar acceso
UPDATE organizers SET active = true WHERE email = 'correo@ejemplo.com';
```

`ORGANIZER_EMAILS` solo agrega correos que falten al iniciar la API. No quita ni reactiva organizadores existentes.

## Preparar una sesion de IA Friday

1. Entra con tu correo y contrasena.
2. En **Sesiones**, crea la sesion con nombre y fecha.
3. En **Participantes**, agrega personas a mano o importa un CSV. La importacion reemplaza toda la lista.
4. En **Casos**, carga los casos de uso de la sesion.
5. En **Equipos**, elige el numero de equipos y genera el balance.
6. En **Tombola**, reparte los casos.
7. En **Evaluacion**, abre la votacion y comparte el QR de jurados.
8. En **Resultados**, muestra el ranking en la pantalla compartida y marca la sesion como completada.

Cada vez que reemplazas equipos o casos ya sorteados, la app guarda una copia en **Historial**, donde puedes agregar una nota o eliminar el registro.

## Jurados

- Los jurados no tienen cuenta. Escanean el QR de la sesion, que abre `/judge/{token}`, y escriben su nombre.
- Al identificarse, la app les entrega un token que queda guardado en su navegador. Sus votos solo se aceptan con ese token.
- Si un jurado vuelve a identificarse con el mismo nombre desde otro dispositivo, el token anterior deja de funcionar. El jurado puede usar el boton "No soy [nombre]" para cambiar de identidad en el mismo navegador.
- El QR debe apuntar a la URL de produccion. Si aparece la advertencia de `localhost`, configura `VITE_PUBLIC_APP_URL` o abre la app desde el dominio de Vercel.

## Calendario de clientes

Desde la pantalla de sesiones, **Calendario de clientes** muestra las visitas del mes. Cada visita tiene empresa, contacto, notas y fecha. Los viernes aparecen marcados como IA Friday.

Este calendario es independiente de las sesiones: las visitas de clientes no aparecen en el historial de sorteos ni en los equipos.

## Historial de sorteos

Se guarda una copia cuando se reemplaza o elimina algo que ya estaba sorteado:

| Motivo | Cuando ocurre |
| --- | --- |
| Se importo la lista de participantes | Al importar un CSV o Excel |
| Se edito o elimino un participante | Al cambiar la lista con equipos ya generados |
| Se regeneraron los equipos | Al volver a generar equipos |
| Se editaron equipos a mano | Al cambiar los equipos manualmente |
| Se volvio a sortear los casos | Al repetir el sorteo de casos |
| Se elimino la sesion | Al borrar una sesion |

Las entradas se consultan en la API con `GET /sessions/{id}/draw-history`.

## Solucion de problemas

| Sintoma | Causa probable | Que hacer |
| --- | --- |
| Vuelve a aparecer la pantalla de inicio | La sesion expiro (12 horas) o la cuenta fue desactivada | Vuelve a iniciar sesion. Si no entra, revisa `active` en `organizers`. |
| "Correo o contrasena incorrectos" | Contrasena mal escrita o organizador sin contrasena | Ejecuta `python -m app.set_organizer_password correo` para fijarla. |
| Error 503 al iniciar sesion | Falta `SESSION_SECRET` en el entorno | Configurala en Vercel y redespliega. |
| `/api/health/db` responde SQLite | Falta `DATABASE_URL` en Vercel | Configurala y redespliega. |
| Los datos desaparecen al redesplegar | La app esta usando SQLite temporal | Configura `DATABASE_URL` con Neon. |
| El QR no abre en el celular | El QR apunta a `localhost` | Configura `VITE_PUBLIC_APP_URL` o usa la URL de Vercel. |
| En Windows, la API no levanta en el puerto 8002 | Un proceso anterior sigue usando el puerto | Cierra ese proceso o reinicia el equipo. |
