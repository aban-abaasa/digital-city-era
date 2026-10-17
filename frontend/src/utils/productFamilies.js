// Products that share a name but carry different barcodes — "Fanta 500ml", "Fanta 500ml - Orange",
// "Fanta 500ml - Mango" — are one product family: the same item in different flavors. They are
// found automatically from the names, so there is nothing to switch on.

import { barcodesMatch } from './barcodeHelper.js';

const tidy = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

// "Fanta 500ml - Orange" -> "Fanta 500ml". A name with no " - " is its own family name.
export const familyName = (name) => tidy(String(name ?? '').split(/\s+[-–—]\s+/)[0]);

const hasPhoto = (product) => Array.isArray(product.images) && Boolean(product.images[0]);
const hasDifferentBarcodes = (members) =>
  members.some((member, index) => members.slice(index + 1).some((other) => !barcodesMatch(member.barcode, other.barcode)));

// Families with two or more products and at least two different barcodes, A to Z. Inside a
// family the product named exactly like the family comes first, then the rest A to Z.
export const groupProductFamilies = (products) => {
  const groups = new Map();
  (products || []).forEach((product) => {
    const name = familyName(product.name);
    if (!name) return;
    const key = name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { key, name, members: [] });
    groups.get(key).members.push(product);
  });

  return [...groups.values()]
    .filter((group) => group.members.length >= 2 && hasDifferentBarcodes(group.members))
    .map((group) => {
      const members = [...group.members].sort((a, b) => {
        const aBase = tidy(a.name).toLowerCase() === group.key;
        const bBase = tidy(b.name).toLowerCase() === group.key;
        if (aBase !== bBase) return aBase ? -1 : 1;
        return tidy(a.name).localeCompare(tidy(b.name));
      });
      return {
        ...group,
        members,
        units: members.reduce((sum, member) => sum + (Number(member.current_stock) || 0), 0),
        withoutPhoto: members.filter((member) => !hasPhoto(member)).length
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};
