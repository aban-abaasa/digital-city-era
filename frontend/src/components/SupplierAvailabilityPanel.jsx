import React, { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiChevronDown, FiChevronUp, FiPackage } from 'react-icons/fi';
import { supabase } from '../services/supabase';
import { getActiveSuppliers } from '../services/supplierOrdersService';

// CMMS's own requisitions/supplies view has no way to tell whether a given
// business is actually a registered supplier — it just lists every business
// profile. getActiveSuppliers() already solves exactly that (it cross-checks
// the published supplier_directory against business_profiles restricted to
// supplier-shaped business types), so this panel reuses it instead of
// linking out to CMMS or re-guessing supplier identity from scratch.
const SOURCE_LABEL = {
  business_directory: 'Published supplier',
  cmms_business_profile: 'CMMS business',
};

export default function SupplierAvailabilityPanel({ embedded = true }) {
  const [suppliers, setSuppliers] = useState([]);
  const [itemsBySupplier, setItemsBySupplier] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');

      const result = await getActiveSuppliers();
      if (!active) return;
      if (!result.success) {
        setError(result.error || 'Could not load suppliers');
        setLoading(false);
        return;
      }
      setSuppliers(result.suppliers);

      const supplierIds = [...new Set(result.suppliers.map((s) => s.id).filter(Boolean))];
      if (supplierIds.length) {
        const { data: items, error: itemsError } = await supabase
          .from('supplier_catalog_items')
          .select('id, supplier_user_id, name, category, unit, price_per_unit, is_available')
          .in('supplier_user_id', supplierIds)
          .eq('is_available', true);
        if (!active) return;
        if (itemsError) {
          console.error('Error loading supplier catalog items:', itemsError);
        } else {
          const grouped = {};
          (items || []).forEach((item) => {
            (grouped[item.supplier_user_id] ||= []).push(item);
          });
          setItemsBySupplier(grouped);
        }
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        (s.company_name || '').toLowerCase().includes(q) ||
        (itemsBySupplier[s.id] || []).some((i) => (i.name || '').toLowerCase().includes(q))
    );
  }, [suppliers, itemsBySupplier, search]);

  const cardBg = embedded ? 'bg-white border border-gray-200' : 'bg-gray-900';
  const textMain = embedded ? 'text-gray-900' : 'text-white';
  const textMuted = embedded ? 'text-gray-500' : 'text-gray-400';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className={`font-semibold text-base ${textMain}`}>Supplier Availability</h2>
        <span className={`text-xs ${textMuted}`}>
          {suppliers.length} confirmed supplier{suppliers.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${embedded ? 'bg-gray-100' : 'bg-gray-800'}`}>
        <FiSearch className={textMuted} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers or items…"
          className={`flex-1 bg-transparent text-sm outline-none ${textMain}`}
        />
      </div>

      {loading ? (
        <div className={`rounded-2xl p-6 text-center text-sm ${textMuted} ${cardBg}`}>Loading suppliers…</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-4 text-sm text-rose-400">{error}</div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-2xl p-6 text-center text-sm ${textMuted} ${cardBg}`}>
          No suppliers match yet. A business shows up here once it publishes in the supplier directory or its
          business profile is active with a supplier-type business.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((supplier) => {
            const items = itemsBySupplier[supplier.id] || [];
            const isOpen = expandedId === supplier.id;
            return (
              <div key={supplier.id} className={`overflow-hidden rounded-2xl ${cardBg}`}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : supplier.id)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div>
                    <p className={`text-sm font-medium ${textMain}`}>{supplier.company_name}</p>
                    <p className={`text-xs ${textMuted}`}>{SOURCE_LABEL[supplier.source] || 'Supplier'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        items.length ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {items.length ? `${items.length} available` : 'No items listed'}
                    </span>
                    {isOpen ? <FiChevronUp className={textMuted} /> : <FiChevronDown className={textMuted} />}
                  </div>
                </button>
                {isOpen && items.length > 0 && (
                  <div className={`space-y-2 border-t px-4 pb-4 ${embedded ? 'border-gray-100' : 'border-gray-800'}`}>
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between pt-2 text-sm">
                        <div className="flex items-center gap-2">
                          <FiPackage className={textMuted} />
                          <span className={textMain}>{item.name}</span>
                          {item.category && <span className={`text-xs ${textMuted}`}>· {item.category}</span>}
                        </div>
                        <span className={textMuted}>
                          {item.price_per_unit
                            ? `UGX ${Number(item.price_per_unit).toLocaleString()}/${item.unit || 'unit'}`
                            : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
