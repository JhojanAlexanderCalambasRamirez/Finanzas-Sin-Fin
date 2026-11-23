# Ruta de desarrollo

## Estado actual

Version 0.10: dashboard con prioridades, comparacion mensual y feedback visible; simulador de prestamos. JSON version 7 y SQLite esquema 7. Resultado: 49 pruebas unitarias y 39 funcionales aprobadas. Consulta QA.md y MVP.md.

## Checklist de evaluacion continua

- [x] Revisar funcionalidades y ejecutar la suite previa: 53 pruebas aprobadas antes de los cambios.
- [x] Separar comandos de pruebas unitarias y funcionales.
- [x] Corregir consultas simultaneas durante un guardado del cliente.
- [x] Informar el limite de movimientos antes de generar recurrencias.
- [x] Verificar flujo completo de registro, presupuesto, meta, recurrencia, respaldo y restauracion.
- [x] Ejecutar pruebas finales: 49 unitarias y 39 funcionales, cero fallos.
- [x] Validar sintaxis de la interfaz y configuracion Docker Compose.
- [ ] Construir la imagen, validar navegador, movil, scroll y teclado.
- [ ] Ejecutar pruebas de red real y comprobar reinicio del contenedor.

## 1. Estabilizacion

- [x] Pruebas de calculos y validacion de movimientos.
- [x] Pruebas de respaldo, restauracion, duplicados y conflictos.
- [x] Pruebas de almacenamiento local y proteccion de datos corruptos.
- [x] Validacion de sintaxis JavaScript y configuracion Compose.
- [ ] Verificar interfaz en navegador, movil y teclado.
- [ ] Construir y levantar la imagen actualizada en Docker Desktop.
- [ ] Verificar salud del contenedor y funcionamiento tras reinicio.

La validacion visual y Docker continuan pendientes por las restricciones del entorno de pruebas. Esto no impide avanzar en la capa de datos, que tiene pruebas independientes.

## 2. Persistencia en Docker (implementada; validacion de despliegue pendiente)

- [x] Esquema SQLite versionado con migracion inicial.
- [x] Configuracion de volumen persistente y permisos del usuario del contenedor.
- [x] API con validacion, limite de solicitudes y proteccion de origen local.
- [x] Revision transaccional para impedir sobrescrituras de sesiones desactualizadas.
- [x] Interfaz conectada a la API, sin escritura local alternativa si falla el servidor.
- [x] Migracion explicita desde navegador con descarga de respaldo y conservacion del original.
- [x] Pruebas con archivo SQLite real: reapertura, conflictos entre conexiones y rollback.
- [x] Pruebas de API y cliente, incluida respuesta perdida.
- [ ] Comprobar migracion mediante interfaz y restauracion JSON en otra instancia Docker.
- [ ] Recrear contenedor y confirmar que conserva movimientos en el volumen.

## 3. Cuentas y saldos (implementada; validacion visual pendiente)

- [x] Cuentas de efectivo, banco y billetera con saldo inicial y fecha.
- [x] Creacion y edicion de cuentas en la interfaz.
- [x] Movimientos asociados a cuentas y migracion SQL a Cuenta principal.
- [x] Creacion, edicion y eliminacion de transferencias sin alterar ingresos ni gastos.
- [x] Saldos por cuenta y global al cierre del mes, incluidos saldos iniciales.
- [x] Respaldo completo version 2 e importacion de respaldos antiguos version 1.
- [x] Pruebas de migracion real, restauracion, saldos y flujo cliente-API-SQLite.
- [ ] Validar formularios y distribucion visual en navegador y movil.
- [ ] Comprobar actualizacion de la imagen y volumen en Docker Desktop.

## 4. Gestion de movimientos (implementada; validacion visual pendiente)

- [x] Busqueda por palabras sin distinguir mayusculas ni tildes.
- [x] Filtros combinados por mes, tipo, cuenta y categoria.
- [x] Subtotales del listado filtrado y limpieza de filtros.
- [x] Creacion, renombrado, archivo y reactivacion de categorias.
- [x] Renombrado transaccional del historial sin modificar montos.
- [x] Respaldo completo version 3 con compatibilidad de versiones 1 y 2.
- [x] Pruebas de filtros, categorias, API y migracion de esquema 2 a 3.
- [ ] Validar interfaz actualizada en navegador y Docker Desktop.
- [x] Movimientos recurrentes con vista previa, pausa, reactivacion y control de duplicados.
- [x] Persistencia y respaldo de fechas procesadas, incluso si se elimina el movimiento generado.
- [x] Validacion de formatos COP, tipos JSON, texto invisible y fechas incorrectas.
- [x] Paginacion, desplazamiento de tabla, dialogos altos y bloqueo del fondo.
- [ ] Comprobar los cambios visuales de 0.5 en la imagen actualizada y en movil.

## 5. Presupuestos (implementada; validacion visual pendiente)

- [x] Definir limites por mes y categoria con validacion de duplicados.
- [x] Persistir presupuestos en SQLite y conservarlos con clientes anteriores.
- [x] Crear, editar y eliminar limites desde la interfaz.
- [x] Mostrar gasto, disponible, porcentaje y alertas al 80 %, 100 % y exceso.
- [x] Incluir presupuestos en respaldos y aceptar versiones anteriores.
- [x] Probar calculos, migracion, validaciones y restauracion.
- [ ] Validar interfaz y despliegue de la imagen actualizada.

## 6. Metas y obligaciones (implementada; validacion visual pendiente)

- [x] Definir metas de ahorro con valor objetivo, inicio y fecha objetivo opcional.
- [x] Registrar, editar y eliminar aportes de seguimiento sin crear ingresos ni gastos.
- [x] Mostrar avance, cumplimiento, vencimiento y fecha de corte del periodo.
- [x] Archivar o reactivar metas y consultar su historial completo.
- [x] Registrar deudas, cuotas y vencimientos.
- [x] Asociar pagos con movimientos y comprobar saldos pendientes.
- [x] Persistir deudas y pagos, migrar esquema 6 a 7 y restaurar sin duplicados.
- [x] Incluir metas y aportes en SQLite y respaldos, conservandolos con clientes anteriores.
- [x] Probar calculos, entradas invalidas, restauracion y migracion del esquema 5 al 6.
- [ ] Validar formularios de metas y aportes en navegador y movil.

Siguiente validacion: formularios de deudas, pagos e informes en navegador y Docker.

## 7. Informes

- [x] Evolucion de ingresos, gastos y balance de seis meses.
- [x] CSV de todos los resultados filtrados, sin duplicar transferencias.
- [x] Pruebas de meses vacios, filtros y escape de formulas.
- [ ] Validar descarga y presentacion en navegador.

## 8. Usuarios y acceso

Autenticacion, separacion de datos por usuario y sesiones protegidas antes de exponer la aplicacion a terceros.

## 9. Despliegue y recuperacion

Configuracion por entorno, HTTPS, respaldos y prueba documentada de restauracion completa.

## 10. Preparacion de GitHub

- [x] Descripcion y temas en GITHUB.md.
- [x] Exclusiones de datos locales y respaldos.
- [x] Workflow para Windows, Linux y Docker preparado.
- [x] Plantilla de pull request y revision de sintaxis/HTML.
- [ ] Conectar remoto, elegir licencia y revisar primer commit.
- [ ] Confirmar primera ejecucion real de GitHub Actions.

## 11. Dashboard y cierre del MVP

- [x] Indicadores de balance/ingresos, variacion de gastos y deuda pendiente.
- [x] Alertas de cuotas vencidas, presupuestos y cuentas negativas con enlaces al detalle.
- [x] Feedback visible de guardado y recarga tras error.
- [x] Simulador de prestamo con tasa efectiva anual y amortizacion.
- [x] Prueba por HTTP real y reapertura SQLite con datos de ejemplo.
- [ ] Validar interfaz con navegador, movil, teclado y zoom.
- [ ] Ejecutar recuperacion y persistencia en Docker.
- [ ] Completar criterios de salida en MVP.md.

## 12. Primer uso reproducible

- [x] Aprovisionamiento SQLite automatico e idempotente.
- [x] Comando npm run db:init y prueba desde cero con datos conservados.
- [x] README estructurado con creditos al autor y guia de instalacion.
- [x] Revision de flujo documentada en docs/UX-REVIEW.md.
- [x] Remoto configurado; entrega preparada sobre el commit inicial existente.

## Copia mensual de limites

- [x] Vista previa y confirmacion explicita.
- [x] Omite limites existentes y categorias archivadas.
- [x] Repetir no duplica ni modifica gastos.
- [x] Pruebas de entradas invalidas, colisiones, SQLite y respaldo.
- [ ] Validacion del nuevo dialogo en navegador.

## Reestructuracion 0.10

- [x] Dominio independiente de DOM, HTTP y SQLite.
- [x] Servicio de aplicacion y adaptador SQLite separados.
- [x] Migraciones separadas del repositorio y base conservada en data/.
- [x] Frontend dividido en 11 funcionalidades y sesion sin DOM.
- [x] Pruebas y utilidades separadas en tests/unit, integration y helpers.
- [x] Restricciones de dependencias verificadas automaticamente.
- [x] Arranque del servidor real desde cero y reinicio con persistencia.
- [x] Grafo HTTP de modulos y rechazo de rutas privadas.
- [x] Bootstrap web con DOM simulado, apertura de formularios, registro y simulacion.
- [ ] Validacion visual completa y construccion Docker en un entorno con acceso al motor.

## Gastos fijos 0.11

- [x] Plan mensual de transporte, cabello y cuotas con importe previsto, registrado y pendiente.
- [x] Reutilizar reglas mensuales, pausa, fecha final y deduplicacion existentes.
- [x] Registrar solo el mes confirmado y conservar vinculos en SQLite y respaldo.
- [x] Detectar importes parciales, registros eliminados y categorias archivadas.
- [x] 92 pruebas aprobadas: 52 unitarias y 40 de integracion.
- [x] Pagina, 32 modulos, salud y API devuelven 200 en 3081, sin escrituras financieras de prueba.
- [ ] Revision visual real y prueba completa en Docker.


## Migracion simple por archivo

- [x] Retirar configuracion LAN, HTTPS y autenticacion compartida del alcance.
- [x] Exportar todos los datos financieros y meses en un JSON completo.
- [x] Cargar con vista previa, confirmacion y deteccion de duplicados y conflictos.
- [ ] Prueba visual completa en navegador.

Verificacion del flujo simplificado: 95 pruebas aprobadas (54 unitarias y 41 de integracion). Se prueba un JSON completo entre dos bases independientes, con todos los modulos, saldos y reapertura del destino.

## Perfiles 0.13

- [x] Primer administrador conserva datos anteriores; perfiles nuevos independientes.
- [x] Login, logout y sesiones persistentes de 12 horas, revocacion y limite de intentos.
- [x] Cambio de nombre, usuario y contrasena propia; crear y desactivar/reactivar perfiles.
- [x] Roles y acceso a finanzas comprobados en el servidor, incluidos endpoints anteriores.
- [x] Pruebas de aislamiento, alta concurrente, vencimiento y migracion.
- [x] Bootstrap de login y formularios de perfiles con DOM simulado.
- [ ] Recuperacion de contrasena, revision visual completa y despliegue publico.

Validacion 0.13: 101 pruebas aprobadas (56 unitarias y 45 de integracion); 86 archivos JavaScript y 184 identificadores HTML comprobados.
