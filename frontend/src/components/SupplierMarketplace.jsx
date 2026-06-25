import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';

// ── shared helpers ─────────────────────────────────────────────────────────────
const fmtUGX = n => n ? 'UGX ' + Number(n).toLocaleString() : '—';
const CATEGORIES = [
  'Fresh Produce', 'Dairy', 'Meat & Poultry', 'Beverages', 'Bakery',
  'Grains & Cereals', 'Snacks', 'Household', 'Personal Care', 'Frozen Foods',
  'Spices & Condiments', 'Electronics', 'Clothing', 'Other',
];
const UNITS = ['kg', 'piece', 'litre', 'box', 'bag', 'crate', 'dozen', 'pack'];

// ─── MY CATALOG TAB ───────────────────────────────────────────────────────────
export function SupplierCatalogTab({ userId }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState({
    name: '', category: '', description: '',
    unit: 'kg', min_order_qty: 1, price_per_unit: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { load(); }, [userId]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('supplier_catalog_items')
      .select('*')
      .eq('supplier_user_id', userId)
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditId(null);
    setForm({ name: '', category: '', description: '', unit: 'kg', min_order_qty: 1, price_per_unit: '' });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      name: item.name, category: item.category, description: item.description || '',
      unit: item.unit || 'kg', min_order_qty: item.min_order_qty || 1,
      price_per_unit: item.price_per_unit || '',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.category) { toast.error('Name and category required'); return; }
    setSaving(true);
    try {
      const payload = {
        supplier_user_id: userId,
        name:             form.name.trim(),
        category:         form.category,
        description:      form.description || null,
        unit:             form.unit,
        min_order_qty:    Number(form.min_order_qty) || 1,
        price_per_unit:   form.price_per_unit ? Number(form.price_per_unit) : null,
        is_available:     true,
      };
      let error;
      if (editId) {
        ({ error } = await supabase.from('supplier_catalog_items').update(payload).eq('id', editId));
      } else {
        ({ error } = await supabase.from('supplier_catalog_items').insert(payload));
      }
      if (error) throw error;
      toast.success(editId ? 'Item updated' : 'Item added to catalog');
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item) => {
    await supabase.from('supplier_catalog_items')
      .update({ is_available: !item.is_available }).eq('id', item.id);
    load();
  };

  const remove = async (id) => {
    await supabase.from('supplier_catalog_items').delete().eq('id', id);
    load();
    toast.success('Item removed');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">My Supply Catalog</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            List everything you can supply. Supermarkets browse this when reviewing your applications.
          </p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-semibold rounded-xl hover:opacity-90">
          + Add Item
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-4">{editId ? 'Edit Item' : 'Add Catalog Item'}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Item name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Fresh Tomatoes"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400">
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Quality, origin, packaging details…"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min order qty</label>
              <input type="number" min="1" value={form.min_order_qty} onChange={e => set('min_order_qty', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Price per unit (UGX, optional)</label>
              <input type="number" min="0" value={form.price_per_unit} onChange={e => set('price_per_unit', e.target.value)}
                placeholder="Leave blank if negotiable"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40">
              {saving ? 'Saving…' : editId ? 'Update Item' : 'Add to Catalog'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-6 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Catalog list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading catalog…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="text-5xl mb-3">📦</div>
          <p className="text-gray-600 font-medium">No items in your catalog yet</p>
          <p className="text-sm text-gray-400 mt-1">Add what you supply so supermarkets can see your offerings</p>
          <button onClick={openNew}
            className="mt-4 px-6 py-2 bg-purple-500 text-white text-sm font-semibold rounded-xl hover:bg-purple-600">
            Add First Item
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div key={item.id}
              className={`bg-white rounded-2xl border p-4 transition-all ${item.is_available ? 'border-gray-100 shadow-sm' : 'border-gray-100 opacity-50'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                  <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{item.category}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-gray-600 p-1">✏️</button>
                  <button onClick={() => remove(item.id)} className="text-gray-400 hover:text-red-500 p-1">🗑️</button>
                </div>
              </div>
              {item.description && <p className="text-xs text-gray-500 mb-2">{item.description}</p>}
              <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                <span>Min: {item.min_order_qty} {item.unit}</span>
                <span>{item.price_per_unit ? fmtUGX(item.price_per_unit) + '/' + item.unit : 'Negotiable'}</span>
              </div>
              <button onClick={() => toggle(item)}
                className={`mt-2 w-full py-1 rounded-lg text-xs font-semibold ${item.is_available
                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                {item.is_available ? '✓ Available' : '✗ Hidden'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── APPLY TO STORES TAB ──────────────────────────────────────────────────────
export function SupplierApplicationsTab({ userId }) {
  const [stores, setStores]   = useState([]);
  const [myApps, setMyApps]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);  // supermarket id being applied to
  const [form, setForm]         = useState({
    business_name: '', contact_name: '', contact_phone: '', contact_email: '',
    product_categories: [], message: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleCat = (cat) => setForm(f => ({
    ...f,
    product_categories: f.product_categories.includes(cat)
      ? f.product_categories.filter(c => c !== cat)
      : [...f.product_categories, cat],
  }));

  useEffect(() => { loadAll(); }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: sm }, { data: apps }] = await Promise.all([
      supabase.from('supermarkets').select('id, name, city, country, is_active').eq('is_active', true),
      supabase.from('supplier_applications').select('*').eq('supplier_user_id', userId),
    ]);
    setStores(sm || []);
    setMyApps(apps || []);
    setLoading(false);
  };

  const appStatus = (smId) => myApps.find(a => a.supermarket_id === smId)?.status || null;

  const openApply = (smId) => {
    setApplying(smId);
    // Pre-fill from existing draft if any
    const existing = myApps.find(a => a.supermarket_id === smId);
    if (existing) {
      setForm({
        business_name:       existing.business_name || '',
        contact_name:        existing.contact_name || '',
        contact_phone:       existing.contact_phone || '',
        contact_email:       existing.contact_email || '',
        product_categories:  existing.product_categories || [],
        message:             existing.message || '',
      });
    }
  };

  const submitApplication = async (smId) => {
    if (!form.business_name || !form.contact_name || !form.contact_phone) {
      toast.error('Business name, contact name and phone are required'); return;
    }
    try {
      const { error } = await supabase.from('supplier_applications').upsert({
        supermarket_id:     smId,
        supplier_user_id:   userId,
        business_name:      form.business_name,
        contact_name:       form.contact_name,
        contact_phone:      form.contact_phone,
        contact_email:      form.contact_email,
        product_categories: form.product_categories,
        message:            form.message,
        status:             'pending',
      }, { onConflict: 'supermarket_id,supplier_user_id' });
      if (error) throw error;
      toast.success('Application submitted! Supermarket will review it.');
      setApplying(null);
      loadAll();
    } catch (e) {
      toast.error(e.message || 'Application failed');
    }
  };

  const STATUS_COLORS = {
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading stores…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Apply to Supermarkets</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Apply to supply any supermarket on the platform. You can apply to multiple at once.
          Approved suppliers earn <strong>5 ICAN</strong> per approval.
        </p>
      </div>

      {/* My applications summary */}
      {myApps.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">My Applications ({myApps.length})</h3>
          <div className="space-y-2">
            {myApps.map(app => {
              const store = stores.find(s => s.id === app.supermarket_id);
              return (
                <div key={app.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{store?.name || 'Unknown Store'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-500'}`}>
                    {app.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Store directory */}
      <div className="grid sm:grid-cols-2 gap-4">
        {stores.length === 0 ? (
          <div className="sm:col-span-2 text-center py-12 text-gray-400">
            No supermarkets registered on the platform yet.
          </div>
        ) : stores.map(store => {
          const status = appStatus(store.id);
          return (
            <div key={store.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{store.name}</p>
                  <p className="text-xs text-gray-400">{store.city}, {store.country}</p>
                </div>
                {status ? (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-500'}`}>
                    {status}
                  </span>
                ) : (
                  <button
                    onClick={() => openApply(store.id)}
                    className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-semibold rounded-lg hover:opacity-90">
                    Apply
                  </button>
                )}
              </div>

              {/* Inline application form */}
              {applying === store.id && (
                <div className="border-t border-gray-100 pt-4 mt-2 space-y-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Application to {store.name}</p>
                  <input placeholder="Business name *" value={form.business_name} onChange={e => set('business_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Contact name *" value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                    <input placeholder="Phone *" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                  </div>
                  <input placeholder="Email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">What do you supply?</p>
                    <div className="flex flex-wrap gap-1">
                      {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => toggleCat(cat)}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            form.product_categories.includes(cat)
                              ? 'bg-purple-500 text-white border-purple-500'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300'}`}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea placeholder="Message to the supermarket (optional)" value={form.message}
                    onChange={e => set('message', e.target.value)} rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => submitApplication(store.id)}
                      className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-semibold rounded-lg hover:opacity-90">
                      Submit Application
                    </button>
                    <button onClick={() => setApplying(null)}
                      className="px-4 py-2 border border-gray-200 text-gray-500 text-sm rounded-lg hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
