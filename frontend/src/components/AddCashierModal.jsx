/**
 * Add Cashier Modal
 * Lets a manager invite a cashier by email. The invited row is pending
 * (is_active=false, no auth_id) until the cashier completes their own
 * signup at /employee-auth with this exact email, and until an admin
 * approves it. The cashier is owned by the inviting manager (manager_id)
 * so their team list and sales stay isolated from other managers' cashiers
 * in the same supermarket.
 */

import React, { useState } from 'react';
import { FiX, FiUserPlus, FiMail, FiPhone, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';

const AddCashierModal = ({ onClose, onSuccess }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error('Full name and email are required');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('register_cashier', {
        p_full_name: fullName.trim(),
        p_email: email.trim(),
        p_phone: phone.trim() || null
      });

      if (error) throw error;

      if (!data?.success) {
        toast.error(data?.error || 'Failed to invite cashier');
        return;
      }

      toast.success(`✅ ${fullName} invited! They must sign up at /employee-auth with ${email} to activate their account.`);
      onSuccess?.();
    } catch (err) {
      console.error('Error inviting cashier:', err);
      toast.error(err.message || 'Failed to invite cashier');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center space-x-2">
            <FiUserPlus className="h-5 w-5" />
            <span>Add Cashier</span>
          </h3>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-2 transition-colors">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cashier@example.com"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Phone (optional)</label>
            <div className="relative">
              <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+256 700 000 000"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            The cashier must sign up at /employee-auth using this exact email to activate their login. An admin still needs to approve the account before they can use the till.
          </p>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Inviting...' : 'Invite Cashier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCashierModal;
