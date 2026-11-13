export const taxIncludedFor = (item, storeDefault = true) => item?.tax_included ?? storeDefault;

export function calculateTaxTotals(items = [], storeDefault = true) {
  return items.reduce((totals, item) => {
    const amount = (Number(item.price ?? item.selling_price) || 0) * (Number(item.quantity) || 0);
    const rate = Math.max(0, Number(item.tax_rate ?? 18)) / 100;
    const included = taxIncludedFor(item, storeDefault);
    const tax = rate > 0 ? (included ? amount - amount / (1 + rate) : amount * rate) : 0;
    totals.subtotal += included ? amount - tax : amount;
    totals.tax += tax;
    totals.total += included ? amount : amount + tax;
    return totals;
  }, { subtotal: 0, tax: 0, total: 0 });
}
