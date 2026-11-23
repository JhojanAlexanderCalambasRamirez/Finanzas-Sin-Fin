// Estimacion de cuota fija. No registra dinero ni modifica obligaciones.
export function simulateLoan({ principal, annualRate, months }) {
  if (!Number.isSafeInteger(principal) || principal < 1 || principal > 1e12
    || typeof annualRate !== 'number' || !Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100
    || !Number.isInteger(months) || months < 1 || months > 360 || months > principal) {
    throw new Error('Revisa el capital, la tasa efectiva anual (0 a 100 %) y el plazo (1 a 360 meses, sin superar el capital en pesos).');
  }
  const rate = Math.expm1(Math.log1p(annualRate / 100) / 12);
  const payment = rate === 0 ? principal / months : principal * rate / -Math.expm1(-months * Math.log1p(rate));
  let balance = principal; const schedule = [];
  for (let month = 1; month <= months; month++) {
    const interest = Math.round(balance * rate);
    const capital = month === months ? balance : Math.min(balance, Math.max(1, Math.round(payment) - interest));
    balance -= capital;
    schedule.push({ month, payment: capital + interest, interest, capital, balance });
    if (balance === 0) break;
  }
  const total = schedule.reduce((sum, row) => sum + row.payment, 0);
  return { monthlyRate: rate, payment: schedule[0].payment, total, interest: total - principal, schedule };
}
