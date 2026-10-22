/**
 * Product Photo Source
 * What opens when someone taps to add or change a product photo: two choices,
 * browse the photos already uploaded (the same product usually exists in
 * another store) or upload a new one. Browsing opens ProductImagePicker.
 *
 * Same props as ProductImagePicker, so a screen swaps one for the other:
 *   onSelect(url, entry)  a photo was picked from the existing ones
 *   onUploadNew()         "upload new photo" was chosen; the caller opens its
 *                         file input (this runs inside the tap, so the browser allows it)
 *   onClose()             dismissed without choosing
 *   initialQuery          the product's name, so browsing starts on a likely match
 */

import React, { useEffect, useState } from 'react';
import { FiSearch, FiUpload, FiChevronRight } from 'react-icons/fi';
import ProductImagePicker from './ProductImagePicker';

const ProductPhotoSource = ({ onClose, onSelect, onUploadNew, initialQuery = '' }) => {
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => {
    if (browsing) return undefined; // the picker handles its own Escape
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [browsing, onClose]);

  if (browsing) {
    return (
      <ProductImagePicker
        initialQuery={initialQuery}
        onClose={onClose}
        onSelect={onSelect}
        onUploadNew={onUploadNew}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-[1100] sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a product photo"
        className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-2xl p-4 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-900">Add a product photo</h3>

        <button
          type="button"
          onClick={() => setBrowsing(true)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-blue-200 bg-blue-50 text-left hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white flex-shrink-0">
            <FiSearch className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-gray-900">Browse existing photos</span>
            <span className="block text-xs text-gray-600">Reuse a photo already uploaded for this product</span>
          </span>
          <FiChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </button>

        <button
          type="button"
          onClick={onUploadNew}
          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 bg-white text-left hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 flex-shrink-0">
            <FiUpload className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-gray-900">Upload new photo</span>
            <span className="block text-xs text-gray-600">Take a picture or choose a file</span>
          </span>
          <FiChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </button>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ProductPhotoSource;
