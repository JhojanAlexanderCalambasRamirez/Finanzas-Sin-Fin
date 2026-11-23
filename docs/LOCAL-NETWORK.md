# Una base de datos para varios PC

## Qué se comparte

Un único PC ejecuta el servidor y abre SQLite. Los demás usan su navegador contra esa dirección HTTPS. No se copian bases entre equipos ni se comparte el archivo SQLite por red. Es un solo espacio financiero personal con un acceso compartido; no es multiusuario con datos aislados.

## Preparar el PC central

1. Instala el proyecto y Node.js 24 o superior.
2. Conserva la base actual en `data/finanzas.sqlite`, o carga su respaldo JSON desde la página.
3. Obtén un certificado HTTPS para la IP o nombre del PC central, emitido por una autoridad en la que confíen tus equipos. Coloca certificado y clave privada en `certs/server-cert.pem` y `certs/server-key.pem`. No uses los certificados públicos de tests/fixtures.
4. Copia `lan.env.example` a `lan.env`. Ajusta la IP/nombre y define tu contraseña. El archivo local y certs/ están excluidos de Git.
5. Ejecuta desde la carpeta del proyecto:

```powershell
npm run start:lan
```

El servidor falla al arrancar si faltan certificado, clave o credenciales válidas en modo LAN. No instala certificados, cambia firewall ni abre puertos automáticamente.

## Entrar desde otro PC

Abre `https://IP-DEL-PC-CENTRAL:3081`, usando el host que configuraste, no localhost. El navegador solicitará usuario y contraseña mediante autenticación HTTP. El PC central debe permanecer encendido y ser accesible desde tu red.

El certificado debe ser válido y confiable en ese equipo. No ignores las advertencias del navegador: corrige la dirección, el certificado o la confianza con el administrador de tu equipo. Permite el puerto solo en la red privada desde la configuración del firewall si es necesario.

El navegador puede conservar las credenciales hasta cerrar la sesión de navegación. Usa una ventana privada en equipos compartidos y ciérrala al terminar. Este mecanismo no incorpora administración de usuarios, recuperación de contraseña ni un cierre de sesión de aplicación.

## Cargar datos

En el equipo antiguo exporta el JSON completo. Abre la instancia central, selecciona Importar respaldo y revisa la tabla de cantidades y saldo resultante. Confirma después de revisar. Antes de escribir se prepara una descarga del estado anterior; comprueba que el navegador la guarde.

Los registros idénticos no se duplican; los conflictos cancelan la operación completa. CSV no restaura toda la aplicación. Después de migrar, todos los PC deben usar la dirección central, en lugar de mantener instalaciones independientes editadas en paralelo.

## Actualización de información

Cada navegador lee la misma base central, pero no hay sincronización automática en tiempo real: recarga para ver cambios de otro equipo. Una revisión antigua se rechaza para impedir sobrescrituras. Los respaldos JSON siguen siendo el mecanismo de migración y recuperación.

## Límites y verificación

Se prueban HTTPS real con un certificado exclusivamente de pruebas, autenticación, origen, lectura y escritura en SQLite. No se ha comprobado conexión entre tus equipos físicos, confianza de certificados, firewall o ejecución Docker con TLS.

El modo local y Compose habituales conservan sus valores predeterminados. Este procedimiento de LAN inicia Node directamente; el contenedor predeterminado no monta certificados ni configura el modo LAN por sí solo. No está preparado para publicarlo directamente en Internet.

Si lan.env no existe, el comando lo crea a partir del ejemplo y muestra lo que falta antes de iniciar. Edita ese archivo para completar la direccion real, la contrasena y los certificados. Si ya existe, nunca se sobrescribe automaticamente.
