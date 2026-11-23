# Arquitectura de Finanzas Sin Fin

## Objetivo y alcance

Organizar el sistema por responsabilidades y dependencias comprobables. No se introduce un framework ni una capa por cada función: la aplicación sigue siendo local, con Node.js, módulos ES y SQLite.

La reestructuración conserva las reglas financieras, el contrato JSON, los endpoints `/api/state` y `/api/transactions`, el esquema SQLite 7 y los respaldos versión 7. No mueve ni reinicia la base personal de `data/`.

## Estructura

| Área | Contenido | Puede depender de |
| --- | --- | --- |
| `src/domain` | Cuentas, movimientos, categorías, presupuestos, recurrencias, metas, deudas, informes y simulación | Otros módulos del dominio |
| `src/application` | Servicio del libro financiero y errores de aplicación | Dominio y contratos de aplicación |
| `src/infrastructure/sqlite` | Repositorio, migraciones y aprovisionamiento | Dominio, aplicación y SQLite |
| `src/server/http` | Política de acceso local, JSON, rutas y recursos públicos | Aplicación y utilidades HTTP |
| `src/server/main.js` | Composición del backend y ciclo de vida | Adaptadores de infraestructura y HTTP |
| `src/web/features` | Controladores de cada funcionalidad, formularios y renderizado | Dominio, utilidades y dependencias explícitas |
| `src/web/application` | Estado de sesión, carga y coordinación de guardado | Dominio y contrato del almacén de datos |
| `src/web/data` | Adaptación HTTP y almacenamiento local anterior | Dominio y APIs de transporte/almacenamiento |
| `src/web/shared` | Formatos, selectores e interacciones generales | Plataforma web y validación compartida |
| `tests/unit` | Reglas, servicio, sesión y arquitectura | Código probado y dobles específicos |
| `tests/integration` | SQLite, API, red, bootstrap y reinicio | Composición de componentes |

Los controladores web no importan otros controladores de funcionalidades. El dominio no conoce carpetas web, servidor, infraestructura ni módulos `node:`. HTTP no importa SQLite: recibe un repositorio mediante inyección y lo adapta a un servicio de aplicación. Estas restricciones se comprueban en `tests/unit/architecture.test.js`.

## Backend

`src/server/main.js` conecta el repositorio SQLite con el adaptador HTTP. Es el lugar donde se permite conocer implementaciones concretas.

`application/ledger-service.js` hidrata colecciones omitidas por clientes anteriores, valida el agregado financiero y delega su persistencia. El contrato del repositorio incluye `readState`, `replaceState`, `read`, `replace` y `health`. Se inyecta un objeto; el servicio no abre conexiones ni construye SQL.

`infrastructure/sqlite/ledger-repository.js` ejecuta lecturas consistentes y escrituras atómicas. Conserva la comprobación de revisión dentro del bloqueo de escritura. También mantiene validación defensiva para sus consumidores directos.

`infrastructure/sqlite/migrations.js` concentra la evolución ordenada del esquema. `provision.js` prepara y comprueba la instalación sin sembrar movimientos ficticios.

### Por qué un repositorio del agregado financiero

La API actual guarda un estado financiero relacionado: borrar un gasto puede eliminar el vínculo de un pago, renombrar una categoría actualiza su historial y restaurar un respaldo afecta varios módulos. Estas operaciones deben confirmar o revertir juntas.

Separar una transacción independiente por tabla rompería esa garantía. Por eso se mantiene un repositorio del agregado, con migraciones aparte, en lugar de introducir repositorios independientes que hagan commits parciales. Si el volumen de datos exige operaciones incrementales, se añadirán casos de uso conservando una unidad de trabajo transaccional.

### HTTP

- `protocol.js`: política local, lectura JSON, límite de tamaño y respuestas.
- `ledger-routes.js`: métodos y adaptación de solicitudes de estado/movimientos.
- `handler.js`: selección de rutas y traducción de errores.
- `static-assets.js`: registro de recursos públicos.

Solo se publican JavaScript y CSS de `src/domain` y `src/web`, además del documento HTML. Infraestructura, servidor, aplicación backend, pruebas y archivos de datos no se sirven. Los alias de los módulos antiguos se mantienen para clientes con páginas previamente cargadas.

## Frontend

`src/web/main.js` es la raíz de composición: crea sesión y controladores, conecta sus callbacks y coordina el renderizado. No almacena estados de edición de metas, pagos o presupuestos.

Cada carpeta de `features` tiene su controlador: `accounts`, `movements`, `categories`, `budgets`, `recurrences`, `goals`, `debts`, `reports`, `dashboard`, `loans`, `fixed-expenses` y `backups`. Sus variables de edición quedan en el cierre privado de su fábrica.

Los controladores reciben únicamente las capacidades que usan: consultar estado, guardar, notificar, solicitar renderizado y utilidades de presentación. No reciben un contenedor global de toda la aplicación ni importan controladores hermanos.

`application/ledger-session.js` conserva el estado confirmado y controla carga, doble envío y respuestas inciertas. No consulta el DOM. `data/api-store.js` conserva el protocolo de revisión y las restricciones del transporte; ambos se prueban por separado.

El HTML sigue siendo un documento estático de composición, con diálogos nativos y selectores estables. Los estilos están separados del comportamiento en `styles`. No se introduce un motor de plantillas propio ni un bundler solo para dividir el documento.

## Cómo añadir una funcionalidad

1. Definir las reglas puras y validaciones en dominio.
2. Añadir un caso de uso de aplicación si coordina persistencia o varios dominios.
3. Incorporar datos nuevos mediante migración y compatibilidad de respaldos cuando corresponda.
4. Crear el controlador de interfaz en su carpeta de funcionalidad, con dependencias explícitas.
5. Conectarlo en la raíz de composición; no acceder al estado privado de otro controlador.
6. Añadir pruebas de reglas, persistencia y recorrido de integración apropiadas.
7. Ejecutar `npm run check` y `npm test`, y comprobar el flujo visual afectado.

El módulo fixed-expenses reutiliza las recurrencias mensuales y sus identificadores. No introduce tablas ni duplica calendarios; sus reglas y controlador están separados como las demás funcionalidades.

## Validación y límites

- Las 82 pruebas existentes siguen pasando.
- Se añadieron pruebas de límites de arquitectura, servicio y sesión.
- HTTP real recorre los imports del frontend y comprueba que las rutas privadas respondan 404.
- El servidor se inicia como proceso real con una base nueva y conserva registros tras reiniciar.
- El bootstrap de interfaz usa un DOM simulado: comprueba composición, apertura de formularios, registro de un ingreso y simulación válida/inválida.

El DOM simulado no certifica aspecto, scroll, foco real ni accesibilidad completa. La revisión visual y la construcción del contenedor siguen pendientes del entorno que permita ejecutarlas.

## Entrega y copia de publicación

La fuente de trabajo es `src/` en la carpeta principal. `publication-worktree` es una copia excluida de Git utilizada para preparar commits porque el índice Git de la carpeta principal está restringido por el entorno. No es un paquete, módulo ni dependencia de la aplicación; nunca debe importarse ni incluirse en Docker. Puede retirarse cuando se trabaje desde una clonación normal con permisos de Git.

## Identidad y aislamiento

La entrada HTTP de produccion usa profile-handler y el servicio de identidad antes del adaptador financiero. Las credenciales y sesiones se guardan en el registro SQLite de perfiles; cada UUID selecciona su repositorio financiero exclusivamente en el servidor. El primer administrador conserva la base anterior. Las reglas financieras y el formato de respaldo no cambian. Consulta PROFILES.md para rutas y alcance.
