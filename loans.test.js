import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateLoan } from './loans.js';

test('prestamo sin interes distribuye pesos y ajusta ultima cuota', () => {
  const result = simulateLoan({ principal: 1000000, annualRate: 0, months: 12 });
  assert.equal(result.total, 1000000); assert.equal(result.interest, 0);
  assert.equal(result.schedule.at(-1).balance, 0);
});
test('tasa efectiva anual se convierte a mensual y capital concilia', () => {
  const result = simulateLoan({ principal: 5000000, annualRate: 24, months: 24 });
  assert.ok(Math.abs((1 + result.monthlyRate) ** 12 - 1.24) < 1e-12);
  assert.equal(result.schedule.reduce((sum, row) => sum + row.capital, 0), 5000000);
  assert.ok(result.interest > 0); assert.equal(result.total, 5000000 + result.interest);
  assert.ok(result.schedule.every(row => Number.isSafeInteger(row.payment) && row.balance >= 0));
});
test('simulador rechaza coercion, tasas y plazos invalidos', () => {
  for (const overrides of [{ principal: '1000' }, { principal: -1 }, { annualRate: NaN }, { annualRate: Infinity }, { annualRate: -1 }, { annualRate: 101 }, { months: 0 }, { months: 361 }, { months: 2.5 }]) {
    assert.throws(() => simulateLoan({ principal: 1000, annualRate: 20, months: 12, ...overrides }));
  }
});
