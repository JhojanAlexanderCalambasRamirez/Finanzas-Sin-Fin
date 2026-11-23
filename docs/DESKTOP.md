# Aplicación de escritorio

## Para quien usa la aplicación

Windows disponible en esta entrega: extrae completamente `Finanzas-Sin-Fin-0.14.0-Windows-x64.zip`, abre la carpeta `win-unpacked` y ejecuta `Finanzas Sin Fin.exe`. Conserva las bibliotecas junto al EXE. No necesitas instalar Node.js ni Docker. El instalador con acceso directo está configurado, pero su generación no pudo completarse en este entorno.

macOS pendiente de generar: una vez construido el DMG correspondiente a tu equipo (arm64 para Apple Silicon; x64 para Intel), se abre y se arrastra la aplicación a Aplicaciones. Los instaladores de macOS se generan en un Mac; la configuración no equivale a una validación realizada en ese sistema.

La primera vez crea tu administrador. Los perfiles nuevos tienen finanzas independientes. Para traer tus finanzas desde la versión web, exporta el JSON desde ella e impórtalo en la aplicación de escritorio. No se copia automáticamente ninguna base de otra instalación.

Los datos se guardan en la carpeta de usuario de Electron, fuera del programa. En Windows normalmente `%APPDATA%\Finanzas Sin Fin`; en macOS `~/Library/Application Support/Finanzas Sin Fin`. Usa **Archivo → Mostrar carpeta de datos** para encontrar la ubicación real. No se borran al actualizar ni se incluyen en el instalador.

Al exportar se abre Guardar como. La página muestra la ruta completa del archivo y **Mostrar última copia en carpeta** abre el Explorador o Finder. La copia sigue siendo JSON de las finanzas del perfil activo, no un respaldo físico completo de todas las bases y credenciales.

## Desarrollo y generación

Requiere Node.js 24 o superior y acceso a Internet para descargar las herramientas de construcción:

```sh
npm ci
npm run desktop
npm run desktop:smoke
npm run dist:win
```

En macOS usa `npm run dist:mac`. Los archivos se generan en `dist/`. También se incluye el flujo manual de GitHub Actions **Desktop installers**, que construye en Windows y macOS y guarda los instaladores como artefactos. No publica una release automáticamente.

`desktop:smoke` abre una ventana oculta, usa una carpeta temporal independiente, prueba SQLite, primer perfil, API protegida y puente de escritorio, y muestra la ruta del informe. No modifica los datos personales. Una segunda instancia de la aplicación enfoca la primera.

El servidor escucha solamente en loopback y elige un puerto libre. La ventana tiene aislamiento de contexto, sandbox y Node deshabilitado. El puente nativo solo permite guardar respaldos JSON y mostrar el último archivo guardado; no acepta rutas arbitrarias para abrir carpetas.

## Límites de esta entrega

Los instaladores locales no están firmados con certificados comerciales ni notarizados por Apple. No hay actualización automática, recuperación de contraseña ni restauración física de toda la instalación. La validación automatizada no sustituye probar instalación, actualización y desinstalación en equipos reales Windows/macOS.

## Resultado local de construccion

La aplicacion Windows se empaqueta en dist/win-unpacked/Finanzas Sin Fin.exe, con sus bibliotecas en la misma carpeta. Esa carpeta puede distribuirse comprimida: extrae todo y abre el EXE, sin instalar dependencias. No copies solamente el EXE. El instalador NSIS no pudo completarse en este entorno: la ejecucion de makensis falla con spawn UNKNOWN. Electron tambien se cierra antes de completar la prueba visual. La compatibilidad SQLite del motor incluido se comprobo por separado con Node 24.22.3, y las 106 pruebas del proyecto pasan. Falta ejecutar el smoke de ventana y el instalador fuera de este entorno. npm audit informa seis avisos moderados transitivos de las herramientas de empaquetado; no se incluyen como dependencias de ejecucion en la app.
