// FLAVOR FAMILIES — products that share a name but have different barcodes, listed
// automatically (see utils/productFamilies.js) so the admin can see every flavor of an item
// together, give each its own photo, and add more. A photo per flavor is what lets a customer
// (or cashier) pick the right one at checkout. Styled with the page's own oi-* classes.

import React, { useMemo, useState } from 'react';
import { FiChevronDown, FiChevronRight, FiImage, FiPlus } from 'react-icons/fi';
import { groupProductFamilies } from '../utils/productFamilies';

const photoOf = (product) => (Array.isArray(product.images) ? product.images[0] : null);

const ProductFamiliesPanel = ({ products, isAdmin, formatCurrency, onPickPhoto, uploadingPhotoId, onAddFlavors }) => {
  const families = useMemo(() => groupProductFamilies(products), [products]);
  const [open, setOpen] = useState(false);

  if (families.length === 0) return null;

  const productCount = families.reduce((sum, family) => sum + family.members.length, 0);
  const missingPhotos = families.reduce((sum, family) => sum + family.withoutPhoto, 0);

  return (
    <div className="oi-panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 p-2.5 text-left sm:p-3"
      >
        {open ? <FiChevronDown className="h-4 w-4 flex-shrink-0" /> : <FiChevronRight className="h-4 w-4 flex-shrink-0" />}
        <span className="text-sm font-bold text-gray-800">🍹 Flavor families · {families.length}</span>
        <span className="text-xs text-gray-500">
          {productCount} products share a name{missingPhotos > 0 ? ` · ${missingPhotos} without a photo` : ''}
        </span>
      </button>

      {open && (
        <div className="oi-row-in space-y-3 border-t border-gray-200/60 p-2.5 sm:p-3">
          <p className="text-xs text-gray-500">
            Same name, different barcodes. Give each flavor its own photo so customers pick the right one at checkout.
          </p>
          {families.map((family) => (
            <div key={family.key} className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-800">{family.name}</p>
                  <p className="text-xs text-gray-500">{family.members.length} flavors · {family.units} in stock</p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onAddFlavors(family.members[0])}
                    className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                  >
                    <FiPlus className="h-3.5 w-3.5" /> Add flavor
                  </button>
                )}
              </div>
              <ul className="divide-y divide-gray-100">
                {family.members.map((member) => {
                  const photo = photoOf(member);
                  const uploading = uploadingPhotoId === member.id;
                  return (
                    <li key={member.id} className="flex items-center gap-3 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => isAdmin && onPickPhoto(member.id)}
                        disabled={!isAdmin || uploading}
                        title={photo ? 'Change photo' : 'Add photo'}
                        className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                      >
                        {photo
                          ? <img src={photo} alt={member.name} className="h-full w-full object-cover" />
                          : <span className="flex h-full w-full items-center justify-center text-gray-400"><FiImage className="h-5 w-5" /></span>}
                        {uploading && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          </span>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800">{member.name}</p>
                        <p className="truncate font-mono text-xs text-gray-500">{member.barcode || 'No barcode'}</p>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => onPickPhoto(member.id)}
                            disabled={uploading}
                            className="mt-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-sky-300 dark:hover:text-sky-200"
                          >
                            {uploading ? 'Uploading…' : photo ? 'Change photo' : 'Add photo'}
                          </button>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-bold text-green-700 dark:text-green-400">{formatCurrency(member.selling_price)}</p>
                        <p className="text-xs text-gray-500">{Number(member.current_stock) || 0} in stock</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductFamiliesPanel;
