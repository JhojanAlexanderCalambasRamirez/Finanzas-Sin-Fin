# Finanzas sin fin

Aplicacion local de finanzas personales en espanol, con valores en pesos colombianos. Consulta ROADMAP.md para las etapas de desarrollo.

## Version 0.9: dashboard, feedback y simulacion de prestamos

Los movimientos se guardan en SQLite a traves de una API local. Los navegadores que abran la misma instancia consultan la misma base de datos. No necesitas instalar un motor de base de datos aparte.

La interfaz incluye resumen mensual, creacion, edicion, eliminacion, filtros, gastos por categoria y respaldo JSON. El balance del mes es ingresos menos gastos. La seccion Mis cuentas muestra los saldos acumulados al cierre del mes seleccionado.

### Metas de ahorro

Crea una meta con nombre, objetivo en COP, fecha inicial y fecha objetivo opcional. Registra aportes con fecha y nota. Puedes editar los datos, corregir o eliminar un aporte, y archivar o reactivar una meta sin borrar su historial.

Los aportes son registros de seguimiento: no mueven dinero, no reservan saldo en cuentas y no crean ingresos o gastos. Si moviste dinero entre cuentas reales, registra esa transferencia por separado. El avance de una meta no certifica que exista dinero disponible o reservado para ella.

Las tarjetas muestran el avance acumulado al cierre del mes seleccionado. El historial incluye todas las fechas. No se aceptan aportes anteriores al inicio de la meta. Se puede seguir aportando despues de la fecha objetivo y superar el objetivo; el faltante se muestra como cero. Una meta con fecha objetivo vencida y sin completar se identifica como vencida.

Archivar oculta la accion de nuevo aporte en la tarjeta, conserva el historial y permite corregir registros previos. Esta version no incluye retiros de aportes ni conciliacion automatica con cuentas. Las deudas y sus pagos se gestionan en su propia seccion.

### Deudas y pagos

Registra acreedor, importe total acordado, inicio, primer vencimiento y de 1 a 360 cuotas mensuales. No se calculan intereses: el importe introducido es el total a pagar. Las cuotas distribuyen exactamente los pesos y ajustan el vencimiento al ultimo dia de meses cortos.

Crear una deuda no mueve dinero. Cada pago vincula un gasto existente o crea un gasto y su asociacion juntos. Un gasto completo solo puede pagar una deuda; no se divide entre obligaciones. No se permiten pagos superiores al saldo pendiente, incluidos pagos futuros ya registrados.

Las tarjetas muestran el estado al cierre del mes seleccionado. El historial incluye todos los pagos. Los abonos cubren primero las cuotas antiguas. Desvincular conserva el gasto; eliminar el gasto elimina su asociacion y reabre el saldo. Una edicion del gasto que invalide el pago se rechaza. Archivar conserva el historial.

Limites: 100 deudas y 5000 vinculos de pago. La API usa debts con {id,name,creditor,amount,startDate,firstDueDate,installments,archived} y debtPayments con {id,debtId,transactionId}. Omitir estas colecciones desde un cliente anterior conserva sus valores actuales.

### Informes y CSV

El informe muestra ingresos, gastos y balance de los ultimos seis meses, incluidos meses sin movimientos. Las transferencias no se cuentan como ingresos o gastos.

Exportar CSV incluye todos los resultados de los filtros actuales, aunque ocupen varias paginas. Cada transferencia aparece una sola vez con sus cuentas de origen y destino. El archivo usa UTF-8 con BOM, punto y coma, comillas y proteccion contra formulas. El respaldo para restaurar todos los datos sigue siendo JSON.

### Pruebas y evaluacion

```powershell
npm run test:unit
npm run test:functional
npm test
```

`test:unit` ejecuta validadores, calculos y unidades del cliente con almacenamiento o transporte simulado. `test:functional` ejecuta escenarios de negocio y de integracion con archivos SQLite reales, incluidos migraciones, errores SQL, API y restauracion. El transporte HTTP se simula en esas pruebas: no sustituyen una prueba de red, navegador o Docker. `npm test` ejecuta ambas colecciones mediante el descubrimiento de Node.

### Presupuestos

En Presupuestos del mes, crea un limite para una categoria y un mes. Puedes editar el mes, categoria e importe o quitar el limite sin borrar gastos. Solo se admite un limite por combinacion de mes y categoria.

El consumo suma los gastos registrados en esa categoria durante el mes, de todas las cuentas. Incluye movimientos futuros ya registrados dentro de ese mes. Ingresos, transferencias y saldos iniciales no descuentan presupuesto. El resumen muestra por separado los gastos de categorias que no tienen limite.

Cada tarjeta muestra limite, gasto, disponible, porcentaje y estado: dentro del limite, aviso desde el 80 %, limite alcanzado o exceso. La barra se limita al 100 % visualmente; el importe excedido y el porcentaje real siguen visibles. Son avisos dentro de la aplicacion, no notificaciones externas ni bloqueos para registrar gastos.

Archivar una categoria conserva su presupuesto e historial. Renombrarla actualiza los presupuestos de todos los meses. Los filtros del listado no alteran los presupuestos, que siguen el mes del resumen. Esta version no copia ni renueva limites automaticamente entre meses.

### Formatos y validacion

Los importes se escriben en pesos enteros. Se aceptan `50000` y `50.000`. El saldo inicial tambien admite cero y negativos, por ejemplo `-50.000`. No se aceptan decimales, letras, notacion cientifica, prefijos de moneda ni separadores ambiguos en los formularios. Al salir del campo, un importe valido se muestra con puntos de miles.

El servidor exige numeros JSON enteros, fechas existentes, tipos de cuenta validos y referencias a cuentas y categorias existentes. Las cadenas numericas, booleanos en campos monetarios, tipos JSON incorrectos, texto vacio y controles invisibles se rechazan sin modificar la base de datos.

El listado muestra 25 movimientos por pagina y conserva los subtotales de todos los resultados del filtro. La tabla tiene desplazamiento propio y encabezado fijo. Los dialogos limitan su altura al espacio visible y permiten desplazamiento vertical. El fondo se bloquea mientras un dialogo esta abierto. Las columnas y los formularios se adaptan a pantallas estrechas.

### Movimientos recurrentes

1. Crea una regla de ingreso o gasto con cuenta, categoria, importe, frecuencia semanal o mensual, inicio y fin opcional.
2. Selecciona una fecha de corte y pulsa Revisar pendientes.
3. Revisa fechas, importes y cuentas. Solo Registrar pendientes crea los movimientos.

Guardar una regla no programa tareas de fondo ni modifica saldos. La generacion es manual y requiere revisar la vista previa. Se permiten fechas de corte futuras si deseas registrar movimientos futuros de forma explicita.

Las reglas mensuales mantienen el dia del inicio. Un inicio el 31 genera el ultimo dia de febrero y vuelve al 31 en marzo. El fin es inclusivo. Las reglas pausadas no generan pendientes; al reactivarlas pueden aparecer fechas atrasadas, que se muestran antes de confirmar. Una categoria archivada bloquea la generacion de esa regla y aparece como aviso.

La aplicacion conserva las fechas procesadas por regla. Repetir la generacion no duplica movimientos. Editar o eliminar un movimiento generado no libera su fecha para volver a crearlo. Las reglas se editan y pausan; no se eliminan para conservar ese registro. Cambiar una regla no modifica movimientos ya generados. Las nuevas fechas que resulten del cambio aparecen en la siguiente vista previa.

Reglas, movimientos y fechas procesadas se guardan juntos en una transaccion SQL y se incluyen en los respaldos. La revision compartida impide que dos sesiones confirmen el mismo estado simultaneamente.

### Buscar movimientos y administrar categorias

El listado combina busqueda por palabras, cuenta, categoria y tipo dentro del mes seleccionado. La busqueda ignora mayusculas y tildes y consulta descripcion, categoria y nombres de cuenta. Una transferencia aparece al filtrar cualquiera de sus dos cuentas. Al filtrar una categoria, se muestran ingresos y gastos de esa categoria, sin transferencias.

Los filtros afectan al listado y sus subtotales. Las tarjetas del mes, el grafico de gastos y los saldos de cuentas mantienen los totales del periodo. Limpiar filtros conserva el mes seleccionado.

En Mis categorias puedes crear nombres personalizados, renombrarlos y archivar o reactivar categorias. Los nombres deben ser unicos, sin distinguir mayusculas ni tildes. El renombrado actualiza tambien el nombre de la categoria en todo su historial y se guarda en la misma transaccion SQL.

Una categoria archivada permanece en filtros, informes y respaldos. La interfaz la oculta al crear movimientos nuevos, y permite conservarla al editar un movimiento que ya la usaba. Archivar no borra movimientos ni modifica montos. El archivo es una preferencia de catalogo, no una restriccion de permisos para clientes de la API.

La base de datos se actualiza al esquema 7. Los registros anteriores se conservan y se prepara el almacenamiento de deudas y pagos. No regreses a una version anterior de la aplicacion con esta base ya migrada.

### Usar cuentas y transferencias

1. En Mis cuentas, crea cuentas de efectivo, banco o billetera.
2. Indica el saldo inicial y la fecha en que empiezas a registrar cada cuenta.
3. Selecciona la cuenta al registrar ingresos y gastos.
4. Para mover dinero entre cuentas, elige Transferencia en Nuevo movimiento. Necesitas dos cuentas diferentes.

Las transferencias cambian el saldo de origen y destino por el mismo importe. No alteran los ingresos, los gastos ni el saldo global. Editar o eliminar una transferencia recalcula ambas cuentas. Se permiten saldos negativos; la aplicacion registra movimientos y no ejecuta operaciones bancarias.

El saldo inicial corresponde al inicio de su fecha. Los movimientos de ese dia se aplican despues. No se aceptan movimientos ni transferencias anteriores a la fecha inicial de sus cuentas. Editar el saldo inicial recalcula el historico; usalo para corregir el punto de partida, no para registrar un ingreso nuevo.

Al actualizar desde 0.2, la migracion SQLite asigna todos los movimientos existentes a Cuenta principal, con saldo inicial cero. No cambia sus montos ni fechas. Esa cuenta usa una fecha base anterior a los movimientos; puedes cambiarla si no excluyes registros existentes.

## Iniciar con Docker

Requiere Docker Desktop iniciado y Docker Compose. Desde PowerShell, en esta carpeta:

```powershell
.\scripts\Start-Local.ps1
```

El script muestra los puertos y contenedores, intenta usar 3080 y busca otro puerto si esta ocupado. Si el servicio ya esta iniciado, reutiliza su puerto. No detiene otros proyectos.

Para usar otro puerto inicial:

```powershell
.\scripts\Start-Local.ps1 -Port 4080
```

Tambien puedes configurar Compose directamente:

```powershell
Copy-Item .env.example .env
# Ajusta APP_PORT en .env si hace falta.
docker compose up -d --build --wait
```

Con la configuracion predeterminada, abre http://localhost:3080. La API acepta localhost, 127.0.0.1 y ::1; esta version es para uso personal en esta maquina. Aun no incluye usuarios ni autenticacion y no esta preparada para publicarse en Internet.

## Actualizar y migrar registros anteriores

```powershell
docker compose up -d --build --wait
```

1. Abre la direccion y el navegador donde registrabas tus movimientos.
2. Recarga la pagina. Los registros anteriores siguen en el navegador y no se borran.
3. Si aparece **Migrar registros del navegador**, pulsalo.
4. Revisa la cantidad y confirma. Se prepara una descarga JSON antes de escribir en SQLite; comprueba que el navegador guarde el archivo.
5. Conserva ese respaldo. La copia original del navegador tambien se conserva.

La migracion no se ejecuta automaticamente. Si tus registros estaban en otro puerto o navegador, exporta el JSON desde esa direccion e importalo en la nueva. La copia antigua no se sincroniza con SQLite despues de migrarla. No la uses como fuente actualizada.

## Persistencia y operacion

Compose monta el volumen `finanzas-sin-fin_finance-data` en `/app/data`. Contiene `finanzas.sqlite` y los archivos auxiliares de SQLite. Recrear el servicio conserva ese volumen.

```powershell
docker compose ps
docker compose logs --tail 100 web
docker compose restart web
docker compose down
```

No uses `docker compose down -v` para actualizar: elimina el volumen y sus datos. No borres los volumenes del proyecto sin un respaldo verificado.

La imagen corre como usuario sin privilegios y con archivos de aplicacion de solo lectura. Unicamente el volumen de datos permite escritura. La imagen ejecuta las pruebas antes de construir la etapa final. `/health` comprueba tambien el acceso a SQLite.

## Respaldar y llevar a otra maquina

1. Usa **Exportar respaldo**. Consulta la base de datos y descarga cuentas, categorias, saldos iniciales, movimientos, transferencias, reglas recurrentes, presupuestos, metas, aportes, deudas y pagos de todos los meses en JSON version 7.
2. Copia los archivos del proyecto a la otra maquina.
3. Instala Docker Desktop e inicia con `docker compose up -d --build --wait`.
4. Abre la aplicacion e importa el JSON.
5. Compara cantidad de movimientos y balances antes de retirar la instalacion anterior.

Copiar la imagen o el codigo no copia el volumen Docker. El respaldo JSON es el mecanismo portable de datos de esta version. No copies solo el archivo SQLite mientras este en uso: puede tener cambios pendientes en archivos auxiliares.

Para transferir la imagen sin construirla en el destino:

```powershell
docker image save -o finanzas-sin-fin-image.tar finanzas-sin-fin:local
# Copia el TAR, compose.yaml, .env.example y el respaldo JSON.
docker image load -i finanzas-sin-fin-image.tar
docker compose up -d --no-build --wait
```

Si las maquinas tienen arquitecturas diferentes, construye la imagen desde el codigo en el destino.

Importar conserva los registros actuales. Repetir un respaldo identico no duplica cuentas, categorias, movimientos ni transferencias. Si un identificador coincide pero su contenido cambio, o una categoria del respaldo tiene un estado de archivo diferente, se cancela toda la importacion. Una instalacion nueva permite restaurar tambien los datos de una Cuenta principal editada y el catalogo de categorias. Otro navegador conectado a la misma instancia comparte SQLite; para comparar una copia conflictiva por separado se necesita otra instancia con otro volumen.

Se aceptan respaldos de versiones 1 a 7. La version 7 requiere la aplicacion 0.8 e incluye deudas y pagos. La version 6 requiere la aplicacion 0.7 o posterior e incluye metas y aportes. Importar un respaldo anterior conserva presupuestos, metas y aportes actuales. Los registros identicos con el mismo identificador no se duplican. Los cambios conflictivos o dos limites que compiten por la misma categoria y mes cancelan la importacion completa. Las fechas procesadas de reglas identicas se unen para conservar la deduplicacion. Los movimientos de respaldos version 1 se asignan a Cuenta principal. Antes de actualizar, conserva un respaldo de la version anterior.

## Ejecutar sin Docker

Requiere Node.js 24 o superior. No necesita dependencias externas.

```powershell
npm start
npm test
```

Abre http://localhost:3000. SQLite se crea por defecto en `data/finanzas.sqlite`, dentro del proyecto. Puedes configurar `DATABASE_PATH`, `HOST` y `PORT`. Esta base local y el volumen Docker son instalaciones independientes; usa JSON para trasladar registros entre ambas.

## API y limites actuales

- `GET /api/state`: devuelve cuentas, categorias, movimientos, transferencias, reglas recurrentes, presupuestos, metas (`goals`), aportes (`contributions`), deudas (`debts`), pagos (`debtPayments`) y revision.
- `PUT /api/state`: recibe `{ "revision": "...", "accounts": [...], "categories": [{ "name": "...", "archived": false }], "transactions": [...], "transfers": [...], "recurrences": [...], "budgets": [{ "id": "...", "month": "2026-11", "category": "Vivienda", "amount": 500000 }] }` y guarda todo en una transaccion SQL. Si un cliente anterior omite categories, recurrences o budgets, se conservan sus valores actuales. No se permite borrar reglas existentes ni retirar fechas ya procesadas.
- `/api/transactions` se conserva para clientes anteriores: mantiene las cuentas y transferencias existentes. Los movimientos nuevos de ese endpoint se asignan a Cuenta principal.
- Una revision antigua produce HTTP 409 sin modificar los datos. Recarga antes de reintentar.
- Un fallo de conexion durante un guardado puede dejar una respuesta incierta. La interfaz bloquea nuevos guardados hasta recargar y consultar el estado real.
- Maximo actual: 100 cuentas, 100 categorias, 100 reglas, 5000 movimientos, 5000 transferencias, 5000 fechas procesadas de recurrencias y JSON de 5 MB. La vista previa acepta hasta 500 pendientes; si supera el limite, usa una fecha de corte anterior. Los montos son enteros entre 1 y 1.000.000.000.000 COP. El saldo inicial admite negativos y cero. La magnitud acumulada se limita a enteros seguros de JavaScript.
- Las fechas y descripciones se validan tanto en cliente como en servidor. Se admiten hasta 1000 presupuestos en total, con importes enteros positivos hasta 1.000.000.000.000 COP.
- Se admiten 100 metas y 5000 aportes positivos de hasta 1.000.000.000.000 COP. Cada aporte debe pertenecer a una meta existente y no ser anterior a su inicio. Si un cliente anterior omite goals o contributions, SQLite conserva los valores actuales. En PUT /api/state, goals contiene objetos `{id,name,targetAmount,startDate,targetDate,archived}` y contributions contiene `{id,goalId,amount,date,note}`. Una fecha objetivo ausente se representa con cadena vacia.
- No hay sincronizacion en tiempo real: recarga para ver cambios de otra sesion.

Esta version comparte un unico espacio financiero personal. El acceso por usuario queda para una siguiente etapa. Las cuentas se pueden crear y editar; su eliminacion y archivo quedan pendientes. Consulta QA.md para conocer las pruebas realizadas y las comprobaciones visuales pendientes.

## Preparar GitHub

Consulta GITHUB.md para la descripcion y checklist del repositorio. El workflow preparado ejecutara pruebas en Windows y Linux, construira Docker y consultara su salud HTTP. Su primera ejecucion queda pendiente de conectar el repositorio. No publica ni despliega automaticamente.

## Dashboard y simulador

El resumen incluye balance como porcentaje de ingresos (sin porcentaje si no hubo ingresos), variacion absoluta del gasto frente al mes anterior y deuda pendiente de obligaciones activas al cierre del periodo. Las alertas enlazan a presupuestos, deudas y cuentas. Los filtros del listado no alteran estos indicadores. Las fechas futuras ya registradas cuentan dentro del mes correspondiente.

El simulador convierte una tasa efectiva anual de 0 a 100 % a tasa mensual, admite de 1 a 360 meses y ajusta el redondeo en la ultima cuota. Excluye seguros y comisiones; no guarda deudas ni desembolsos. Al cambiar los parametros se oculta el resultado anterior hasta recalcular. Consulta MVP.md para los criterios de cierre.

## Copiar presupuestos entre meses

En Presupuestos, selecciona el periodo destino y pulsa Copiar mes anterior. La vista previa muestra categorias e importes y requiere confirmacion. Solo copia limites de categorias activas que aun no tienen presupuesto en el destino. No copia gastos ni modifica limites existentes; repetir la operacion no duplica registros.
