# Evaluación del flujo y usabilidad

Revisión del código, orden del documento, navegación y mensajes. No equivale a una prueba visual con usuarios: móvil, zoom, teclado y lector de pantalla siguen pendientes.

| Hallazgo | Consecuencia | Cambio aplicado |
| --- | --- | --- |
| Categorías y respaldos sin enlaces | Difíciles de encontrar al final | Accesos directos en el menú. |
| Cuentas antes del listado | Retrasa la revisión frecuente de movimientos | Orden DOM: resumen, movimientos, cuentas y planificación. |
| Muchos módulos y explicación constante | Compiten por atención | Ayuda inicial en details, cerrada por defecto; nota decorativa retirada. |
| Balance y saldo pueden confundirse | Lectura incorrecta del dinero disponible | Ayuda distingue ambos y explica el primer uso. |
| Feedback al final de página | Puede pasar inadvertido | Zona visible junto al encabezado, implementada en 0.9. |
| Error de conexión sin acción | Recuperación difícil | Acción de recarga cuando no hay estado confirmado. |

La secuencia visual sigue el orden del documento; no se usa CSS order para diferenciarla del recorrido por teclado. Los filtros preceden a resultados y acciones. Nuevo movimiento permanece como acción principal.

Ya existen etiquetas, validación, bloqueos de doble envío, diálogos nativos, mensajes de negocio y alertas con texto además de color.

## Pendiente para certificar usabilidad

- [ ] Completar primera instalación sin instrucciones externas.
- [ ] Registrar ingreso, gasto, transferencia, aporte y pago desde UI.
- [ ] Comprobar pérdida de conexión y conflicto entre pestañas.
- [ ] Validar menú y formularios a 320 px y al 200 % de zoom.
- [ ] Revisar retorno del foco y alcance del último botón de cada diálogo.
- [ ] Evaluar si la longitud exige separar módulos en pantallas propias.
- [ ] Comprobar contraste y legibilidad visualmente.

La estructura y el feedback mejoran; no se certifica facilidad de uso hasta completar esas pruebas.
