import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FiChevronRight, FiCreditCard } from 'react-icons/fi';
import PortalHeader from '../components/PortalHeader';
import { usePortalAccess } from '../hooks/usePortalAccess';
import useIsPhone from '../hooks/useIsPhone';
import { prefetchPortal } from '../utils/portalPages';

// What each card says under the portal's name.
const BLURB = {
  admin: 'Users, orders, stores and system settings',
  manager: 'Your store, staff, stock and orders',
  cashier: 'The till, receipts and your shift',
  supplier: 'Bids, deliveries and payments',
  customer: 'Shop, order, book and pay'
};

/**
 * The phone home screen for accounts that can enter more than one portal: the
 * shared header (every portal + the Wallet) with a card for each below it.
 * Every one opens as its own full page, and Back returns here.
 * Wider screens have no use for it and go straight to the account's top portal.
 */
export default function PortalHub() {
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const { role, accessiblePortals } = usePortalAccess();

  if (!isPhone && accessiblePortals.length > 0) return <Navigate to={accessiblePortals[0].route} replace />;
  // Access is still loading — keep the header up so the screen doesn't flash.
  if (role && accessiblePortals.length === 1) return <Navigate to={accessiblePortals[0].route} replace />;

  const open = (route) => navigate(route);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <PortalHeader hub showBusiness={false} title="Choose where to go" onWalletClick={() => open('/ican-wallet')} />

      <main className="mx-auto max-w-xl space-y-3 px-4 pb-10 pt-5">
        <p className="font-classic-display text-xl font-semibold text-slate-800 dark:text-slate-100">Where to?</p>

        {accessiblePortals.map((portal) => {
          const Icon = portal.icon;
          return (
            <button
              key={portal.id}
              type="button"
              onClick={() => open(portal.route)}
              onPointerEnter={() => prefetchPortal(portal.id)}
              className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-inset ring-[#c4a052]/25 transition-transform active:scale-[0.99] dark:bg-slate-900 dark:ring-slate-700"
            >
              <span className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br ${portal.color} text-white shadow-md`}>
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-classic-display text-lg font-semibold leading-tight text-slate-800 dark:text-slate-100">{portal.name}</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{portal.subtitle || BLURB[portal.id]}</span>
              </span>
              <FiChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300" />
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => open('/ican-wallet')}
          className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-inset ring-[#c4a052]/25 transition-transform active:scale-[0.99] dark:bg-slate-900 dark:ring-slate-700"
        >
          <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-800 text-white shadow-md">
            <FiCreditCard className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-classic-display text-lg font-semibold leading-tight text-slate-800 dark:text-slate-100">₡ IcanEra Wallet</span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Balance, send, receive and pay</span>
          </span>
          <FiChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300" />
        </button>
      </main>
    </div>
  );
}
