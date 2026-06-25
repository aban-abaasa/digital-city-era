import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { FiSend, FiCheckCircle, FiUser, FiMail, FiPhone, FiBriefcase, FiTruck, FiMapPin, FiFileText } from 'react-icons/fi';

const TYPE_CONFIG = {
  supplier: {
    icon: '🏭',
    label: 'Supplier',
    color: 'from-blue-600 to-indigo-700',
    badge: 'bg-blue-100 text-blue-700',
    description: 'Supply products to this supermarket'
  },
  mybodaguy: {
    icon: '🛵',
    label: 'MyBodaGuy Driver',
    color: 'from-green-600 to-emerald-700',
    badge: 'bg-green-100 text-green-700',
    description: 'Deliver orders to customers'
  },
  manager: {
    icon: '👔',
    label: 'Manager',
    color: 'from-purple-600 to-violet-700',
    badge: 'bg-purple-100 text-purple-700',
    description: 'Manage supermarket operations'
  },
  cashier: {
    icon: '💰',
    label: 'Cashier',
    color: 'from-yellow-500 to-orange-600',
    badge: 'bg-yellow-100 text-yellow-700',
    description: 'Handle POS sales and transactions'
  }
};

const ApplyPage = () => {
  const { supermarketId } = useParams();
  const [searchParams] = useSearchParams();
  const defaultType = searchParams.get('type') || 'supplier';

  const [supermarket, setSupermarket] = useState(null);
  const [applicationType, setApplicationType] = useState(defaultType);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    applicant_name: '',
    applicant_email: '',
    applicant_phone: '',
    business_name: '',
    business_address: '',
    product_categories: '',
    vehicle_type: '',
    license_number: '',
    id_number: '',
    notes: ''
  });

  useEffect(() => {
    if (supermarketId && supermarketId !== 'undefined') {
      supabase.from('supermarkets').select('id, name, location').eq('id', supermarketId).maybeSingle()
        .then(({ data }) => setSupermarket(data));
    }
  }, [supermarketId]);

  const cfg = TYPE_CONFIG[applicationType] || TYPE_CONFIG.supplier;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.applicant_name || !form.applicant_email) {
      setError('Name and email are required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        supermarket_id: supermarketId && supermarketId !== 'undefined' ? supermarketId : null,
        application_type: applicationType,
        applicant_name: form.applicant_name,
        applicant_email: form.applicant_email,
        applicant_phone: form.applicant_phone || null,
        business_name: form.business_name || null,
        business_address: form.business_address || null,
        product_categories: form.product_categories ? [form.product_categories] : [],
        vehicle_type: form.vehicle_type || null,
        license_number: form.license_number || null,
        id_number: form.id_number || null,
        notes: form.notes || null,
        status: 'pending'
      };
      const { error: err } = await supabase.from('user_applications').insert(payload);
      if (err) throw err;
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
          <p className="text-gray-600 mb-4">
            Thank you, <strong>{form.applicant_name}</strong>. Your {cfg.label} application has been received.
          </p>
          {supermarket && (
            <p className="text-sm text-gray-500 mb-6">The admin at <strong>{supermarket.name}</strong> will review your application and contact you at <strong>{form.applicant_email}</strong>.</p>
          )}
          <button onClick={() => { setSubmitted(false); setForm({ applicant_name: '', applicant_email: '', applicant_phone: '', business_name: '', business_address: '', product_categories: '', vehicle_type: '', license_number: '', id_number: '', notes: '' }); }}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium underline">
            Submit another application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className={`bg-gradient-to-r ${cfg.color} rounded-2xl p-6 mb-6 text-white shadow-xl`}>
          <div className="text-4xl mb-2">{cfg.icon}</div>
          <h1 className="text-2xl font-bold mb-1">Apply as {cfg.label}</h1>
          <p className="text-white/80 text-sm">{cfg.description}</p>
          {supermarket && (
            <div className="mt-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 text-sm font-medium">
              🏪 {supermarket.name}{supermarket.location ? ` · ${supermarket.location}` : ''}
            </div>
          )}
        </div>

        {/* Type selector */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(TYPE_CONFIG).map(([type, c]) => (
            <button key={type} onClick={() => setApplicationType(type)}
              className={`rounded-xl py-3 px-2 text-center transition-all border-2 ${applicationType === type ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
              <div className="text-2xl mb-1">{c.icon}</div>
              <p className="text-xs font-semibold text-gray-700">{c.label}</p>
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Your Details</h2>

          {/* Basic fields */}
          {[
            { key: 'applicant_name', label: 'Full Name *', icon: FiUser, placeholder: 'John Doe' },
            { key: 'applicant_email', label: 'Email *', icon: FiMail, placeholder: 'you@example.com', type: 'email' },
            { key: 'applicant_phone', label: 'Phone', icon: FiPhone, placeholder: '+256 700 000 000' }
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <div className="relative">
                <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
              </div>
            </div>
          ))}

          {/* Supplier-specific */}
          {applicationType === 'supplier' && (
            <>
              <div className="border-t pt-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Business Information</h3>
                {[
                  { key: 'business_name', label: 'Business / Company Name', icon: FiBriefcase, placeholder: 'Acme Supplies Ltd' },
                  { key: 'business_address', label: 'Business Address', icon: FiMapPin, placeholder: 'Kampala, Uganda' },
                  { key: 'product_categories', label: 'Product Categories', icon: FiFileText, placeholder: 'e.g. Grains, Beverages, Dairy' }
                ].map(f => (
                  <div key={f.key} className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <div className="relative">
                      <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input type="text" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* MyBodaGuy-specific */}
          {applicationType === 'mybodaguy' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Driver Information</h3>
              {[
                { key: 'vehicle_type', label: 'Vehicle Type', icon: FiTruck, placeholder: 'Motorcycle / Bicycle / Car' },
                { key: 'license_number', label: 'License Plate / Number', icon: FiFileText, placeholder: 'UAA 123B' },
                { key: 'id_number', label: 'National ID / Passport', icon: FiUser, placeholder: 'CM12345678' }
              ].map(f => (
                <div key={f.key} className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <div className="relative">
                    <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input type="text" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Any additional information about yourself or your business…"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm resize-none" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          <button type="submit" disabled={submitting}
            className={`w-full py-3.5 bg-gradient-to-r ${cfg.color} text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60 shadow-lg`}>
            {submitting ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> Submitting…</>
            ) : (
              <><FiSend className="h-5 w-5" /> Submit Application</>
            )}
          </button>

          <p className="text-xs text-center text-gray-400">
            Your application will be reviewed by the supermarket admin. You will be contacted at the email you provide.
          </p>
        </form>
      </div>
    </div>
  );
};

export default ApplyPage;
