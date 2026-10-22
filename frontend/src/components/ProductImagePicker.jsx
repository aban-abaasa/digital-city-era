/**
 * Product Image Picker
 * Search the photos already uploaded for products (this store's and every
 * other store's) and reuse one, instead of uploading the same picture again.
 *
 * Mounted only while open: it starts on `initialQuery` (the product's name)
 * so a match is usually on screen straight away. `onSelect(url, entry)` gets
 * the chosen photo's URL; `onUploadNew` (optional) adds a "can't find it,
 * upload a new one" way out for when nothing matches.
 */

import React, { useEffect, useRef, useState } from 'react';
import { FiSearch, FiX, FiImage, FiUpload } from 'react-icons/fi';
import { searchProductImages } from '../services/productImageLibrary';

const SEARCH_DELAY_MS = 300;

const PhotoTile = ({ entry, onSelect }) => {
  const [broken, setBroken] = useState(false);
  const label = [entry.name, entry.brand].filter(Boolean).join(' · ') || 'Product photo';

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.url, entry)}
      aria-label={`Use the photo of ${label}`}
      className="group text-left rounded-lg border border-gray-200 bg-white overflow-hidden hover:border-blue-500 hover:ring-2 hover:ring-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
    >
      <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
        {broken ? (
          <FiImage className="h-6 w-6 text-gray-300" />
        ) : (
          <img
            src={entry.url}
            alt={label}
            loading="lazy"
            onError={() => setBroken(true)}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="px-1.5 py-1">
        <p className="text-[11px] sm:text-xs font-medium text-gray-800 truncate">{entry.name || 'Unnamed product'}</p>
        <p className="text-[10px] sm:text-[11px] text-gray-500 truncate">
          {entry.usedBy > 1 ? `Used by ${entry.usedBy} products` : entry.brand || ' '}
        </p>
      </div>
    </button>
  );
};

const ProductImagePicker = ({ onClose, onSelect, onUploadNew, initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const firstSearch = useRef(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // First search runs at once; later ones wait for a pause in typing.
    const delay = firstSearch.current ? 0 : SEARCH_DELAY_MS;
    firstSearch.current = false;

    const timer = setTimeout(async () => {
      try {
        const found = await searchProductImages(query);
        if (cancelled) return;
        setResults(found);
        setError(null);
      } catch (err) {
        console.error('Product photo search failed:', err);
        if (!cancelled) setError('Could not load photos. Check your connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const searching = query.trim().length > 0;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-[1100] sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose an existing product photo"
        className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[88dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-gray-900">Choose an existing photo</h3>
            <p className="text-[11px] sm:text-xs text-gray-500">Same product already photographed? Reuse it instead of uploading again.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 flex-shrink-0"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-3 flex-shrink-0">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus={typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: fine)').matches)}
              placeholder="Search by product name, brand or barcode"
              aria-label="Search product photos"
              // The app's global color-scheme is dark; without these the field renders dark with dark text.
              style={{ colorScheme: 'light' }}
              className="w-full pl-9 pr-3 py-2.5 bg-white text-gray-900 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {error ? (
            <p role="alert" className="text-sm text-red-600 text-center py-8">{error}</p>
          ) : loading && results.length === 0 ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
              <p className="text-sm text-gray-500 mt-2">Searching photos…</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-10">
              <FiImage className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="text-sm font-medium text-gray-700 mt-2">
                {searching ? `No photos found for "${query.trim()}"` : 'No product photos have been uploaded yet'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Try fewer words, or upload a new photo.</p>
            </div>
          ) : (
            <div className={`grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {results.map((entry) => (
                <PhotoTile key={entry.url} entry={entry} onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>

        {onUploadNew && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-[11px] sm:text-xs text-gray-500">Not here? Upload it once and every store can reuse it.</p>
            <button
              type="button"
              onClick={onUploadNew}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-300 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-100 flex-shrink-0"
            >
              <FiUpload className="h-4 w-4" />
              Upload new photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductImagePicker;
