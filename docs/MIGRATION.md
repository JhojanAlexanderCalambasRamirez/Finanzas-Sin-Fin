# Llevar tus datos a otro PC

1. En el PC de origen, abre **Migrar mis datos** y pulsa **Exportar todos mis datos**.
2. Conserva el archivo JSON descargado y llévalo al otro PC.
3. Instala y abre Finanzas Sin Fin en ese PC. La base se crea automáticamente al iniciar.
4. Pulsa **Cargar mis datos** y selecciona el JSON.
5. Revisa la tabla y el saldo resultante y pulsa **Confirmar e importar**.

El archivo contiene cuentas, saldos iniciales, categorías, ingresos, gastos, transferencias, reglas recurrentes y gastos fijos, presupuestos, metas, aportes, deudas y pagos de todos los meses. Los filtros de pantalla no recortan el respaldo.

Si el destino está vacío, se restaura también la configuración de la cuenta principal y las categorías. Si tiene datos, se integran los registros compatibles sin duplicarlos. Un conflicto cancela la importación para evitar sobrescrituras. Antes de confirmar se prepara una descarga del estado anterior.

El archivo lleva los datos financieros; el programa se instala por separado. No requiere configurar red, contraseñas ni certificados. CSV sirve para consultar movimientos, pero para migrar todos los datos debes usar JSON.

Los cambios posteriores son locales a cada PC. Exporta una copia nueva desde el último equipo utilizado para trasladar sus nuevos registros. No hay sincronización automática entre instalaciones.

## Encontrar la copia

Al exportar, los navegadores compatibles muestran Guardar como para elegir carpeta y nombre. La pagina confirma el nombre solo al terminar de escribir. No puede leer la ruta absoluta ni abrir el Explorador. Si no hay selector, se solicita una descarga: abre Ctrl+J y usa Mostrar en carpeta. La carpeta depende de la configuracion del navegador, normalmente Descargas. Cancelar el selector no crea una copia; los errores de escritura no se anuncian como exito. Los respaldos automaticos anteriores a una importacion siguen usando descargas y muestran estas instrucciones. El respaldo continua siendo JSON financiero del perfil activo, no un dump SQLite fisico.
