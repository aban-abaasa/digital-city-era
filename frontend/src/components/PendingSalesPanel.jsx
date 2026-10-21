/**
 * Sales waiting for payment (IcanEra Mobile / Card) while the cashier serves the next customer.
 * Listed in the POS sidebar: Open one to change how it is paid, Cancel to void it; when a payment lands the sale is
 * recorded on its own and the entry offers its receipt. See hooks/usePendingMobileCardSales.js.
 */

import React, { useEffect, useState } from 'react';
import { isWaiting, pendingSaleLabel, pendingStatusText, saleItemCount } from '../utils/pendingSales';

const PendingSalesPanel = ({ sales, formatUGX, onOpen, onCancel, onReceipt, onDismiss }) => {
  const [now, setNow] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(null);

  // keep the countdowns moving while anything is waiting
  const anyWaiting = sales.some(isWaiting);
  useEffect(() => {
    if (!anyWaiting) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [anyWaiting]);

  if (!sales.length) return null;
  const waiting = sales.filter(isWaiting).length;

  const cancel = async (entry) => {
    setCancelling(entry.id);
    try { await onCancel(entry); } finally { setCancelling(null); }
  };

  return (
    <section className="cashier-pos-pending" aria-label="Sales waiting for payment">
      <div className="cashier-pos-pending-heading">
        <span>⏳ Waiting for payment</span>
        <span className="cashier-pos-pending-count">{waiting}</span>
      </div>
      <ul className="cashier-pos-pending-list">
        {sales.map((entry) => {
          const state = entry.status === 'waiting' || entry.status === 'recording' ? 'waiting' : entry.status;
          return (
            <li key={entry.id} className={`cashier-pos-pending-item is-${state}`} data-status={entry.status}>
              <div className="cashier-pos-pending-main">
                <strong>{pendingSaleLabel(entry)}</strong>
                <span>{formatUGX(entry.charge.amount_ugx)}</span>
              </div>
              <p className="cashier-pos-pending-note">
                {saleItemCount(entry.sale)} item{saleItemCount(entry.sale) === 1 ? '' : 's'} · {pendingStatusText(entry, now)}
              </p>
              <div className="cashier-pos-pending-actions">
                {entry.status === 'waiting' && (
                  <>
                    <button type="button" onClick={() => onOpen(entry)} disabled={cancelling === entry.id}>Open</button>
                    <button type="button" className="is-danger" onClick={() => cancel(entry)} disabled={cancelling === entry.id}>
                      {cancelling === entry.id ? 'Checking...' : 'Cancel'}
                    </button>
                  </>
                )}
                {entry.status === 'paid' && (
                  <>
                    {entry.receipt && <button type="button" onClick={() => onReceipt(entry)}>Receipt</button>}
                    <button type="button" onClick={() => onDismiss(entry)}>Dismiss</button>
                  </>
                )}
                {entry.status === 'ended' && <button type="button" onClick={() => onDismiss(entry)}>Dismiss</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default PendingSalesPanel;
