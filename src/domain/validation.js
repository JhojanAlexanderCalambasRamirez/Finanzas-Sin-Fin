export function validText(value, maxLength) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength &&
    !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff\ufffd]/u.test(value)
  );
}
export function validId(value, maxLength = 100) {
  return validText(value, maxLength) && value === value.trim();
}
export function validDate(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '0001-01-01' &&
    !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function parseMoneyInput(value, { signed = false } = {}) {
  if (typeof value !== 'string') throw new Error('Escribe un monto en pesos enteros.');
  const text = value.trim();
  const pattern = signed ? /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)$/ : /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/;
  if (!pattern.test(text))
    throw new Error(
      'Usa pesos enteros: 50000 o 50.000. No se aceptan decimales, letras ni exponentes.',
    );
  const amount = Number(text.replaceAll('.', ''));
  if (
    !Number.isSafeInteger(amount) ||
    Math.abs(amount) > 1000000000000 ||
    (!signed && amount <= 0)
  ) {
    throw new Error(
      signed
        ? 'El saldo inicial debe estar entre -1.000.000.000.000 y 1.000.000.000.000 COP.'
        : 'El monto debe estar entre 1 y 1.000.000.000.000 COP.',
    );
  }
  return amount;
}
