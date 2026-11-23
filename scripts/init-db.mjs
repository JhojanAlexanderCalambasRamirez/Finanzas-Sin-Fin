import { provisionDatabase } from '../src/infrastructure/sqlite/provision.js';
try {
  const result = provisionDatabase();
  console.log(
    `Base preparada. Cuentas: ${result.accounts}; categorias: ${result.categories}; movimientos: ${result.transactions}.`,
  );
} catch (error) {
  console.error(`No se pudo preparar la base: ${error.message}`);
  process.exitCode = 1;
}
