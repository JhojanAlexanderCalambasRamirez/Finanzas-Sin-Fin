# Revision de calidad: version 0.9

## Resultados automaticos

Evaluacion realizada el 23 de noviembre de 2026. La suite previa de 53 pruebas paso antes de modificar el codigo. Resultado final con Node.js 24: **45 pruebas unitarias y 37 funcionales aprobadas, cero fallos y cero omitidas**. La configuracion Compose y la sintaxis JavaScript se validaron. La suite utiliza archivos SQLite reales. Las pruebas de API usan transporte simulado y, adicionalmente, network.test.js levanta un servidor HTTP real en un puerto efimero sobre loopback. Esto no sustituye la prueba de navegador o Docker.

## Checklist funcional actual

| Funcionalidad | Implementada | Comprobacion automatica | Pendiente |
| --- | --- | --- | --- |
| Ingresos, gastos y saldos | Si | Calculos, validacion y guardado | Interfaz y red real |
| Cuentas y transferencias | Si | Saldos por cuenta y saldo global | Movil y teclado |
| Categorias y filtros | Si | Renombrado, archivo, busqueda y combinaciones | Interfaz actualizada |
| Recurrencias | Si | Calendario, idempotencia, pausas y limites | Vista previa en navegador |
| Presupuestos | Si | Umbrales, duplicados, migracion y rollback | Tarjetas y formularios |
| Metas y aportes | Si | Avance, vencimiento, edicion y no alteracion de cuentas | Interfaz y movil |
| Respaldos | Si | Restauracion completa, conflictos y compatibilidad | Descarga e importacion desde navegador |
| SQLite y API | Si | Reapertura, migraciones, concurrencia y rechazo sin cambios | HTTP sobre red y Docker |
| Deudas y pagos | Si | Cuotas, abonos, referencias y restauracion | Formularios en navegador |
| Informes y CSV | Si | Meses vacios, filtros y escape de formulas | Descarga y visualizacion |
| Usuarios y sesiones | No | Pendiente | Autenticacion y aislamiento |

### Cambios verificados en 0.8

- [x] Cuotas exactas, vencimientos y abonos parciales.
- [x] Vincular gastos sin duplicar salidas de dinero.
- [x] Rechazar sobrepagos y gastos vinculados a varias deudas.
- [x] Migracion SQLite y restauracion de deudas y pagos.
- [x] Informes de seis meses y CSV filtrado con proteccion contra formulas.
- [x] Sintaxis de 30 archivos JavaScript y 115 identificadores HTML sin duplicados.
- [x] Workflow preparado; no ejecutado todavia en GitHub.
- [ ] Probar formularios, historial y CSV en navegador.
- [ ] Construir y reiniciar la imagen Docker actualizada.

### Cambios verificados en 0.7

- [x] Crear metas, objetivos y fechas opcionales.
- [x] Registrar, editar y eliminar aportes, y archivar metas sin perder historial.
- [x] Los aportes no cambian ingresos, gastos ni saldos de cuentas.
- [x] Rechazar objetivos invalidos, aportes huerfanos y fechas anteriores al inicio.
- [x] Persistir y restaurar metas y aportes sin duplicados.
- [x] Migrar esquema 5 a 6 conservando finanzas existentes.
- [x] Un error SQL devuelve el estado completo a su version anterior.
- [x] Bloquear consultas del cliente mientras hay un guardado pendiente.
- [x] Avisar del limite de 5000 movimientos antes de confirmar recurrencias.
- [x] Flujo completo: registrar ingresos/gastos y transferencia, definir presupuesto y meta, registrar aporte, generar recurrencia, respaldar, restaurar en otra base y reabrir.
- [ ] Validar formularios, scroll y navegacion de la version 0.8 en navegador.
- [ ] Construir e iniciar la imagen Docker actualizada. El motor sigue denegando acceso desde este entorno.

Comandos ejecutados: `npm run check`, `npm run test:unit`, `npm run test:functional`, `node --check app.js` y `docker compose config --quiet`.

### Presupuestos verificados en 0.6

- [x] Consumo por categoria y mes, sin descontar ingresos u otros meses.
- [x] Estados de disponible, 80 %, limite exacto y exceso.
- [x] Rechazo de limites duplicados, categorias inexistentes y montos invalidos.
- [x] Renombrado y archivo de categorias conservan limites y calculos.
- [x] Restauracion JSON y compatibilidad con respaldos anteriores.
- [x] Persistencia SQLite y preservacion con clientes que omiten presupuestos.
- [x] Migracion de esquema 4 a 5 conserva los registros anteriores.
- [x] Un fallo SQL revierte juntos cambios de presupuestos y movimientos.
- [ ] Validar las tarjetas y formularios de presupuesto en navegador y movil.
- [ ] Actualizar y verificar la imagen en Docker Desktop.

### Correcciones y casos cubiertos

- El tipo de cuenta ya no acepta arrays por coercion: `type: ["bank"]` se rechaza como entrada invalida.
- Los catalogos explicitamente nulos se rechazan en vez de sustituirse silenciosamente por categorias predeterminadas.
- Los importes de formulario admiten enteros y puntos de miles. Exponentes, decimales, letras, prefijos de moneda y formatos ambiguos se rechazan.
- Los importes recibidos por API deben ser numeros enteros, no cadenas ni booleanos.
- Se rechazan fechas inexistentes, anio cero, texto vacio, controles invisibles y caracteres de reemplazo.
- Una entrada invalida produce HTTP 400 y mantiene el estado SQLite y su revision.
- Se conserva la proteccion ante sobrescrituras de otras sesiones y respuestas de guardado perdidas.
- Las recurrencias respetan febrero bisiesto, fin de mes, frecuencia semanal, fecha final y pausas.
- Generar otra vez, editar o eliminar un movimiento generado no vuelve a crear su fecha.
- SQLite y los respaldos conservan reglas y fechas procesadas.
- Los respaldos antiguos siguen siendo compatibles.

## Ajustes de interfaz aplicados

- Dialogos con altura limitada al viewport y desplazamiento propio.
- Bloqueo del desplazamiento del fondo al abrir dialogos.
- Menu lateral desplazable en ventanas bajas.
- Columnas de rejilla que pueden reducirse sin desbordar toda la pagina.
- Tabla con scroll horizontal y vertical, encabezado fijo y acceso con teclado.
- Paginacion de 25 filas y subtotales sobre todos los resultados.
- Ajuste de textos largos, controles y columnas de formulario en pantallas estrechas.
- Aumento de legibilidad de etiquetas, cabeceras y textos de apoyo.
- Campos de formulario bloqueados durante el guardado y controles de doble envio.
- Recuperacion del ultimo mes valido si se borra o altera el selector de periodo.
- Limpieza de filtros al guardar un movimiento para que el registro sea visible.
- Navegacion activa acorde a la seccion visible durante el desplazamiento.

## Revision visual realizada y limites

Se inspecciono en Brave la instancia existente en localhost:3080. Mostraba una version anterior, con cuentas y transferencias pero sin los filtros nuevos. Se abrio el formulario, se intento enviarlo vacio y se cerro sin guardar datos. Esta comprobacion no certifica la interfaz de 0.5.

El motor Docker sigue rechazando el acceso desde el entorno del agente. No se pudo construir o desplegar la imagen actualizada, ni probar en ella el scroll o todos los datos invalidos desde la interfaz. Los cambios visuales anteriores estan implementados, pero requieren la siguiente comprobacion manual:

1. Exportar un respaldo de la instalacion actual.
2. Ejecutar `docker compose up -d --build --wait` y recargar.
3. Probar anchos de 320, 375, 768 y 1440 px, y una ventana baja.
4. Abrir cada dialogo. Comprobar que todos los campos y el boton de guardado sean alcanzables.
5. Confirmar que la tabla se desplaza dentro de su panel y no ensancha toda la pagina.
6. Probar vacios, espacios, texto invisible, `1e3`, `1,50`, montos negativos y fechas inexistentes.
7. Probar `50.000` y verificar que se guarde como 50000 COP.
8. Crear una regla de prueba, revisar pendientes y confirmar dos veces. La segunda vista previa no debe repetir registros.
9. Exportar e importar el respaldo en otra instancia y comparar saldos, reglas y fechas procesadas.
10. Reiniciar el servicio y comprobar la persistencia.

## Verificacion de 0.9

- [x] Dashboard: periodo inicial, meses vacios, comparacion, tasa sin ingresos, presupuestos y deudas archivadas.
- [x] Simulador: tasa cero, tasa efectiva, amortizacion exacta e importes invalidos.
- [x] HTTP real: salud, archivos publicos, alta de gasto 50000 COP, monto de texto rechazado, conflicto 409, reapertura persistente.
- [x] Sintaxis: 35 archivos JavaScript; HTML: 131 identificadores sin duplicados.
- [x] Configuracion Compose valida.
- [ ] Construccion Docker: acceso denegado al motor dockerDesktopLinuxEngine.
- [ ] Revision visual actual: automatizacion del navegador bloqueada al verificar la URL en el turno anterior; no se considera aprobada.

Los datos del test HTTP se crean en una base temporal separada y se eliminan al terminar. No se escriben movimientos de prueba en la base personal.

## Aprovisionamiento y flujo

- [x] Base nueva en directorios inexistentes: cuenta principal, categorias y esquema completo.
- [x] Repetir aprovisionamiento conserva datos y revision.
- [x] Comando db:init probado como proceso real.
- [x] Orden DOM: resumen, movimientos, cuentas; categorias y respaldos accesibles desde menu.
- [x] 82 pruebas totales aprobadas antes de publicar.
- [ ] Validacion visual y contenedor Docker completos.

## Copia mensual de limites

- [x] Vista previa y confirmacion explicita.
- [x] Omite limites existentes y categorias archivadas.
- [x] Repetir no duplica ni modifica gastos.
- [x] Pruebas de entradas invalidas, colisiones, SQLite y respaldo.
- [ ] Validacion del nuevo dialogo en navegador.
