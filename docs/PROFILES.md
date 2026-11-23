# Inicio de sesión y perfiles

## Primer uso

1. Inicia la aplicación y abre su dirección local.
2. Si todavía no existen perfiles, aparecerá Crear mi perfil.
3. Introduce un nombre, un usuario de 3 a 32 caracteres y una contraseña de 12 a 128 caracteres.
4. Ese primer perfil será administrador y conservará los datos financieros que existían antes de esta actualización.

No hay credenciales predeterminadas. Si dos personas intentan crear el primer administrador simultáneamente, solo una operación se confirma.

## Gestionar perfiles

En Mi perfil puedes cambiar nombre visible, usuario y contraseña. Para cambiar la contraseña debes introducir la actual. El cambio revoca las otras sesiones; la sesión actual recibe una credencial nueva.

El administrador puede crear hasta 20 perfiles en total y desactivar o reactivar perfiles sin borrar sus finanzas. No puede desactivar su propia cuenta. Los demás perfiles no pueden gestionar usuarios. Cada perfil nuevo recibe una cuenta principal y categorías iniciales, sin movimientos ajenos.

El administrador administra accesos, pero no puede consultar las finanzas de otros perfiles a través de la aplicación. Cada persona debe iniciar sesión con su usuario para ver sus cuentas.

## Sesiones y protección

Las contraseñas usan scrypt con una sal aleatoria por contraseña y versión del algoritmo. No se guardan en texto plano. Las sesiones usan tokens aleatorios cuyo hash se almacena en SQLite, con vencimiento de 12 horas. La cookie es HttpOnly y SameSite=Strict; no se guardan tokens en localStorage.

Las consultas y escrituras financieras vuelven a comprobar la sesión en el servidor. El identificador de perfil que envíe un cliente no decide qué base se consulta. Cerrar sesión invalida la credencial; desactivar un perfil invalida sus sesiones y reactivarlo no revive las antiguas.

Hay un límite temporal de intentos de acceso. Los mensajes de login no indican si existe el usuario. Las pantallas no sustituyen la autorización del servidor.

La aplicación continúa destinada al uso local. El login no sustituye los permisos del sistema operativo ni cifra los archivos de datos. No se certifica su publicación por Internet.

## Dónde se guardan los datos

Con DATABASE_PATH predeterminado:

| Archivo o carpeta | Uso |
| --- | --- |
| `data/finanzas.sqlite` | Finanzas existentes, asignadas al primer administrador. |
| `data/finanzas.sqlite.profiles.sqlite` | Identidades y sesiones. |
| `data/finanzas.sqlite.profiles/` | Una base financiera por perfil nuevo, identificada por UUID. |

Estos archivos permanecen dentro del volumen de datos cuando se usa Docker. Las rutas se derivan de DATABASE_PATH, para que dos instalaciones con archivos distintos no compartan identidades accidentalmente. Cambiar el nombre de un usuario no cambia la ubicación ni el identificador de sus finanzas.

## Respaldos y otro PC

Exportar todos mis datos descarga únicamente los datos financieros del perfil activo. Las identidades, contraseñas y sesiones no se incluyen en JSON. En el otro PC crea un perfil y carga su respaldo. No se mezclan automáticamente las finanzas de varios usuarios.

La migración antigua desde localStorage solo se ofrece al administrador. Ese almacenamiento pertenece a versiones anteriores y no constituye un almacén protegido por perfil; los datos nuevos se guardan en SQLite.

## Pendientes

- Recuperación de contraseña olvidada y restablecimiento de acceso por el administrador.
- Verificación visual completa de teclado, móvil y gestores de contraseñas.
- Una descarga/restauración física de SQLite desde la página sigue pendiente; el respaldo disponible es JSON.

No borres archivos de datos para recuperar una contraseña. Conserva tus credenciales en un gestor mientras se incorpora recuperación.
