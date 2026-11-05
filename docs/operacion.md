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

## Administrar organizadores desde la web

Los administradores no necesitan la consola. En el menú (☰) de la esquina superior izquierda, **Organizadores** abre la pantalla de administración, que solo ven los administradores. Desde ahí pueden:

- Crear un organizador con su correo y una contraseña inicial de al menos 8 caracteres, y darle el rol de administrador si hace falta. La contraseña inicial se comparte por un canal privado.
- Cambiar la contraseña de otra persona, por ejemplo si la olvidó.
- Dar o quitar el rol de administrador, y activar o desactivar cuentas.

Un administrador no puede desactivarse ni quitarse el rol a sí mismo, así que siempre queda al menos uno. Cualquier administrador puede gestionar a los demás.

El primer administrador se crea una sola vez con el comando de arriba y la opción `--admin`:

```bash
python -m app.set_organizer_password correo@ejemplo.com --admin
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
2. En **Sesiones**, crea la sesion con nombre y fecha. Para encontrar una sesion anterior, usa el buscador del historial (por nombre o fecha; no distingue mayusculas ni acentos).
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
- Si alguien escribe un nombre que ya esta registrado en la sesion, la app pregunta si es la misma persona (por ejemplo, cambio de celular). Quien no lo es debe agregar su apellido; asi dos personas con el mismo nombre no se pisan.
- Al abrir la votacion, el registro de jurados se cierra: solo pueden volver a entrar quienes ya estaban registrados. Si llega alguien tarde, usa **Reabrir registro** en la pantalla de Evaluacion (y **Cerrar registro ahora** si quieres cerrarlo antes de abrir la votacion).

Como vota un jurado desde el celular:

1. Escanea el QR y escribe su nombre.
2. Elige un equipo (cada uno muestra su caso) y toca un numero del 1 al 5 en cada criterio. Cada nota muestra su etiqueta: 1 Muy mal, 2 Insuficiente, 3 Aceptable, 4 Bueno, 5 Muy bueno.
3. Puede dejar un comentario opcional y pulsa **Guardar voto**. La pantalla avanza sola al siguiente equipo sin votar y muestra "X de N votados".
4. Mientras la votacion siga abierta puede volver a un equipo y pulsar **Actualizar voto**.

Los criterios por defecto (Presentación y comunicación, Usabilidad y diseño, Innovación, Impacto y relevancia, Calidad técnica) se guardan en español. Al arrancar, la API renombra los criterios que se crearon antes en inglés; los votos no se pierden porque dependen del id del criterio.

Otros detalles: si el jurado se registra antes de que abras la votacion, su pantalla se actualiza sola al abrirla o cerrarla. Lo que puntua y no guarda se conserva al cambiar de equipo o recargar la pagina. Los comentarios se guardan en la tabla `team_scores` (columna `comment`), una vez por criterio, y el reporte los cuenta una sola vez por jurado y equipo.

## Calendario de clientes

En el menú (☰), **Calendario de clientes** muestra las visitas del mes. Cada visita tiene empresa, contacto, notas y fecha. Los viernes aparecen marcados como IA Friday.

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
| "Correo o contraseña incorrectos" | Contraseña mal escrita o organizador sin contraseña | Un administrador puede cambiarla desde **Organizadores**, o ejecuta `python -m app.set_organizer_password correo`. |
| Error 503 al iniciar sesion | Falta `SESSION_SECRET` en el entorno | Configurala en Vercel y redespliega. |
| Un jurado ve "El registro de jurados ya cerró" | La votacion ya se abrio y el jurado no estaba registrado | En **Evaluacion**, pulsa **Reabrir registro**. |
| `/api/health/db` responde SQLite | Falta `DATABASE_URL` en Vercel | Configurala y redespliega. |
| Los datos desaparecen al redesplegar | La app esta usando SQLite temporal | Configura `DATABASE_URL` con Neon. |
| El QR no abre en el celular | El QR apunta a `localhost` | Configura `VITE_PUBLIC_APP_URL` o usa la URL de Vercel. |
| En Windows, la API no levanta en el puerto 8002 | Un proceso anterior sigue usando el puerto | Cierra ese proceso o reinicia el equipo. |
