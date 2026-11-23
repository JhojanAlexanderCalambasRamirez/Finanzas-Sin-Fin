# Finanzas Sin Fin

**Tu dinero, más claro.** Aplicación local de finanzas personales en español y pesos colombianos.

Creada por **[Alexander Calambas Ramírez](https://github.com/JhojanAlexanderCalambasRamirez)**.

[Instalación](#instalación) · [Primer uso](#primer-uso) · [Base de datos](#aprovisionamiento-de-la-base-de-datos) · [Pruebas](#pruebas) · [Documentación](#documentación)

## El problema y la propuesta

Registrar gastos en lugares separados dificulta saber cuánto dinero queda en cada cuenta, qué presupuesto se está agotando y cuáles cuotas siguen pendientes. Finanzas Sin Fin reúne esa información en un espacio personal con persistencia, validación y respaldos portables.

Permite registrar movimientos, comparar meses y seguir obligaciones sin depender de un motor de base de datos externo. La aplicación registra información: no se conecta a bancos ni ejecuta operaciones financieras.

## Funcionalidades

| Área | Qué permite |
| --- | --- |
| Dashboard | Ingresos, gastos, balance, comparación mensual y alertas con acceso al detalle. |
| Movimientos | Crear, editar, eliminar, buscar, filtrar y exportar CSV. |
| Cuentas | Efectivo, banco y billetera, saldos iniciales y transferencias. |
| Presupuestos | Límites por categoría y mes, avisos al 80 %, al límite y por exceso. |
| Recurrencias | Reglas semanales/mensuales, vista previa y generación manual sin duplicados. |
| Metas | Objetivos, aportes de seguimiento e historial. |
| Deudas | Total acordado, cuotas, vencimientos y pagos asociados a gastos sin doble conteo. |
| Préstamos | Simulador con tasa efectiva anual, intereses y amortización. |
| Informes | Evolución de seis meses y CSV del listado filtrado. |
| Respaldos | JSON completo, compatibilidad y detección de conflictos. |

**Estado: versión 0.10, en desarrollo.** Funciona como un único espacio personal local. Quedan pruebas visuales completas, certificación de Docker y préstamos reales con desembolso y separación de capital/intereses. Autenticación y multiusuario están pendientes. Consulta [MVP.md](MVP.md).

## Tecnologías

| Capa | Tecnología |
| --- | --- |
| Interfaz | HTML semántico, CSS y JavaScript modular, sin framework. |
| Servidor | Node.js 24 con HTTP nativo. |
| Datos | SQLite integrado en Node, migraciones y transacciones. |
| Entorno | Docker Compose con volumen persistente. |
| Calidad | `node:test`, pruebas unitarias, funcionales y HTTP real. |
| CI | GitHub Actions preparado para Windows, Linux y Docker. |

No requiere dependencias npm de terceros para ejecutarse ni un servidor de base de datos independiente.

## Instalación

### Docker Compose

Requiere Git y Docker con Compose; en Windows/macOS, inicia Docker Desktop.

```sh
git clone https://github.com/JhojanAlexanderCalambasRamirez/Finanzas-Sin-Fin.git
cd Finanzas-Sin-Fin
docker compose up -d --build --wait
```

Abre **http://localhost:3080**. El primer arranque crea automáticamente la base, las tablas, la cuenta principal y las categorías. No debes importar SQL.

En Windows también puedes usar el asistente que muestra puertos ocupados y busca uno libre sin detener otros proyectos:

```powershell
.\scripts\Start-Local.ps1
```

Para fijar un puerto, copia `.env.example` como `.env` y cambia `APP_PORT`. El puerto interno es 3000. Conserva `BIND_ADDRESS=127.0.0.1` para el uso local previsto.

### Node.js

Requiere Node.js 24 o superior. Desde la carpeta clonada:

```sh
npm run db:init
npm start
```

Abre **http://localhost:3000**. `db:init` prepara y comprueba la base antes del arranque; es opcional, porque el servidor también la prepara automáticamente.

## Aprovisionamiento de la base de datos

Es **idempotente**: repetirlo no borra datos, reinicia saldos ni duplica categorías.

1. Crea el directorio de datos si no existe.
2. Abre SQLite y aplica las migraciones pendientes hasta el esquema 7.
3. Crea una cuenta principal con saldo cero y las categorías iniciales.
4. Prepara movimientos, transferencias, recurrencias, presupuestos, metas, aportes, deudas y pagos.
5. Conserva los registros y la revisión al ejecutarse nuevamente sobre una base actualizada.

No incluye datos financieros del autor ni movimientos ficticios. Las pruebas usan bases temporales separadas.

| Entorno | Ubicación |
| --- | --- |
| Node | `data/finanzas.sqlite` dentro del proyecto por defecto. |
| Docker | `/app/data/finanzas.sqlite`, en el volumen Compose `finance-data`. |

Variables de Node: `DATABASE_PATH`, `HOST` y `PORT`. Una ruta personalizada relativa se interpreta desde el directorio de ejecución. Node y Docker tienen bases independientes: usa JSON para trasladar registros.

## Primer uso

1. En **Cuentas**, ajusta nombre, dinero inicial y fecha de la cuenta principal.
2. Registra un ingreso o gasto desde **Nuevo movimiento**.
3. Consulta resumen y movimientos; cambia el periodo para revisar otro mes.
4. Define presupuestos y configura metas o deudas.
5. Exporta un respaldo antes de actualizar o cambiar de equipo.

La lectura principal sigue resumen → movimientos → cuentas → planificación. Categorías y respaldos tienen acceso desde el menú. La ayuda inicial se despliega bajo demanda.

### Cómo interpretar tus números

- **Balance mensual:** ingresos menos gastos; no incluye saldos iniciales ni transferencias.
- **Saldo de cuenta:** saldo inicial más movimientos acumulados al cierre del periodo.
- **Transferencia:** mueve saldo entre cuentas, sin generar ingreso ni gasto.
- **Meta:** sus aportes son seguimiento; no reservan dinero ni crean movimientos.
- **Deuda:** crearla no desembolsa dinero. Cada pago se asocia a un gasto completo.
- **Simulación:** estima financiación sin seguros/comisiones; no crea una deuda automáticamente.

Importes en pesos enteros: `50000` o `50.000`. Las fechas futuras registradas cuentan en su mes. Las recurrencias requieren revisión y confirmación; no son tareas programadas.

## Persistencia y recuperación

```sh
docker compose ps
docker compose logs --tail 100 web
docker compose up -d --build --wait
```

Recrear el contenedor conserva el volumen. **No uses `docker compose down -v` para actualizar:** elimina sus datos.

Para migrar, exporta el JSON completo, instala en el destino, importa y compara saldos y cantidades. CSV sirve para analizar movimientos, no para restaurar toda la aplicación. No copies solamente el archivo SQLite mientras está abierto: puede tener cambios pendientes en WAL.

## Pruebas

```sh
npm run check
npm run test:unit
npm run test:functional
npm test
```

`check` recorre src, tests y scripts: revisa sintaxis, UTF-8, imports e identificadores HTML duplicados. Las pruebas cubren cálculos, entradas inválidas, migraciones, restauración, concurrencia y persistencia. Una prueba levanta HTTP real en loopback; otra comprueba el aprovisionamiento desde cero y su repetición sin alterar datos.

Los resultados y comprobaciones pendientes están en [QA.md](QA.md). El workflow preparado no garantiza por sí solo que CI haya pasado: consulta Actions.

## Arquitectura

La interfaz llama a una API local. El servidor valida y guarda el estado completo en una transacción SQLite. Una revisión evita sobrescribir cambios de otra sesión: un estado desactualizado produce conflicto.

| Carpeta | Responsabilidad |
| --- | --- |
| `src/domain/` | Reglas y cálculos financieros, sin DOM, HTTP ni SQLite. |
| `src/application/` | Servicio financiero y contrato con el repositorio. |
| `src/infrastructure/sqlite/` | Persistencia transaccional, migraciones y aprovisionamiento. |
| `src/server/` | Composición del backend, rutas y protocolo HTTP. |
| `src/web/features/` | Controladores independientes por funcionalidad. |
| `src/web/application/` | Sesión y coordinación de guardado del navegador. |
| `src/web/data/` | Adaptadores HTTP y migración del almacenamiento anterior. |
| `src/web/shared/`, `src/web/styles/` | Utilidades de interfaz, interacciones y estilos. |
| `tests/unit/`, `tests/integration/`, `tests/helpers/` | Pruebas separadas del código de producción. |
| `scripts/`, `docs/`, `.github/` | Operación, documentación y CI. |

Consulta [ARCHITECTURE.md](docs/ARCHITECTURE.md) para las reglas de dependencias y la guía de extensión. El punto de entrada es `src/server/main.js`; los comandos de instalación y arranque se conservan.

## Seguridad y límites

Un único espacio financiero local, sin autenticación. La API valida hosts locales, entradas, referencias, tamaño de solicitud y revisiones. Docker usa un usuario sin privilegios y archivos de aplicación de solo lectura.

No expongas esta versión directamente a Internet. Ofrecerla a terceros requiere identidad, sesiones, aislamiento de datos y HTTPS. Bases, respaldos, `.env` y cachés están excluidos de Git.

## Documentación

- [Guía detallada y compatibilidad](docs/USAGE.md)
- [Evaluación del flujo y usabilidad](docs/UX-REVIEW.md)
- [Ruta de desarrollo](ROADMAP.md)
- [Criterios del MVP](MVP.md)
- [Pruebas y pendientes](QA.md)

## Autor y créditos

**Alexander Calambas Ramírez**, creador y responsable del proyecto.

[GitHub](https://github.com/JhojanAlexanderCalambasRamirez) · [Portafolio](https://portafolio-j4-cr.vercel.app/) · [LinkedIn](https://www.linkedin.com/in/j4cr/)

La documentación toma como referencia la organización de sus README de [MacNTFS](https://github.com/JhojanAlexanderCalambasRamirez/MacNTFS) y [MdConverter](https://github.com/JhojanAlexanderCalambasRamirez/MdConverter): problema, solución, instalación, arquitectura y límites. Esto no implica reutilización de su código.

Desarrollo con asistencia de Codex. Node.js, SQLite y Docker pertenecen a sus respectivos autores y comunidades. La licencia de distribución del proyecto está pendiente; no se hereda automáticamente la de otros repositorios.

## Copiar presupuestos entre meses

En Presupuestos, selecciona el periodo destino y pulsa Copiar mes anterior. La vista previa muestra categorias e importes y requiere confirmacion. Solo copia limites de categorias activas que aun no tienen presupuesto en el destino. No copia gastos ni modifica limites existentes; repetir la operacion no duplica registros.

Verificacion de esta entrega: [docs/VALIDATION.md](docs/VALIDATION.md).
