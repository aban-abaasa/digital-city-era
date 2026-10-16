// Amounts in a store's own currency (the platform is global). Uses the
// currency's own decimals (none for UGX, two for most others).
export function formatMoney(amount, currency = 'UGX') {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code' }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}
