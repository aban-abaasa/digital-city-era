import React, { useState } from 'react';

/**
 * Decoy dashboard — where a flagged IP gets rerouted (see the reputation
 * gate in backend/src/middleware/canweShield.js).
 *
 * Hard rule: this component must NEVER import supabase, AuthContext, or any
 * service module that reaches a real API (backendApiService, adminService,
 * cashierService, managerService, etc). Everything on this page is a
 * hardcoded literal. An attacker who got this far should be able to click
 * around, "see" a POS dashboard, "log in", and never once touch real data,
 * a real session, or a real backend call.
 */

const FAKE_SALES = [
  { id: 'TXN-51092', label: 'Checkout — Till 3', amount: 'UGX 84,500', time: '10:42 AM' },
  { id: 'TXN-51087', label: 'Checkout — Till 1', amount: 'UGX 12,300', time: '10:31 AM' },
  { id: 'TXN-51079', label: 'Refund — Till 2', amount: '- UGX 6,000', time: '10:12 AM' },
];

const DecoyPortal = () => {
  const [view, setView] = useState('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleFakeLogin = (e) => {
    e.preventDefault();
    setView('dashboard');
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
          <div>
            <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">Staff Login</h2>
            <p className="mt-2 text-center text-sm text-gray-600">Admin Access Only</p>
          </div>
          <form onSubmit={handleFakeLogin} className="space-y-4">
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Staff ID"
              className="appearance-none rounded relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              autoComplete="off"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="appearance-none rounded relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              autoComplete="off"
            />
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">POS Admin Dashboard</h1>
          <button onClick={() => setView('login')} className="text-sm text-indigo-600 hover:text-indigo-500">
            Sign out
          </button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-gray-500 text-sm">Today's Sales</p>
            <p className="text-2xl font-bold mt-1 text-gray-900">UGX 1,240,800</p>
          </div>
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-gray-500 text-sm">Active Tills</p>
            <p className="text-2xl font-bold mt-1 text-gray-900">4</p>
          </div>
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-gray-500 text-sm">Low Stock Alerts</p>
            <p className="text-2xl font-bold mt-1 text-gray-900">7</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
          </div>
          <ul className="divide-y divide-gray-200">
            {FAKE_SALES.map((txn) => (
              <li key={txn.id} className="px-5 py-4 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900">{txn.label}</p>
                  <p className="text-gray-500">{txn.id} • {txn.time}</p>
                </div>
                <span className={txn.amount.startsWith('-') ? 'text-red-500' : 'text-emerald-600'}>{txn.amount}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DecoyPortal;
