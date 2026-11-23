# Criterios de salida del MVP

## Alcance

MVP local: una persona administra su espacio financiero en COP, desde su equipo, con SQLite y Docker. No requiere multiusuario para cumplir este alcance.

MVP publicado: varias personas acceden por Internet con identidad, sesiones protegidas y datos aislados. Esta modalidad requiere trabajo adicional y aun no esta lista.

## Lo implementado

- [x] Ingresos, gastos, cuentas y transferencias conciliados.
- [x] Categorias, filtros, paginacion y CSV.
- [x] Presupuestos y recurrencias con deduplicacion.
- [x] Metas y aportes de seguimiento.
- [x] Deudas, cuotas y pagos vinculados a gastos.
- [x] Simulador de prestamos con tasa efectiva anual y amortizacion.
- [x] Dashboard con comparacion mensual y alertas accionables.
- [x] Validacion de entradas y control de revision contra sobrescrituras.
- [x] SQLite, migraciones y respaldos JSON portables.
- [x] 45 pruebas unitarias y 35 funcionales, incluida una prueba HTTP real.

## Cuatro bloques para cerrar el MVP local

### 1. Experiencia completa en navegador

- [ ] Ejecutar altas, ediciones y eliminaciones desde la interfaz con datos de ejemplo separados.
- [ ] Verificar formularios invalidos y errores de conexion/conflicto sin perder datos.
- [ ] Validar 320, 375, 768 y 1440 px; ventana baja, zoom al 200 % y textos largos.
- [ ] Recorrer por teclado, comprobar foco al cerrar dialogos y anunciar errores.
- [ ] Comprobar descarga CSV y exportacion/importacion JSON.

### 2. Despliegue y recuperacion

- [ ] Construir la imagen y levantar Compose sin modificar otros proyectos.
- [ ] Recrear el contenedor y conservar datos del volumen.
- [ ] Restaurar JSON en una instancia vacia y conciliar saldos, deudas y recurrencias.
- [ ] Documentar actualizacion y recuperacion ante un fallo real de arranque.

### 3. Estabilizacion funcional

- [ ] Completar prestamo real: desembolso, separacion de capital/interes y conciliacion de pagos. El simulador actual no implementa este flujo.
- [ ] Revisar limites con historiales grandes y ultimas cuotas/redondeos en UI.
- [ ] Resolver los bugs encontrados en la validacion manual y repetir los flujos afectados.

### 4. Entrega reproducible

- [ ] Conectar el repositorio y revisar que no incluya datos personales.
- [ ] Confirmar GitHub Actions en Windows, Linux y Docker.
- [ ] Etiquetar una version candidata y completar una instalacion limpia documentada.

## Para ofrecerlo a terceros

- [ ] Autenticacion y sesiones seguras.
- [ ] Aislamiento por usuario en consultas, escrituras y respaldos.
- [ ] Recuperacion de acceso y pruebas de permisos entre usuarios.
- [ ] HTTPS, gestion de secretos y operacion de respaldos.

No se asigna un porcentaje de avance: el codigo implementado y la validacion de uso son criterios diferentes. El MVP local tiene su nucleo funcional; los cuatro bloques anteriores determinan su robustez. El MVP publicado agrega los controles de acceso y operacion indicados.
